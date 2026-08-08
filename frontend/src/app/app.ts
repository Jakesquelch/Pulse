import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ThemeName, ThemeService } from './core/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DatePipe, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private themeService = inject(ThemeService);

  // Templates can only see properties of their own component,
  // not services directly - that why we have to re-expose the 
  // themeService state here (so that app.html can use it)
  themes = this.themeService.themes;
  theme = this.themeService.theme;
  today = new Date();

  setTheme(theme: ThemeName) {
    this.themeService.setTheme(theme);
  }
}
