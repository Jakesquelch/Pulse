# Pulse - Technical Architecture

## Overview

Pulse is **two programs**: an Angular single-page app in `frontend/`, and a
FastAPI server in `backend/` that owns the data. They talk over HTTP —
`localhost:4200` to `localhost:8000` — and both must be running for the app to
work.

The frontend uses Angular's standalone component architecture, running
**zoneless** (no zone.js — change detection is driven by signals). It is
organised **by feature**: each feature folder co-locates everything that feature
needs, and the same three roles repeat inside each one:

```
page component   →  what the user sees (thin view)
service (+spec)  →  state + logic (signals, talking to the API)
model            →  the shape of the data (interface)
```

Components never own shared data; they read signals from services and call
service methods. Where the data actually *lives* is an implementation detail
*inside* the services — which is why the migration below has been possible one
feature at a time, with no component changes.

> **Mid-migration.** Tasks are fully backend-backed (SQLite via the API).
> Journal and habits are still localStorage. See
> [Persistence Model](#persistence-model-current) for the split and
> `fable-plan.md` for the remaining phases.

## Frontend Architecture

### Technology Stack

- **Framework:** Angular 21.0.1 (standalone components, zoneless)
- **Language:** TypeScript 5.9.3
- **State:** Angular signals (`signal`, `computed`, `effect`) — no NgRx/Redux
- **Routing:** Angular Router (standalone)
- **Forms:** Template-driven (`ngModel`)
- **HTTP:** Angular `HttpClient` (`provideHttpClient()` in `app.config.ts`)
- **Persistence:** the API for tasks; localStorage for journal/habits (see below)
- **Styling:** Custom CSS design system with theme tokens
- **Build System:** Angular CLI with esbuild

### Backend Technology Stack

- **Framework:** FastAPI (Python), served by uvicorn on `localhost:8000`
- **Validation:** Pydantic models — enforced at *runtime*, unlike TS types
- **Database:** SQLite (`backend/pulse.db`) via the stdlib `sqlite3` module —
  **no ORM**, deliberately: hand-written SQL is the point at this stage
- **CORS:** `localhost:4200` allowed explicitly, nothing wider

### Folder Structure

```
backend/
├── main.py           # HTTP layer: routes, Pydantic models, status codes
├── storage.py        # ALL SQL — the backend's persistence seam
├── pulse.db          # SQLite file (gitignored — local data, not source)
└── requirements.txt

frontend/src/app/
├── app.ts / app.html / app.css   # App shell: sidebar + router outlet
├── app.routes.ts                 # Route table
├── dashboard/                    # Home: greeting, quick capture, stats, up-next
│   └── dashboard.ts/.html/.css
├── tasks/
│   ├── to-do-list.ts/.html/.css  # Tasks page
│   ├── task.model.ts             # Task, TaskCreate, TaskUpdate
│   ├── task.service.ts           # Talks to the API — no localStorage
│   └── task.service.spec.ts
├── journal/
│   ├── journal.ts/.html/.css     # Journal page
│   ├── journal-entry.model.ts
│   └── journal.service.ts        # Entry state (key: pulse-journal)
├── habits/
│   ├── habit-tracker.ts/.html/.css  # Habits page + 7-day grid
│   ├── habit.model.ts
│   ├── habit.service.ts          # Habit state (key: pulse-habits)
│   └── habit.service.spec.ts
└── core/                         # Cross-cutting, shared by features
    ├── persisted-signal.ts       # The persistence seam (+ spec)
    ├── theme.service.ts          # Active theme (key: pulse-theme)
    └── util/date.ts              # toLocalDate() — local "YYYY-MM-DD" strings
```

Adding a feature means adding one folder; a feature folder importing from
another (e.g. `dashboard/` importing the three data services) makes
cross-feature dependencies visible in the import paths.

## The Service Pattern

Every data service exposes the same *surface* — a private writable signal, a
public read-only view, and methods — but there are currently **two flavours**
underneath, because the migration is half done.

### Migrated: API-backed (`task.service.ts` — the reference going forward)

```typescript
@Injectable({ providedIn: 'root' })        // one shared instance, app-wide
export class TaskService {
  private http = inject(HttpClient);
  // A cache of what the server last said — NOT the source of truth. Starts
  // empty on every page load; the server is the only thing that knows.
  private tasksSignal = signal<Task[]>([]);
  readonly tasks = this.tasksSignal.asReadonly();

  constructor() {                          // fill the cache on startup
    this.http.get<Task[]>(API_URL).subscribe(tasks => this.tasksSignal.set(tasks));
  }

  addTask(...) {                           // pessimistic: server first, then signal
    this.http.post<Task>(API_URL, requestBody).subscribe(createdTask => {
      this.tasksSignal.update(tasks => [...tasks, createdTask]);
    });
  }
}
```

The important shift: **updates are pessimistic**. The signal changes only after
the server has accepted the change, and for PATCH the service stores the
server's returned task rather than merging locally — so the two can never
quietly disagree. `toggleComplete` and `updateTitle` both funnel through a
private `patchTask()`.

### Not yet migrated: seam-backed (`journal.service.ts`, `habit.service.ts`)

```typescript
private entriesSignal = persistedSignal<JournalEntry[]>('pulse-journal', []);
```

`persistedSignal()` (`core/persisted-signal.ts`) is **the persistence seam**: the
one place that knows state lives in localStorage. It returns a signal seeded
from storage, with an `effect()` inside that auto-saves every change. Services
know their storage *key* but nothing about the storage *mechanism*.

Phase 4 of `fable-plan.md` moves these two to the API as well. At that point
`persistedSignal` has no callers left and gets deleted along with its spec.

Key points (true of both flavours):
- **Writes are private** — components can only mutate through service methods.
- **Updates are immutable** (`[...arr]`, `.map`, `.filter`), never in-place mutation.
- **`ThemeService`** doesn't use the seam and isn't migrating: theme is a UI
  preference of *this browser*, not user data, so localStorage is the right
  home for it. It keeps its own `effect()`, which writes `data-theme` onto
  `<html>` as well as localStorage.

## The Backend

`main.py` owns HTTP; `storage.py` owns SQL. The endpoints translate HTTP into
calls on named storage functions and translate the answers back:

```python
@app.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: str):
    deleted = storage.delete_task(task_id)          # returns a bool
    if not deleted:
        raise HTTPException(status_code=404, detail=f"No task with id {task_id}")
```

`storage.py` knows nothing about HTTP — it never raises `HTTPException`, it just
reports what happened to the data (`delete_task` → `bool`, `update_task` →
`dict | None`). That's what makes it callable from a test or a script with no
web server involved. It's the same separation as "services don't know about
button clicks".

| Endpoint | Behaviour |
|---|---|
| `GET /tasks` | All tasks |
| `POST /tasks` | Server owns `id` (uuid4) and `completed`; returns the created task |
| `DELETE /tasks/{id}` | `204 No Content`, or `404` if the id is unknown |
| `PATCH /tasks/{id}` | Partial update, returns the full updated task, or `404` |

Details worth knowing inside `storage.py`:

- **Parameterised queries only.** Values travel as `?` placeholders, never
  f-strings — that's the SQL-injection lesson. Column *names* can't be
  parameterised, so the PATCH builds its `SET` clause from a hardcoded
  `UPDATABLE_COLUMNS` tuple, never from client input.
- **`group` is a reserved SQL word**, so the column is quoted `"group"` — which
  keeps row keys mapping straight onto the frontend's `Task` interface.
- **SQLite has no boolean type** (`completed` is stored 0/1). `_row_to_task()`
  is where the database's representation stops and the API's begins.
- **One connection per operation**, because sqlite3 connections belong to the
  thread that created them and FastAPI runs sync endpoints on a threadpool.
  `with connection:` commits the transaction but does *not* close it, so the
  context manager does both.

### PATCH semantics

`TaskUpdate` has every field optional, and the endpoint uses
`model_dump(exclude_unset=True)` — **not** `exclude_none`. That's what makes it
a real PATCH: only fields the client actually sent are applied, so toggling
`completed` can't clobber a title that was never sent. An explicit
`"group": null` survives as an intentional "remove the grouping", and
`response_model_exclude_none=True` drops it on the way out so the client sees an
absent key rather than a null — matching `group?: TaskGroup` in the model.

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

Journal and habit ids are UUID strings from `crypto.randomUUID()` (previously
`Date.now()` numbers, which could collide if two items were created in the same
millisecond). **Task ids now come from the server** (`uuid.uuid4()` in
`main.py`) — the client no longer invents them, because the server owns the
data.

```typescript
// tasks/task.model.ts
type TaskGroup = 'fun' | 'personal' | 'work';
interface Task {
  id: string;                    // server-generated (uuid4)
  title: string;
  completed: boolean;            // server-owned, false at creation
  priority: 'low' | 'medium' | 'high';
  group?: TaskGroup;
}

// What the client may send, derived from Task so they can't drift apart:
type TaskCreate = Omit<Task, 'id' | 'completed'>;   // server owns what's removed
type TaskUpdate = Partial<Omit<Task, 'id'>>;        // PATCH: only changed fields

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

The `Task` models are mirrored by Pydantic models in `backend/main.py`
(`Task`, `TaskCreate`, `TaskUpdate`). Per the CLAUDE.md rule these must not
drift: the backend never accepts something looser than the frontend declares.
Because they're the contract, `response_model=` is set on every endpoint —
FastAPI then validates what goes *out* as well as what comes in, and publishes
the schema at `/docs`.

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

Two mechanisms coexist while the migration finishes:

| Data | Where it lives | Survives |
|---|---|---|
| **Tasks** | `backend/pulse.db` (SQLite), reached over HTTP | server restart, browser change, clearing site data |
| **Journal** | localStorage `pulse-journal` | refresh only — this browser, this machine |
| **Habits** | localStorage `pulse-habits` | refresh only — this browser, this machine |
| **Theme** | localStorage `pulse-theme` | staying put — a per-browser preference by design |

### Tasks

The Angular signal is a **cache**, not storage. It starts empty on every page
load and is filled by `GET /tasks`; every mutation goes to the server first and
updates the signal from the response. The server is the single source of truth,
which is what killed the "zombie task" bug (deletes that only ever happened in
the browser and came back on refresh).

The trade this makes: **the backend must be running.** With uvicorn down the
browser has nothing to read — it can't open `pulse.db` itself, it only speaks
HTTP. Offline-first (a local read cache plus a replay queue for writes) would
change that, but it drags in conflict resolution and tombstones, and is
explicitly out of scope for the MVP. Being *honest* about a dead server is
Phase 3's job instead.

**Currently that honesty is missing** — no `subscribe` has an error callback, so
an unreachable backend renders as a normal, empty page. Known gap, next phase.

### Journal and habits

Browser localStorage, one key per service, JSON-serialized on every change,
parsed on startup — all inside `core/persisted-signal.ts`. Consequences:
per-browser/per-device, no sync, cleared with site data.

If stored JSON is corrupt, the seam backs the raw bytes up to
`<key>-corrupt` before falling back to empty, so bad data never crashes the
app and is never silently destroyed. (Earlier versions wiped corrupt data
one tick after startup — a flaw found by characterization tests, fixed when
the seam was extracted.)

The seam did its job: it is exactly what `TaskService` deleted when tasks moved
to the API, with no component changes. Phase 4 does the same for these two and
retires the seam entirely — see `fable-plan.md`.
