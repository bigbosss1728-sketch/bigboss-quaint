from contextlib import closing

import pandas as pd
import pytest

from backend.app.data_pipeline import Services, run_data_initialize
from backend.app.database import connect_database
from backend.app.data_store import ParquetDataStore
from backend.app.market_data import MarketDayFrames
from backend.app.task_repository import TaskRepository
from backend.app.universe_repository import UniverseRepository


DATES = ("20260709", "20260710")


def _daily(trade_date: str, *, valid: bool = True) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "ts_code": "000001.SZ",
                "trade_date": trade_date,
                "open": 10.0,
                "high": 11.0 if valid else 9.0,
                "low": 9.0,
                "close": 10.0,
                "vol": 1_000.0,
                "amount": 50_000_000.0,
            }
        ]
    )


class FakeMarketData:
    def __init__(self, invalid_dates=(), empty_dates=()):
        self.invalid_dates = set(invalid_dates)
        self.empty_dates = set(empty_dates)
        self.day_calls = []

    def fetch_trade_cal(self):
        return pd.DataFrame(
            [{"cal_date": date, "is_open": 1} for date in DATES]
        )

    def fetch_stock_basic(self):
        return pd.DataFrame(
            [
                {
                    "ts_code": "000001.SZ",
                    "name": "target",
                    "list_date": "20000101",
                    "delist_date": None,
                    "list_status": "L",
                }
            ]
        )

    def fetch_namechange(self):
        return pd.DataFrame(
            columns=["ts_code", "name", "start_date", "end_date"]
        )

    def fetch_trade_date(self, trade_date):
        self.day_calls.append(trade_date)
        daily = _daily(trade_date, valid=trade_date not in self.invalid_dates)
        if trade_date in self.empty_dates:
            daily = daily.iloc[0:0]
        return MarketDayFrames(
            trade_date=trade_date,
            daily=daily,
            adj_factor=pd.DataFrame(
                [{"ts_code": "000001.SZ", "trade_date": trade_date, "adj_factor": 1.0}]
            ),
            suspend=pd.DataFrame(columns=["ts_code", "trade_date"]),
            limit=pd.DataFrame(
                columns=["ts_code", "trade_date", "up_limit", "down_limit"]
            ),
        )


class RecordingTasks:
    def __init__(self, tasks):
        self._tasks = tasks
        self.stages = []

    def progress(self, run_id, stage, progress):
        self.stages.append(stage)
        self._tasks.progress(run_id, stage, progress)


def _services(tmp_path, market_data):
    database_path = tmp_path / "quant.db"
    tasks = TaskRepository(database_path)
    recording_tasks = RecordingTasks(tasks)
    return (
        Services(
            tasks=recording_tasks,
            universe=UniverseRepository(database_path),
            market_data=market_data,
            store=ParquetDataStore(tmp_path / "data"),
        ),
        tasks,
        recording_tasks,
        database_path,
    )


def _run(tasks, services, params):
    run_id = tasks.create("data_initialize", params)
    assert tasks.claim_next().id == run_id
    result = run_data_initialize(run_id, params, services)
    tasks.succeed(run_id, result)
    return result


def test_initialize_skips_existing_partitions_and_reports_stages_in_order(tmp_path):
    market_data = FakeMarketData()
    services, tasks, recording, database_path = _services(tmp_path, market_data)
    params = {
        "start_date": DATES[0],
        "end_date": DATES[0],
        "listing_days": 1,
        "liquidity_days": 1,
        "min_average_amount": 0,
    }

    first = _run(tasks, services, params)
    second = _run(tasks, services, params)

    assert market_data.day_calls == [DATES[0]]
    assert recording.stages[:6] == [
        "calendar",
        "static_data",
        "market_data",
        "validation",
        "universe",
        "publish",
    ]
    assert recording.stages[6:] == recording.stages[:6]
    assert set(first) == {"universe_run_ids", "published_count", "partitions_written"}
    assert len(first["universe_run_ids"]) == 1
    assert first["published_count"] == 1
    assert second["universe_run_ids"] == []
    assert second["published_count"] == 0
    with closing(connect_database(database_path)) as connection:
        assert connection.execute("SELECT COUNT(*) FROM universe_runs").fetchone()[0] == 1


