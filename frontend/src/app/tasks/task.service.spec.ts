import { TestBed } from '@angular/core/testing';
import { Task } from './task.model';
import { TaskService } from './task.service';

const STORAGE_KEY = 'jakeos-tasks';

// What localStorage actually holds right now, parsed.
function stored(): Task[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
}

describe('TaskService', () => {
  beforeEach(() => {
    // All tests share one real (jsdom) localStorage — blank slate each time.
    localStorage.clear();
  });

  // We create the service with TestBed.inject rather than `new TaskService()`
  // because the constructor calls effect(), which throws outside an injection
  // context. TestBed also resets between tests, so each test gets a fresh
  // instance — and therefore a fresh construction-time read of localStorage.

  it('starts empty when nothing is stored', () => {
    const service = TestBed.inject(TaskService);
    expect(service.tasks()).toEqual([]);
  });

  it('loads tasks saved by a previous session', () => {
    // Seeding must happen BEFORE inject(): the service reads localStorage
    // in its field initializer, i.e. at construction.
    const saved: Task[] = [{ id: 'a1', title: 'Stretch', completed: true, priority: 'low' }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

    const service = TestBed.inject(TaskService);
    expect(service.tasks()).toEqual(saved);
  });

  it('addTask appends an incomplete task with a generated id', () => {
    const service = TestBed.inject(TaskService);
    service.addTask('Water the plants', 'high');

    const tasks = service.tasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      title: 'Water the plants',
      priority: 'high',
      completed: false,
    });
    expect(tasks[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("stores the form's no-group value ('') as undefined", () => {
    const service = TestBed.inject(TaskService);
    service.addTask('Read 10 pages', 'medium', '');
    expect(service.tasks()[0].group).toBeUndefined();
  });

  it('toggleComplete flips only the targeted task', () => {
    const service = TestBed.inject(TaskService);
    service.addTask('One', 'low');
    service.addTask('Two', 'low');
    const [one, two] = service.tasks();

    service.toggleComplete(two.id);

    expect(service.tasks().find((t) => t.id === one.id)?.completed).toBe(false);
    expect(service.tasks().find((t) => t.id === two.id)?.completed).toBe(true);
  });

  it('persists to localStorage when the effect runs — after a tick, not synchronously', () => {
    const service = TestBed.inject(TaskService);
    service.addTask('Buy milk', 'medium');

    // Changing the signal only *schedules* the effect; nothing is written yet.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    TestBed.tick(); // run pending effects

    expect(stored()).toHaveLength(1);
    expect(stored()[0].title).toBe('Buy milk');
  });

  it('deleteTask removes only the targeted task', () => {
    const service = TestBed.inject(TaskService);
    service.addTask('Keep me', 'low');
    service.addTask('Delete me', 'high');
    const [keep, remove] = service.tasks();

    service.deleteTask(remove.id);

    expect(service.tasks()).toHaveLength(1);
    expect(service.tasks()[0].id).toBe(keep.id);
  });

  it('updateTitle renames only the targeted task, leaving the rest untouched', () => {
    const service = TestBed.inject(TaskService);
    service.addTask('Old name', 'medium');
    service.addTask('Unrelated', 'low');
    const [target, other] = service.tasks();

    service.updateTitle(target.id, 'New name');

    const after = service.tasks();
    expect(after.find((t) => t.id === target.id)).toMatchObject({
      title: 'New name',
      priority: 'medium',
      completed: false,
    });
    expect(after.find((t) => t.id === other.id)?.title).toBe('Unrelated');
  });

  it('starts empty when the stored JSON is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, 'not json{');
    const service = TestBed.inject(TaskService);
    expect(service.tasks()).toEqual([]);
  });

  // Characterization test: this pins CURRENT behavior, not desired behavior.
  // The load fell back to [], and the effect mirrors in-memory state wholesale —
  // so one tick later the corrupt (possibly recoverable) bytes are gone forever.
  // When we harden the storage layer, this test should start failing and be
  // rewritten to assert the data is preserved instead.
  it('overwrites corrupt stored data with an empty list one tick later (silent wipe)', () => {
    localStorage.setItem(STORAGE_KEY, 'not json{');
    TestBed.inject(TaskService);

    // Before the flush, the corrupt bytes are still there...
    expect(localStorage.getItem(STORAGE_KEY)).toBe('not json{');

    TestBed.tick();

    // ...and now they are not.
    expect(localStorage.getItem(STORAGE_KEY)).toBe('[]');
  });
});
