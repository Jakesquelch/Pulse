import { effect, Injectable, signal } from '@angular/core';

export type ThemeName = 'oat' | 'dusk' | 'ink' | 'candlelit';

const STORAGE_KEY = 'jakeos-theme';
const THEMES: ThemeName[] = ['oat', 'dusk', 'ink', 'candlelit'];

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly themes = THEMES;

  private themeSignal = signal<ThemeName>(this.loadTheme());
  readonly theme = this.themeSignal.asReadonly();

  constructor() {
    // Stamps the choice onto <html data-theme="...">, which is what
    // the token blocks in styles.css key off — and remembers it.
    effect(() => {
      const theme = this.themeSignal();
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem(STORAGE_KEY, theme);
    });
  }

  private loadTheme(): ThemeName {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeName | null;
    if (saved && THEMES.includes(saved)) return saved;
    // First visit: respect the visitor's OS preference.
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'candlelit' : 'oat';
  }

  setTheme(theme: ThemeName) {
    this.themeSignal.set(theme);
  }
}
