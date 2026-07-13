from contextlib import closing

import pandas as pd
from fastapi.testclient import TestClient

import backend.app.main as main_module
from backend.app.database import UNIVERSE_SCHEMA, connect_database
from backend.app.data_store import ParquetDataStore
from backend.app.main import create_app
from backend.app.task_repository import TaskRepository


def test_latest_signals_returns_sample_payload_when_store_is_empty(tmp_path):
    app = create_app(data_dir=tmp_path)
    client = TestClient(app)

    response = client.get("/api/signals/latest")

    assert response.status_code == 200
    payload = response.json()
    assert payload["source"] == "sample"
    assert len(payload["signals"]) >= 1
    assert {"ts_code", "name", "rating", "action", "score"}.issubset(
        payload["signals"][0].keys()
    )
    signal = payload["signals"][0]
    assert len(signal["bars"]) >= 5
    assert signal["indicators"] == ["涨跌幅", "日内振幅", "动量评分", "建议仓位"]
    assert any("\u4e00" <= char <= "\u9fff" for char in signal["reason"])


def test_health_endpoint_reports_service_name(tmp_path):
    app = create_app(data_dir=tmp_path)
    client = TestClient(app)

    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "quant-platform-backend"}


def test_data_task_is_committed_before_worker_is_spawned(tmp_path, monkeypatch):
    observed = []

    def observe_spawn():
        runs = TaskRepository(tmp_path / "quant.db").list()
        observed.append([(run.id, run.status) for run in runs])

    monkeypatch.setattr(main_module, "spawn_worker_once", observe_spawn)
    app = create_app(data_dir=tmp_path)
    with TestClient(app) as client:
        response = client.post("/api/tasks/data/initialize", json={})

    assert response.status_code == 202
    assert response.json()["status"] == "queued"
    assert set(response.json()) == {"id", "status"}
    assert observed == [[(response.json()["id"], "queued")]]


def test_startup_interrupts_running_tasks_once_before_spawning(tmp_path, monkeypatch):
    database_path = tmp_path / "quant.db"
    tasks = TaskRepository(database_path)
    running_id = tasks.create("data_initialize", {})
    tasks.claim_next()
    calls = []
    original = TaskRepository.mark_running_interrupted

    def record_interrupt(repository):
        calls.append("interrupt")
        original(repository)

    def record_spawn():
        calls.append(TaskRepository(database_path).get(running_id).status)

    monkeypatch.setattr(TaskRepository, "mark_running_interrupted", record_interrupt)
    monkeypatch.setattr(main_module, "spawn_worker_once", record_spawn)
    with TestClient(create_app(data_dir=tmp_path)) as client:
        response = client.post("/api/tasks/data/update", json={})

    assert response.status_code == 202
    assert calls == ["interrupt", "interrupted"]


def test_task_get_exposes_duration_without_secrets_or_traceback(tmp_path, monkeypatch):
    token = "unit-test-secret"
    monkeypatch.setenv("TUSHARE_TOKEN", token)
    tasks = TaskRepository(tmp_path / "quant.db")
    run_id = tasks.create("data_initialize", {"token": token})
    tasks.claim_next()
    tasks.fail(run_id, f"Traceback (most recent call last):\nRuntimeError: {token}")

    with TestClient(create_app(data_dir=tmp_path)) as client:
        response = client.get(f"/api/tasks/{run_id}")

    assert response.status_code == 200
    payload = response.json()
    assert payload["duration_ms"] is not None
    assert token not in response.text
    assert "Traceback" not in response.text
    assert "params" not in payload
    assert "result" not in payload


def test_task_list_supports_bounded_pagination(tmp_path):
    tasks = TaskRepository(tmp_path / "quant.db")
    first = tasks.create("data_initialize", {})
    second = tasks.create("data_incremental", {})

    with TestClient(create_app(data_dir=tmp_path)) as client:
        response = client.get("/api/tasks", params={"limit": 1, "offset": 1})
        invalid = client.get("/api/tasks", params={"limit": 0})

    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [first]
    assert second not in response.text
    assert invalid.status_code == 422


def test_missing_universe_returns_exact_not_found_detail(tmp_path):
    with TestClient(create_app(data_dir=tmp_path)) as client:
        response = client.get("/api/universe/latest")

    assert response.status_code == 404
    assert response.json() == {"detail": "Universe has not been initialized."}


def test_latest_universe_returns_published_members(tmp_path):
    database_path = tmp_path / "quant.db"
    with closing(connect_database(database_path)) as connection:
        connection.executescript(UNIVERSE_SCHEMA)
        connection.execute(
            """
            INSERT INTO universe_runs
              (id, trade_date, task_run_id, params_json, funnel_json, published_at)
            VALUES ('u1', '20260710', 't1', '{}', '{"initial": 1}', 'now')
            """
        )
        connection.execute(
            """
            INSERT INTO universe_members
              (universe_run_id, ts_code, eligible, reasons_json, average_amount_20d)
            VALUES ('u1', '000001.SZ', 1, '[]', 50000000)
            """
        )
        connection.commit()

    with TestClient(create_app(data_dir=tmp_path)) as client:
        response = client.get("/api/universe/latest")

    assert response.status_code == 200
    assert response.json()["members"] == [
        {
            "ts_code": "000001.SZ",
            "eligible": True,
            "reasons": [],
            "average_amount_20d": 50000000.0,
        }
    ]


def test_stock_bars_are_ascending_and_unique_by_trade_date(tmp_path):
    store = ParquetDataStore(tmp_path / "market")
    store.write_partition(
        "daily",
        "20260710",
        pd.DataFrame(
            [
                {"ts_code": "000001.SZ", "trade_date": "20260710", "open": 10, "high": 11, "low": 9, "close": 10.5, "vol": 100, "amount": 1000},
                {"ts_code": "000001.SZ", "trade_date": "20260710", "open": 10, "high": 12, "low": 9, "close": 11, "vol": 200, "amount": 2000},
            ]
        ),
    )
    store.write_partition(
        "daily",
        "20260709",
        pd.DataFrame(
            [{"ts_code": "000001.SZ", "trade_date": "20260709", "open": 9, "high": 10, "low": 8, "close": 9.5, "vol": 90, "amount": 900}]
        ),
    )

    with TestClient(create_app(data_dir=tmp_path)) as client:
        response = client.get("/api/stocks/000001.SZ/bars")

    assert response.status_code == 200
    assert [bar["trade_date"] for bar in response.json()] == ["20260709", "20260710"]
