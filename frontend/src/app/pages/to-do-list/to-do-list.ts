import { Component, computed, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Task, TaskGroup } from '../../models/task.model';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { TaskService } from '../../services/task.service';

@Component({
  selector: 'app-to-do-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TitleCasePipe],
  templateUrl: './to-do-list.html',
  styleUrl: './to-do-list.css',
})
export class ToDoList {
  private taskService = inject(TaskService);

  newTaskTitle = '';
  newTaskGroup: TaskGroup | '' = '';
  newTaskPriority: 'low' | 'medium' | 'high' = 'medium';
  editingTaskId: string | null = null;
  editTaskTitle = '';

  doneCount = computed(() => this.taskService.tasks().filter((t) => t.completed).length);
  openCount = computed(() => this.taskService.tasks().length - this.doneCount());

  // Recomputes only when the service's tasks signal changes.
  sortedTasks = computed(() => {
    const priorities = { high: 3, medium: 2, low: 1 };
    return [...this.taskService.tasks()].sort(
      (a, b) => priorities[b.priority] - priorities[a.priority]
    );
  });

  addTask() {
    if (!this.newTaskTitle.trim()) return;
    this.taskService.addTask(this.newTaskTitle, this.newTaskPriority, this.newTaskGroup);
    this.newTaskTitle = '';
    this.newTaskGroup = '';
    this.newTaskPriority = 'medium';
  }

  deleteTask(id: string) {
    this.taskService.deleteTask(id);
  }

  toggleComplete(task: Task) {
    this.taskService.toggleComplete(task.id);
  }

  editTask(task: Task) {
    this.editingTaskId = task.id;
    this.editTaskTitle = task.title;
  }

  saveTask(task: Task) {
    if (!this.editTaskTitle.trim()) return;
    this.taskService.updateTitle(task.id, this.editTaskTitle);
    this.editingTaskId = null;
  }

  cancelEdit() {
    this.editingTaskId = null;
  }
}
