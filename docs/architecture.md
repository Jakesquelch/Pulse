# JakeOS - Technical Architecture

## Overview

JakeOS is built as a modern single-page application (SPA) using Angular's standalone component architecture, running **zoneless** (no zone.js — change detection is driven by signals). The app is organised **by feature**: each feature folder co-locates everything that feature needs, and the same three roles repeat inside each one:

```
page component   →  what the user sees (thin view)
service (+spec)  →  state + logic (signals, persistence)
model            →  the shape of the data (interface)
```

Components never own shared data; they read signals from services and call service methods. Persistence is an implementation detail *inside* the services — currently localStorage, later a backend API, with no component changes needed.

## Frontend Architecture

### Technology Stack

- **Framework:** Angular 21.0.1 (standalone components, zoneless)
- **Language:** TypeScript 5.9.3
- **State:** Angular signals (`signal`, `computed`, `effect`) — no NgRx/Redux
- **Routing:** Angular Router (standalone)
- **Forms:** Template-driven (`ngModel`)
- **Persistence:** localStorage (per-service keys, JSON-serialized)
- **Styling:** Custom CSS design system with theme tokens
- **Build System:** Angular CLI with esbuild

### Folder Structure

```
frontend/src/app/
├── app.ts / app.html / app.css   # App shell: sidebar + router outlet
├── app.routes.ts                 # Route table
├── dashboard/                    # Home: greeting, quick capture, stats, up-next
│   └── dashboard.ts/.html/.css
├── tasks/
│   ├── to-do-list.ts/.html/.css  # Tasks page
│   ├── task.model.ts
│   ├── task.service.ts           # Task state (key: jakeos-tasks)
│   └── task.service.spec.ts
├── journal/
│   ├── journal.ts/.html/.css     # Journal page
│   ├── journal-entry.model.ts
│   └── journal.service.ts        # Entry state (key: jakeos-journal)
├── habits/
│   ├── habit-tracker.ts/.html/.css  # Habits page + 7-day grid
│   ├── habit.model.ts
│   ├── habit.service.ts          # Habit state (key: jakeos-habits)
│   └── habit.service.spec.ts
└── core/                         # Cross-cutting, shared by features
    ├── theme.service.ts          # Active theme (key: jakeos-theme)
    └── util/date.ts              # toLocalDate() — local "YYYY-MM-DD" strings
```

Adding a feature means adding one folder; a feature folder importing from
another (e.g. `dashboard/` importing the three data services) makes
cross-feature dependencies visible in the import paths.

## The Service Pattern

Every data service follows the same shape (worth reading `task.service.ts` as the reference):

```typescript
@Injectable({ providedIn: 'root' })        // one shared instance, app-wide
export class TaskService {
  private tasksSignal = signal<Task[]>(this.loadTasks());  // seeded from localStorage
  readonly tasks = this.tasksSignal.asReadonly();          // components get read-only view

  constructor() {
    effect(() => {                          // auto-save on every change
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tasksSignal()));
    });
  }

  addTask(...)    { this.tasksSignal.update(tasks => [...tasks, newTask]); }
  deleteTask(id)  { this.tasksSignal.update(tasks => tasks.filter(...)); }
  // all updates are immutable — required for signals to detect changes
}
```

Key points:
- **Writes are private** — components can only mutate through service methods.
- **Updates are immutable** (`[...arr]`, `.map`, `.filter`), never in-place mutation.
- **Saving is automatic** via `effect()`; no method needs to remember to persist.
- **`ThemeService`** is the same pattern, but its effect writes `data-theme` onto `<html>` as well as localStorage.

## Components

### App Shell (`app.ts`)
The root component is the persistent frame: sidebar (logo, nav links via
`routerLink`/`routerLinkActive`, theme switcher dots, date) with a `<router-outlet>`
alongside. Pages render inside the shell, so navigation is always visible.

### Dashboard (`dashboard/`)
Injects all three data services and derives everything with `computed()`:
task done/total + progress, journal count + last entry, habits-done-today,
and the top-3 "Up next" tasks. Quick-capture box adds a task from the home screen.

### To-Do List (`tasks/`)
Thin view over `TaskService`: `computed()` priority sort, inline editing,
hover-revealed actions. Form state (inputs mid-typing) stays in the component —
only *shared* data lives in services.

### Journal (`journal/`)
Composer + entries newest-first over `JournalService`. Entry text renders in the
serif display font with `white-space: pre-wrap`.

### Habit Tracker (`habits/`)
Rolling 7-day grid over `HabitService`. A habit's history is
`completedDates: string[]` of local dates; streaks are computed by walking
backwards from today. Uses `core/util/date.ts` to avoid the UTC date-shift pitfall.

## Data Models

All ids are UUID strings from `crypto.randomUUID()` (previously `Date.now()`
numbers, which could collide if two items were created in the same millisecond).

```typescript
// tasks/task.model.ts
type TaskGroup = 'fun' | 'personal' | 'work';
interface Task {
  id: string;                    // crypto.randomUUID() at creation
  title: string;
  description?: string;          // in the model, not yet in the UI
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  group?: TaskGroup;
}

// journal/journal-entry.model.ts
interface JournalEntry {
  id: string;
  content: string;
  createdAt: string;             // ISO timestamp
}

// habits/habit.model.ts
interface Habit {
  id: string;
  name: string;
  completedDates: string[];      // local "YYYY-MM-DD" strings
}
```

## Routing (`app.routes.ts`)

```typescript
routes: Routes = [
  { path: '', component: Dashboard },
  { path: 'todo', component: ToDoList },
  { path: 'journal', component: Journal },
  { path: 'habit', component: HabitTracker },
]
```

- Flat structure, no lazy loading (fine at this size)
- No route guards yet (arrives with authentication)

## Styling & Theming

### Design System (`styles.css`)
All visual decisions live as CSS custom properties ("design tokens"):
colors (`--bg`, `--surface`, `--ink`, `--accent`, `--done`, priority colors…),
shape (`--radius`), and type (`--font-display` serif, `--font-body` sans).

### Themes
Four palettes redefine the same token names, keyed off `data-theme` on `<html>`:

| Theme | Character |
|---|---|
| **Oat** (default) | light — neutral oat paper, clay accent |
| **Dusk** | warm taupe-grey mid tone |
| **Ink** | desaturated navy, warm cream text |
| **Candlelit** | dark coffee-brown, candle-amber accent |

`ThemeService` stamps the attribute; switching themes swaps every color at once
because components only ever reference tokens. First visit follows the OS
light/dark preference; the choice persists in localStorage.

### CSS Layers
- **Global (`styles.css`):** tokens, base styles, shared classes (`.card`, `.btn`,
  `.field`, `.pill`, `.tag`, `.list`, page headers)
- **Component CSS:** page-specific layout only (stat grid, week grid, composer…)
- Encapsulation: Angular's default `ViewEncapsulation.Emulated`

## Persistence Model (current)

Browser localStorage, one key per service, JSON-serialized on every change,
parsed on startup (with try/catch fallback to empty). Consequences:
per-browser/per-device, no sync, cleared with site data.

Known flaw (pinned by characterization tests in the task and habit specs): if
the stored JSON is corrupt, the load falls back to `[]` and the auto-save
effect then overwrites the corrupt — possibly recoverable — bytes with `[]`
one tick after startup. The identical load/persist code is copy-pasted across
all three data services; both problems point at the same fix, a shared
persistence seam. This is the layer the planned FastAPI backend will replace —
see `features.md` for the roadmap.
