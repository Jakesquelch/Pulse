import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Task } from './task.model';
import { TaskService } from './task.service';

const API_URL = 'http://localhost:8000/tasks';

// A complete Task with sensible defaults, so each test only has to state the
// fields it actually cares about.
function makeTask(overrides: Partial<Task> = {}): Task {
  return { id: 'a1', title: 'Stretch', completed: false, priority: 'low', ...overrides };
}

describe('TaskService', () => {
  let service: TaskService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    // provideHttpClientTesting swaps the real network backend for one that
    // queues requests instead of sending them, so tests can inspect what the
    // service asked for and decide what it gets back. Nothing leaves the
    // process — these tests pass with the backend switched off.
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TaskService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  // Fails the test if the service fired a request nobody accounted for, or
  // left one hanging — catches accidental extra calls as well as missing ones.
  afterEach(() => httpTesting.verify());

  // The constructor fires GET /tasks the moment the service is injected, so
  // every test has to answer that request before anything else happens.
  function flushInitialLoad(tasks: Task[] = []) {
    httpTesting.expectOne({ method: 'GET', url: API_URL }).flush(tasks);
  }

  it('starts empty and only fills once the server responds', () => {
    // The signal is a cache of what the server said, and it hasn't said
    // anything yet — no localStorage to fall back on any more.
    expect(service.tasks()).toEqual([]);

    flushInitialLoad([makeTask({ id: 'srv-1', title: 'From the server' })]);

    expect(service.tasks()).toEqual([
      makeTask({ id: 'srv-1', title: 'From the server' }),
    ]);
  });

  it('addTask POSTs the new task and appends the version the server returns', () => {
    flushInitialLoad();

    service.addTask('Water the plants', 'high');

    const request = httpTesting.expectOne(API_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      title: 'Water the plants',
      priority: 'high',
      group: undefined,
    });

    // The server owns `id` and `completed`, so the test asserts we store what
    // it sent rather than checking a generated id — that's the backend's job
    // to get right now, not this service's.
    const createdTask = makeTask({
      id: 'srv-99',
      title: 'Water the plants',
      priority: 'high',
    });
    request.flush(createdTask);

    expect(service.tasks()).toEqual([createdTask]);
  });

  it("sends the form's no-group value ('') as undefined, so JSON omits the key", () => {
    flushInitialLoad();

    service.addTask('Read 10 pages', 'medium', '');

    const request = httpTesting.expectOne(API_URL);
    expect(request.request.body.group).toBeUndefined();
    request.flush(makeTask({ title: 'Read 10 pages', priority: 'medium' }));
  });

  it('does not add the task until the server has accepted it', () => {
    flushInitialLoad();

    service.addTask('Not yet', 'low');

    // Request is in flight and unanswered: a pessimistic update means the
    // list must not show the task yet.
    expect(service.tasks()).toEqual([]);

    httpTesting.expectOne(API_URL).flush(makeTask({ id: 'srv-1', title: 'Not yet' }));
    expect(service.tasks()).toHaveLength(1);
  });

  it('deleteTask DELETEs by id and removes only that task', () => {
    const keep = makeTask({ id: 'keep', title: 'Keep me' });
    const remove = makeTask({ id: 'remove', title: 'Delete me' });
    flushInitialLoad([keep, remove]);

    service.deleteTask('remove');

    const request = httpTesting.expectOne(`${API_URL}/remove`);
    expect(request.request.method).toBe('DELETE');
    // 204 No Content is what the endpoint answers — no body to hand back.
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(service.tasks()).toEqual([keep]);
  });

  it('toggleComplete PATCHes only the flipped field', () => {
    const existing = makeTask({ id: 't1', title: 'Stretch', completed: false });
    flushInitialLoad([existing]);

    service.toggleComplete('t1');

    const request = httpTesting.expectOne(`${API_URL}/t1`);
    expect(request.request.method).toBe('PATCH');
    // The heart of PATCH: `title` and `priority` are deliberately absent, so
    // the server can't be told to overwrite them with what we happen to hold.
    expect(request.request.body).toEqual({ completed: true });

    request.flush({ ...existing, completed: true });

    expect(service.tasks()[0].completed).toBe(true);
  });

  it('updateTitle PATCHes only the title, leaving the rest untouched', () => {
    const target = makeTask({ id: 'target', title: 'Old name', priority: 'medium' });
    const other = makeTask({ id: 'other', title: 'Unrelated' });
    flushInitialLoad([target, other]);

    service.updateTitle('target', 'New name');

    const request = httpTesting.expectOne(`${API_URL}/target`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ title: 'New name' });

    request.flush({ ...target, title: 'New name' });

    const tasks = service.tasks();
    expect(tasks.find((task) => task.id === 'target')).toMatchObject({
      title: 'New name',
      priority: 'medium',
      completed: false,
    });
    expect(tasks.find((task) => task.id === 'other')?.title).toBe('Unrelated');
  });

  it('stores the server\'s version of a patched task, not a locally merged one', () => {
    const existing = makeTask({ id: 't1', title: 'Old name' });
    flushInitialLoad([existing]);

    service.updateTitle('t1', 'New name');

    // If the server normalises the change, its answer wins — we replace our
    // copy rather than merging what we hoped would happen.
    httpTesting
      .expectOne(`${API_URL}/t1`)
      .flush({ ...existing, title: 'Normalised By Server' });

    expect(service.tasks()[0].title).toBe('Normalised By Server');
  });

  it('toggleComplete sends no request at all for an unknown id', () => {
    flushInitialLoad();

    service.toggleComplete('ghost');

    // Nothing to flip locally means a guaranteed 404 — don't ask.
    httpTesting.expectNone(`${API_URL}/ghost`);
  });
});

// Not covered here yet: what the service does when a request FAILS. Nothing
// subscribes with an error callback, so a failure currently propagates as an
// unhandled error rather than any behaviour worth pinning. Those tests belong
// with the error-handling work, once there's handling to test.
//
// The localStorage tests that used to live in this file are gone with the
// persistence they described — TaskService no longer touches localStorage.
// persistedSignal itself is still covered by core/persisted-signal.spec.ts,
// which habits and journal still rely on.
