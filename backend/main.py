from fastapi import FastAPI

app = FastAPI()

tasks = [
    {"id": "1", "title": "Try out FastAPI", "completed": False, "priority": "high"},
    {"id": "2", "title": "Wire up Angular later", "completed": False, "priority": "medium", "group": "work"},
]

@app.get("/tasks")
def get_tasks():
    return tasks