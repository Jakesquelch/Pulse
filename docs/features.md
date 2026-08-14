# Pulse - Features & Implementation Status

## Feature Overview

This document provides a breakdown of all features, their current implementation status, and what remains to be built.

Last major update: 14th August 2026 — the migration is **finished**. All three
features are backend-backed by SQLite via the API, honest failure states are in
place, and `persistedSignal` is deleted. See `fable-plan.md` for the phases
this completed.

---

## 🏠 Dashboard

### Status: ✅ COMPLETE

The old landing page is now a proper dashboard (`dashboard/`) — the home screen of the app.

#### Implemented Features:
- ✅ Time-of-day greeting and date
- ✅ Quick-capture box (adds a medium-priority task from anywhere)
- ✅ Live stat cards for each module, computed from the shared services:
  - Tasks: done/total with progress meter
  - Journal: entry count + time of last entry
  - Habits: done-today count with one dot per habit
- ✅ "Up next" — top three open tasks by priority
- ✅ Stat cards navigate to their module

---

## ✅ To-Do List Module

### Status: ✅ COMPLETE (core)

Task management with priorities, optional grouping, and persistence.

### Implemented Features:
- ✅ Add tasks (title, priority, optional group) — Enter key or button
- ✅ Priority pills (High/Medium/Low) with per-theme colors
- ✅ Group shown as a tag chip
- ✅ Automatic sorting by priority
- ✅ Complete/uncomplete via checkbox (strikes through the title only)
- ✅ Inline editing with Save/Cancel
- ✅ Delete (Edit/Delete revealed on row hover)
- ✅ **Persistence via the backend API + SQLite** — every add/edit/toggle/delete
  is a real HTTP call; data survives a server restart
- ✅ Empty state message (only once the load has landed — never before)
- ✅ **Honest failure states** — a "couldn't reach the server" panel with a
  retry button when the load fails, and a banner above the still-accurate list
  when a single write fails

### Technical Implementation:
- Model: `tasks/task.model.ts` (`id`, `title`, `completed`, `priority`, `group?`),
  plus `TaskCreate` / `TaskUpdate` derived from it — mirrored by Pydantic models in `backend/main.py`
- `tasks/task.service.ts` holds a plain `signal<Task[]>([])` used as a **cache**;
  `HttpClient` calls the API and the signal is updated from the server's response
  (pessimistic updates). No localStorage — `persistedSignal` was retired here.
- Component (`tasks/to-do-list.ts`) is a thin view layer: `computed()` for sorting, methods delegate to the service
- Backend: `GET`/`POST`/`PATCH`/`DELETE` on `/tasks`, with 404s for unknown ids

### Future Ideas:
- [ ] Task description (removed from the model — it was never in the UI)
- [ ] Due dates
- [ ] Filtering (priority/group/completion) and search
- [ ] Drag & drop reordering
- [ ] Subtasks

---

## 📔 Journal Module

### Status: ✅ COMPLETE (core)

Free-form journaling — the heart of the "dump your mind" idea.

### Implemented Features:
- ✅ Write entries in a textarea composer
- ✅ Entries listed newest-first with date/time stamps
- ✅ Edit and delete (revealed on hover)
- ✅ Multi-line entries preserved (`white-space: pre-wrap`)
- ✅ Serif reading typography for entry text
- ✅ **Persistence via the backend API + SQLite** — the `journal_entries` table
- ✅ **Server-owned timestamps** — `createdAt` is stamped by the server, and no
  edit can change it, so rewording an entry never moves its place in the journal
- ✅ Honest failure states (same load panel + write banner as tasks)

### Technical Implementation:
- Model: `journal/journal-entry.model.ts` (`id`, `content`, `createdAt` ISO
  timestamp), plus `JournalEntryCreate` (just `{ content }`) and
  `JournalEntryUpdate` — mirrored by Pydantic models in `backend/main.py`
- `journal/journal.service.ts` — the same cache-signal + `HttpClient` pattern
  as tasks, with `loadState` and `actionError`
- Backend: `GET`/`POST`/`DELETE`/`PATCH` on `/journal`; entries returned
  oldest-first so the dashboard's "last entry" is well-defined

### Future Ideas:
- [ ] Tags / mood tracking
- [ ] Search and date-range filtering
- [ ] Calendar view
- [ ] Full-screen writing mode
- [ ] Export (Markdown/PDF)

---

## 🎯 Habit Tracker Module

### Status: ✅ COMPLETE (core)

Daily habit tracking over a rolling 7-day window.

### Implemented Features:
- ✅ Add/delete habits
- ✅ Last 7 days as clickable day cells (weekday + day number, today outlined)
- ✅ Toggle any of the 7 days done/undone
- ✅ 🔥 Streak counter (consecutive days, forgiving of an unticked today)
- ✅ **Persistence via the backend API + SQLite** — two tables, `habits` and
  `habit_completions`, one row per day done
- ✅ Ticking a day is idempotent — double-clicks and retries can't double-record
- ✅ Honest failure states (same load panel + write banner as tasks)

### Technical Implementation:
- Model: `habits/habit.model.ts` (`id`, `name`, `completedDates: string[]` of local `"YYYY-MM-DD"` strings)
  plus `HabitCreate` (just `{ name }`) — mirrored by Pydantic models in `backend/main.py`
- `habits/habit.service.ts` — the same cache-signal + `HttpClient` pattern as tasks
- Backend: `GET`/`POST`/`DELETE` on `/habits`, plus a completion sub-resource —
  `PUT`/`DELETE /habits/{id}/completions/{date}` — so the client sends an
  unambiguous instruction rather than "flip it, whatever it is"
