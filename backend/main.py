import uuid
from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

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