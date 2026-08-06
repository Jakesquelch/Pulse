import { effect, Injectable, signal } from '@angular/core';
import { Task, TaskGroup } from '../models/task.model';

const STORAGE_KEY = 'jakeos-tasks';

@Injectable({ providedIn: 'root' })
export class TaskService {
  // Only the service can write to this signal (private)
  // The below reads from my saved tasks from localStorage and puts
  // them in the signal.
  private tasksSignal = signal<Task[]>(this.loadTasks());
  // ...components get a read-only view of the signal:
  readonly tasks = this.tasksSignal.asReadonly();

  constructor() {
    // Runs once now, then again every time the tasks signal changes,
    // so every add/delete/edit is saved without each method having to remember to.
    effect(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tasksSignal()));
    });
  }

  private loadTasks(): Task[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      // Corrupted/hand-edited data shouldn't crash the app; start fresh.
      return [];
    }
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
