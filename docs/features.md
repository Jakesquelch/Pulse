# Pulse - Features & Implementation Status

## Feature Overview

This document provides a breakdown of all features, their current implementation status, and what remains to be built.

Last major update: 12th August 2026 (FastAPI backend + SQLite persistence for
tasks — see `fable-plan.md` for the phased migration this is part of).

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
- ✅ Empty state message
- ⚠️ No error state yet if the backend is unreachable (Phase 3)

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
- ✅ **Persistence via localStorage** (`pulse-journal`)

### Technical Implementation:
- Model: `journal/journal-entry.model.ts` (`id`, `content`, `createdAt` ISO timestamp)
- `journal/journal.service.ts` — same signal + localStorage pattern as tasks

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
- ✅ **Persistence via localStorage** (`pulse-habits`)

### Technical Implementation:
- Model: `habits/habit.model.ts` (`id`, `name`, `completedDates: string[]` of local `"YYYY-MM-DD"` strings)
- `habits/habit.service.ts` — same signal + localStorage pattern
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

### Status: ⚠️ IN PROGRESS — tasks migrated, journal/habits not yet

Python **FastAPI** backend (`backend/`) with **SQLite**, using the stdlib
`sqlite3` module directly — **no ORM**, a deliberate choice to write the SQL by
hand and learn what an ORM would hide. Run it with `./run-backend.sh`
(`http://localhost:8000`, interactive docs at `/docs`).

- ✅ REST API for tasks — `GET`, `POST`, `PATCH`, `DELETE` with 404s on unknown ids
- ✅ SQLite persistence — `backend/pulse.db`, all SQL in `backend/storage.py`
- ✅ Angular `HttpClient` integration + CORS (`localhost:4200` allowed explicitly)
- ✅ Pydantic models mirroring the frontend's `Task` / `TaskCreate` / `TaskUpdate`
- [ ] Error + loading states in the UI when the server is unreachable (Phase 3)
- [ ] Backend tests (`pytest` + FastAPI `TestClient`)
- [ ] Journal and habit endpoints (Phase 4) — after which `persistedSignal` is deleted
- [ ] `http://localhost:8000` moved out of the services into `environments/` (Phase 5)

**Note:** the app now requires the backend to be running. Offline-first support
(a local cache with a write queue) is out of scope for the MVP — the plan is to
*report* an unreachable server honestly, not to work around it.

---

## 📱 Responsive Design

### Status: ⚠️ DESKTOP-FIRST

The new layout is desktop-oriented; the sidebar shell needs a mobile treatment.

- [ ] Mobile-responsive layouts (collapsible sidebar)
- [ ] Touch-friendly controls

---

## 🧪 Testing

### Status: ⚠️ IN PROGRESS

Vitest (jsdom) via `ng test`; specs live next to the service they test.

- ✅ `TaskService` spec — rewritten against the API using
  `provideHttpClientTesting`: asserts the right verb/URL/body per call, that the
  signal only changes once the server responds, and that PATCH stores the
  server's version rather than a locally merged one
- ✅ `HabitService` spec — same coverage + `toggleDate` behavior
- ✅ `JournalService` spec — same coverage + `createdAt` stamping/preservation
- ✅ `persistedSignal` spec — load/fallback/auto-save + corrupt-data backup
  (replaced the three per-service "silent wipe" characterization tests when
  the seam refactor fixed the flaw they pinned). Retires with the seam in Phase 4.
- [ ] Backend tests — `pytest` + FastAPI `TestClient`, the backend twin of these
- [ ] Component tests

---

## 📦 Deployment & DevOps

### Status: ❌ NOT IMPLEMENTED

- [ ] Hosting setup
- [ ] CI/CD pipeline

---

## Summary

### Completion Status:
- **Dashboard:** ✅ done
- **To-Do List:** ✅ core done, fully backend-backed
- **Journal:** ✅ core done (still localStorage)
- **Habit Tracker:** ✅ core done (still localStorage)
- **Design system / theming:** ✅ done
- **Backend/API:** ⚠️ tasks migrated; journal/habits to follow
- **Authentication:** ❌
- **Testing:** ⚠️ all frontend service specs done; backend + component tests remain
- **Deployment:** ❌

Pulse is now genuinely two programs, and tasks are real data on disk rather than
a per-browser copy. Remaining for the MVP, in order: honest error/loading states,
then the same migration for journal and habits, then polish (README,
`environments/` config, doc sweep). Auth and sync stay out of scope.
