# Pulse Architecture

Pulse is two programs. The dashed HTTP arrow is the boundary between them —
everything above it runs in the browser, everything below it runs in uvicorn.

```mermaid
---
id: 447b6665-61a0-439f-9087-079346da219f
---
graph TD
    subgraph FE["Frontend — Angular · localhost:4200"]
        Root["App (app.ts)<br/>shell + theme switcher"]
        Router{{"Router<br/>app.routes.ts"}}

        Root --> Router

        Router -->|"''"| Dashboard["Dashboard<br/>dashboard/"]
        Router -->|"/todo"| ToDo["ToDoList<br/>tasks/to-do-list"]
        Router -->|"/journal"| Journal["Journal<br/>journal/"]
        Router -->|"/habit"| Habit["HabitTracker<br/>habits/habit-tracker"]

        Root --> ThemeService["ThemeService<br/>core/ — signal: theme"]

        Dashboard --> TaskService
        Dashboard --> JournalService
        Dashboard --> HabitService

        ToDo --> TaskService["TaskService<br/>tasks/ — signal: tasks (cache)"]
        Journal --> JournalService["JournalService<br/>journal/ — signal: entries"]
        Habit --> HabitService["HabitService<br/>habits/ — signal: habits"]

        TaskService -.-> TaskModel["Task / TaskCreate / TaskUpdate<br/>tasks/task.model.ts"]
        JournalService -.-> JournalModel["JournalEntry<br/>journal/journal-entry.model.ts"]
        HabitService -.-> HabitModel["Habit<br/>habits/habit.model.ts"]

        JournalService --> Seam
        HabitService --> Seam
        Seam["persistedSignal()<br/>core/persisted-signal.ts"] --> LocalStorage[("localStorage<br/>pulse-journal · pulse-habits<br/>(+ -corrupt backups)")]
        ThemeService --> LocalStorage4[("localStorage<br/>pulse-theme")]

        ThemeService -->|"data-theme attr"| Styles["styles.css<br/>oat / dusk / ink / candlelit tokens"]
    end

    TaskService ==>|"HttpClient<br/>GET · POST · PATCH · DELETE"| Main

    subgraph BE["Backend — FastAPI · localhost:8000"]
        Main["main.py<br/>routes · Pydantic models · status codes"]
        Storage["storage.py<br/>ALL SQL — the backend's seam"]
        DB[("pulse.db<br/>SQLite · tasks table")]

        Main -->|"list/create/update/delete_task()"| Storage
        Storage -->|"parameterised queries"| DB
    end

    Main -.-> PydanticModels["Task / TaskCreate / TaskUpdate<br/>mirrors task.model.ts"]

    classDef page fill:#4a7ba6,stroke:#2c4a63,color:#fff
    classDef service fill:#a65c4a,stroke:#63302c,color:#fff
    classDef storage fill:#5c8a5c,stroke:#345234,color:#fff
    classDef model fill:#8a7a5c,stroke:#524834,color:#fff

    class Dashboard,ToDo,Journal,Habit page
    class TaskService,JournalService,HabitService,ThemeService,Seam,Main,Storage service
    class LocalStorage,LocalStorage4,DB storage
    class TaskModel,JournalModel,HabitModel,PydanticModels model
```

## Notes

- All pages are standalone Angular components (no NgModules).
- The app is organised by feature: each feature folder under `src/app/`
  (`dashboard/`, `tasks/`, `habits/`, `journal/`) co-locates its page component,
  model, service, and service spec. Cross-cutting code lives in `core/`.
- **The diagram is mid-migration, and that's the most important thing on it.**
  `TaskService` crosses the HTTP boundary to the server. `JournalService` and
  `HabitService` still go through the seam to localStorage. Phase 4 of
  `fable-plan.md` points those two at the backend as well, after which
  `persistedSignal` has no callers and is deleted.
- Every feature still follows the same *shape* — a page component injects a
  service, the service owns a signal, components only read it. What changed for
  tasks is what sits behind the signal: it's now a cache of the server's answer
  rather than the source of truth.
- Inside the backend the same seam idea repeats one level down: `main.py` speaks
  HTTP and never writes SQL; `storage.py` writes SQL and knows nothing about
  HTTP (it returns `bool` / `dict | None`, and `main.py` turns those into 404s).
- The two model boxes are one contract in two languages — the Pydantic models
  mirror `task.model.ts`, and per CLAUDE.md the backend must never be looser
  than the frontend declares.
- `ThemeService` is the odd one out — it lives in `core/`, is injected directly by
  the app shell (`app.ts`) rather than a page, and drives the four CSS-variable
  palettes in `styles.css` by setting `data-theme` on `<html>`. It is *not*
  migrating: a theme choice belongs to this browser, not to the user's data.
- Dashboard is a read-only aggregator: it injects all three feature services to
  show summary stats but doesn't own any state itself.
