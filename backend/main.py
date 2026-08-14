import uuid
from datetime import date
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import storage

app = FastAPI()

# Data now lives in a SQLite file rather than a list in memory, so it survives
# a restart. Creating the tables at startup means a fresh clone (or a deleted
# pulse.db) just works — CREATE TABLE IF NOT EXISTS makes it a no-op otherwise.
storage.init_db()

# Browsers block localhost:4200 (Angular) from reading responses off
# localhost:8000 (this server) unless we consent — that's CORS. Allow exactly
# our frontend origin, nothing wider.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Tasks ------------------------------------------------------------------
#
# Three models for one resource, because "a task" means something different at
# each end of a request: what the client may send to create one, what it may
# send to change one, and what the server hands back. Collapsing them into a
# single model is how servers end up letting clients set their own ids.
#
# Each one mirrors a type in frontend/src/app/tasks/task.model.ts — that
# pairing is the contract, and CLAUDE.md's rule about not loosening it lives
# right here.

# A whole task as the API hands it back — the mirror of the frontend's `Task`
# interface. Declaring it as each endpoint's response_model means FastAPI
# validates what we send *out*, not just what comes in, and publishes the shape
# in /docs. `group` is the only optional field, and the endpoints below pair
# this with response_model_exclude_none so it's omitted rather than sent as
# null — the frontend's `group?: TaskGroup` allows absent, not null.
class Task(BaseModel):
    id: str
    title: str
    completed: bool
    priority: Literal["low", "medium", "high"]
    group: Literal["fun", "personal", "work"] | None = None

# What the client may send to create a task. `id` and `completed` are absent
# on purpose: the server generates one and knows the other is False, and a
# field that isn't modelled is a field Pydantic silently drops — so a client
# trying to set either is ignored rather than obeyed. `priority` has a default
# because "medium" is a sane assumption; `title` has none, so omitting it is
# a 422 rather than a task called "".
class TaskCreate(BaseModel):
    title: str
    priority: Literal["low", "medium", "high"] = "medium"
    group: Literal["fun", "personal", "work"] | None = None

# Every field optional because PATCH means "change what I send, leave the
# rest" — a client toggling `completed` shouldn't have to resend the title.
# `id` is absent on purpose: the server owns it, and it's already in the URL.
class TaskUpdate(BaseModel):
    title: str | None = None
    completed: bool | None = None
    priority: Literal["low", "medium", "high"] | None = None
    group: Literal["fun", "personal", "work"] | None = None

@app.get("/tasks", response_model=list[Task], response_model_exclude_none=True)
def get_tasks():
    return storage.list_tasks()

@app.post("/tasks", response_model=Task, response_model_exclude_none=True)
def create_task(task: TaskCreate):
    # A plain model_dump (not exclude_none) so `group` is present as None when
    # the client omitted it — the INSERT wants a value for every column, and
    # None is what SQLite stores as NULL.
    new_task = {
        "id": str(uuid.uuid4()),
        "completed": False,
        **task.model_dump(),
    }
    storage.create_task(new_task)
    return new_task

# The id lives in the URL path, not the body: the URL names *which* task and
# the method says what to do to it. FastAPI matches the {task_id} placeholder
# to the same-named argument below.
#
# 204 means "done, and there's deliberately no body to send you" — a deleted
# task has nothing left worth returning. Returning None is required to match.
@app.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: str):
    deleted = storage.delete_task(task_id)
    # Deleting an id we've never heard of is the client's mistake, not a
    # server failure — raising HTTPException gets that across as a 404 instead
    # of us silently pretending it worked.
    if not deleted:
        raise HTTPException(status_code=404, detail=f"No task with id {task_id}")

# PATCH, not PUT: the client sends only the fields it wants changed, so
# toggling `completed` can't accidentally clobber a title it never sent.
# Returns the full updated task so the client can trust the server's version
# rather than guessing what the change produced.
@app.patch("/tasks/{task_id}", response_model=Task, response_model_exclude_none=True)
def update_task(task_id: str, updates: TaskUpdate):
    # exclude_unset (not exclude_none) is what makes this a real PATCH: it
    # keeps only the fields the client actually sent, so the ones it stayed
    # silent about aren't overwritten with the model's None defaults.
    #
    # An explicit `"group": null` means "remove the grouping", and survives
    # exclude_unset as intended — it's stored as NULL, and
    # response_model_exclude_none drops it on the way out, so the client sees
    # an absent key rather than a null.
    requested_changes = updates.model_dump(exclude_unset=True)
    updated_task = storage.update_task(task_id, requested_changes)

    # Same as above for delete_task, if we can't find the task_id throw a 404.
    # storage returns None for an id that isn't in the table.
    if updated_task is None:
        raise HTTPException(status_code=404, detail=f"No task with id {task_id}")

    return updated_task


# --- Habits -----------------------------------------------------------------

# `completedDates` is camelCase in a Python file on purpose. Pydantic field
# names *are* the JSON keys, and this model's job is to mirror the frontend's
# `Habit` interface exactly — same reasoning as the quoted "group" column in
# storage.py. A snake_case name here would need an alias to produce the same
# JSON, which is a translation layer earning nothing.
class Habit(BaseModel):
    id: str
    name: str
    completedDates: list[str]

# The client sends a name and nothing else: the server owns the id, and a new
# habit has no completions by definition — there's no "created already done".
class HabitCreate(BaseModel):
    name: str

@app.get("/habits", response_model=list[Habit])
def get_habits():
    return storage.list_habits()

@app.post("/habits", response_model=Habit)
def create_habit(habit: HabitCreate):
    new_habit = {
        "id": str(uuid.uuid4()),
        "completedDates": [],
        **habit.model_dump(),
    }
    storage.create_habit(new_habit)
    return new_habit

# 204 like the task delete: a deleted habit has nothing left to return. Its
# completion rows go with it, via ON DELETE CASCADE in the schema.
@app.delete("/habits/{habit_id}", status_code=204)
def delete_habit(habit_id: str):
    if not storage.delete_habit(habit_id):
        raise HTTPException(status_code=404, detail=f"No habit with id {habit_id}")

# A completion is its own resource, and its URL names it fully: this habit,
# this date. That's what lets the two verbs below carry no request body at all.
#
# PUT rather than POST because PUT means "make this URL exist", which is
# idempotent — ticking an already-ticked day is a no-op, not a duplicate.
#
# `completion_date: date` is doing validation for free: FastAPI parses the path
# segment into a real date, so "banana" is rejected with a 422 before any of
# our code runs. The frontend's `completedDates: string[]` comment promises
# YYYY-MM-DD; this is the backend holding it to that promise.
COMPLETION_URL = "/habits/{habit_id}/completions/{completion_date}"

# Unlike DELETE /tasks, both of these answer with the whole updated habit. The
# habit still exists and is still on screen, so handing back the server's
# version keeps the client from having to guess what its list looks like now —
# the same reasoning as PATCH /tasks returning the updated task.
@app.put(COMPLETION_URL, response_model=Habit)
def add_completion(habit_id: str, completion_date: date):
    habit = storage.add_completion(habit_id, completion_date.isoformat())
    if habit is None:
        raise HTTPException(status_code=404, detail=f"No habit with id {habit_id}")
    return habit

@app.delete(COMPLETION_URL, response_model=Habit)
def remove_completion(habit_id: str, completion_date: date):
    habit = storage.remove_completion(habit_id, completion_date.isoformat())
    if habit is None:
        raise HTTPException(status_code=404, detail=f"No habit with id {habit_id}")
    return habit