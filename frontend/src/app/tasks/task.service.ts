import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Task, TaskCreate, TaskGroup, TaskUpdate } from './task.model';

const API_URL = 'http://localhost:8000/tasks';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private http = inject(HttpClient);
  // An in-memory cache of what the server last told us, nothing more. It
  // starts empty on every page load because the server — not this signal, and
  // no longer localStorage — is the only thing that knows what tasks exist.
  // Only the service can write to it (private)...
  private tasksSignal = signal<Task[]>([]);
  // ...components get a read-only view of the signal:
  readonly tasks = this.tasksSignal.asReadonly();

  constructor() {
    // Fills the empty signal on startup. If this fails the list stays empty,
    // which is honest-but-unhelpful: better than the old behaviour of showing
    // a stale localStorage snapshot as though it were live data. Surfacing the
    // failure to the user needs an error callback here — still to come.
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
