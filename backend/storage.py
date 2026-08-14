"""All SQL for Pulse lives here.

This module is the backend's persistence seam: `main.py` handles HTTP
(status codes, validation, 404s) and calls the named functions below, but it
never sees a query string. Swapping SQLite for Postgres later would be a
rewrite of this file and nothing else.
"""

import sqlite3
from contextlib import contextmanager
from pathlib import Path

# Next to this file rather than relative to the shell's working directory, so
# `uvicorn main:app` finds the same database wherever it's launched from.
DB_PATH = Path(__file__).parent / "pulse.db"

# `group` is a reserved word in SQL, so the column is quoted everywhere it
# appears. Keeping the name means a database row maps straight onto the
# frontend's `Task` interface with no renaming layer in between.
CREATE_TASKS_TABLE = """
    CREATE TABLE IF NOT EXISTS tasks (
        id        TEXT PRIMARY KEY,
        title     TEXT NOT NULL,
        completed INTEGER NOT NULL,
        priority  TEXT NOT NULL,
        "group"   TEXT
    )
"""

# The columns a PATCH is allowed to touch. Column *names* can't be passed as
# query parameters (only values can), so any name we splice into SQL has to
# come from a list we wrote — never from client input.
UPDATABLE_COLUMNS = ("title", "completed", "priority", "group")

CREATE_HABITS_TABLE = """
    CREATE TABLE IF NOT EXISTS habits (
        id   TEXT PRIMARY KEY,
        name TEXT NOT NULL
    )
"""

# A habit owns a *list* of dates, and SQL columns hold one value — so the list
# becomes its own table, one row per date the habit was done. This is the
# normalised shape: the arrow points from child to parent (a completion knows
# its habit, a habit doesn't know its completions).
#
# The composite PRIMARY KEY (habit_id, date) is doing real work: it makes
# "done twice on the same day" impossible to store, rather than something we
# remember to check for. ON DELETE CASCADE means deleting a habit takes its
# completions with it — no orphan rows, and no second DELETE to forget.
CREATE_COMPLETIONS_TABLE = """
    CREATE TABLE IF NOT EXISTS habit_completions (
        habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
        date     TEXT NOT NULL,
        PRIMARY KEY (habit_id, date)
    )
"""


@contextmanager
def _connection():
    """Open a connection, commit on success, and always close it.

    Two things worth separating: `with connection:` manages the *transaction*
    (commit on a clean exit, roll back on an exception) and does not close the
    connection — that's what the `finally` is for. A connection per operation
    is deliberate: sqlite3 connections belong to the thread that created them,
    and FastAPI runs sync endpoints on a threadpool.
    """
    connection = sqlite3.connect(DB_PATH)
    # Rows arrive as mapping-like objects (`row["title"]`) instead of tuples.
    connection.row_factory = sqlite3.Row
    # SQLite ships with foreign keys switched OFF for backwards compatibility,
    # and the setting is per-connection, not per-database. Without this line
    # the REFERENCES clause on habit_completions is decorative: the CASCADE
    # never fires and deleted habits leave their completions behind.
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        with connection:
            yield connection
    finally:
        connection.close()


def init_db() -> None:
    """Create any tables this database is missing."""
    with _connection() as connection:
        connection.execute(CREATE_TASKS_TABLE)
        connection.execute(CREATE_HABITS_TABLE)
        connection.execute(CREATE_COMPLETIONS_TABLE)


# --- Tasks ------------------------------------------------------------------
#
# The simple case, and worth reading before the habits section below: a task is
# exactly one row in one table, so each function here is essentially one SQL
# statement with a name on it.
#
# Two conventions hold across both sections. Everything takes and returns plain
# dicts, never Pydantic models — main.py owns the HTTP shapes, this module owns
# the storage ones, and neither imports the other's. And "not found" is
# reported as a return value (None, or False from a delete) rather than an
# exception, because whether a missing row is a 404 or a shrug is an HTTP
# decision, and HTTP decisions don't belong in here.


def _row_to_task(row: sqlite3.Row) -> dict:
    """Convert a database row into the dict shape the API returns.

    SQLite has no boolean type — `completed` comes back as 0 or 1 — so this is
    where storage's representation stops and the API's begins.
    """
    task = dict(row)
    task["completed"] = bool(task["completed"])
    return task


def list_tasks() -> list[dict]:
    with _connection() as connection:
        rows = connection.execute("SELECT * FROM tasks").fetchall()
    return [_row_to_task(row) for row in rows]


