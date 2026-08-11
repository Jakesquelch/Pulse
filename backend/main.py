import uuid
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

# Browsers block localhost:4200 (Angular) from reading responses off
# localhost:8000 (this server) unless we consent — that's CORS. Allow exactly
# our frontend origin, nothing wider.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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

tasks = [
    {"id": "1", "title": "Try out FastAPI", "completed": False, "priority": "high"},
    {"id": "2", "title": "Wire up Angular later", "completed": False, "priority": "medium", "group": "work"},
]

@app.get("/tasks", response_model=list[Task], response_model_exclude_none=True)
def get_tasks():
    return tasks

@app.post("/tasks", response_model=Task, response_model_exclude_none=True)
def create_task(task: TaskCreate):
    new_task = {
        "id": str(uuid.uuid4()),
        "completed": False,
        **task.model_dump(exclude_none=True),
    }
    tasks.append(new_task)
    return new_task

# The id lives in the URL path, not the body: the URL names *which* task and
# the method says what to do to it. FastAPI matches the {task_id} placeholder
# to the same-named argument below.
#
# 204 means "done, and there's deliberately no body to send you" — a deleted
# task has nothing left worth returning. Returning None is required to match.
@app.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: str):
    task_to_delete = next((task for task in tasks if task["id"] == task_id), None)
    # Deleting an id we've never heard of is the client's mistake, not a
    # server failure — raising HTTPException gets that across as a 404 instead
    # of us silently pretending it worked.
    if task_to_delete is None:
        raise HTTPException(status_code=404, detail=f"No task with id {task_id}")
    tasks.remove(task_to_delete)

# PATCH, not PUT: the client sends only the fields it wants changed, so
# toggling `completed` can't accidentally clobber a title it never sent.
# Returns the full updated task so the client can trust the server's version
# rather than guessing what the change produced.
@app.patch("/tasks/{task_id}", response_model=Task, response_model_exclude_none=True)
def update_task(task_id: str, updates: TaskUpdate):
    task_to_update = next((task for task in tasks if task["id"] == task_id), None)
    # Same as above for delete_task, if we can't find the task_id throw a 404
    if task_to_update is None:
        raise HTTPException(status_code=404, detail=f"No task with id {task_id}")

    # exclude_unset (not exclude_none) is what makes this a real PATCH: it
    # keeps only the fields the client actually sent, so the ones it stayed
    # silent about aren't overwritten with the model's None defaults.
    requested_changes = updates.model_dump(exclude_unset=True)
    task_to_update.update(requested_changes)

    # An explicit `"group": null` means "remove the grouping". Storing it as
    # None is fine now — response_model_exclude_none drops it on the way out,
    # so the client still sees an absent key rather than a null.
    return task_to_update