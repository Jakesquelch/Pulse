"""Tests for the /habits API.

Same setup as test_tasks.py — TestClient against a throwaway database — but
the thing under test is different in kind. A task is one row; a habit is a row
plus a set of completion rows in a second table. Most of what follows is
checking that the seam between those two tables never leaks: that the API's
`completedDates` list is always exactly what's in habit_completions, and that
deleting a habit doesn't strand rows behind it.
"""


class TestReadingAndCreating:
    def test_a_fresh_database_has_no_habits(self, client):
        response = client.get("/habits")

        assert response.status_code == 200
        assert response.json() == []

    def test_a_created_habit_comes_back_from_get(self, client):
        client.post("/habits", json={"name": "Read 10 pages"})

        habits = client.get("/habits").json()

        assert len(habits) == 1
        assert habits[0]["name"] == "Read 10 pages"

    def test_a_new_habit_starts_with_no_completed_dates(self, client):
        response = client.post("/habits", json={"name": "Meditate"})

        assert response.json()["completedDates"] == []

    def test_the_server_owns_the_id(self, client):
        # Neither field exists on HabitCreate, so Pydantic drops both rather
        # than letting a client dictate its own id or backdate its history.
        response = client.post(
            "/habits",
            json={"name": "Walk", "id": "chosen-by-me", "completedDates": ["2026-01-01"]},
        )

        habit = response.json()
        assert habit["id"] != "chosen-by-me"
        assert habit["completedDates"] == []

    def test_a_missing_name_is_rejected(self, client):
        response = client.post("/habits", json={})

        assert response.status_code == 422


class TestMarkingDatesDone:
    def test_putting_a_completion_marks_the_date(self, client, created_habit):
        response = client.put(f"/habits/{created_habit['id']}/completions/2026-08-14")

        assert response.status_code == 200
        assert response.json()["completedDates"] == ["2026-08-14"]

    def test_a_completion_survives_a_new_request(self, client, created_habit):
        client.put(f"/habits/{created_habit['id']}/completions/2026-08-14")

        habits = client.get("/habits").json()

        assert habits[0]["completedDates"] == ["2026-08-14"]

    def test_marking_the_same_date_twice_is_a_no_op(self, client, created_habit):
        # The idempotence PUT promises, and the reason INSERT OR IGNORE sits on
        # top of a composite primary key: a double-click can't record two rows.
        client.put(f"/habits/{created_habit['id']}/completions/2026-08-14")
        response = client.put(f"/habits/{created_habit['id']}/completions/2026-08-14")

        assert response.status_code == 200
        assert response.json()["completedDates"] == ["2026-08-14"]

    def test_dates_come_back_in_chronological_order(self, client, created_habit):
        # Inserted out of order on purpose — ORDER BY date is what makes the
        # response order a property of the API rather than of insertion luck.
        for day in ("2026-08-14", "2026-08-12", "2026-08-13"):
            client.put(f"/habits/{created_habit['id']}/completions/{day}")

        habit = client.get("/habits").json()[0]

        assert habit["completedDates"] == ["2026-08-12", "2026-08-13", "2026-08-14"]

    def test_marking_one_habit_leaves_the_others_alone(self, client, created_habit):
        other = client.post("/habits", json={"name": "Journal"}).json()

        client.put(f"/habits/{created_habit['id']}/completions/2026-08-14")

        habits = {habit["id"]: habit for habit in client.get("/habits").json()}
        assert habits[other["id"]]["completedDates"] == []


class TestUnmarkingDates:
    def test_deleting_a_completion_unmarks_the_date(self, client, created_habit):
        client.put(f"/habits/{created_habit['id']}/completions/2026-08-14")

        response = client.delete(f"/habits/{created_habit['id']}/completions/2026-08-14")

        assert response.status_code == 200
        assert response.json()["completedDates"] == []

    def test_unmarking_leaves_the_habits_other_dates_untouched(self, client, created_habit):
        for day in ("2026-08-12", "2026-08-13"):
            client.put(f"/habits/{created_habit['id']}/completions/{day}")

        client.delete(f"/habits/{created_habit['id']}/completions/2026-08-12")

        assert client.get("/habits").json()[0]["completedDates"] == ["2026-08-13"]

    def test_unmarking_a_date_that_was_never_marked_is_not_an_error(self, client, created_habit):
        # The caller asked for that date to be absent, and afterwards it is.
        # Only a missing *habit* is a 404 — a missing completion is success.
        response = client.delete(f"/habits/{created_habit['id']}/completions/2026-08-14")

        assert response.status_code == 200
        assert response.json()["completedDates"] == []


class TestDeleting:
    def test_delete_answers_204_with_no_body(self, client, created_habit):
        response = client.delete(f"/habits/{created_habit['id']}")

        assert response.status_code == 204
        assert response.content == b""

    def test_a_deleted_habit_is_gone(self, client, created_habit):
        client.delete(f"/habits/{created_habit['id']}")

        assert client.get("/habits").json() == []

    def test_deleting_a_habit_takes_its_completions_with_it(self, client, created_habit):
        # The CASCADE test, and the one that fails silently if the
        # `PRAGMA foreign_keys = ON` in storage._connection ever goes missing:
        # the orphaned rows would resurface on the next habit to reuse the id.
        import storage

        client.put(f"/habits/{created_habit['id']}/completions/2026-08-14")
        client.delete(f"/habits/{created_habit['id']}")

        with storage._connection() as connection:
            orphans = connection.execute(
                "SELECT * FROM habit_completions WHERE habit_id = ?",
                (created_habit["id"],),
            ).fetchall()

        assert orphans == []

    def test_deleting_one_habit_leaves_the_others(self, client, created_habit):
        keep = client.post("/habits", json={"name": "Keep me"}).json()

        client.delete(f"/habits/{created_habit['id']}")

        habits = client.get("/habits").json()
        assert [habit["id"] for habit in habits] == [keep["id"]]


class TestErrorPaths:
    """Error paths rot fastest, so they get the most attention.

    Note what is and isn't a 404 here: an unknown *habit* is, because the URL
    names something that doesn't exist; an unmarked *date* isn't, because the
    request's goal is already met.
    """

    UNKNOWN = "no-such-habit"

    def test_deleting_an_unknown_habit_is_a_404(self, client):
        response = client.delete(f"/habits/{self.UNKNOWN}")

        assert response.status_code == 404
        assert self.UNKNOWN in response.json()["detail"]

    def test_marking_a_date_on_an_unknown_habit_is_a_404(self, client):
        response = client.put(f"/habits/{self.UNKNOWN}/completions/2026-08-14")

        assert response.status_code == 404

    def test_unmarking_a_date_on_an_unknown_habit_is_a_404(self, client):
        response = client.delete(f"/habits/{self.UNKNOWN}/completions/2026-08-14")

        assert response.status_code == 404

    def test_a_failed_completion_writes_nothing(self, client):
        client.put(f"/habits/{self.UNKNOWN}/completions/2026-08-14")

        assert client.get("/habits").json() == []

    def test_an_unparseable_date_is_rejected(self, client, created_habit):
        # `completion_date: date` in the signature is the whole defence — this
        # never reaches storage.py, so no junk string can enter the table.
        response = client.put(f"/habits/{created_habit['id']}/completions/banana")

        assert response.status_code == 422

    def test_an_impossible_date_is_rejected(self, client, created_habit):
        response = client.put(f"/habits/{created_habit['id']}/completions/2026-02-30")

        assert response.status_code == 422
