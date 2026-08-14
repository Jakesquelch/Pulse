import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { LoadState } from '../core/load-state';
import { environment } from '../../environments/environment';
import { Habit, HabitCreate } from './habit.model';

const API_URL = `${environment.apiUrl}/habits`;

// Same shape of message as TaskService's: what didn't happen, and what's still
// true — so the user never has to guess the state of the world.
const ADD_FAILED = "Couldn't add that habit — it hasn't been saved.";
const DELETE_FAILED = "Couldn't delete that habit — it's still there.";
const TOGGLE_FAILED = "Couldn't save that tick — the day is as it was.";

@Injectable({ providedIn: 'root' })
export class HabitService {
  private http = inject(HttpClient);
  // An in-memory cache of what the server last told us. It starts empty on
  // every page load because the server — no longer localStorage — is the only
  // thing that knows what habits exist.
  private habitsSignal = signal<Habit[]>([]);
  // ...components get a read-only view of the signal:
  readonly habits = this.habitsSignal.asReadonly();

  // Split for the same reason as TaskService's: a failed GET means the list is
  // unknown, a failed write means the list is still right and one action
  // didn't land. Different lies to avoid, so different signals.
  private loadStateSignal = signal<LoadState>('loading');
  readonly loadState = this.loadStateSignal.asReadonly();

  private actionErrorSignal = signal<string | null>(null);
  readonly actionError = this.actionErrorSignal.asReadonly();

  constructor() {
    this.loadHabits();
  }

  // Public so the UI can offer a retry rather than making the user reload.
  loadHabits() {
    this.loadStateSignal.set('loading');
    this.http.get<Habit[]>(API_URL).subscribe({
      next: (habits) => {
        this.habitsSignal.set(habits);
        this.loadStateSignal.set('ready');
      },
      error: () => this.loadStateSignal.set('failed'),
    });
  }

  // Pessimistic update: the signal only gets the habit once the server has
  // accepted it and told us the id it chose.
  addHabit(name: string) {
    const requestBody: HabitCreate = { name };
    this.actionErrorSignal.set(null);
    this.http.post<Habit>(API_URL, requestBody).subscribe({
      next: (createdHabit) => {
        this.habitsSignal.update((habits) => [...habits, createdHabit]);
      },
      error: () => this.actionErrorSignal.set(ADD_FAILED),
    });
  }

  // <void> because the server answers 204: the habit and its completions are
  // gone, so there's deliberately nothing to send back.
  deleteHabit(id: string) {
    this.actionErrorSignal.set(null);
    this.http.delete<void>(`${API_URL}/${id}`).subscribe({
      next: () => {
        this.habitsSignal.update((habits) => habits.filter((habit) => habit.id !== id));
      },
      error: () => this.actionErrorSignal.set(DELETE_FAILED),
    });
  }

  /**
   * Mark or unmark a habit as done on a given date.
   *
   * The *toggle* is still decided here — we read the current state to work out
   * which way the tick is going — but what goes over the wire is one of two
   * unambiguous instructions rather than "flip it, whatever it is". That's
   * what makes the request safe to repeat: PUT means "this day is done" and
   * DELETE means "it isn't", and sending either twice changes nothing.
   *
   * Both verbs answer with the whole updated habit, so the two ends can never
   * quietly disagree about which days are ticked — the same reasoning as
   * TaskService.patchTask taking the server's version of a task.
   */
  toggleDate(id: string, date: string) {
    const habit = this.habits().find((habit) => habit.id === id);
    // Nothing to toggle, and the server would 404 — so we stop rather than
    // send a request we already know is wrong.
    if (!habit) return;

    const completionUrl = `${API_URL}/${id}/completions/${date}`;
    // Angular's put() requires a body argument; null sends none, which is
    // right here — the URL already carries everything the server needs.
    const request = habit.completedDates.includes(date)
      ? this.http.delete<Habit>(completionUrl)
      : this.http.put<Habit>(completionUrl, null);

    this.actionErrorSignal.set(null);
    request.subscribe({
      next: (updatedHabit) => {
        this.habitsSignal.update((habits) =>
          habits.map((habit) => (habit.id === id ? updatedHabit : habit))
        );
      },
      error: () => this.actionErrorSignal.set(TOGGLE_FAILED),
    });
  }
}
