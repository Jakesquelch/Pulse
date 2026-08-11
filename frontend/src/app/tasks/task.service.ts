import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { persistedSignal } from '../core/persisted-signal';
import { Task, TaskCreate, TaskGroup, TaskUpdate } from './task.model';

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
    // Every task operation now goes through the server, so localStorage is
    // pure dead weight here — a second source of truth that only ever shows
    // up as stale ghosts when this GET fails. Retiring persistedSignal from
    // this service (plain signal([])) is the last step of the migration.
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

  // Reads the current value to know what to flip to. If the id isn't in the
  // signal there's nothing to toggle and the server would 404 anyway, so we
  // stop here rather than send a request we know is wrong.
  toggleComplete(id: string) {
    const task = this.tasks().find((task) => task.id === id);
    if (!task) return;
    this.patchTask(id, { completed: !task.completed });
  }

  updateTitle(id: string, title: string) {
    this.patchTask(id, { title });
  }

  // Shared by every partial update: PATCH sends just the changed fields, and
  // the server responds with the whole updated task, which replaces our copy.
  // Taking the server's version rather than merging locally means the two can
  // never quietly disagree about what a task now looks like.
  private patchTask(id: string, changes: TaskUpdate) {
    this.http.patch<Task>(`${API_URL}/${id}`, changes).subscribe((updatedTask) => {
      this.tasksSignal.update((tasks) =>
        tasks.map((task) => (task.id === id ? updatedTask : task))
      );
    });
  }
}
