import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { LoadState } from '../core/load-state';
import { environment } from '../../environments/environment';
import { Task, TaskCreate, TaskGroup, TaskUpdate } from './task.model';

const API_URL = `${environment.apiUrl}/tasks`;

// Each message says what didn't happen *and* what's still true, so the user
// knows the state of the world without having to guess. Named up here rather
// than inline so the failure paths read as one set you can compare.
const ADD_FAILED = "Couldn't add that task — it hasn't been saved.";
const UPDATE_FAILED = "Couldn't save that change — the task is as it was.";
const DELETE_FAILED = "Couldn't delete that task — it's still there.";

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

  // Two separate failure signals, because they mean different things. A failed
  // GET means the task list is unknown, so showing it at all would be a lie.
  // A failed write means the list is still accurate and one action didn't
  // land — blanking the list there would be a worse lie than the one we're
  // fixing. Starts as 'loading': at page load we genuinely don't know yet.
  private loadStateSignal = signal<LoadState>('loading');
  readonly loadState = this.loadStateSignal.asReadonly();

  private actionErrorSignal = signal<string | null>(null);
  readonly actionError = this.actionErrorSignal.asReadonly();

  constructor() {
    this.loadTasks();
  }

  // Public so the UI can offer a retry — without it, a user whose backend was
  // briefly down has to reload the whole page to recover.
  loadTasks() {
    this.loadStateSignal.set('loading');
    // The observer object form of subscribe: the bare-function form only ever
    // takes the success path, which is why every failure used to be silent.
    this.http.get<Task[]>(API_URL).subscribe({
      next: (tasks) => {
        this.tasksSignal.set(tasks);
        this.loadStateSignal.set('ready');
      },
      // The error object is deliberately ignored: an HttpErrorResponse's
      // message is written for developers ("Http failure response for..."),
      // not for the person looking at the screen.
      error: () => this.loadStateSignal.set('failed'),
    });
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
    this.actionErrorSignal.set(null);
    this.http.post<Task>(API_URL, requestBody).subscribe({
      next: (createdTask) => {
        this.tasksSignal.update((tasks) => [...tasks, createdTask]);
      },
      error: () => this.actionErrorSignal.set(ADD_FAILED),
    });
  }

  // The id goes in the URL, not a body — the server's route is /tasks/{task_id}.
  // <void> because the server answers 204 No Content: the delete succeeded and
  // there's deliberately nothing to send back, so we drop the task ourselves
  // rather than waiting for it in the response.
  deleteTask(id: string) {
    this.actionErrorSignal.set(null);
    this.http.delete<void>(`${API_URL}/${id}`).subscribe({
      next: () => {
        this.tasksSignal.update((tasks) => tasks.filter((task) => task.id !== id));
      },
      error: () => this.actionErrorSignal.set(DELETE_FAILED),
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
    this.actionErrorSignal.set(null);
    this.http.patch<Task>(`${API_URL}/${id}`, changes).subscribe({
      next: (updatedTask) => {
        this.tasksSignal.update((tasks) =>
          tasks.map((task) => (task.id === id ? updatedTask : task))
        );
      },
      error: () => this.actionErrorSignal.set(UPDATE_FAILED),
    });
  }
}
