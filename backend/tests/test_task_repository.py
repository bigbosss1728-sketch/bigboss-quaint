import backend.app.task_repository as task_repository
from backend.app.database import connect_database
from backend.app.task_repository import TaskRepository


def test_connect_database_enables_wal_and_30_second_timeout(tmp_path):
    connection = connect_database(tmp_path / "quant.db")
    try:
        assert connection.execute("PRAGMA journal_mode").fetchone()[0] == "wal"
        assert connection.execute("PRAGMA busy_timeout").fetchone()[0] == 30_000
    finally:
        connection.close()


def test_claim_next_is_fifo_and_atomic(tmp_path):
    repo = TaskRepository(tmp_path / "quant.db")
    first = repo.create("data_initialize", {"start_date": "20150101"})
    second = repo.create("data_incremental", {})
    assert repo.claim_next().id == first
    assert repo.claim_next() is None
    repo.succeed(first, {"rows": 1})
    assert repo.claim_next().id == second
    assert repo.claim_next() is None


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