def get_task(task_id: str) -> dict | None:
    with _connection() as connection:
        # The `?` placeholder is the whole point: SQLite receives the query and
        # the value separately, so a task_id containing SQL can never be parsed
        # as SQL. An f-string here would be the injection hole.
        row = connection.execute(
            "SELECT * FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()
    return _row_to_task(row) if row else None


def create_task(task: dict) -> None:
    """Insert an already-complete task (id and completed included)."""
    with _connection() as connection:
        connection.execute(
            'INSERT INTO tasks (id, title, completed, priority, "group")'
            " VALUES (?, ?, ?, ?, ?)",
            (
                task["id"],
                task["title"],
                task["completed"],
                task["priority"],
                task["group"],
            ),
        )


def update_task(task_id: str, changes: dict) -> dict | None:
    """Apply a partial update, returning the stored task afterwards.

    Returns None if no task has that id, which is how `main.py` knows to 404.
    """
    unknown_columns = set(changes) - set(UPDATABLE_COLUMNS)
    if unknown_columns:
        raise ValueError(f"Cannot update unknown columns: {sorted(unknown_columns)}")

    # PATCH sends an arbitrary subset of fields, so the SET clause is built to
    # match. Only the column names are spliced in, and only from
    # UPDATABLE_COLUMNS above; every value still travels as a `?` parameter.
    assignments = ", ".join(f'"{column}" = ?' for column in changes)
    values = tuple(changes.values())

    with _connection() as connection:
        # An empty PATCH body is a valid no-op: there's nothing to SET, and
        # `UPDATE tasks SET  WHERE ...` wouldn't even parse.
        if assignments:
            connection.execute(
                f"UPDATE tasks SET {assignments} WHERE id = ?", values + (task_id,)
            )
        row = connection.execute(
            "SELECT * FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()

    return _row_to_task(row) if row else None


def delete_task(task_id: str) -> bool:
    """Delete a task, returning whether one actually existed to delete."""
    with _connection() as connection:
        cursor = connection.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    # rowcount is how many rows the DELETE matched — 0 means the id was never
    # here, which saves a separate SELECT just to decide between 204 and 404.
    return cursor.rowcount > 0


# --- Habits -----------------------------------------------------------------
#
# A habit lives across two tables, so unlike a task it can't be handed back as
# one row. Every function below returns the *assembled* shape — a dict with a
# `completedDates` list — because that's the API's unit, and how it's split up
# for storage is this module's business and nobody else's.


def _habit_exists(connection: sqlite3.Connection, habit_id: str) -> bool:
    # SELECT 1 rather than SELECT *: we only want to know whether a row is
    # there, so there's no reason to carry its columns back.
    row = connection.execute("SELECT 1 FROM habits WHERE id = ?", (habit_id,)).fetchone()
    return row is not None


def _fetch_habit(connection: sqlite3.Connection, habit_id: str) -> dict | None:
    """Assemble one habit, reusing a connection the caller already has open."""
    row = connection.execute("SELECT * FROM habits WHERE id = ?", (habit_id,)).fetchone()
    if row is None:
        return None

    # ORDER BY date sorts ISO strings lexicographically, which for YYYY-MM-DD
    # is the same as chronologically — a small payoff for the date format the
    # frontend already uses.
    completions = connection.execute(
        "SELECT date FROM habit_completions WHERE habit_id = ? ORDER BY date",
        (habit_id,),
    ).fetchall()

    # camelCase because this dict *is* the JSON the frontend's Habit interface
    # expects; the snake_case habit_id column never leaves this module.
    return {**dict(row), "completedDates": [row["date"] for row in completions]}


def list_habits() -> list[dict]:
    """Every habit with its dates, in two queries regardless of habit count.

    The obvious version — SELECT the habits, then loop and SELECT each one's
    dates — is the N+1 query problem: 50 habits means 51 round trips. Fetching
    all completions once and grouping them in Python keeps it at two.
    """
    with _connection() as connection:
        rows = connection.execute("SELECT * FROM habits").fetchall()
        completions = connection.execute(
            "SELECT habit_id, date FROM habit_completions ORDER BY date"
        ).fetchall()

    dates_by_habit: dict[str, list[str]] = {}
    for completion in completions:
        dates_by_habit.setdefault(completion["habit_id"], []).append(completion["date"])

    return [
        {**dict(row), "completedDates": dates_by_habit.get(row["id"], [])} for row in rows
    ]


def get_habit(habit_id: str) -> dict | None:
    with _connection() as connection:
        return _fetch_habit(connection, habit_id)


def create_habit(habit: dict) -> None:
    """Insert a new habit. New habits have no completions by definition."""
    with _connection() as connection:
        connection.execute(
            "INSERT INTO habits (id, name) VALUES (?, ?)",
            (habit["id"], habit["name"]),
        )


def delete_habit(habit_id: str) -> bool:
    """Delete a habit, returning whether one existed to delete.

    Its completions go too, via ON DELETE CASCADE — that's the foreign key
    doing the cleanup instead of a second DELETE we'd have to remember.
    """
    with _connection() as connection:
        cursor = connection.execute("DELETE FROM habits WHERE id = ?", (habit_id,))
    return cursor.rowcount > 0


def add_completion(habit_id: str, date: str) -> dict | None:
    """Mark a habit done on a date. Returns None if the habit doesn't exist.

    OR IGNORE makes this idempotent: marking an already-marked date does
    nothing instead of raising. That only works because of the composite
    primary key — the constraint is precisely the thing being ignored.
    """
    with _connection() as connection:
        if not _habit_exists(connection, habit_id):
            return None
        connection.execute(
            "INSERT OR IGNORE INTO habit_completions (habit_id, date) VALUES (?, ?)",
            (habit_id, date),
        )
        return _fetch_habit(connection, habit_id)


def remove_completion(habit_id: str, date: str) -> dict | None:
    """Unmark a date. Returns None if the habit doesn't exist.

    Deleting a date that wasn't marked is a no-op, not an error: the caller
    asked for it to be absent, and afterwards it is. We deliberately don't
    distinguish that from a real deletion — only a missing *habit* is a 404.
    """
    with _connection() as connection:
        if not _habit_exists(connection, habit_id):
            return None
        connection.execute(
            "DELETE FROM habit_completions WHERE habit_id = ? AND date = ?",
            (habit_id, date),
        )
        return _fetch_habit(connection, habit_id)
