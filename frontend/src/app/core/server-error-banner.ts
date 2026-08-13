import { Component, input } from '@angular/core';

/**
 * A "that didn't work" banner, shared by every page that writes through a
 * service.
 *
 * Deliberately presentational: it takes a message and knows nothing about
 * tasks, HTTP or services, so habits and journal can reuse it unchanged once
 * they move to the backend. It renders nothing at all when there's no message,
 * which is why callers can hand it a signal's value directly without wrapping
 * the tag in their own `@if`.
 */
@Component({
  selector: 'app-server-error-banner',
  standalone: true,
  template: `
    @if (message()) {
      <p class="banner" role="alert">{{ message() }}</p>
    }
  `,
  styles: `
    /* --hi-bg is the high-priority pill's background: not literally an "error"
       token, but it's the soft warning tone that exists in all four palettes,
       so this stays readable whichever theme is on. */
    .banner {
      margin: 0 0 16px;
      padding: 12px 16px;
      border: 1px solid var(--danger);
      border-radius: var(--radius-sm);
      background: var(--hi-bg);
      color: var(--danger);
      font-size: 0.92rem;
    }
  `,
})
export class ServerErrorBanner {
  // null is the "nothing is wrong" case, matching what the service signals
  // hold, so no caller has to translate between the two.
  message = input<string | null>(null);
}
