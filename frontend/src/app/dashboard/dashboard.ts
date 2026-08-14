import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TaskService } from '../tasks/task.service';
import { JournalService } from '../journal/journal.service';
import { HabitService } from '../habits/habit.service';
import { toLocalDate } from '../core/util/date';
import { ServerErrorBanner } from '../core/server-error-banner';
import { environment } from '../../environments/environment';

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
  // Shown in the "couldn't reach the server" message below, from the same
  // source the services call — so the address quoted is always the real one.
  readonly apiUrl = environment.apiUrl;

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
  // Third feature, same trap as the two above: "0 entries / nothing written
  // yet" is a claim about an empty journal, not about an unreachable server.
  private journalUnavailable = computed(() => this.journalService.loadState() === 'failed');

  entryCount = computed(() => this.journalService.entries().length);
  journalSummary = computed(() =>
    this.journalUnavailable()
      ? 'Unavailable'
      : `${this.entryCount()} ${this.entryCount() === 1 ? 'entry' : 'entries'}`
  );
  // The service returns entries oldest-first, so the last one is the newest.
  lastEntry = computed(() => {
    const entries = this.journalService.entries();
    return entries.length ? entries[entries.length - 1] : null;
  });
  // Three states, not two: the most recent entry's date, "nothing written
  // yet", or nothing at all when we couldn't ask.
  journalHint = computed(() => {
    if (this.journalUnavailable()) return null;
    return this.lastEntry() ? null : 'nothing written yet';
  });

  // --- Habits ---
  // Now that habits come from the server too, this tile has exactly the same
  // trap as the task tiles above: "0 of 0" reads as a real answer when it's
  // really "we couldn't ask". Same fix, same shape.
  habits = this.habitService.habits;
  private habitsUnavailable = computed(() => this.habitService.loadState() === 'failed');

  habitsDoneToday = computed(() => {
    const today = toLocalDate(new Date());
    return this.habitService.habits().filter((h) => h.completedDates.includes(today)).length;
  });
  habitSummary = computed(() =>
    this.habitsUnavailable()
      ? 'Unavailable'
      : `${this.habitsDoneToday()} of ${this.habits().length}`
  );

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
