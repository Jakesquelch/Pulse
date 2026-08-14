"""Tests for the /journal API.

The flattest of the three resources, so most of this is the same ground as
test_tasks.py. What's specific to the journal is `createdAt`: the server owns
it, nothing can change it afterwards, and its exact string format is what
makes `ORDER BY createdAt` mean "chronological". Those get the attention.
"""

import re

# The shape main._now_iso promises and frontend/src/app/journal/
# journal-entry.model.ts documents: UTC, millisecond precision, "Z" suffix.
ISO_UTC_MILLIS = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$")


class TestReadingAndCreating:
    def test_a_fresh_database_has_no_entries(self, client):
        response = client.get("/journal")

        assert response.status_code == 200
        assert response.json() == []

    def test_a_created_entry_comes_back_from_get(self, client):
        client.post("/journal", json={"content": "Long day, good day."})

        entries = client.get("/journal").json()

        assert len(entries) == 1
        assert entries[0]["content"] == "Long day, good day."

    def test_the_server_owns_id_and_created_at(self, client):
        # Neither field is on JournalEntryCreate, so Pydantic drops both rather
        # than letting a client pick its own id or backdate an entry.
        response = client.post(
            "/journal",
            json={
                "content": "Sneaky",
                "id": "chosen-by-me",
                "createdAt": "1999-01-01T00:00:00.000Z",
            },
        )

        entry = response.json()
        assert entry["id"] != "chosen-by-me"
        assert entry["createdAt"] != "1999-01-01T00:00:00.000Z"

    def test_created_at_has_the_format_the_frontend_expects(self, client):
        response = client.post("/journal", json={"content": "Timestamped"})

        assert ISO_UTC_MILLIS.match(response.json()["createdAt"])

    def test_missing_content_is_rejected(self, client):
        response = client.post("/journal", json={})

        assert response.status_code == 422

    def test_an_empty_entry_is_allowed_by_the_api(self, client):
        # Deliberate: the *page* refuses to submit blank text (journal.ts
        # checks .trim()), but "" is a valid string and the API doesn't invent
        # a rule the model never stated. Written down so the next person knows
        # it's a decision rather than an oversight.
        response = client.post("/journal", json={"content": ""})

        assert response.status_code == 200
        assert response.json()["content"] == ""


class TestOrdering:
    def test_entries_come_back_oldest_first(self, client):
        for content in ("first", "second", "third"):
            client.post("/journal", json={"content": content})

        entries = client.get("/journal").json()

        # The journal page re-sorts newest-first for display, but the dashboard
        # reads the last element as "most recent" — so this order is a promise,
        # not an accident of how SQLite happened to store the rows.
        assert [entry["content"] for entry in entries] == ["first", "second", "third"]

    def test_the_order_is_by_timestamp_not_insertion(self, client):
        for content in ("first", "second"):
            client.post("/journal", json={"content": content})

        entries = client.get("/journal").json()

        assert entries[0]["createdAt"] <= entries[1]["createdAt"]


class TestEditing:
    def test_patching_content_changes_it(self, client, created_entry):
        response = client.patch(
            f"/journal/{created_entry['id']}", json={"content": "Reworded"}
        )

        assert response.status_code == 200
        assert response.json()["content"] == "Reworded"

    def test_an_edit_survives_a_new_request(self, client, created_entry):
        client.patch(f"/journal/{created_entry['id']}", json={"content": "Reworded"})

        assert client.get("/journal").json()[0]["content"] == "Reworded"

    def test_editing_never_changes_created_at(self, client, created_entry):
        # The point of the whole design: rewording an entry doesn't change when
        # you wrote it, so an edited entry keeps its place in the journal.
        client.patch(f"/journal/{created_entry['id']}", json={"content": "Reworded"})

        entry = client.get("/journal").json()[0]
        assert entry["createdAt"] == created_entry["createdAt"]

    def test_created_at_cannot_be_patched(self, client, created_entry):
        client.patch(
            f"/journal/{created_entry['id']}",
            json={"createdAt": "1999-01-01T00:00:00.000Z"},
        )

        entry = client.get("/journal").json()[0]
        assert entry["createdAt"] == created_entry["createdAt"]

    def test_an_empty_patch_is_a_no_op_not_an_error(self, client, created_entry):
        response = client.patch(f"/journal/{created_entry['id']}", json={})

        assert response.status_code == 200
        assert response.json() == created_entry


class TestDeleting:
    def test_delete_answers_204_with_no_body(self, client, created_entry):
        response = client.delete(f"/journal/{created_entry['id']}")

        assert response.status_code == 204
        assert response.content == b""

    def test_a_deleted_entry_is_gone(self, client, created_entry):
        client.delete(f"/journal/{created_entry['id']}")

        assert client.get("/journal").json() == []

    def test_deleting_one_entry_leaves_the_others(self, client, created_entry):
        keep = client.post("/journal", json={"content": "Keep me"}).json()

        client.delete(f"/journal/{created_entry['id']}")

        entries = client.get("/journal").json()
        assert [entry["id"] for entry in entries] == [keep["id"]]


class TestErrorPaths:
    UNKNOWN = "no-such-entry"

    def test_deleting_an_unknown_entry_is_a_404(self, client):
        response = client.delete(f"/journal/{self.UNKNOWN}")

        assert response.status_code == 404
        assert self.UNKNOWN in response.json()["detail"]

    def test_patching_an_unknown_entry_is_a_404(self, client):
        response = client.patch(f"/journal/{self.UNKNOWN}", json={"content": "Nope"})

        assert response.status_code == 404

    def test_a_failed_delete_changes_nothing(self, client, created_entry):
        client.delete(f"/journal/{self.UNKNOWN}")

        assert len(client.get("/journal").json()) == 1

    def test_a_non_string_content_is_rejected(self, client, created_entry):
        response = client.patch(f"/journal/{created_entry['id']}", json={"content": 42})

        assert response.status_code == 422


class TestIsolationFromOtherResources:
    def test_journal_entries_do_not_appear_as_tasks_or_habits(self, client):
        # Three tables in one file, so this is cheap insurance against a
        # copy-pasted table name in a query pointing at the wrong one.
        client.post("/journal", json={"content": "An entry"})

        assert client.get("/tasks").json() == []
        assert client.get("/habits").json() == []