- Local-date helper in `core/util/date.ts` (avoids the UTC off-by-one-day pitfall)

### Future Ideas:
- [ ] Longer history / calendar view
- [ ] Habit frequency (weekly, custom)
- [ ] Success-rate stats
- [ ] Archive habits

---

## 🎨 Design System & Theming

### Status: ✅ COMPLETE

- ✅ Token-based design system in `styles.css` (colors, radii, type as CSS variables)
- ✅ Four themes: **Oat** (light), **Dusk** (warm grey), **Ink** (navy), **Candlelit** (dark)
- ✅ Theme switcher (swatch dots in the sidebar), choice persisted (`pulse-theme`)
- ✅ First visit follows the OS light/dark preference
- ✅ Persistent sidebar navigation (app shell in `app.html`)
- ✅ Serif display font, shared `.card`/`.btn`/`.pill` component classes

---

## 🔐 Authentication & User Management

### Status: ❌ NOT IMPLEMENTED

- [ ] User registration / login / logout
- [ ] Multi-device sync

---

## 🌐 Backend & API

### Status: ✅ COMPLETE for the MVP — all three features migrated

Python **FastAPI** backend (`backend/`) with **SQLite**, using the stdlib
`sqlite3` module directly — **no ORM**, a deliberate choice to write the SQL by
hand and learn what an ORM would hide. Run it with `./run-backend.sh`
(`http://localhost:8000`, interactive docs at `/docs`).

- ✅ REST API for all three features, with 404s on unknown ids
- ✅ SQLite persistence — `backend/pulse.db`, all SQL in `backend/storage.py`,
  four tables (`tasks`, `habits`, `habit_completions`, `journal_entries`)
- ✅ Angular `HttpClient` integration + CORS (`localhost:4200` allowed explicitly)
- ✅ Pydantic models mirroring every frontend model, `response_model=` on every
  endpoint so what goes *out* is validated too
- ✅ Error + loading states in the UI when the server is unreachable
- ✅ Backend tests — `pytest` + FastAPI `TestClient`
- ✅ `apiUrl` moved out of the services into `src/environments/environment.ts`

**Note:** the app requires the backend to be running. Offline-first support
(a local cache with a write queue) is out of scope for the MVP — the app
*reports* an unreachable server honestly rather than working around it.

---

## 📱 Responsive Design

### Status: ⚠️ DESKTOP-FIRST

The new layout is desktop-oriented; the sidebar shell needs a mobile treatment.

- [ ] Mobile-responsive layouts (collapsible sidebar)
- [ ] Touch-friendly controls

---

## 🧪 Testing

### Status: ✅ SERVICE + API LEVEL DONE — 115 tests

Two suites that mirror each other: the frontend specs fake the *network* to
test services without a server, the backend tests fake the *database* to test
the server without a browser. Both run with nothing else switched on.

**Frontend — 48 tests, Vitest (jsdom) via `ng test`**, specs next to the
service they test, all using `provideHttpClientTesting`:

- ✅ `TaskService` — right verb/URL/body per call, the signal only changes once
  the server responds, PATCH stores the server's version not a local merge
- ✅ `HabitService` — same, plus `toggleDate` picking PUT vs DELETE from local
  state, taking the server's date ordering, and sending nothing for an unknown id
- ✅ `JournalService` — same, plus `createdAt` coming from the server and
  surviving an edit
- ✅ Failure handling in all three — load failure, retry recovery, each write
  failing without corrupting the cached list, and errors clearing on success

**Backend — 67 tests, `pytest` + FastAPI `TestClient`** against a throwaway
database in a temp folder (never `pulse.db`):

- ✅ `test_tasks.py` — CRUD, the group contract, PATCH semantics, error paths
- ✅ `test_habits.py` — completions, idempotence, ordering, and the CASCADE
  (that one was verified by removing the `PRAGMA foreign_keys = ON` and
  confirming it fails)
- ✅ `test_journal.py` — server-owned `createdAt`, its format, immutability
  under edit, and ordering

Not covered: **component tests.** Every spec here is a service or an endpoint;
nothing exercises a template, so a broken `@if` in a page would compile and
pass. `ng build` catches type errors in templates, which is a floor, not a net.

- [ ] Component tests

---

## 📦 Deployment & DevOps

### Status: ❌ NOT IMPLEMENTED

- [ ] Hosting setup
- [ ] CI/CD pipeline

---

## Summary

### Completion Status:
- **Dashboard:** ✅ done, and honest when any of the three services can't load
- **To-Do List:** ✅ core done, fully backend-backed
- **Journal:** ✅ core done, fully backend-backed
- **Habit Tracker:** ✅ core done, fully backend-backed
- **Design system / theming:** ✅ done
- **Backend/API:** ✅ all three features migrated, 67 tests
- **Authentication:** ❌ (out of scope for the MVP)
- **Testing:** ✅ service + API level; ⚠️ no component tests
- **Deployment:** ❌ (out of scope for the MVP)

Pulse is genuinely two programs, and every module is real data on disk rather
than a per-browser copy. The MVP as scoped in `fable-plan.md` is complete: CRUD,
persistence, honest failure handling, all three features migrated, and polish.

Known gaps, none of them blocking:
- **No component tests** — templates are only checked by the compiler.
- **Typed text is lost if a write fails.** Both composers clear the input on
  submit, before the POST lands, so a failed add loses what you typed. Worst on
  the journal, where it could be a paragraph.
- **Old localStorage data is stranded.** Anything written under `pulse-habits`
  or `pulse-journal` before 14th Aug is still in the browser and unread by any
  code. Recoverable with a one-off import; not lost, but not visible.
