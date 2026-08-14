"""Shared test fixtures.

pytest imports this file automatically for every test in this folder, so
fixtures defined here are available to all of them without being imported.

`import storage` below reaches one level up into backend/ — that works because
pytest.ini sets `pythonpath = .`, not by accident.
"""

import pytest
from fastapi.testclient import TestClient

import storage


@pytest.fixture
def client(tmp_path, monkeypatch):
    """A TestClient wired to a throwaway database.

    Two problems to solve, both inherited from decisions in the app itself:

    1. `storage.DB_PATH` is a module-level constant pointing at the real
       pulse.db. Left alone, this suite would create, mutate and delete rows in
       the database you actually use. monkeypatch redirects it and — crucially —
       puts it back afterwards, so one forgotten cleanup can't leak into the
       next test.

    2. It has to be a *file*, not SQLite's `:memory:`. `storage._connection()`
       opens a new connection per operation (deliberately — sqlite3 connections
       are thread-bound and FastAPI runs sync endpoints on a threadpool), and
       every new connection to `:memory:` gets its own blank database. A task
       POSTed by one request would be gone before the next could read it.

    tmp_path is pytest's own per-test temporary directory, so each test starts
    from an empty database and nothing has to be cleaned up by hand.
    """
    monkeypatch.setattr(storage, "DB_PATH", tmp_path / "test.db")

    # Imported here rather than at the top of the file because main.py calls
    # storage.init_db() at import time. At the top, that would run against the
    # real DB_PATH before the line above could redirect it.
    import main

    # Python caches modules, so main's own init_db() only ever runs on the
    # first test. Every later test needs its fresh database set up explicitly.
    storage.init_db()

    return TestClient(main.app)


@pytest.fixture
def created_task(client):
    """One task already in the database, for tests that need something to act on.

    Returns the server's version, so tests use the real generated id rather
    than one they made up.
    """
    response = client.post("/tasks", json={"title": "Existing", "priority": "medium"})
    return response.json()


@pytest.fixture
def created_habit(client):
    """One habit already in the database, with no completions yet."""
    response = client.post("/habits", json={"name": "Stretch"})
    return response.json()
