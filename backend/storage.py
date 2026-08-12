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
    try:
        with connection:
            yield connection
    finally:
        connection.close()


def _row_to_task(row: sqlite3.Row) -> dict:
    """Convert a database row into the dict shape the API returns.

    SQLite has no boolean type — `completed` comes back as 0 or 1 — so this is
    where storage's representation stops and the API's begins.
    """
    task = dict(row)
    task["completed"] = bool(task["completed"])
    return task


def init_db() -> None:
    """Create the tasks table if this is a fresh database."""
    with _connection() as connection:
        connection.execute(CREATE_TASKS_TABLE)


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
