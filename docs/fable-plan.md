# Fable plan — road to a stable MVP

Written 11th August, mid-migration. State right now: `GET /tasks` and
`POST /tasks` exist and are wired to Angular. Delete/toggle/rename are still
localStorage-only ghosts (the zombie-task bug). Habits and journal are pure
localStorage. Backend storage is an in-memory list that dies on restart.

The ordering below is deliberate: **finish CRUD before persistence**, so you
persist a complete, correct API rather than retrofitting endpoints onto a
database later. Each phase leaves the app working — no phase strands it.

---

## Phase 1 — Finish task CRUD (next session)

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

## Phase 2 — SQLite persistence

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

## Phase 3 — Honest failure handling

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

## Phase 4 — Migrate habits and journal

Repetition on purpose: same endpoints, same wiring, same retirement of
`persistedSignal`, but done mostly from memory this time. That's the test
of whether Phase 1–2 knowledge stuck. Two new tables in the same SQLite
file. After this, `persistedSignal` has no callers left — delete it and its
spec, and the localStorage era is over.

## Phase 5 — MVP polish

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

| Session | Focus |
|---|---|
| 1 | DELETE + PATCH endpoints, frontend wiring, retire seam from tasks |
| 2 | SQLite: schema, storage module, endpoints read/write the DB |
| 3 | Error/loading states + pytest suite |
| 4–5 | Habits, then journal (increasingly solo) |
| 6 | Polish: README, environments, doc sweep |
