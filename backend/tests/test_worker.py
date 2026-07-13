import os
import subprocess
import sys
from threading import Event, Thread
from pathlib import Path
from types import SimpleNamespace

import pytest

import backend.app.task_process as task_process
import backend.app.worker as worker_module
from backend.app.data_pipeline import Services
from backend.app.task_repository import TaskRepository
from backend.app.worker import main, run_once


def _services(tasks):
    return Services(tasks=tasks, universe=None, market_data=None, store=None)


def test_second_worker_cannot_claim_while_another_task_is_running(tmp_path):
    tasks = TaskRepository(tmp_path / "quant.db")
    running_id = tasks.create("data_initialize", {})
    queued_id = tasks.create("data_incremental", {})
    assert tasks.claim_next().id == running_id
    dispatched = []

    assert run_once(_services(tasks), {"data_incremental": dispatched.append}) is False

    assert dispatched == []
    assert tasks.get(running_id).status == "running"
    assert tasks.get(queued_id).status == "queued"


def test_worker_main_does_not_interrupt_a_live_task_before_claiming(tmp_path):
    tasks = TaskRepository(tmp_path / "quant.db")
    running_id = tasks.create("data_initialize", {})
    queued_id = tasks.create("data_incremental", {})
    assert tasks.claim_next().id == running_id

    assert main(["--once"], _services(tasks)) == 0

    assert tasks.get(running_id).status == "running"
    assert tasks.get(queued_id).status == "queued"


@pytest.mark.parametrize("first_status", ["succeeded", "failed"])
def test_finished_worker_wakes_next_worker_after_competing_worker_found_running(
    tmp_path, monkeypatch, first_status
):
    tasks = TaskRepository(tmp_path / "quant.db")
    first_id = tasks.create("data_initialize", {})
    started = Event()
    release = Event()
    wakeups = []

    def run_first(_task_id, _params, _services):
        started.set()
        assert release.wait(timeout=2)
        if first_status == "failed":
            raise RuntimeError("expected test failure")
        return {}

    monkeypatch.setattr(worker_module, "spawn_worker_once", lambda: wakeups.append(True), raising=False)
    first_worker = Thread(
        target=run_once,
        args=(_services(tasks), {"data_initialize": run_first}),
    )
    first_worker.start()
    assert started.wait(timeout=2)

    second_id = tasks.create("data_incremental", {})
    assert run_once(_services(tasks), {"data_incremental": lambda *_args: {}}) is False
    assert tasks.get(second_id).status == "queued"

    release.set()
    first_worker.join(timeout=2)

    assert not first_worker.is_alive()
    assert tasks.get(first_id).status == first_status
    assert wakeups == [True]

    assert run_once(_services(tasks), {"data_incremental": lambda *_args: {}}) is True
    assert tasks.get(second_id).status == "succeeded"
    assert wakeups == [True]


def test_unknown_task_type_fails_without_traceback_or_token(tmp_path, monkeypatch):
    token = "unit-test-secret-token"
    monkeypatch.setenv("TUSHARE_TOKEN", token)
    tasks = TaskRepository(tmp_path / "quant.db")
    run_id = tasks.create("mystery", {"token": token})

    assert run_once(_services(tasks), {}) is True

    run = tasks.get(run_id)
    assert run.status == "failed"
    assert run.error_message == "Unknown task type: mystery"
    assert "Traceback" not in run.error_message
    assert token not in run.error_message


def test_spawn_worker_once_uses_list_argv_workspace_cwd_and_no_shell(monkeypatch):
    calls = []
    monkeypatch.setattr(
        task_process.subprocess,
        "Popen",
        lambda argv, **kwargs: calls.append((argv, kwargs)) or SimpleNamespace(),
    )

    task_process.spawn_worker_once()

    argv, kwargs = calls[0]
    assert argv == [sys.executable, "-m", "backend.app.worker", "--once"]
    assert kwargs["cwd"] == Path(task_process.__file__).resolve().parents[2]
    assert kwargs["shell"] is False
    assert kwargs["stdin"] == subprocess.DEVNULL
    assert kwargs["stdout"] == subprocess.DEVNULL
    assert kwargs["stderr"] == subprocess.DEVNULL
    if os.name == "nt":
        assert kwargs["creationflags"] == subprocess.CREATE_NO_WINDOW
