# Fable plan — road to a stable MVP

Written 11th August, mid-migration. State when written: `GET /tasks` and
`POST /tasks` exist and are wired to Angular. Delete/toggle/rename are still
localStorage-only ghosts (the zombie-task bug). Habits and journal are pure
localStorage. Backend storage is an in-memory list that dies on restart.

> **Progress: all five phases done.** Phase 1 ✅ (11th Aug) · Phase 2 ✅
> (12th Aug) · Phase 3 ✅ (13th Aug) · Phase 4 ✅ (14th Aug) · Phase 5 ✅
> (14th Aug). The MVP as scoped below is complete — see the bottom of this
> file for what that turned out to mean.

The ordering below is deliberate: **finish CRUD before persistence**, so you
persist a complete, correct API rather than retrofitting endpoints onto a
database later. Each phase leaves the app working — no phase strands it.

---

## Phase 1 — Finish task CRUD ✅ done 11th Aug

The server becomes the single authority for tasks; the zombie bug dies here.

- `DELETE /tasks/{task_id}` — first path parameter. The URL names the
  resource, the method says what to do to it.
- First `HTTPException`: deleting/updating an id that doesn't exist → 404.
- Update endpoint — **homework: come with a PUT-vs-PATCH opinion.**
  PUT replaces the whole task; PATCH changes some fields. You have two
  partial updates (toggle `completed`, rename `title`), which hints one way,
  but argue it before reading the answer. You'll want a `TaskUpdate` Pydantic
  model with all-optional fields, mirrored in `task.model.ts` per the
  CLAUDE.md rule.
- Wire `deleteTask`, `toggleComplete`, `updateTitle` in `TaskService` to the
  new endpoints (same pessimistic-update shape as `addTask`).
- **Retire `persistedSignal` from TaskService** — plain `signal([])`. The
  persistence seam has done its job for this feature. Some
  `task.service.spec.ts` tests will fail; per the 7th Aug tracker note,
  that's the plan working. Rewrite them against the new behaviour
  (mock `HttpClient` — `provideHttpClientTesting` is the tool to meet here).

**Done when:** delete a task, restart uvicorn — wait, it's still gone from
the *server's* memory only until restart. True check: delete, refresh — it
stays deleted while the server runs. No task operation touches localStorage.

## Phase 2 — SQLite persistence ✅ done 12th Aug

Built as planned: `backend/storage.py` owns all SQL, stdlib `sqlite3`, no ORM.
One thing the plan didn't call out and the build met anyway: sqlite3 connections
are per-thread and FastAPI runs sync endpoints on a threadpool, so it's one
connection per operation rather than a shared global one. Column named `"group"`
(quoted) rather than `task_group`, so rows map straight onto the frontend model.


Yes, this is the DB step, and SQLite is the right call: a single file on
disk, zero servers to run, ships with Python (`import sqlite3`), and is
genuinely production-grade for a single-user app. Not a toy compromise.

- **Recommendation: use the stdlib `sqlite3` module directly, not an ORM
  (SQLAlchemy/SQLModel) yet.** Given the ownership goal, writing
  `CREATE TABLE`, `INSERT`, `SELECT`, `UPDATE`, `DELETE` by hand teaches
  what an ORM would hide. An ORM is a later refactor if the SQL gets
  repetitive — you'll then know exactly what it's saving you.
- Shape: a `storage.py` (or `db.py`) module owning all SQL — the backend's
  version of the persistence seam. Endpoints in `main.py` call named
  functions (`list_tasks()`, `create_task(...)`), never raw SQL.
- Concepts you'll meet: schema definition, parameterised queries
  (`?` placeholders — **never** f-strings into SQL; that's the injection
  lesson), converting rows ↔ dicts, `NULL` for the optional `group`
  (note: `group` is a reserved word in SQL — name the column `"group"`
  quoted, or `task_group`).
- Delete the two hardcoded seed tasks — the deferred cleanup happens here.
- Add `pulse.db` to `.gitignore`.

**Done when:** add a task, kill uvicorn, restart, refresh — it's still there.

## Phase 3 — Honest failure handling ✅ done 13th Aug

