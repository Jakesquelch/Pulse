import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Habit } from './habit.model';
import { HabitService } from './habit.service';
import { environment } from '../../environments/environment';

// From environment for the same reason as the task spec: the base URL is
// configuration, not behaviour under test.
const API_URL = `${environment.apiUrl}/habits`;

// A complete Habit with sensible defaults, so each test only states the fields
// it actually cares about.
function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return { id: 'h1', name: 'Stretch', completedDates: [], ...overrides };
}

describe('HabitService', () => {
  let service: HabitService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    // Same setup as the task spec: the real network backend is swapped for one
    // that queues requests instead of sending them, so these tests pass with
    // the backend switched off entirely.
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(HabitService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  // Fails the test if the service fired a request nobody accounted for, or
  // left one hanging.
  afterEach(() => httpTesting.verify());

  // The constructor fires GET /habits on injection, so every test answers that
  // before doing anything else.
  function flushInitialLoad(habits: Habit[] = []) {
    httpTesting.expectOne({ method: 'GET', url: API_URL }).flush(habits);
  }

  function completionUrl(id: string, date: string) {
    return `${API_URL}/${id}/completions/${date}`;
  }

  it('starts empty and only fills once the server responds', () => {
    // No localStorage to fall back on any more — the signal is a cache of what
    // the server said, and it hasn't said anything yet.
    expect(service.habits()).toEqual([]);

    flushInitialLoad([makeHabit({ id: 'srv-1', name: 'From the server' })]);

    expect(service.habits()).toEqual([makeHabit({ id: 'srv-1', name: 'From the server' })]);
  });

  it('addHabit POSTs just the name and appends the version the server returns', () => {
    flushInitialLoad();

    service.addHabit('Read 10 pages');

    const request = httpTesting.expectOne(API_URL);
    expect(request.request.method).toBe('POST');
    // No id and no completedDates: the server owns both, so sending them would
    // be the client claiming authority it doesn't have.
    expect(request.request.body).toEqual({ name: 'Read 10 pages' });

    request.flush(makeHabit({ id: 'srv-99', name: 'Read 10 pages' }));

    expect(service.habits()).toEqual([makeHabit({ id: 'srv-99', name: 'Read 10 pages' })]);
  });

  it('deleteHabit DELETEs by id and drops it once the server confirms', () => {
    flushInitialLoad([makeHabit({ id: 'keep' }), makeHabit({ id: 'remove' })]);

    service.deleteHabit('remove');

    const request = httpTesting.expectOne(`${API_URL}/remove`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(service.habits().map((habit) => habit.id)).toEqual(['keep']);
  });

  // toggleDate is where habits stop resembling tasks, so it gets the most
  // attention: one method, two different HTTP verbs, chosen from local state.
  describe('toggleDate', () => {
    it('PUTs the completion when the date is not already marked', () => {
      flushInitialLoad([makeHabit({ id: 'h1', completedDates: [] })]);

      service.toggleDate('h1', '2026-08-14');

      const request = httpTesting.expectOne(completionUrl('h1', '2026-08-14'));
      expect(request.request.method).toBe('PUT');
      // The URL carries habit and date, so there is genuinely nothing to send.
      expect(request.request.body).toBeNull();

      request.flush(makeHabit({ id: 'h1', completedDates: ['2026-08-14'] }));

      expect(service.habits()[0].completedDates).toEqual(['2026-08-14']);
    });

    it('DELETEs the completion when the date is already marked', () => {
      flushInitialLoad([makeHabit({ id: 'h1', completedDates: ['2026-08-14'] })]);

      service.toggleDate('h1', '2026-08-14');

      const request = httpTesting.expectOne(completionUrl('h1', '2026-08-14'));
      expect(request.request.method).toBe('DELETE');

      request.flush(makeHabit({ id: 'h1', completedDates: [] }));

      expect(service.habits()[0].completedDates).toEqual([]);
    });

    it('takes the server’s dates rather than editing the array locally', () => {
      flushInitialLoad([makeHabit({ id: 'h1', completedDates: ['2026-08-12'] })]);

      service.toggleDate('h1', '2026-08-14');

      // The server sorts, so the response is the authority on order — the
      // service must not assume its own append would have matched.
      httpTesting
        .expectOne(completionUrl('h1', '2026-08-14'))
        .flush(makeHabit({ id: 'h1', completedDates: ['2026-08-12', '2026-08-14'] }));

      expect(service.habits()[0].completedDates).toEqual(['2026-08-12', '2026-08-14']);
    });

    it('touches only the targeted habit', () => {
      flushInitialLoad([makeHabit({ id: 'h1' }), makeHabit({ id: 'h2' })]);

      service.toggleDate('h1', '2026-08-14');
      httpTesting
        .expectOne(completionUrl('h1', '2026-08-14'))
        .flush(makeHabit({ id: 'h1', completedDates: ['2026-08-14'] }));

      expect(service.habits().find((habit) => habit.id === 'h2')?.completedDates).toEqual([]);
    });

    it('sends nothing at all for a habit it does not hold', () => {
      flushInitialLoad([makeHabit({ id: 'h1' })]);

      service.toggleDate('ghost', '2026-08-14');

      // afterEach's verify() would fail if a request had gone out; this states
      // the intent outright rather than relying on that.
      httpTesting.expectNone(completionUrl('ghost', '2026-08-14'));
    });
  });

  describe('failure handling', () => {
    // What HttpClient reports when the request never reached a server at all —
    // the backend being switched off, rather than it answering with a 500.
    const networkFailure = () => new ProgressEvent('error');

    it('is loading until the first response, then ready', () => {
      expect(service.loadState()).toBe('loading');

      flushInitialLoad([makeHabit()]);

      expect(service.loadState()).toBe('ready');
    });

    it('marks the load failed when the initial GET cannot reach the server', () => {
      httpTesting.expectOne({ method: 'GET', url: API_URL }).error(networkFailure());

      expect(service.loadState()).toBe('failed');
      // Empty *and* flagged: the emptiness is unknown-ness, not "no habits".
      expect(service.habits()).toEqual([]);
    });

    it('recovers when a retry succeeds', () => {
      httpTesting.expectOne({ method: 'GET', url: API_URL }).error(networkFailure());
      expect(service.loadState()).toBe('failed');

      service.loadHabits();

      httpTesting.expectOne({ method: 'GET', url: API_URL }).flush([makeHabit()]);
      expect(service.loadState()).toBe('ready');
      expect(service.habits()).toHaveLength(1);
    });

    it('reports a failed add without inventing the habit locally', () => {
      flushInitialLoad([makeHabit({ id: 'existing' })]);

      service.addHabit('Never lands');
      httpTesting.expectOne(API_URL).error(networkFailure());

      expect(service.actionError()).toBeTruthy();
      // Pessimistic updates earn their keep: there's nothing to roll back.
      expect(service.habits()).toEqual([makeHabit({ id: 'existing' })]);
    });

    it('keeps a habit that failed to delete', () => {
      flushInitialLoad([makeHabit({ id: 'stubborn' })]);

      service.deleteHabit('stubborn');
      httpTesting.expectOne(`${API_URL}/stubborn`).error(networkFailure());

      expect(service.actionError()).toBeTruthy();
      expect(service.habits()).toHaveLength(1);
    });

    it('leaves the day unticked when the toggle fails', () => {
      flushInitialLoad([makeHabit({ id: 'h1', completedDates: [] })]);

      service.toggleDate('h1', '2026-08-14');
      httpTesting.expectOne(completionUrl('h1', '2026-08-14')).error(networkFailure());

      expect(service.actionError()).toBeTruthy();
      // The square must not stay lit on a tick the server never recorded.
      expect(service.habits()[0].completedDates).toEqual([]);
    });

    it('leaves the habits visible when a write fails', () => {
      flushInitialLoad([makeHabit()]);

      service.deleteHabit('h1');
      httpTesting.expectOne(`${API_URL}/h1`).error(networkFailure());

      // The point of two signals rather than one: a failed write says nothing
      // about whether the habits we already hold are accurate.
      expect(service.loadState()).toBe('ready');
    });

    it('clears a previous error once an action succeeds', () => {
      flushInitialLoad();

      service.addHabit('Fails');
      httpTesting.expectOne(API_URL).error(networkFailure());
      expect(service.actionError()).toBeTruthy();

      service.addHabit('Works');
      httpTesting.expectOne(API_URL).flush(makeHabit({ id: 'srv-2', name: 'Works' }));

      expect(service.actionError()).toBeNull();
    });
  });
});
