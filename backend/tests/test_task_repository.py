import json
from contextlib import closing

import pytest

import backend.app.task_repository as task_repository
from backend.app.database import connect_database
from backend.app.task_repository import TaskRepository


def test_connect_database_enables_wal_and_30_second_timeout(tmp_path):
    database_path = tmp_path / "clean" / "nested" / "quant.db"
    connection = connect_database(database_path)
    try:
        assert connection.execute("PRAGMA journal_mode").fetchone()[0] == "wal"
        assert connection.execute("PRAGMA busy_timeout").fetchone()[0] == 30_000
    finally:
        connection.close()
    assert database_path.exists()


def test_claim_next_is_fifo_and_atomic(tmp_path):
    database_path = tmp_path / "quant.db"
    first_repo = TaskRepository(database_path)
    second_repo = TaskRepository(database_path)
    first = first_repo.create("data_initialize", {"start_date": "20150101"})
    second = first_repo.create("data_incremental", {})
    assert first_repo.claim_next().id == first
    assert second_repo.claim_next() is None
    first_repo.succeed(first, {"rows": 1})
    assert second_repo.claim_next().id == second
    assert first_repo.claim_next() is None


def test_success_records_server_duration(tmp_path, monkeypatch):
    clock = iter([100.0, 100.125])
    monkeypatch.setattr(task_repository.time, "time", lambda: next(clock))
    repo = TaskRepository(tmp_path / "quant.db")
    run_id = repo.create("data_initialize", {})
    repo.claim_next()
    repo.succeed(run_id, {"rows": 2})
    run = repo.get(run_id)
    assert run.status == "succeeded"
    assert run.duration_ms == 125


def test_progress_failure_and_list_decode_json(tmp_path):
    repo = TaskRepository(tmp_path / "quant.db")
    run_id = repo.create("data_initialize", {"start_date": "20150101"})
    repo.claim_next()
    repo.progress(run_id, "download", 40)
    repo.fail(run_id, "network unavailable")

    run = repo.get(run_id)
    assert run.params == {"start_date": "20150101"}
    assert run.result is None
    assert run.stage == "download"
    assert run.progress == 40
    assert run.status == "failed"
    assert run.error_message == "network unavailable"
    assert repo.list(limit=1) == [run]


def test_mark_running_interrupted_leaves_queued_tasks_unchanged(tmp_path):
    repo = TaskRepository(tmp_path / "quant.db")
    running_id = repo.create("data_initialize", {})
    queued_id = repo.create("data_incremental", {})
    repo.claim_next()

    repo.mark_running_interrupted()

    assert repo.get(running_id).status == "interrupted"
    assert repo.get(queued_id).status == "queued"


def test_repository_redacts_secrets_before_writing(tmp_path, monkeypatch):
    configured_secret = "unit-test-sensitive-value"
    monkeypatch.setenv("TUSHARE_TOKEN", configured_secret)
    repo = TaskRepository(tmp_path / "quant.db")
    succeeded_id = repo.create(
        "data_initialize",
        {
            "ApiToken": "key-value",
            "nested": [{"PASSWORD": "password-value"}],
            "note": f"prefix {configured_secret} suffix",
        },
    )
    repo.claim_next()
    repo.succeed(
        succeeded_id,
        {"Secret": "result-value", "note": configured_secret},
    )
    failed_id = repo.create("data_incremental", {})
    repo.claim_next()
    repo.fail(failed_id, f"authorization failed for {configured_secret}")

    with closing(connect_database(tmp_path / "quant.db")) as connection:
        succeeded = connection.execute(
            "SELECT params_json, result_json FROM task_runs WHERE id = ?",
            (succeeded_id,),
        ).fetchone()
        failed = connection.execute(
            "SELECT error_message FROM task_runs WHERE id = ?", (failed_id,)
        ).fetchone()

    assert configured_secret not in succeeded["params_json"]
    assert configured_secret not in succeeded["result_json"]
    assert configured_secret not in failed["error_message"]
    assert repo.get(succeeded_id).params == {
        "ApiToken": "[REDACTED_SECRET]",
        "nested": [{"PASSWORD": "[REDACTED_SECRET]"}],
        "note": "prefix [REDACTED_SECRET] suffix",
    }
    assert repo.get(succeeded_id).result == {
        "Secret": "[REDACTED_SECRET]",
        "note": "[REDACTED_SECRET]",
    }
    assert repo.get(failed_id).error_message == (
        "authorization failed for [REDACTED_SECRET]"
    )


def test_repository_redacts_secrets_defensively_when_reading(tmp_path, monkeypatch):
    configured_secret = "unit-test-sensitive-value"
    monkeypatch.setenv("TUSHARE_TOKEN", configured_secret)
    repo = TaskRepository(tmp_path / "quant.db")
    run_id = repo.create("data_initialize", {})
    with closing(connect_database(tmp_path / "quant.db")) as connection:
        connection.execute(
            """
            UPDATE task_runs
            SET params_json = ?, result_json = ?, error_message = ?
            WHERE id = ?
            """,
            (
                json.dumps({"authorization": "raw", "note": configured_secret}),
                json.dumps({"password": "raw"}),
                f"failed with {configured_secret}",
                run_id,
            ),
        )
        connection.commit()

    run = repo.get(run_id)
    assert run.params == {
        "authorization": "[REDACTED_SECRET]",
        "note": "[REDACTED_SECRET]",
    }
    assert run.result == {"password": "[REDACTED_SECRET]"}
    assert run.error_message == "failed with [REDACTED_SECRET]"


def test_mutations_reject_unknown_and_non_running_tasks(tmp_path):
    repo = TaskRepository(tmp_path / "quant.db")
    queued_for_progress = repo.create("data_initialize", {})
    queued_for_success = repo.create("data_initialize", {})
    queued_for_failure = repo.create("data_initialize", {})

    with pytest.raises(ValueError):
        repo.progress(queued_for_progress, "download", 10)
    with pytest.raises(ValueError):
        repo.succeed(queued_for_success, {})
    with pytest.raises(ValueError):
        repo.fail(queued_for_failure, "failed")

    with pytest.raises(KeyError):
        repo.progress("missing", "download", 10)
    with pytest.raises(KeyError):
        repo.succeed("missing", {})
    with pytest.raises(KeyError):
        repo.fail("missing", "failed")


def test_terminal_updates_are_idempotent_and_cannot_change_terminal_state(
    tmp_path, monkeypatch
):
    clock = iter([100.0, 100.125, 200.0, 200.050])
    monkeypatch.setattr(task_repository.time, "time", lambda: next(clock))
    repo = TaskRepository(tmp_path / "quant.db")

    succeeded_id = repo.create("data_initialize", {})
    repo.claim_next()
    repo.succeed(succeeded_id, {"rows": 2})
    succeeded = repo.get(succeeded_id)
    repo.succeed(succeeded_id, {"rows": 99})
    assert repo.get(succeeded_id) == succeeded
    with pytest.raises(ValueError):
        repo.fail(succeeded_id, "must not replace success")
    assert repo.get(succeeded_id) == succeeded
    with pytest.raises(ValueError):
        repo.progress(succeeded_id, "late", 99)

    failed_id = repo.create("data_incremental", {})
    repo.claim_next()
    repo.fail(failed_id, "first failure")
    failed = repo.get(failed_id)
    repo.fail(failed_id, "second failure")
    assert repo.get(failed_id) == failed
    with pytest.raises(ValueError):
        repo.succeed(failed_id, {"rows": 1})
    assert repo.get(failed_id) == failed
