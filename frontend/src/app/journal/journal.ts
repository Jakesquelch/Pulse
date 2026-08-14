import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { JournalEntry } from './journal-entry.model';
import { JournalService } from './journal.service';
import { ServerErrorBanner } from '../core/server-error-banner';
import { LoadErrorPanel } from '../core/load-error-panel';

@Component({
  selector: 'app-journal',
  standalone: true,
  imports: [CommonModule, FormsModule, ServerErrorBanner, LoadErrorPanel],
  templateUrl: './journal.html',
  styleUrl: './journal.css',
})
export class Journal {
  private journalService = inject(JournalService);

  loadState = this.journalService.loadState;
  actionError = this.journalService.actionError;
  newEntryContent = '';
  editingEntryId: string | null = null;
  editEntryContent = '';

  // Newest entry first.
  sortedEntries = computed(() =>
    [...this.journalService.entries()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
  );

  addEntry() {
    if (!this.newEntryContent.trim()) return;
    this.journalService.addEntry(this.newEntryContent);
    this.newEntryContent = '';
  }

  deleteEntry(id: string) {
    this.journalService.deleteEntry(id);
  }

  retryLoad() {
    this.journalService.loadEntries();
  }

  editEntry(entry: JournalEntry) {
    this.editingEntryId = entry.id;
    this.editEntryContent = entry.content;
  }

  saveEntry(entry: JournalEntry) {
    if (!this.editEntryContent.trim()) return;
    this.journalService.updateContent(entry.id, this.editEntryContent);
    this.editingEntryId = null;
  }

  cancelEdit() {
    this.editingEntryId = null;
  }
}
