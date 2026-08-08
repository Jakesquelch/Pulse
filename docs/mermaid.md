# JakeOS Architecture

```mermaid
---
id: 447b6665-61a0-439f-9087-079346da219f
---
graph TD
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

    ToDo --> TaskService["TaskService<br/>tasks/ — signal: tasks"]
    Journal --> JournalService["JournalService<br/>journal/ — signal: entries"]
    Habit --> HabitService["HabitService<br/>habits/ — signal: habits"]

    TaskService -.-> TaskModel["Task / TaskGroup<br/>tasks/task.model.ts"]
    JournalService -.-> JournalModel["JournalEntry<br/>journal/journal-entry.model.ts"]
    HabitService -.-> HabitModel["Habit<br/>habits/habit.model.ts"]

    TaskService --> LocalStorage[("localStorage<br/>jakeos-tasks")]
    JournalService --> LocalStorage2[("localStorage<br/>jakeos-journal")]
    HabitService --> LocalStorage3[("localStorage<br/>jakeos-habits")]
    ThemeService --> LocalStorage4[("localStorage<br/>jakeos-theme")]

    ThemeService -->|"data-theme attr"| Styles["styles.css<br/>oat / dusk / ink / candlelit tokens"]

    classDef page fill:#4a7ba6,stroke:#2c4a63,color:#fff
    classDef service fill:#a65c4a,stroke:#63302c,color:#fff
    classDef storage fill:#5c8a5c,stroke:#345234,color:#fff
    classDef model fill:#8a7a5c,stroke:#524834,color:#fff

    class Dashboard,ToDo,Journal,Habit page
    class TaskService,JournalService,HabitService,ThemeService service
    class LocalStorage,LocalStorage2,LocalStorage3,LocalStorage4 storage
    class TaskModel,JournalModel,HabitModel model
```

## Notes

- All pages are standalone Angular components (no NgModules).
- The app is organised by feature: each feature folder under `src/app/`
  (`dashboard/`, `tasks/`, `habits/`, `journal/`) co-locates its page component,
  model, service, and service spec. Cross-cutting code lives in `core/`.
- Each feature (tasks, journal, habits) follows the same pattern: a page component
  injects a service; the service holds state in an Angular `signal`, persists it to
  `localStorage` via an `effect`, and exposes typed model interfaces.
- `ThemeService` is the odd one out — it lives in `core/`, is injected directly by
  the app shell (`app.ts`) rather than a page, and drives the four CSS-variable
  palettes in `styles.css` by setting `data-theme` on `<html>`.
- Dashboard is a read-only aggregator: it injects all three feature services to
  show summary stats but doesn't own any state itself.
