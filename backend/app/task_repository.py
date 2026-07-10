import json
import time
from contextlib import closing
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from backend.app.database import connect_database


SCHEMA = """
CREATE TABLE IF NOT EXISTS task_runs (
  id TEXT PRIMARY KEY,
  task_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('queued','running','succeeded','failed','interrupted')),
  stage TEXT NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
  params_json TEXT NOT NULL,
  result_json TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  duration_ms INTEGER
);
"""


@dataclass(frozen=True)
class TaskRun:
    id: str
    task_type: str
    status: str
    stage: str
    progress: int
    params: dict
    result: dict | None
    error_message: str | None
    created_at: str
    started_at: str | None
    finished_at: str | None
    duration_ms: int | None


class TaskRepository:
    def __init__(self, path: Path):
        self._path = path
        with closing(connect_database(path)) as connection:
            connection.executescript(SCHEMA)
            connection.commit()

    def create(self, task_type: str, params: dict) -> str:
        run_id = str(uuid4())
        with closing(connect_database(self._path)) as connection:
            connection.execute(
                """
                INSERT INTO task_runs (id, task_type, status, params_json, created_at)
                VALUES (?, ?, 'queued', ?, ?)
                """,
                (run_id, task_type, json.dumps(params), _utc_now()),
            )
            connection.commit()
        return run_id

    def claim_next(self) -> TaskRun | None:
        with closing(connect_database(self._path)) as connection:
            connection.execute("BEGIN IMMEDIATE")
            if connection.execute(
                "SELECT 1 FROM task_runs WHERE status = 'running' LIMIT 1"
            ).fetchone():
                connection.commit()
                return None

            row = connection.execute(
                """
                SELECT id FROM task_runs
                WHERE status = 'queued'
                ORDER BY rowid
                LIMIT 1
                """
            ).fetchone()
            if row is None:
                connection.commit()
                return None

            started_at = _iso_timestamp(time.time())
            connection.execute(
                """
                UPDATE task_runs
                SET status = 'running', started_at = ?
                WHERE id = ?
                """,
                (started_at, row["id"]),
            )
            claimed = connection.execute(
                "SELECT * FROM task_runs WHERE id = ?", (row["id"],)
            ).fetchone()
            connection.commit()
        return _task_run(claimed)

    def progress(self, run_id: str, stage: str, progress: int) -> None:
        with closing(connect_database(self._path)) as connection:
            connection.execute(
                "UPDATE task_runs SET stage = ?, progress = ? WHERE id = ?",
                (stage, progress, run_id),
            )
            connection.commit()

    def succeed(self, run_id: str, result: dict) -> None:
        self._finish(run_id, "succeeded", result=result)

    def fail(self, run_id: str, message: str) -> None:
        self._finish(run_id, "failed", error_message=message)

    def get(self, run_id: str) -> TaskRun | None:
        with closing(connect_database(self._path)) as connection:
            row = connection.execute(
                "SELECT * FROM task_runs WHERE id = ?", (run_id,)
            ).fetchone()
        return _task_run(row) if row else None

    def list(self, limit: int = 100) -> list[TaskRun]:
        with closing(connect_database(self._path)) as connection:
            rows = connection.execute(
                "SELECT * FROM task_runs ORDER BY rowid DESC LIMIT ?", (limit,)
            ).fetchall()
        return [_task_run(row) for row in rows]

    def mark_running_interrupted(self) -> None:
        finished_epoch = time.time()
        finished_at = _iso_timestamp(finished_epoch)
        with closing(connect_database(self._path)) as connection:
            rows = connection.execute(
                "SELECT id, started_at FROM task_runs WHERE status = 'running'"
            ).fetchall()
            for row in rows:
                connection.execute(
                    """
                    UPDATE task_runs
                    SET status = 'interrupted', finished_at = ?, duration_ms = ?
                    WHERE id = ?
                    """,
                    (
                        finished_at,
                        _duration_ms(row["started_at"], finished_epoch),
                        row["id"],
                    ),
                )
            connection.commit()

    def _finish(
        self,
        run_id: str,
        status: str,
        result: dict | None = None,
        error_message: str | None = None,
    ) -> None:
        finished_epoch = time.time()
        finished_at = _iso_timestamp(finished_epoch)
        with closing(connect_database(self._path)) as connection:
            row = connection.execute(
                "SELECT started_at FROM task_runs WHERE id = ?", (run_id,)
            ).fetchone()
            connection.execute(
                """
                UPDATE task_runs
                SET status = ?, result_json = ?, error_message = ?,
                    finished_at = ?, duration_ms = ?
                WHERE id = ?
                """,
                (
                    status,
                    json.dumps(result) if result is not None else None,
                    error_message,
                    finished_at,
                    _duration_ms(row["started_at"], finished_epoch),
                    run_id,
                ),
            )
            connection.commit()


def _task_run(row) -> TaskRun:
    return TaskRun(
        id=row["id"],
        task_type=row["task_type"],
        status=row["status"],
        stage=row["stage"],
        progress=row["progress"],
        params=json.loads(row["params_json"]),
        result=json.loads(row["result_json"]) if row["result_json"] else None,
        error_message=row["error_message"],
        created_at=row["created_at"],
        started_at=row["started_at"],
        finished_at=row["finished_at"],
        duration_ms=row["duration_ms"],
    )


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _iso_timestamp(epoch: float) -> str:
    return datetime.fromtimestamp(epoch, timezone.utc).isoformat()


def _duration_ms(started_at: str | None, finished_epoch: float) -> int | None:
    if started_at is None:
        return None
    return round((finished_epoch - datetime.fromisoformat(started_at).timestamp()) * 1000)
