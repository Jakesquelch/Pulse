import { effect, Injectable, signal } from '@angular/core';
import { Habit } from '../models/habit.model';

const STORAGE_KEY = 'jakeos-habits';

@Injectable({ providedIn: 'root' })
export class HabitService {
  // Only the service can write to this signal:
  private habitsSignal = signal<Habit[]>(this.loadHabits());
  // ...components get a read-only view of it:
  readonly habits = this.habitsSignal.asReadonly();

  constructor() {
    effect(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.habitsSignal()));
    });
  }

  private loadHabits(): Habit[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

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
