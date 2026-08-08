import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Habit } from './habit.model';
import { HabitService } from './habit.service';
import { toLocalDate } from '../core/util/date';

@Component({
  selector: 'app-habit-tracker',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './habit-tracker.html',
  styleUrl: './habit-tracker.css',
})
export class HabitTracker {
  private habitService = inject(HabitService);

  habits = this.habitService.habits;
  newHabitName = '';
  today = toLocalDate(new Date());
  // Last 7 days, oldest first, e.g. { date: "2026-07-03", label: "Fri", dayNum: 3 }.
  recentDays = this.buildRecentDays();

  doneToday = computed(
    () => this.habitService.habits().filter((h) => h.completedDates.includes(this.today)).length
  );

  private buildRecentDays() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        date: toLocalDate(d),
        label: d.toLocaleDateString(undefined, { weekday: 'short' }),
        dayNum: d.getDate(),
      });
    }
    return days;
  }

  addHabit() {
    if (!this.newHabitName.trim()) return;
    this.habitService.addHabit(this.newHabitName);
    this.newHabitName = '';
  }

  deleteHabit(id: string) {
    this.habitService.deleteHabit(id);
  }

  toggleDay(habit: Habit, date: string) {
    this.habitService.toggleDate(habit.id, date);
  }

  isDone(habit: Habit, date: string): boolean {
    return habit.completedDates.includes(date);
  }

  // Consecutive days done, counting back from today (or from yesterday,
  // so an unticked today doesn't kill a streak you're still on).
  streak(habit: Habit): number {
    const done = new Set(habit.completedDates);
    const day = new Date();
    if (!done.has(toLocalDate(day))) {
      day.setDate(day.getDate() - 1);
    }
    let count = 0;
    while (done.has(toLocalDate(day))) {
      count++;
      day.setDate(day.getDate() - 1);
    }
    return count;
  }
}
