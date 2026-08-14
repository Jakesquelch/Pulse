import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Task } from './task.model';
import { TaskService } from './task.service';
import { environment } from '../../environments/environment';

// Built from environment rather than typed out, so changing the API's address
// doesn't break the suite. What's under test is the path and the verb — the
// base URL is configuration, and a wrong one shows up the moment you run the app.
const API_URL = `${environment.apiUrl}/tasks`;

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

  // The two failure signals mean different things, and the tests below exist
  // mainly to pin that difference: a dead GET hides the list, a dead write
  // must not.
  describe('failure handling', () => {
    // What HttpClient reports when the request never reached a server at all
    // — the backend being switched off, rather than it answering with a 500.
    const networkFailure = () => new ProgressEvent('error');

    it('is loading until the first response, then ready', () => {
      // Before the flush the answer is genuinely unknown, and the UI leans on
      // that to avoid claiming "no tasks yet" prematurely.
      expect(service.loadState()).toBe('loading');

      flushInitialLoad([makeTask()]);

      expect(service.loadState()).toBe('ready');
    });

    it('marks the load failed when the initial GET cannot reach the server', () => {
      httpTesting.expectOne({ method: 'GET', url: API_URL }).error(networkFailure());

      expect(service.loadState()).toBe('failed');
      // Empty *and* flagged: the emptiness is unknown-ness, not "no tasks".
      expect(service.tasks()).toEqual([]);
    });

    it('recovers when a retry succeeds', () => {
      httpTesting.expectOne({ method: 'GET', url: API_URL }).error(networkFailure());
      expect(service.loadState()).toBe('failed');

      service.loadTasks();

      httpTesting.expectOne({ method: 'GET', url: API_URL }).flush([makeTask()]);
      expect(service.loadState()).toBe('ready');
      expect(service.tasks()).toHaveLength(1);
    });

    it('reports a failed add without inventing the task locally', () => {
      flushInitialLoad([makeTask({ id: 'existing' })]);

      service.addTask('Never lands', 'high');
      httpTesting.expectOne(API_URL).error(networkFailure());

      expect(service.actionError()).toBeTruthy();
      // Pessimistic updates earn their keep here: nothing to roll back.
      expect(service.tasks()).toEqual([makeTask({ id: 'existing' })]);
    });

    it('keeps a task that failed to delete', () => {
      flushInitialLoad([makeTask({ id: 'stubborn' })]);

      service.deleteTask('stubborn');
      httpTesting.expectOne(`${API_URL}/stubborn`).error(networkFailure());

      expect(service.actionError()).toBeTruthy();
      expect(service.tasks()).toHaveLength(1);
    });

    it('keeps the old value when a patch fails', () => {
      flushInitialLoad([makeTask({ id: 't1', completed: false })]);

      service.toggleComplete('t1');
      httpTesting.expectOne(`${API_URL}/t1`).error(networkFailure());

      expect(service.actionError()).toBeTruthy();
      // The checkbox must not stay flipped on a change the server rejected.
      expect(service.tasks()[0].completed).toBe(false);
    });

    it('leaves the list visible when a write fails', () => {
      flushInitialLoad([makeTask()]);

      service.deleteTask('a1');
      httpTesting.expectOne(`${API_URL}/a1`).error(networkFailure());

      // The whole point of two signals rather than one: a failed write says
      // nothing about whether the tasks we already hold are accurate.
      expect(service.loadState()).toBe('ready');
    });

    it('clears a previous error once an action succeeds', () => {
      flushInitialLoad();

      service.addTask('First try', 'low');
      httpTesting.expectOne(API_URL).error(networkFailure());
      expect(service.actionError()).toBeTruthy();

      service.addTask('Second try', 'low');
      httpTesting.expectOne(API_URL).flush(makeTask({ id: 'new', title: 'Second try' }));

      // Clearing on the next attempt is why no dismiss button is needed — a
      // stale message can't outlive the failure it described.
      expect(service.actionError()).toBeNull();
    });
  });
});

// The localStorage tests that used to live in this file are gone with the
// persistence they described — TaskService no longer touches localStorage.
// As of the journal migration, neither does anything else: persistedSignal
// and its spec are deleted, and the server is the only store there is.
