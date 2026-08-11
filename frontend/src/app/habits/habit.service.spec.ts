import { TestBed } from '@angular/core/testing';
import { Habit } from './habit.model';
import { HabitService } from './habit.service';

const STORAGE_KEY = 'pulse-habits';

// What localStorage actually holds right now, parsed.
function stored(): Habit[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
}

describe('HabitService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // Same construction story as TaskService: the signal's initial value comes
  // from loadHabits(), which runs in the field initializer — so localStorage
  // must be seeded BEFORE TestBed.inject() for the service to see it.

  it('starts empty when nothing is stored', () => {
    const service = TestBed.inject(HabitService);
    expect(service.habits()).toEqual([]);
  });

  it('loads habits saved by a previous session', () => {
    const saved: Habit[] = [{ id: 'h1', name: 'Stretch', completedDates: ['2026-08-07'] }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

    const service = TestBed.inject(HabitService);
    expect(service.habits()).toEqual(saved);
  });

  it('addHabit appends a habit with a generated id and no completed dates', () => {
    const service = TestBed.inject(HabitService);
    service.addHabit('Drink water');

    const habits = service.habits();
    expect(habits).toHaveLength(1);
    expect(habits[0]).toMatchObject({ name: 'Drink water', completedDates: [] });
    expect(habits[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('deleteHabit removes only the targeted habit', () => {
    const service = TestBed.inject(HabitService);
    service.addHabit('Keep me');
    service.addHabit('Delete me');
    const [keep, remove] = service.habits();

    service.deleteHabit(remove.id);

    expect(service.habits()).toHaveLength(1);
    expect(service.habits()[0].id).toBe(keep.id);
  });

  // toggleDate is the one method here with real logic, so it gets the most
  // tests. It's a toggle, not a setter: the same call marks OR unmarks
  // depending on whether the date is already present.

  it('toggleDate marks a date as done when it is not already', () => {
    const service = TestBed.inject(HabitService);
    service.addHabit('Meditate');
    const { id } = service.habits()[0];

    service.toggleDate(id, '2026-08-08');

    expect(service.habits()[0].completedDates).toEqual(['2026-08-08']);
  });

  it('toggleDate unmarks a date that was already done', () => {
    const service = TestBed.inject(HabitService);
    service.addHabit('Meditate');
    const { id } = service.habits()[0];

    service.toggleDate(id, '2026-08-08');
    service.toggleDate(id, '2026-08-08'); // toggle back off

    expect(service.habits()[0].completedDates).toEqual([]);
  });

  it('toggleDate leaves the habit’s other dates untouched', () => {
    const service = TestBed.inject(HabitService);
    service.addHabit('Meditate');
    const { id } = service.habits()[0];
    service.toggleDate(id, '2026-08-06');
    service.toggleDate(id, '2026-08-07');

    service.toggleDate(id, '2026-08-06'); // unmark just the 6th

    expect(service.habits()[0].completedDates).toEqual(['2026-08-07']);
  });

  it('toggleDate touches only the targeted habit', () => {
    const service = TestBed.inject(HabitService);
    service.addHabit('Meditate');
    service.addHabit('Journal');
    const [meditate, journal] = service.habits();

    service.toggleDate(meditate.id, '2026-08-08');

    expect(service.habits().find((h) => h.id === journal.id)?.completedDates).toEqual([]);
  });

  it('persists to localStorage when the effect runs — after a tick, not synchronously', () => {
    const service = TestBed.inject(HabitService);
    service.addHabit('Read');

    // Changing the signal only *schedules* the effect; nothing is written yet.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    TestBed.tick();

    expect(stored()).toHaveLength(1);
    expect(stored()[0].name).toBe('Read');
  });

  it('starts empty when the stored JSON is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, 'not json{');
    const service = TestBed.inject(HabitService);
    expect(service.habits()).toEqual([]);
  });
});
