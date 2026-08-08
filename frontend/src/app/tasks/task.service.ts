import { Injectable } from '@angular/core';
import { persistedSignal } from '../core/persisted-signal';
import { Task, TaskGroup } from './task.model';

const STORAGE_KEY = 'jakeos-tasks';

@Injectable({ providedIn: 'root' })
export class TaskService {
  // Loaded from and auto-saved to storage by the seam; only the service can
  // write to this signal (private)...
  private tasksSignal = persistedSignal<Task[]>(STORAGE_KEY, []);
  // ...components get a read-only view of the signal:
  readonly tasks = this.tasksSignal.asReadonly();

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
