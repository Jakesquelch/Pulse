import uuid
from typing import Literal

from fastapi import FastAPI
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