import { Injectable } from '@angular/core';
import { persistedSignal } from '../core/persisted-signal';
import { Habit } from './habit.model';

const STORAGE_KEY = 'pulse-habits';

@Injectable({ providedIn: 'root' })
export class HabitService {
  // Loaded from and auto-saved to storage by the seam; only the service can
  // write to this signal:
  private habitsSignal = persistedSignal<Habit[]>(STORAGE_KEY, []);
  // ...components get a read-only view of it:
  readonly habits = this.habitsSignal.asReadonly();

  addHabit(name: string) {
    const newHabit: Habit = {
      id: crypto.randomUUID(),
      name,
      completedDates: [],
    };
    this.habitsSignal.update((habits) => [...habits, newHabit]);
  }

  deleteHabit(id: string) {
    this.habitsSignal.update((habits) => habits.filter((habit) => habit.id !== id));
  }

  // Mark/unmark a habit as done on a given date.
  toggleDate(id: string, date: string) {
    this.habitsSignal.update((habits) =>
      habits.map((habit) => {
        if (habit.id !== id) return habit;
        const done = habit.completedDates.includes(date);
        return {
          ...habit,
          completedDates: done
            ? habit.completedDates.filter((d) => d !== date)
            : [...habit.completedDates, date],
        };
      })
    );
  }
}
