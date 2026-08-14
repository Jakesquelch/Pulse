export interface JournalEntry {
  id: string;
  content: string;
  createdAt: string; // ISO timestamp, e.g. "2026-07-03T14:30:00.000Z"
}

// What the client may send when writing an entry — mirrors the backend's
// JournalEntryCreate. Both Omitted fields are the server's: it generates the
// id, and it decides what "now" is, so an entry can't be backdated.
export type JournalEntryCreate = Omit<JournalEntry, 'id' | 'createdAt'>;

// What the client may send when editing — mirrors JournalEntryUpdate. Only
// `content`: an entry's timestamp records when it was written, and rewording
// it later doesn't change that, so createdAt isn't editable by anyone.
export type JournalEntryUpdate = Partial<Pick<JournalEntry, 'content'>>;
