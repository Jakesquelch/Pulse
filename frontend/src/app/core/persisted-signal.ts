import { effect, signal, WritableSignal } from '@angular/core';

// The persistence seam: every data service gets its state signal from here,
// and this file is the ONLY place that knows state lives in localStorage.
// When the backend arrives, this is the one file whose internals change.
//
// Must be called from an injection context (a service's field initializer or
// constructor) because effect() requires one — the same constraint the
// services' own constructor effects had.
export function persistedSignal<T>(key: string, fallback: T): WritableSignal<T> {
  const value = signal<T>(load(key, fallback));

  // Runs once now, then again every time the signal changes, so every update
  // is saved without each service method having to remember to.
  effect(() => {
    localStorage.setItem(key, JSON.stringify(value()));
  });

  return value;
}

function load<T>(key: string, fallback: T): T {
  const saved = localStorage.getItem(key);
  if (saved === null) return fallback;
  try {
    return JSON.parse(saved);
  } catch {
    // Corrupted/hand-edited data shouldn't crash the app — but the effect
    // above will overwrite the main key with the fallback one tick from now,
    // so stash the original bytes first. They may be hand-recoverable, and
    // losing them silently was the flaw our characterization tests pinned.
    localStorage.setItem(`${key}-corrupt`, saved);
    return fallback;
  }
}
