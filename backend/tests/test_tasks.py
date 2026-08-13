"""Tests for the /tasks API.

The backend twin of frontend/src/app/tasks/task.service.spec.ts. That suite
fakes the *network* to test the service without a server; this one fakes the
*database* to test the server without a browser. TestClient calls the app
in-process, so there's no uvicorn to start and no port 8000 involved — but
routing, Pydantic validation and the response models all really run.
"""


class TestReadingAndCreating:
    def test_a_fresh_database_has_no_tasks(self, client):
        response = client.get("/tasks")

        assert response.status_code == 200
        assert response.json() == []

    def test_a_created_task_comes_back_from_get(self, client):
        client.post("/tasks", json={"title": "Water the plants", "priority": "high"})

        tasks = client.get("/tasks").json()

        assert len(tasks) == 1
        assert tasks[0]["title"] == "Water the plants"
        assert tasks[0]["priority"] == "high"

    def test_the_server_owns_id_and_completed(self, client):
        # A client trying to set either is ignored rather than obeyed: neither
        # field exists on TaskCreate, and Pydantic drops what it doesn't model.
        response = client.post(
            "/tasks",
            json={
                "title": "Sneaky",
                "priority": "low",
                "id": "chosen-by-the-client",
                "completed": True,
            },
        )

        created = response.json()
        assert created["id"] != "chosen-by-the-client"
        assert created["completed"] is False

    def test_priority_defaults_to_medium(self, client):
        response = client.post("/tasks", json={"title": "No priority given"})

        assert response.json()["priority"] == "medium"


class TestTheGroupContract:
    """`group` is the only optional field, and absent means absent — not null.

    The frontend model declares `group?: TaskGroup`, which permits a missing
    key but not an explicit null, so response_model_exclude_none exists to hold
    up that half of the contract. Nothing else checks it: the frontend specs
    mock the server, so they'd pass against a backend that had stopped.
    """

    def test_a_task_without_a_group_omits_the_key_entirely(self, client):
        response = client.post("/tasks", json={"title": "Ungrouped", "priority": "low"})

        assert "group" not in response.json()

    def test_a_task_with_a_group_keeps_it(self, client):
        response = client.post(
            "/tasks", json={"title": "Grouped", "priority": "low", "group": "work"}
        )

        assert response.json()["group"] == "work"

    def test_patching_group_to_null_removes_it(self, client):
        created = client.post(
            "/tasks", json={"title": "Grouped", "priority": "low", "group": "work"}
        ).json()

        # An explicit null means "remove the grouping" — it survives
        # exclude_unset on the way in, and exclude_none drops it on the way out,
        # so the client sees an absent key rather than a null.
        response = client.patch(f"/tasks/{created['id']}", json={"group": None})

        assert response.status_code == 200
        assert "group" not in response.json()


class TestPartialUpdates:
    def test_toggling_completed_leaves_the_title_alone(self, client, created_task):
        response = client.patch(f"/tasks/{created_task['id']}", json={"completed": True})

        updated = response.json()
        assert updated["completed"] is True
        # The whole reason this is PATCH and not PUT: fields the client stayed
        # silent about must not be overwritten with defaults.
        assert updated["title"] == "Existing"
        assert updated["priority"] == "medium"

    def test_renaming_leaves_completed_alone(self, client, created_task):
        client.patch(f"/tasks/{created_task['id']}", json={"completed": True})

        response = client.patch(f"/tasks/{created_task['id']}", json={"title": "Renamed"})

        updated = response.json()
        assert updated["title"] == "Renamed"
        assert updated["completed"] is True

    def test_an_empty_patch_is_a_no_op_not_an_error(self, client, created_task):
        # There's nothing to SET, and `UPDATE tasks SET  WHERE ...` wouldn't
        # even parse — storage.update_task skips the UPDATE for this case.
        response = client.patch(f"/tasks/{created_task['id']}", json={})

        assert response.status_code == 200
        assert response.json() == created_task

    def test_an_update_survives_a_new_request(self, client, created_task):
        client.patch(f"/tasks/{created_task['id']}", json={"title": "Renamed"})

        # Reading it back through a separate request proves it reached the
        # database, not just the response of the request that changed it.
        tasks = client.get("/tasks").json()
        assert tasks[0]["title"] == "Renamed"


class TestDeleting:
    def test_delete_answers_204_with_no_body(self, client, created_task):
        response = client.delete(f"/tasks/{created_task['id']}")

        assert response.status_code == 204
        # 204 means "done, and there's deliberately nothing to send you".
        assert response.content == b""

    def test_a_deleted_task_is_gone(self, client, created_task):
        client.delete(f"/tasks/{created_task['id']}")

        assert client.get("/tasks").json() == []

    def test_deleting_one_task_leaves_the_others(self, client, created_task):
        other = client.post("/tasks", json={"title": "Survivor", "priority": "low"}).json()

        client.delete(f"/tasks/{created_task['id']}")

        remaining = client.get("/tasks").json()
        assert [task["id"] for task in remaining] == [other["id"]]


class TestErrorPaths:
    """The paths that rot fastest, because nothing exercises them by hand.

    You never accidentally delete a task that doesn't exist while clicking
    around, so a regression here would sit undetected until a real client hit
    it — which is exactly the argument for pinning them in tests.
    """

    def test_deleting_an_unknown_id_is_a_404(self, client):
        response = client.delete("/tasks/does-not-exist")

        # Not a silent 204: pretending the delete worked would tell the client
        # the server holds a state it doesn't.
        assert response.status_code == 404
        assert response.json()["detail"] == "No task with id does-not-exist"

    def test_patching_an_unknown_id_is_a_404(self, client):
        response = client.patch("/tasks/does-not-exist", json={"title": "Ghost"})

        assert response.status_code == 404
        assert response.json()["detail"] == "No task with id does-not-exist"

    def test_a_failed_delete_changes_nothing(self, client, created_task):
        client.delete("/tasks/does-not-exist")

        assert len(client.get("/tasks").json()) == 1

    def test_an_invalid_priority_is_rejected(self, client):
        response = client.post("/tasks", json={"title": "Urgent", "priority": "critical"})

        # 422 comes from Pydantic, not from code we wrote — the Literal on
        # TaskCreate is what makes the invalid value unrepresentable.
        assert response.status_code == 422
        assert client.get("/tasks").json() == []

    def test_an_invalid_group_is_rejected(self, client):
        response = client.post(
            "/tasks", json={"title": "Chores", "priority": "low", "group": "errands"}
        )

        assert response.status_code == 422

    def test_a_missing_title_is_rejected(self, client):
        # title is the one required field: everything else has a default or is
        # owned by the server.
        response = client.post("/tasks", json={"priority": "low"})

        assert response.status_code == 422

    def test_an_invalid_patch_is_rejected(self, client, created_task):
        response = client.patch(f"/tasks/{created_task['id']}", json={"priority": "urgent"})

        assert response.status_code == 422
        # The stored task must be untouched by a request that never validated.
        assert client.get("/tasks").json()[0]["priority"] == "medium"


class TestIsolationBetweenTests:
    """Guards the fixture itself.

    If DB_PATH ever stopped being redirected, these tests would keep passing
    while quietly reading and writing the real pulse.db — the failure mode is
    silent, so it's worth one explicit check.
    """

    def test_each_test_starts_from_an_empty_database(self, client):
        # Several tests above leave tasks behind. If tmp_path weren't per-test,
        # they'd be visible here.
        assert client.get("/tasks").json() == []

    def test_the_suite_never_points_at_the_real_database(self, client):
        import storage

        assert storage.DB_PATH.name != "pulse.db"
