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
*inside* the services — which is why the migration was possible one feature at
a time, with only the changes each page needed to report failure honestly.

> **Migration complete (14th Aug).** All three features — tasks, habits and
> journal — are backend-backed by SQLite via the API. localStorage now holds
> exactly one thing: the theme preference. `core/persisted-signal.ts` and its
> spec are deleted. See [Persistence Model](#persistence-model) below.

## Frontend Architecture

### Technology Stack

- **Framework:** Angular 21.0.1 (standalone components, zoneless)
- **Language:** TypeScript 5.9.3
- **State:** Angular signals (`signal`, `computed`, `effect`) — no NgRx/Redux
- **Routing:** Angular Router (standalone)
- **Forms:** Template-driven (`ngModel`)
- **HTTP:** Angular `HttpClient` (`provideHttpClient()` in `app.config.ts`)
- **Persistence:** the API for all three features; localStorage only for theme
- **Config:** `src/environments/environment.ts` holds `apiUrl` — the one place
  the API's address is written down
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
├── pytest.ini        # pythonpath = . so tests import main/storage directly
├── requirements.txt
└── tests/
    ├── conftest.py       # `client` fixture: TestClient on a throwaway database
    ├── test_tasks.py
    ├── test_habits.py
    └── test_journal.py

frontend/src/
├── environments/
│   └── environment.ts            # apiUrl — the only place it's written down
└── app/
    ├── app.ts / app.html / app.css   # App shell: sidebar + router outlet
    ├── app.routes.ts                 # Route table
    ├── dashboard/                    # Home: greeting, capture, stats, up-next
    │   └── dashboard.ts/.html/.css
    ├── tasks/
    │   ├── to-do-list.ts/.html/.css  # Tasks page
    │   ├── task.model.ts             # Task, TaskCreate, TaskUpdate
    │   ├── task.service.ts
    │   └── task.service.spec.ts
    ├── journal/
    │   ├── journal.ts/.html/.css     # Journal page
    │   ├── journal-entry.model.ts    # JournalEntry, ...Create, ...Update
    │   ├── journal.service.ts
    │   └── journal.service.spec.ts
    ├── habits/
    │   ├── habit-tracker.ts/.html/.css  # Habits page + 7-day grid
    │   ├── habit.model.ts            # Habit, HabitCreate
    │   ├── habit.service.ts
    │   └── habit.service.spec.ts
    └── core/                         # Cross-cutting, shared by features
        ├── load-state.ts             # 'loading' | 'ready' | 'failed'
        ├── load-error-panel.ts       # "couldn't load this at all" + retry
        ├── server-error-banner.ts    # "that write failed", above good data
        ├── theme.service.ts          # Active theme (key: pulse-theme)
        └── util/date.ts              # toLocalDate() — local "YYYY-MM-DD"
```

The three things in `core/` that aren't the theme or a date helper all exist
for the same reason: they were written once for tasks, and the second and third
feature to need them proved they weren't task-specific. Nothing lands in
`core/` on speculation.

Adding a feature means adding one folder; a feature folder importing from
another (e.g. `dashboard/` importing the three data services) makes
cross-feature dependencies visible in the import paths.

## The Service Pattern

All three data services are now the same shape. Learn one and you've learnt
all of them:

```typescript
@Injectable({ providedIn: 'root' })        // one shared instance, app-wide
export class TaskService {
  private http = inject(HttpClient);
  // A cache of what the server last said — NOT the source of truth. Starts
  // empty on every page load; the server is the only thing that knows.
  private tasksSignal = signal<Task[]>([]);
  readonly tasks = this.tasksSignal.asReadonly();

  // Two failure signals, because they mean different things (see below).
  private loadStateSignal = signal<LoadState>('loading');
  readonly loadState = this.loadStateSignal.asReadonly();
  private actionErrorSignal = signal<string | null>(null);
  readonly actionError = this.actionErrorSignal.asReadonly();

  constructor() { this.loadTasks(); }      // fill the cache on startup

  addTask(...) {                           // pessimistic: server first, then signal
    this.http.post<Task>(API_URL, requestBody).subscribe({
      next: (createdTask) => this.tasksSignal.update(t => [...t, createdTask]),
      error: () => this.actionErrorSignal.set(ADD_FAILED),
    });
  }
}
```

Three ideas carry across all three services:

**Updates are pessimistic.** The signal changes only after the server has
accepted the change, and where the server returns the updated record the
service stores *that* rather than merging locally — so the two ends can never
quietly disagree. It also means a failed write needs no rollback: nothing was
changed to roll back.

**Two failure signals, not one.** A failed GET means the list is *unknown*, so
showing it would be a lie — `loadState` goes `'failed'` and the page replaces
its content with `<app-load-error-panel>`. A failed write means the list is
still accurate and one action didn't land — `actionError` gets a message and
`<app-server-error-banner>` sits *above* the still-good data. Collapsing these
into one boolean would force one of the two into telling the wrong story.

**The observer-object form of `subscribe`.** `subscribe(fn)` only ever takes
the success path, which is why every failure used to be silent. Every call in
the app now passes `{ next, error }`.

Key points:
- **Writes are private** — components can only mutate through service methods.
- **Updates are immutable** (`[...arr]`, `.map`, `.filter`), never in-place mutation.
- **`ThemeService` is the exception, deliberately.** It still uses localStorage
  and its own `effect()`, because a theme is a preference of *this browser*,
  not user data — there's nothing to put on a server. It writes `data-theme`
  onto `<html>` as well as localStorage.

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
| `GET /habits` | All habits, each with its `completedDates` assembled |
| `POST /habits` | Takes `{ name }`; server owns `id`, history starts empty |
| `DELETE /habits/{id}` | `204`, or `404`. Completions cascade away with it |
| `PUT /habits/{id}/completions/{date}` | Mark a day done; returns the habit |
| `DELETE /habits/{id}/completions/{date}` | Unmark a day; returns the habit |
| `GET /journal` | All entries, oldest first |
| `POST /journal` | Takes `{ content }`; server owns `id` **and** `createdAt` |
| `DELETE /journal/{id}` | `204`, or `404` |
| `PATCH /journal/{id}` | Changes `content` only; `createdAt` is immutable |

### A completion is a resource

The habit endpoints are the one place the API stops mirroring the frontend's
method names. `toggleDate` is a *toggle* in the UI, but "flip it, whatever it
is" is not something a server can act on safely — repeat it and you get the
opposite result. So the client decides which way the tick is going by reading
its own state, and sends an unambiguous instruction: `PUT` means "this day is
done", `DELETE` means "it isn't". Both are idempotent, so a double-click or a
retry changes nothing, and the URL carries everything — neither has a body.

### Why habits need two tables

A task is one row. A habit owns a *list* of dates, and a SQL column holds one
value, so the list becomes its own table:

```sql
CREATE TABLE habit_completions (
    habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    date     TEXT NOT NULL,
    PRIMARY KEY (habit_id, date)
)
```

The composite primary key makes "done twice on the same day" impossible to
store rather than something the code remembers to check — which is also what
lets `INSERT OR IGNORE` stand in for the whole idempotence question. `ON
DELETE CASCADE` means deleting a habit takes its history with it.

**The gotcha:** SQLite ships with foreign keys switched **off**, per
connection. Without `PRAGMA foreign_keys = ON` in `_connection()`, that
`REFERENCES` clause is decorative and the cascade silently never fires.
`test_deleting_a_habit_takes_its_completions_with_it` exists to catch exactly
that, and does — verified by removing the pragma and watching it fail.

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
- **`list_habits()` avoids the N+1 problem.** The obvious version — select the
  habits, then loop and select each one's dates — is 51 round trips for 50
  habits. Fetching all completions once and grouping them in Python keeps it
  at two queries whatever the habit count.
- **Column names mirror the frontend where it helps.** `"group"` is quoted
  because it's a reserved word; `createdAt` is camelCase in the journal table.
  Both so a row maps onto the frontend interface with no renaming layer — the
  journal has no `_row_to_entry` because `dict(row)` already *is* the API shape.

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

**Every id now comes from the server** (`uuid.uuid4()` in `main.py`). The
client used to invent them with `crypto.randomUUID()`; it doesn't any more,
because the server owns the data. The same reasoning extended one step further
for the journal: `createdAt` is server-generated too, since "when this was
written" is a fact to record, not a field for a client to assert.

The rule those `Omit`s encode: **a field the client shouldn't control simply
isn't on the create model.** Pydantic drops what it doesn't model, so a client
sending `id` or `createdAt` is ignored rather than obeyed — there's no
validation branch to forget.

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
  createdAt: string;             // server-generated ISO timestamp
}
type JournalEntryCreate = Omit<JournalEntry, 'id' | 'createdAt'>;  // { content }
type JournalEntryUpdate = Partial<Pick<JournalEntry, 'content'>>;  // content only

// habits/habit.model.ts
interface Habit {
  id: string;
  name: string;
  completedDates: string[];      // local "YYYY-MM-DD", sorted by the server
}
type HabitCreate = Omit<Habit, 'id' | 'completedDates'>;           // { name }
```

Every one of these is mirrored by a Pydantic model in `backend/main.py`. Per
the CLAUDE.md rule they must not drift: the backend never accepts something
looser than the frontend declares. Because they're the contract,
`response_model=` is set on every endpoint — FastAPI then validates what goes
*out* as well as what comes in, and publishes the schema at `/docs`.

Two places the Python is written to match the TypeScript rather than the other
way round: `completedDates` and `createdAt` are camelCase field names in
Pydantic models, because Pydantic field names *are* the JSON keys and an alias
layer would earn nothing.

The backend also validates one thing the frontend only documents. A habit
completion's date is typed `completion_date: date` in the path, so FastAPI
rejects `banana` — or `2026-02-30` — with a 422 before any of our code runs.
That's the backend holding the model's `// e.g. "2026-07-03"` comment to its
word.

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

## Persistence Model

One mechanism now, plus one deliberate exception:

| Data | Where it lives | Survives |
|---|---|---|
| **Tasks** | `backend/pulse.db` (SQLite), reached over HTTP | server restart, browser change, clearing site data |
| **Habits** | `backend/pulse.db` — `habits` + `habit_completions` | as above |
| **Journal** | `backend/pulse.db` — `journal_entries` | as above |
| **Theme** | localStorage `pulse-theme` | staying put — a per-browser preference by design |

The Angular signal is a **cache**, not storage. It starts empty on every page
load and is filled by the initial GET; every mutation goes to the server first
and updates the signal from the response. The server is the single source of
truth, which is what killed the "zombie task" bug (deletes that only ever
happened in the browser and came back on refresh).

The trade this makes: **the backend must be running.** With uvicorn down the
browser has nothing to read — it can't open `pulse.db` itself, it only speaks
HTTP. Offline-first (a local read cache plus a replay queue for writes) would
change that, but it drags in conflict resolution and tombstones, and is
explicitly out of scope for the MVP. Being *honest* about a dead server is what
the two failure signals do instead: every page says "couldn't reach the server"
and offers a retry, rather than rendering as a normal, empty page.

### What happened to the localStorage era

`core/persisted-signal.ts` was **the persistence seam** — the one file that
knew state lived in localStorage, returning a signal seeded from storage with
an `effect()` that auto-saved every change. Services knew their storage *key*
but nothing about the *mechanism*.

It did exactly the job it was built for. Each feature's migration deleted one
`persistedSignal(...)` call and replaced it with `HttpClient`, and when journal
— the last caller — moved across on 14th Aug, the file and its spec were
deleted outright. It's in git history if it's ever worth looking back at.

One consequence worth knowing about: **data written in the localStorage era is
still sitting in the browser** under `pulse-habits` and `pulse-journal`, and
nothing reads those keys any more. It isn't lost, but it won't appear in the
app again without a one-off import.
