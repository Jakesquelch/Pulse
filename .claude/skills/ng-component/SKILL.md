---
name: ng-component
description: Scaffold a new Angular standalone component following JakeOS conventions.
disable-model-invocation: true
---

Create a standalone Angular component named $ARGUMENTS, following the conventions
used by the existing page components in the feature folders under `src/app/`
(e.g. `habits/habit-tracker`, `journal/journal`, `tasks/to-do-list`,
`dashboard/dashboard`):

1. The app is organised by feature: each feature folder under `src/app/`
   (`dashboard/`, `tasks/`, `habits/`, `journal/`) holds its routed page
   component plus its model, service, and spec; shared cross-cutting code lives
   in `src/app/core/`. If the new component belongs to an existing feature,
   place it in that feature's folder; a component shared across features goes
   in `src/app/shared/<name>/` (doesn't exist yet — this may be the first
   component to create it). Three files: `<name>.ts`, `<name>.html`,
   `<name>.css`. No `.component` suffix on the filename or class name
   (e.g. `HabitTracker`, not `HabitTrackerComponent`).
2. `@Component` decorator: `selector: 'app-<name>'`, `standalone: true`,
   `imports: [...]` (only what the template actually uses — e.g. `CommonModule`,
   `FormsModule`, `RouterLink`), `templateUrl: './<name>.html'`,
   `styleUrl: './<name>.css'` (singular, not `styleUrls`).
3. State:
   - Anything that should persist or be shared belongs in a service in the
     feature's folder (e.g. `src/app/habits/habit.service.ts`), not the
     component: a private writable `signal()`
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