Right now every failure is silent: no `subscribe` has an error callback, so
a dead backend looks like stale-but-normal data. Fine mid-migration,
disqualifying for an MVP calling itself stable.

- Error callbacks on every HTTP call in `TaskService`.
- One visible, theme-token-styled "couldn't reach the server" state in the
  tasks UI (a signal like `loadFailed` the template reads). No toast
  library needed.
- Decide loading behaviour: what shows between page load and GET response?
  Even just an `@if` on a `loading` signal.
- Backend tests: `pytest` + FastAPI's `TestClient` — the backend twin of
  the Vitest specs. Test the 404s especially; error paths rot fastest.

## Phase 4 — Migrate habits and journal ✅ done 14th Aug

Planned as repetition; it wasn't, quite, and that was the useful part.

Habits turned out to be the first thing in the project that doesn't fit in one
row: `completedDates` is a list, so it became a second table
(`habit_completions`) with a composite primary key `(habit_id, date)` and
`ON DELETE CASCADE`. That in turn forced a real API design question, because
"toggle" isn't something a server can act on idempotently — a completion
became its own resource at `/habits/{id}/completions/{date}`, marked with PUT
and unmarked with DELETE. The trap met along the way: SQLite has foreign keys
**off** by default, per connection, so the CASCADE silently does nothing
without `PRAGMA foreign_keys = ON`.

Journal was the flat one, with one new decision: `createdAt` is server-owned
like `id`, and no edit can change it.

Three copies of the same UI also proved which pieces were genuinely shared, so
`LoadState`, `LoadErrorPanel` and `ServerErrorBanner` moved to `core/`.

And as planned: `persistedSignal` and its spec are deleted. The localStorage
era is over — the theme is all that's left there.

## Phase 5 — MVP polish ✅ done 14th Aug

- `README.md`: how to run both halves from a fresh clone (venv setup,
  `pip install -r requirements.txt`, `uvicorn main:app --reload`,
  `npm start`). Write it, then actually follow it top to bottom.
- The hardcoded `http://localhost:8000` in services → Angular
  `environments/` config (one obvious seam, same idea as `STORAGE_KEY`).
- A pass over the docs (`architecture.md`, `my-understanding.md`,
  `visual.md`) — they still describe the localStorage era.

---

## Explicitly out of scope for MVP

Auth/users, deployment, Docker, an ORM, habits/journal analytics, and
anything multi-user. Single user, localhost, one SQLite file — that *is*
the MVP. Resist scope creep; the 6th Aug tracker entry knows why.

## Rough session map

| Session | Focus | |
|---|---|---|
| 1 | DELETE + PATCH endpoints, frontend wiring, retire seam from tasks | ✅ 11th Aug |
| 2 | SQLite: schema, storage module, endpoints read/write the DB | ✅ 12th Aug |
| 3 | Error/loading states + pytest suite | ✅ 13th Aug |
| 4–5 | Habits, then journal (increasingly solo) | ✅ 14th Aug |
| 6 | Polish: README, environments, doc sweep | ✅ 14th Aug |

Six sessions estimated, four days actual — sessions 4, 5 and 6 landed together.

---

## What the MVP turned out to be

Finished on 14th August 2026. Two programs, four SQLite tables, 115 tests
(67 backend, 48 frontend), and no localStorage outside the theme switcher.

Everything in "explicitly out of scope" above stayed out of scope, which is
the part worth noticing.

Three known gaps, recorded rather than fixed, because none of them block the
MVP as scoped:

- **No component tests.** Every test is a service or an endpoint; templates are
  checked only by the compiler.
- **Typed text is lost if a write fails.** Both composers clear their input on
  submit, before the request lands. Worst on the journal. Fixing it properly
  means services reporting success back to components — a change to a pattern
  all three share, so it deserves its own session rather than a quick patch.
- **Pre-migration localStorage data is stranded.** `pulse-habits` and
  `pulse-journal` still hold whatever was written before 14th Aug, and nothing
  reads those keys now. Recoverable with a one-off import; invisible until then.

Natural next steps, in rough order of value: the write-failure fix above,
component tests, then whichever of the "future ideas" in `features.md` you
actually want. Auth and deployment remain out of scope until there's a reason.
