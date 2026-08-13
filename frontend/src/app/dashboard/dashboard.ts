import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TaskService } from '../tasks/task.service';
import { JournalService } from '../journal/journal.service';
import { HabitService } from '../habits/habit.service';
import { toLocalDate } from '../core/util/date';
import { ServerErrorBanner } from '../core/server-error-banner';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ServerErrorBanner],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  private taskService = inject(TaskService);
  private journalService = inject(JournalService);
  private habitService = inject(HabitService);

  captureText = '';
  today = new Date();
  greeting = this.buildGreeting();

  private buildGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning, Jake.';
    if (hour < 18) return 'Good Afternoon, Jake.';
    return 'Good Evening, Jake.';
  }

  // --- Tasks ---
  // The dashboard reads the same TaskService as the To-Do page, so it inherits
  // the same two failure states — and has to be just as careful with them. Its
  // task tiles would otherwise render "0 of 0 done" and a 0% meter when the
  // server is unreachable, which looks like data rather than an outage.
  taskLoadState = this.taskService.loadState;
  taskActionError = this.taskService.actionError;
  private tasksUnavailable = computed(() => this.taskLoadState() === 'failed');

  taskTotal = computed(() => this.taskService.tasks().length);
  taskDone = computed(() => this.taskService.tasks().filter((t) => t.completed).length);
  taskPct = computed(() =>
    this.taskTotal() === 0 ? 0 : Math.round((this.taskDone() / this.taskTotal()) * 100)
  );
  // A named computed rather than a conditional in the template: the tile shows
  // one line of text, and which line it is depends on whether we could reach
  // the server at all.
  taskSummary = computed(() =>
    this.tasksUnavailable() ? 'Unavailable' : `${this.taskDone()} of ${this.taskTotal()} done`
  );
  upNext = computed(() => {
    const priorities = { high: 3, medium: 2, low: 1 };
    return this.taskService
      .tasks()
      .filter((t) => !t.completed)
      .sort((a, b) => priorities[b.priority] - priorities[a.priority])
      .slice(0, 3);
  });

  // --- Journal ---
  entryCount = computed(() => this.journalService.entries().length);
  lastEntry = computed(() => {
    const entries = this.journalService.entries();
    return entries.length ? entries[entries.length - 1] : null;
  });

  // --- Habits ---
  habits = this.habitService.habits;
  habitsDoneToday = computed(() => {
    const today = toLocalDate(new Date());
    return this.habitService.habits().filter((h) => h.completedDates.includes(today)).length;
  });

  isDoneToday(completedDates: string[]): boolean {
    return completedDates.includes(toLocalDate(new Date()));
  }

  capture() {
    if (!this.captureText.trim()) return;
    this.taskService.addTask(this.captureText, 'medium');
    this.captureText = '';
  }

  retryLoad() {
    this.taskService.loadTasks();
  }
}
