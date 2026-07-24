---
name: ng-component
description: Scaffold a new Angular standalone component following JakeOS conventions.
disable-model-invocation: true
---

Create a standalone Angular component named $ARGUMENTS, following the conventions
used by the existing page components in `src/app/pages/` (e.g. `habit-tracker`,
`journal`, `to-do-list`, `dashboard`):

1. Place it in `src/app/components/<name>/` with three files: `<name>.ts`,
   `<name>.html`, `<name>.css`. No `.component` suffix on the filename or class
   name (e.g. `HabitTracker`, not `HabitTrackerComponent`). Note: `components/`
   is distinct from `src/app/pages/`, which is where routed, top-level pages
   live (`habit-tracker`, `journal`, `to-do-list`, `dashboard`). `components/`
   is for smaller, reusable, non-routed pieces — it doesn't exist yet, so this
   may be the first component to create it.
2. `@Component` decorator: `selector: 'app-<name>'`, `standalone: true`,
   `imports: [...]` (only what the template actually uses — e.g. `CommonModule`,
   `FormsModule`, `RouterLink`), `templateUrl: './<name>.html'`,
   `styleUrl: './<name>.css'` (singular, not `styleUrls`).
3. State:
   - Anything that should persist or be shared belongs in a service under
     `src/app/services/`, not the component: a private writable `signal()`
     exposed as `readonly x = this.xSignal.asReadonly()`, with a constructor
     `effect()` that syncs it to `localStorage`. Never use RxJS `BehaviorSubject`.
   - The component injects the service with `private x = inject(XService)` and
     derives view state with `computed()`.
   - Purely local, ephemeral state (form inputs, edit-mode flags) is a plain
     class field, not wrapped in `signal()` — matches the existing pages.
4. Template uses Angular's built-in control flow (`@if`/`@for`/`@switch`), never
   `*ngIf`/`*ngFor`/`*ngSwitch`.
5. CSS references theme tokens only (e.g. `var(--surface)`, `var(--border)`) —
   never raw color values.
6. Don't add a `.spec.ts` — none of the existing components have one. I do however
   want to add these in the future.