import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { persistedSignal } from '../core/persisted-signal';
import { Task, TaskCreate, TaskGroup } from './task.model';

const STORAGE_KEY = 'jakeos-tasks';
const API_URL = 'http://localhost:8000/tasks';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private http = inject(HttpClient);
  // Loaded from and auto-saved to storage by the seam; only the service can
  // write to this signal (private)...
  private tasksSignal = persistedSignal<Task[]>(STORAGE_KEY, []);
  // ...components get a read-only view of the signal:
  readonly tasks = this.tasksSignal.asReadonly();

  constructor() {
    // The server is the source of truth for reads: whatever localStorage had
    // is replaced once this response arrives. Writes (add/delete/toggle) still
    // only go to localStorage until POST /tasks is wired up, so tasks added in
    // the UI don't survive a refresh — known mid-migration gap.
    this.http
      .get<Task[]>(API_URL)
      .subscribe((tasks) => this.tasksSignal.set(tasks));
  }

  // '' comes from the form's "No group" option; `group || undefined` makes
  // JSON.stringify drop the key entirely, matching the backend's omit-style
  // contract. The server owns id generation and `completed` — the signal only
  // gets the task once the server has accepted it (pessimistic update).
  addTask(title: string, priority: Task['priority'], group?: TaskGroup | '') {
    const requestBody: TaskCreate = {
      title,
      priority,
      group: group || undefined,
    };
    this.http.post<Task>(API_URL, requestBody).subscribe((createdTask) => {
      this.tasksSignal.update((tasks) => [...tasks, createdTask]);
    });
  }

  deleteTask(id: string) {
    this.tasksSignal.update((tasks) => tasks.filter((task) => task.id !== id));
  }

  toggleComplete(id: string) {
    this.tasksSignal.update((tasks) =>
      tasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  }

  updateTitle(id: string, title: string) {
    this.tasksSignal.update((tasks) =>
      tasks.map((task) => (task.id === id ? { ...task, title } : task))
    );
  }
}
