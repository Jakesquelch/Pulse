import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { persistedSignal } from '../core/persisted-signal';
import { Task, TaskCreate, TaskGroup } from './task.model';

const STORAGE_KEY = 'pulse-tasks';
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
    // is replaced once this response arrives. If the request fails we keep the
    // localStorage snapshot, so a dead backend looks like stale-but-normal data
    // rather than an empty list.
    //
    // toggle/updateTitle still only touch the signal, so their changes are
    // overwritten by this GET on the next load — the remaining mid-migration
    // gap, closed once PATCH /tasks/{task_id} exists.
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

  // The id goes in the URL, not a body — the server's route is /tasks/{task_id}.
  // <void> because the server answers 204 No Content: the delete succeeded and
  // there's deliberately nothing to send back, so we drop the task ourselves
  // rather than waiting for it in the response.
  deleteTask(id: string) {
    this.http.delete<void>(`${API_URL}/${id}`).subscribe(() => {
      this.tasksSignal.update((tasks) => tasks.filter((task) => task.id !== id));
    });
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
