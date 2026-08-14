import { Component, output } from '@angular/core';

/**
 * The "we couldn't load this at all" panel, shared by every page backed by
 * the API.
 *
 * The distinction from ServerErrorBanner matters: the banner sits *above*
 * still-accurate data when one write failed, whereas this *replaces* the data
 * entirely, because a failed GET means we don't know what the data is.
 *
 * Its wording is deliberately feature-neutral — nothing here says "tasks" or
 * "habits" — so the panel needs no inputs at all. It emits `retry` and lets
 * the page decide what reloading means.
 */
@Component({
  selector: 'app-load-error-panel',
  standalone: true,
  template: `
    <div class="load-error" role="alert">
      <p class="load-error-text">
        Couldn't reach the server, so there's nothing to show. Check the backend
        is running on localhost:8000.
      </p>
      <button class="btn" (click)="retry.emit()">Try again</button>
    </div>
  `,
  styles: `
    .load-error {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 14px;
      padding: 26px 20px;
    }

    .load-error-text {
      margin: 0;
      max-width: 46ch;
      color: var(--muted);
      font-size: 0.95rem;
    }
  `,
})
export class LoadErrorPanel {
  // An output rather than a URL or a service: this component knows how to say
  // "that didn't work", and nothing about how to make it work.
  retry = output<void>();
}
