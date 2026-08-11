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

class TaskCreate(BaseModel):
    title: str
    priority: Literal["low", "medium", "high"] = "medium"
    group: Literal["fun", "personal", "work"] | None = None

tasks = [
    {"id": "1", "title": "Try out FastAPI", "completed": False, "priority": "high"},
    {"id": "2", "title": "Wire up Angular later", "completed": False, "priority": "medium", "group": "work"},
]

@app.get("/tasks")
def get_tasks():
    return tasks

@app.post("/tasks")
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