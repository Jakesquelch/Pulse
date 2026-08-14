export interface Habit {
  id: string;
  name: string;
  completedDates: string[]; // local dates the habit was done, e.g. "2026-07-03"
}

// What the client may send when creating a habit — mirrors the backend's
// HabitCreate model. The server owns the id, and a new habit has no history,
// so both are Omitted rather than sent and ignored.
export type HabitCreate = Omit<Habit, 'id' | 'completedDates'>;
