import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { JournalEntry } from './journal-entry.model';
import { JournalService } from './journal.service';

const API_URL = 'http://localhost:8000/journal';

// A complete entry with sensible defaults, so each test only states the fields
// it actually cares about.
function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 'e1',
    content: 'Long day, good day.',
    createdAt: '2026-08-14T09:00:00.000Z',
    ...overrides,
  };
}

describe('JournalService', () => {
  let service: JournalService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    // The real network backend swapped for one that queues requests instead of
    // sending them — these tests pass with the backend switched off.
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(JournalService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  // Fails the test if the service fired a request nobody accounted for, or
  // left one hanging.
  afterEach(() => httpTesting.verify());

  // The constructor fires GET /journal on injection, so every test answers
  // that before doing anything else.
  function flushInitialLoad(entries: JournalEntry[] = []) {
    httpTesting.expectOne({ method: 'GET', url: API_URL }).flush(entries);
  }

  it('starts empty and only fills once the server responds', () => {
    // No localStorage to fall back on any more — the signal is a cache of what
    // the server said, and it hasn't said anything yet.
    expect(service.entries()).toEqual([]);

    flushInitialLoad([makeEntry({ id: 'srv-1', content: 'From the server' })]);

    expect(service.entries()).toEqual([makeEntry({ id: 'srv-1', content: 'From the server' })]);
  });

  it('addEntry POSTs only the content and appends what the server returns', () => {
    flushInitialLoad();

    service.addEntry('Something on my mind');

    const request = httpTesting.expectOne(API_URL);
    expect(request.request.method).toBe('POST');
    // No id and no createdAt: the server owns both, and a client that could
    // send a timestamp could backdate an entry.
    expect(request.request.body).toEqual({ content: 'Something on my mind' });

    const createdEntry = makeEntry({
      id: 'srv-99',
      content: 'Something on my mind',
      createdAt: '2026-08-14T10:15:00.000Z',
    });
    request.flush(createdEntry);

    expect(service.entries()).toEqual([createdEntry]);
  });

  it('stores the server’s timestamp rather than one of its own', () => {
    flushInitialLoad();

    service.addEntry('Timestamped by the server');
    httpTesting
      .expectOne(API_URL)
      .flush(makeEntry({ id: 'srv-1', createdAt: '2026-01-01T00:00:00.000Z' }));

    expect(service.entries()[0].createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('deleteEntry DELETEs by id and drops it once the server confirms', () => {
    flushInitialLoad([makeEntry({ id: 'keep' }), makeEntry({ id: 'remove' })]);

    service.deleteEntry('remove');

    const request = httpTesting.expectOne(`${API_URL}/remove`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(service.entries().map((entry) => entry.id)).toEqual(['keep']);
  });

  it('updateContent PATCHes just the content', () => {
    flushInitialLoad([makeEntry({ id: 'e1', content: 'Original' })]);

    service.updateContent('e1', 'Reworded');

    const request = httpTesting.expectOne(`${API_URL}/e1`);
    expect(request.request.method).toBe('PATCH');
    // createdAt is absent, so there's no path by which an edit could move an
    // entry's place in the journal.
    expect(request.request.body).toEqual({ content: 'Reworded' });

    request.flush(makeEntry({ id: 'e1', content: 'Reworded' }));

    expect(service.entries()[0].content).toBe('Reworded');
  });

  it('keeps the createdAt the server sends back on an edit', () => {
    const original = makeEntry({ id: 'e1', createdAt: '2026-08-01T08:00:00.000Z' });
    flushInitialLoad([original]);

    service.updateContent('e1', 'Reworded');
    httpTesting
      .expectOne(`${API_URL}/e1`)
      .flush({ ...original, content: 'Reworded' });

    expect(service.entries()[0].createdAt).toBe('2026-08-01T08:00:00.000Z');
  });

  it('updateContent touches only the targeted entry', () => {
    flushInitialLoad([makeEntry({ id: 'e1' }), makeEntry({ id: 'e2', content: 'Untouched' })]);

    service.updateContent('e1', 'Reworded');
    httpTesting.expectOne(`${API_URL}/e1`).flush(makeEntry({ id: 'e1', content: 'Reworded' }));

    expect(service.entries().find((entry) => entry.id === 'e2')?.content).toBe('Untouched');
  });

  describe('failure handling', () => {
    // What HttpClient reports when the request never reached a server at all —
    // the backend being switched off, rather than it answering with a 500.
    const networkFailure = () => new ProgressEvent('error');

    it('is loading until the first response, then ready', () => {
      expect(service.loadState()).toBe('loading');

      flushInitialLoad([makeEntry()]);

      expect(service.loadState()).toBe('ready');
    });

    it('marks the load failed when the initial GET cannot reach the server', () => {
      httpTesting.expectOne({ method: 'GET', url: API_URL }).error(networkFailure());

      expect(service.loadState()).toBe('failed');
      // Empty *and* flagged: the emptiness is unknown-ness, not "nothing
      // written" — which for a journal is a particularly bad thing to imply.
      expect(service.entries()).toEqual([]);
    });

    it('recovers when a retry succeeds', () => {
      httpTesting.expectOne({ method: 'GET', url: API_URL }).error(networkFailure());
      expect(service.loadState()).toBe('failed');

      service.loadEntries();

      httpTesting.expectOne({ method: 'GET', url: API_URL }).flush([makeEntry()]);
      expect(service.loadState()).toBe('ready');
      expect(service.entries()).toHaveLength(1);
    });

    it('reports a failed add without inventing the entry locally', () => {
      flushInitialLoad([makeEntry({ id: 'existing' })]);

      service.addEntry('Never lands');
      httpTesting.expectOne(API_URL).error(networkFailure());

      expect(service.actionError()).toBeTruthy();
      // Pessimistic updates earn their keep: nothing to roll back, and no
      // phantom entry that looks saved but isn't.
      expect(service.entries()).toEqual([makeEntry({ id: 'existing' })]);
    });

    it('keeps an entry that failed to delete', () => {
      flushInitialLoad([makeEntry({ id: 'stubborn' })]);

      service.deleteEntry('stubborn');
      httpTesting.expectOne(`${API_URL}/stubborn`).error(networkFailure());

      expect(service.actionError()).toBeTruthy();
      expect(service.entries()).toHaveLength(1);
    });

    it('keeps the old content when an edit fails', () => {
      flushInitialLoad([makeEntry({ id: 'e1', content: 'Original' })]);

      service.updateContent('e1', 'Never lands');
      httpTesting.expectOne(`${API_URL}/e1`).error(networkFailure());

      expect(service.actionError()).toBeTruthy();
      // The page must not show an edit the server rejected as though it stuck.
      expect(service.entries()[0].content).toBe('Original');
    });

    it('leaves the entries visible when a write fails', () => {
      flushInitialLoad([makeEntry()]);

      service.deleteEntry('e1');
      httpTesting.expectOne(`${API_URL}/e1`).error(networkFailure());

      // The point of two signals rather than one: a failed write says nothing
      // about whether the entries we already hold are accurate.
      expect(service.loadState()).toBe('ready');
    });

    it('clears a previous error once an action succeeds', () => {
      flushInitialLoad();

      service.addEntry('Fails');
      httpTesting.expectOne(API_URL).error(networkFailure());
      expect(service.actionError()).toBeTruthy();

      service.addEntry('Works');
      httpTesting.expectOne(API_URL).flush(makeEntry({ id: 'srv-2', content: 'Works' }));

      expect(service.actionError()).toBeNull();
    });
  });
});
