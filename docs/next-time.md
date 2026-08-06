1. How App gets onto the page (the bootstrap chain)

index.html contains an <app-root> tag and loads main.ts:5, which calls:

bootstrapApplication(App, appConfig)

That says: "find the element matching App's selector (app-root) and render this component into it, configured by appConfig." So the chain is: index.html → main.ts → App component → everything else.

app.config.ts is the app-wide setup. The important line is provideRouter(routes) — this is what turns on routing and hands it your route table. Without it, <router-outlet> would do nothing. This is the modern Angular style ("standalone bootstrap"); older Angular apps did this with an AppModule class instead, which you may see in tutorials — you don't have one, and that's deliberate and current.

2. The @Component decorator (app.ts:6-12)

A decorator is metadata stapled to a class. The class App is just plain TypeScript; the decorator tells Angular how to treat it as a component:

- selector: 'app-root' — the HTML tag name this component answers to. Only used once, in index.html.
- standalone: true — this is the default in Angular 21, so this line is actually redundant — harmless, but you could delete it. It means the component declares its own dependencies instead of belonging to an NgModule.
- imports: [...] — the things the template uses. This is the idea people miss: if app.html uses <router-outlet>, the class must import RouterOutlet, or the tag does nothing. Same story for routerLink (→ RouterLink) and routerLinkActive (→ RouterLinkActive).
- templateUrl / styleUrl — point at app.html and app.css. Component styles are scoped: rules in app.css only affect this component's own template, which is why global stuff (theme palettes) lives in styles.css instead.

One note: CommonModule in your imports is doing almost nothing. It provides *ngIf/*ngFor and pipes — but your template uses the new @for syntax (built into the language, no import needed). The one thing it is earning its keep for is the date pipe, via {{ today | date: 'EEEE d MMMM' }} in app.html:37. You could swap it for just DatePipe instead of the whole CommonModule.

3. Dependency injection (app.ts:14)

private themeService = inject(ThemeService);

You never write new ThemeService() anywhere. Angular maintains a registry of services; inject(ThemeService) asks the registry for the instance. Because ThemeService has @Injectable({ providedIn: 'root' }) (theme.service.ts:8), there is exactly one instance for the whole app — if the habit page also injects ThemeService, it gets the same object, same state. That's how components share state in this app.

(inject() is the modern form of the older pattern using constructor parameters: constructor(private themeService: ThemeService). Same result.)

4. Signals — the theme service (the important one)

This is the most important pattern in the app, so it's worth slowing down on.

In theme.service.ts:12, the current theme is stored in a signal:

private themeSignal = signal<ThemeName>(this.loadTheme());
readonly theme = this.themeSignal.asReadonly();

A signal is a box holding a value that notifies interested parties when it changes. You read it by calling it — theme() — and that's why app.html:30 has t === theme(), not t === theme. When something calls themeSignal.set(...), Angular knows exactly which templates read that signal and updates only those.

Two design choices here are good habits worth repeating elsewhere:

- The write side is private, the read side is public. Components get theme (read-only) and must go through setTheme(...) to change it. That means the one place something can go wrong is one method in one file — when something breaks, you know where to look.
- The effect() in the constructor (theme.service.ts:18) is a "when this signal changes, do a side-effect" hook. Every time the theme changes it stamps <html data-theme="..."> and saves to localStorage. The components know nothing about localStorage or the DOM — they just say "set theme to dusk" and the effect handles the consequences. That separation is why the CLAUDE.md rule ("components only reference tokens") holds: the CSS keys off html[data-theme], and only the service touches that attribute.

Then in App, we're just re-exposing service state to the template:

themes = this.themeService.themes;  // plain array, never changes
theme = this.themeService.theme;    // the read-only signal, passed through

Templates can only see properties of their own component, not services directly — that's why App re-exposes what the template needs.

5. The one slightly clever line

setTheme(theme: (typeof this.themes)[number]) {

typeof this.themes gets the array's type; [number] means "an element of that array" — which resolves to 'oat' | 'dusk' | 'ink' | 'candlelit'. It's equivalent to writing theme: ThemeName (importing that type from the service), just derived instead of imported. Honestly, importing ThemeName would be clearer — this version is showing off a bit.

6. The template, briefly (app.html)

You already have the big picture right: sidebar is permanent, <router-outlet> at line 42 is the only part that changes on navigation. A few bindings worth naming, since they're the vocabulary you'll use everywhere:

- [class.active]="t === theme()" — adds/removes the active class as the expression changes. Reactive because theme() is a signal read.
- (click)="setTheme(t)" — click event → component method.
- @for (t of themes; track t) — loop; track t tells Angular how to identify items so it can reuse DOM nodes instead of rebuilding the list. For a 4-item static array it barely matters, but it's mandatory syntax.
- routerLinkActive="active" with [routerLinkActiveOptions]="{ exact: true }" on the Dashboard link only — without exact, / counts as a prefix of every URL, so Dashboard would stay highlighted on every page.

---

The one-paragraph summary: main.ts bootstraps App into <app-root>; App is a thin shell that renders chrome (nav + theme picker) and delegates page content to the router. It holds no state of its own — theme lives in the singleton ThemeService as a signal, and the theme picker is just "read the signal to highlight the dot, call the service to change it."

A good check of understanding before we move on: can you say why clicking a theme dot causes the colours to change, step by step, from (click) to CSS? Once that chain feels obvious, the natural next step is the Dashboard component — the router side of the shell. Which would you like?