def test_validation_failure_leaves_previously_published_universe_untouched(tmp_path):
    market_data = FakeMarketData(invalid_dates={DATES[1]})
    services, tasks, _recording, database_path = _services(tmp_path, market_data)
    common = {
        "listing_days": 1,
        "liquidity_days": 1,
        "min_average_amount": 0,
    }
    _run(tasks, services, {**common, "start_date": DATES[0], "end_date": DATES[0]})
    with closing(connect_database(database_path)) as connection:
        before = connection.execute(
            "SELECT id, trade_date, task_run_id, params_json, funnel_json, published_at FROM universe_runs"
        ).fetchall()
        before_members = connection.execute(
            "SELECT universe_run_id, ts_code, eligible, reasons_json, average_amount_20d FROM universe_members"
        ).fetchall()

    run_id = tasks.create(
        "data_initialize", {**common, "start_date": DATES[1], "end_date": DATES[1]}
    )
    tasks.claim_next()
    with pytest.raises(ValueError, match="Market data validation failed"):
        run_data_initialize(
            run_id,
            {**common, "start_date": DATES[1], "end_date": DATES[1]},
            services,
        )

    with closing(connect_database(database_path)) as connection:
        after = connection.execute(
            "SELECT id, trade_date, task_run_id, params_json, funnel_json, published_at FROM universe_runs"
        ).fetchall()
        after_members = connection.execute(
            "SELECT universe_run_id, ts_code, eligible, reasons_json, average_amount_20d FROM universe_members"
        ).fetchall()
    assert [tuple(row) for row in after] == [tuple(row) for row in before]
    assert [tuple(row) for row in after_members] == [tuple(row) for row in before_members]


def test_empty_daily_for_open_candidate_date_fails_without_publishing(tmp_path):
    market_data = FakeMarketData(empty_dates={DATES[0]})
    services, tasks, _recording, database_path = _services(tmp_path, market_data)
    params = {
        "start_date": DATES[0],
        "end_date": DATES[0],
        "listing_days": 1,
        "liquidity_days": 1,
        "min_average_amount": 0,
    }
    run_id = tasks.create("data_initialize", params)
    tasks.claim_next()

    with pytest.raises(ValueError, match="Market data validation failed"):
        run_data_initialize(run_id, params, services)

    with closing(connect_database(database_path)) as connection:
        assert connection.execute("SELECT COUNT(*) FROM universe_runs").fetchone()[0] == 0


def test_history_datasets_are_each_read_once_for_multiple_dates(tmp_path):
    market_data = FakeMarketData()
    services, tasks, _recording, _database_path = _services(tmp_path, market_data)
    reads = {}
    read_dataset = services.store.read_dataset

    def counting_read(dataset, *args, **kwargs):
        reads[dataset] = reads.get(dataset, 0) + 1
        return read_dataset(dataset, *args, **kwargs)

    services.store.read_dataset = counting_read
    params = {
        "start_date": DATES[0],
        "end_date": DATES[1],
        "listing_days": 1,
        "liquidity_days": 1,
        "min_average_amount": 0,
    }

    _run(tasks, services, params)

    assert {dataset: reads[dataset] for dataset in (
        "daily",
        "adj_factor",
        "suspend",
        "limit",
        "stock_basic",
        "namechange",
    )} == {
        "daily": 1,
        "adj_factor": 1,
        "suspend": 1,
        "limit": 1,
        "stock_basic": 1,
        "namechange": 1,
    }


def test_second_candidate_validation_failure_publishes_neither_date(tmp_path):
    market_data = FakeMarketData(invalid_dates={DATES[1]})
    services, tasks, _recording, database_path = _services(tmp_path, market_data)
    params = {
        "start_date": DATES[0],
        "end_date": DATES[1],
        "listing_days": 1,
        "liquidity_days": 1,
        "min_average_amount": 0,
    }
    run_id = tasks.create("data_initialize", params)
    tasks.claim_next()

    with pytest.raises(ValueError, match=f"Market data validation failed for {DATES[1]}"):
        run_data_initialize(run_id, params, services)

    with closing(connect_database(database_path)) as connection:
        assert connection.execute("SELECT COUNT(*) FROM universe_runs").fetchone()[0] == 0
