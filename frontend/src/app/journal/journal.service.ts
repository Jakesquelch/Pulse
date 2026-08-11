import { Injectable } from '@angular/core';
import { persistedSignal } from '../core/persisted-signal';
import { JournalEntry } from './journal-entry.model';

const STORAGE_KEY = 'pulse-journal';

@Injectable({ providedIn: 'root' })
export class JournalService {
  // Loaded from and auto-saved to storage by the seam; only the service can
  // write to this signal:
  private entriesSignal = persistedSignal<JournalEntry[]>(STORAGE_KEY, []);
  // ...components get a read-only view of it:
  readonly entries = this.entriesSignal.asReadonly();

  addEntry(content: string) {
    const newEntry: JournalEntry = {
      id: crypto.randomUUID(),
      content,
      createdAt: new Date().toISOString(),
    };
    this.entriesSignal.update((entries) => [...entries, newEntry]);
  }

  deleteEntry(id: string) {
    this.entriesSignal.update((entries) => entries.filter((entry) => entry.id !== id));
  }

  updateContent(id: string, content: string) {
    this.entriesSignal.update((entries) =>
      entries.map((entry) => (entry.id === id ? { ...entry, content } : entry))
    );
  }
}
