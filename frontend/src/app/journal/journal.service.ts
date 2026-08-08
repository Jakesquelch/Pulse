import { effect, Injectable, signal } from '@angular/core';
import { JournalEntry } from './journal-entry.model';

const STORAGE_KEY = 'jakeos-journal';

@Injectable({ providedIn: 'root' })
export class JournalService {
  // Only the service can write to this signal:
  private entriesSignal = signal<JournalEntry[]>(this.loadEntries());
  // ...components get a read-only view of it:
  readonly entries = this.entriesSignal.asReadonly();

  constructor() {
    effect(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entriesSignal()));
    });
  }

  private loadEntries(): JournalEntry[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

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
