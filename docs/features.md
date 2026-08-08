# JakeOS - Features & Implementation Status

## Feature Overview

This document provides a breakdown of all features, their current implementation status, and what remains to be built.

Last major update: August 2026 (service tests with Vitest + restructure into feature folders).

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
- ✅ **Persistence via localStorage** (`jakeos-tasks`)
- ✅ Empty state message

### Technical Implementation:
- Model: `tasks/task.model.ts` (`id`, `title`, `description?`, `completed`, `priority`, `group?`)
- State lives in `tasks/task.service.ts` — a signal, updated immutably, auto-saved to localStorage by an `effect()`
- Component (`tasks/to-do-list.ts`) is a thin view layer: `computed()` for sorting, methods delegate to the service

### Future Ideas:
- [ ] Task description in the UI (field exists in the model)
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
- ✅ **Persistence via localStorage** (`jakeos-journal`)

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
- ✅ **Persistence via localStorage** (`jakeos-habits`)

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
- ✅ Theme switcher (swatch dots in the sidebar), choice persisted (`jakeos-theme`)
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

### Status: ❌ NOT IMPLEMENTED (next up)

Planned: Python **FastAPI** backend with **SQLite** (via SQLAlchemy), replacing the
localStorage layer inside the services with HTTP calls. The service layer was built
so components won't change when this happens.

- [ ] REST API (tasks first, then journal/habits)
- [ ] Database
- [ ] Angular `HttpClient` integration + CORS setup

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

- ✅ `TaskService` spec — load/add/toggle/delete/rename + persistence timing
- ✅ `HabitService` spec — same coverage + `toggleDate` behavior
- ✅ Characterization tests pinning the corrupt-localStorage silent wipe
  (expected to fail — and be rewritten — when persistence is hardened)
- [ ] `JournalService` spec
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
- **To-Do List:** ✅ core done (persistence included)
- **Journal:** ✅ core done
- **Habit Tracker:** ✅ core done
- **Design system / theming:** ✅ done
- **Backend/API:** ❌ next up
- **Authentication:** ❌
- **Testing:** ⚠️ service specs underway (tasks + habits done, journal next)
- **Deployment:** ❌

The frontend is now a genuinely usable local-first app. The next big step is the
FastAPI + SQLite backend, then authentication and sync.
