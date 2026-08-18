# Pulse

https://github.com/user-attachments/assets/26d65307-dca0-44ad-9ca3-06e8628bb3a7

So this projects goal is to be a personal productivity web application designed to help me manage my daily life. I've always been quite an organised person. I like to have systems in place to help me dump information from my brain and get it down somewhere. So I have 3 core modules apart of this project, that I find useful and use day-to-day:

1. **To-Do List** - Task management with priorities and grouping
2. **Journal** - Personal journaling 
3. **Habit Tracker** - Track daily habits and build consistency 

The idea underneath it: most to-do lists are 90% noise. Pulse is meant to help
cut to the signal — the few things actually moving the needle — rather than
making you feel productive for maintaining a list.

## Pulse is two programs

An Angular app in `frontend/` and a FastAPI server in `backend/`, talking over
HTTP. **Both have to be running.** All your data lives in the backend's SQLite
file, so with the API down the frontend has nothing to read — it'll tell you so
and offer a retry rather than showing you an empty page and pretending.

```
frontend/  Angular SPA          localhost:4200
backend/   FastAPI + SQLite     localhost:8000   (interactive docs at /docs)
```

Two terminals, one for each:

```bash
./run-backend.sh     # terminal 1
./run-frontend.sh    # terminal 2
```

Both scripts are safe to re-run — each bails out early if its server is already
up, and installs dependencies only when they've actually changed. On a fresh
clone they'll do the full setup for you.

Then open http://localhost:4200.

### Required Software
- **Node.js** (v18 or higher recommended, I'm on v22.20.0)
- **npm** (11.6.4 or higher, I'm on 11.6.4)
- **Python** 3.10+ (I'm on 3.13.7) — needs to be on your PATH as `python`

---

## Running it manually

If you'd rather not use the scripts, or want to know what they're doing.

### Frontend
```bash
cd frontend 
npm i
npm start (equivalent of ng serve - package.json script)
```

### Backend
```bash
cd backend
source .venv/Scripts/activate (this is the command for bash terminal, might say bin instead of Scripts if the venv was created on mac/linux and not Windows)
pip install -r requirements.txt (only do if you havent installed them yet ofc)
uvicorn main:app --reload
```

On a completely fresh clone there's no venv yet, so create one first with
`python -m venv .venv`. Note that a venv bakes its own absolute path into
`activate` — if you rename or move the project folder, `source activate` will
appear to work (the prompt says `(.venv)`) while `pip` and `uvicorn` quietly
vanish from your PATH. `./run-backend.sh` sidesteps this by calling the venv's
python directly, and warns you if it spots the problem. To fix it:
`rm -rf .venv && ./run-backend.sh`.

---

## Tests

Two suites that mirror each other. The frontend specs fake the *network* to
test services without a server; the backend tests fake the *database* to test
the server without a browser. **Neither needs anything running** — not the API,
not the dev server.

### Frontend (Vitest, 48 tests):
```bash
cd frontend
npm test (equivalent of ng test - package.json script)
```

To run a specific test file:
```bash
cd frontend
ng test --include src/app/tasks/task.service.spec.ts
```

Note: `npx vitest` directly won't work — the Angular builder supplies the test
config, so it has to go through `ng test`.

### Backend (pytest, 67 tests):
```bash
cd backend
source .venv/Scripts/activate
pytest
```
Runs against a throwaway database in a temp folder, never `pulse.db` — your
real tasks are safe.

To run a specific test file or a single test:
```bash
cd backend
pytest tests/test_tasks.py
pytest -k test_deleting_an_unknown_id_is_a_404
```

A quick compile check of the frontend, without running the suite:
```bash
cd frontend
ng build --configuration development
```
Worth doing after template changes — the specs test services, not templates, so
the compiler is what catches a broken `@if`.

---

## The API

Every module is backed by the same SQLite file (`backend/pulse.db`), one table
per thing plus one for habit completions.

| Endpoint | What it does |
|---|---|
| `GET·POST /tasks` · `PATCH·DELETE /tasks/{id}` | Tasks. Server owns `id` and `completed` |
| `GET·POST /habits` · `DELETE /habits/{id}` | Habits |
| `PUT·DELETE /habits/{id}/completions/{date}` | Tick / untick a day. Idempotent |
| `GET·POST /journal` · `PATCH·DELETE /journal/{id}` | Entries. Server owns `id` and `createdAt` |

FastAPI publishes all of it at http://localhost:8000/docs while the backend is
running — you can try every endpoint from there without touching the frontend.

### View the database:
```bash
"/c/Program Files/DB Browser for SQLite/DB Browser for SQLite.exe" ~/Projects/Pulse/backend/pulse.db &
```

---

## Configuration

The API's address is written down in exactly one place:
`frontend/src/environments/environment.ts`. Change `apiUrl` there and the three
services, the error messages and the specs all follow.

---

## Technology Stack
- **OS**: Windows
- **Frontend Framework:** Angular 21.0.1 (standalone components, zoneless — change detection driven by signals)
- **Backend:** FastAPI, Python 3.13.7, served by uvicorn
- **Database:** SQLite via the stdlib `sqlite3` module — no ORM, deliberately
- **Language:** TypeScript 5.9.3
- **Styling:** Custom CSS with theme tokens (four palettes)
- **Testing:** Vitest (frontend), pytest + FastAPI TestClient (backend)
- **AI Model:** Claude Code Pro

## Docs

- [`docs/architecture.md`](docs/architecture.md) — how it's built and why
- [`docs/features.md`](docs/features.md) — what's done, what isn't
- [`docs/mermaid.md`](docs/mermaid.md) — the whole app as one diagram
- [`docs/tracker.md`](docs/tracker.md) — running log of sessions and decisions
- [`docs/fable-plan.md`](docs/fable-plan.md) — the phased plan to a stable MVP
