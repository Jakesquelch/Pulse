import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { LoadState } from '../core/load-state';
import { JournalEntry, JournalEntryCreate, JournalEntryUpdate } from './journal-entry.model';

const API_URL = 'http://localhost:8000/journal';

// Same shape of message as the other two services: what didn't happen, and
// what's still true.
const ADD_FAILED = "Couldn't save that entry — it hasn't been written down.";
const UPDATE_FAILED = "Couldn't save that edit — the entry is as it was.";
const DELETE_FAILED = "Couldn't delete that entry — it's still there.";

@Injectable({ providedIn: 'root' })
export class JournalService {
  private http = inject(HttpClient);
  // An in-memory cache of what the server last told us. Empty on every page
  // load because the server — no longer localStorage — is the only thing that
  // knows what's been written.
  private entriesSignal = signal<JournalEntry[]>([]);
  // ...components get a read-only view of the signal:
  readonly entries = this.entriesSignal.asReadonly();

  // Split for the same reason as the other services': a failed GET means the
  // journal is unknown, a failed write means it's still accurate and one
  // action didn't land.
  private loadStateSignal = signal<LoadState>('loading');
  readonly loadState = this.loadStateSignal.asReadonly();

  private actionErrorSignal = signal<string | null>(null);
  readonly actionError = this.actionErrorSignal.asReadonly();

  constructor() {
    this.loadEntries();
  }

  // Public so the UI can offer a retry rather than making the user reload.
  loadEntries() {
    this.loadStateSignal.set('loading');
    this.http.get<JournalEntry[]>(API_URL).subscribe({
      next: (entries) => {
        this.entriesSignal.set(entries);
        this.loadStateSignal.set('ready');
      },
      error: () => this.loadStateSignal.set('failed'),
    });
  }

  // The server owns both the id and the timestamp, so the entry only reaches
  // the signal once it has come back stamped (pessimistic update).
  addEntry(content: string) {
    const requestBody: JournalEntryCreate = { content };
    this.actionErrorSignal.set(null);
    this.http.post<JournalEntry>(API_URL, requestBody).subscribe({
      next: (createdEntry) => {
        this.entriesSignal.update((entries) => [...entries, createdEntry]);
      },
      error: () => this.actionErrorSignal.set(ADD_FAILED),
    });
  }

  // <void> because the server answers 204: there's deliberately nothing left
  // to send back.
  deleteEntry(id: string) {
    this.actionErrorSignal.set(null);
    this.http.delete<void>(`${API_URL}/${id}`).subscribe({
      next: () => {
        this.entriesSignal.update((entries) => entries.filter((entry) => entry.id !== id));
      },
      error: () => this.actionErrorSignal.set(DELETE_FAILED),
    });
  }

  // PATCH sends only the changed field and the server responds with the whole
  // entry, which replaces our copy — so the two ends can't quietly disagree,
  // and the untouched createdAt comes back from the server rather than being
  // preserved by hand here.
  updateContent(id: string, content: string) {
    const requestBody: JournalEntryUpdate = { content };
    this.actionErrorSignal.set(null);
    this.http.patch<JournalEntry>(`${API_URL}/${id}`, requestBody).subscribe({
      next: (updatedEntry) => {
        this.entriesSignal.update((entries) =>
          entries.map((entry) => (entry.id === id ? updatedEntry : entry))
        );
      },
      error: () => this.actionErrorSignal.set(UPDATE_FAILED),
    });
  }
}
