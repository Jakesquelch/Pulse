import { TestBed } from '@angular/core/testing';
import { persistedSignal } from './persisted-signal';

const KEY = 'test-items';

// persistedSignal calls effect(), which needs an injection context. Services
// get one for free (their field initializers run during DI construction);
// a bare test function doesn't, so we borrow TestBed's.
function create<T>(fallback: T) {
  return TestBed.runInInjectionContext(() => persistedSignal(KEY, fallback));
}

describe('persistedSignal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts at the fallback when nothing is stored', () => {
    const items = create<string[]>([]);
    expect(items()).toEqual([]);
  });

  it('starts from the stored JSON when present', () => {
    localStorage.setItem(KEY, JSON.stringify(['a', 'b']));
    const items = create<string[]>([]);
    expect(items()).toEqual(['a', 'b']);
  });

  it('persists updates when the effect runs — after a tick, not synchronously', () => {
    const items = create<string[]>([]);
    items.set(['a']);

    TestBed.tick();

    expect(localStorage.getItem(KEY)).toBe('["a"]');
  });

  it('falls back when the stored JSON is corrupt', () => {
    localStorage.setItem(KEY, 'not json{');
    const items = create<string[]>([]);
    expect(items()).toEqual([]);
  });

  // This replaces the three per-service "silent wipe" characterization tests.
  // The main key still gets overwritten by the auto-save effect — that part is
  // inherent to mirroring in-memory state — but the original bytes now survive
  // in a backup key instead of being lost. The wipe is no longer silent.
  it('backs up corrupt bytes to <key>-corrupt before the effect overwrites them', () => {
    localStorage.setItem(KEY, 'not json{');
    create<string[]>([]);

    TestBed.tick();

    expect(localStorage.getItem(KEY)).toBe('[]');
    expect(localStorage.getItem(`${KEY}-corrupt`)).toBe('not json{');
  });
});
