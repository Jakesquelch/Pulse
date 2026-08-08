import { TestBed } from '@angular/core/testing';
import { JournalEntry } from './journal-entry.model';
import { JournalService } from './journal.service';

const STORAGE_KEY = 'jakeos-journal';

// What localStorage actually holds right now, parsed.
function stored(): JournalEntry[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
}

describe('JournalService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // Third spec following the same pattern — see task.service.spec.ts for the
  // full commentary on why seeding happens before inject() and why persistence
  // needs TestBed.tick(). Only journal-specific behavior is commented here.

  it('starts empty when nothing is stored', () => {
    const service = TestBed.inject(JournalService);
    expect(service.entries()).toEqual([]);
  });

  it('loads entries saved by a previous session', () => {
    const saved: JournalEntry[] = [
      { id: 'e1', content: 'Slept well.', createdAt: '2026-08-07T21:30:00.000Z' },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

    const service = TestBed.inject(JournalService);
    expect(service.entries()).toEqual(saved);
  });

  it('addEntry appends an entry with a generated id and a createdAt of roughly now', () => {
    const service = TestBed.inject(JournalService);
    const before = Date.now();
    service.addEntry('Long walk in the rain.');
    const after = Date.now();

    const entries = service.entries();
    expect(entries).toHaveLength(1);
    expect(entries[0].content).toBe('Long walk in the rain.');
    expect(entries[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

    // createdAt is whatever new Date().toISOString() produced during the call,
    // so pin it between two timestamps taken around it instead of an exact value.
    const created = Date.parse(entries[0].createdAt);
    expect(created).toBeGreaterThanOrEqual(before);
    expect(created).toBeLessThanOrEqual(after);
  });

  it('deleteEntry removes only the targeted entry', () => {
    const service = TestBed.inject(JournalService);
    service.addEntry('Keep me');
    service.addEntry('Delete me');
    const [keep, remove] = service.entries();

    service.deleteEntry(remove.id);

    expect(service.entries()).toHaveLength(1);
    expect(service.entries()[0].id).toBe(keep.id);
  });

  it('updateContent rewrites the content but preserves id and createdAt', () => {
    const service = TestBed.inject(JournalService);
    service.addEntry('Frist draft');
    const original = service.entries()[0];

    service.updateContent(original.id, 'First draft');

    expect(service.entries()[0]).toEqual({
      id: original.id,
      content: 'First draft',
      createdAt: original.createdAt, // editing must not look like re-posting
    });
  });

  it('updateContent leaves other entries untouched', () => {
    const service = TestBed.inject(JournalService);
    service.addEntry('Target');
    service.addEntry('Bystander');
    const [target, bystander] = service.entries();

    service.updateContent(target.id, 'Rewritten');

    expect(service.entries().find((e) => e.id === bystander.id)?.content).toBe('Bystander');
  });

  it('persists to localStorage when the effect runs — after a tick, not synchronously', () => {
    const service = TestBed.inject(JournalService);
    service.addEntry('Note to self');

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    TestBed.tick();

    expect(stored()).toHaveLength(1);
    expect(stored()[0].content).toBe('Note to self');
  });

  it('starts empty when the stored JSON is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, 'not json{');
    const service = TestBed.inject(JournalService);
    expect(service.entries()).toEqual([]);
  });
});
