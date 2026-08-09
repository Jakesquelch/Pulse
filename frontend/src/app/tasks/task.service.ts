import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { persistedSignal } from '../core/persisted-signal';
import { Task, TaskGroup } from './task.model';

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

  // '' comes from the form's "No group" option and is stored as undefined.
  addTask(title: string, priority: Task['priority'], group?: TaskGroup | '') {
    const newTask: Task = {
      id: crypto.randomUUID(),
      title,
      completed: false,
      priority,
      group: group || undefined,
    };
    this.tasksSignal.update((tasks) => [...tasks, newTask]);
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
