from dataclasses import dataclass

import pandas as pd

from backend.app.data_store import ParquetDataStore
from backend.app.data_validation import validate_market_frame
from backend.app.market_data import TushareMarketData
from backend.app.task_repository import TaskRepository
from backend.app.universe_repository import UniverseRepository
from backend.app.universe_service import UniverseParams, build_universe


MARKET_DATASETS = ("daily", "adj_factor", "suspend", "limit")


@dataclass(frozen=True)
class Services:
    tasks: TaskRepository
    universe: UniverseRepository
    market_data: TushareMarketData
    store: ParquetDataStore


def run_data_initialize(run_id: str, params: dict, services: Services) -> dict:
    return _run_market_data_task(
        run_id,
        {"start_date": "20150101", **params},
        services,
    )


def run_data_incremental(run_id: str, params: dict, services: Services) -> dict:
    return _run_market_data_task(run_id, params, services)


def _run_market_data_task(run_id: str, params: dict, services: Services) -> dict:
    start_date = str(params["start_date"])
    end_date = str(params["end_date"])

    services.tasks.progress(run_id, "calendar", 5)
    calendar = _snapshot(
        services, "trade_cal", end_date, services.market_data.fetch_trade_cal
    )
    trade_dates = _open_dates(calendar, start_date, end_date)

    services.tasks.progress(run_id, "static_data", 15)
    stocks = _snapshot(
        services, "stock_basic", end_date, services.market_data.fetch_stock_basic
    )
    names = _snapshot(
        services, "namechange", end_date, services.market_data.fetch_namechange
    )

    published = services.universe.published_trade_dates(trade_dates)
    candidates = [date for date in trade_dates if date not in published]
    written = 0
    services.tasks.progress(run_id, "market_data", 60)
    for trade_date in candidates:
        missing = [
            dataset
            for dataset in MARKET_DATASETS
            if not _partition_exists(services.store, dataset, trade_date)
        ]
        if not missing:
            continue
        frames = services.market_data.fetch_trade_date(trade_date)
        by_dataset = {
            "daily": frames.daily,
            "adj_factor": frames.adj_factor,
            "suspend": frames.suspend,
            "limit": frames.limit,
        }
        for dataset in missing:
            services.store.write_partition(dataset, trade_date, by_dataset[dataset])
            written += 1

    services.tasks.progress(run_id, "validation", 75)
    market_by_date = {
        trade_date: _market_frame(services.store, trade_date)
        for trade_date in candidates
    }
    failures = [
        (trade_date, issue.code)
        for trade_date, frame in market_by_date.items()
        for issue in validate_market_frame(frame)
    ]
    if failures:
        trade_date, code = failures[0]
        raise ValueError(f"Market data validation failed for {trade_date}: {code}")

    services.tasks.progress(run_id, "universe", 90)
    universe_params = UniverseParams(
        listing_days=int(params.get("listing_days", 120)),
        liquidity_days=int(params.get("liquidity_days", 20)),
        min_average_amount=float(params.get("min_average_amount", 50_000_000)),
    )
    results = []
    for trade_date in candidates:
        daily_history = _history(services.store, trade_date)
        results.append(
            build_universe(
                trade_date,
                daily_history,
                stocks,
                names,
                services.store.read_dataset(
                    "suspend", start_date=start_date, end_date=trade_date
                ),
                services.store.read_dataset(
                    "limit", start_date=start_date, end_date=trade_date
                ),
                universe_params,
            )
        )

    services.tasks.progress(run_id, "publish", 100)
    for result in results:
        services.universe.publish(run_id, params, result)
    return {
        "published_dates": [result.trade_date for result in results],
        "partitions_written": written,
    }


def _snapshot(services: Services, dataset: str, end_date: str, fetch):
    if not _partition_exists(services.store, dataset, end_date):
        services.store.write_partition(dataset, end_date, fetch())
    return services.store.read_dataset(dataset, start_date=end_date, end_date=end_date)


def _partition_exists(store: ParquetDataStore, dataset: str, trade_date: str) -> bool:
    return (
        store.root / "raw" / dataset / f"trade_date={trade_date}" / "data.parquet"
    ).exists()


def _open_dates(calendar: pd.DataFrame, start_date: str, end_date: str) -> list[str]:
    dates = calendar["cal_date"].astype(str)
    open_mask = pd.to_numeric(calendar["is_open"], errors="coerce").eq(1)
    return sorted(dates[open_mask & dates.between(start_date, end_date)].unique())


def _market_frame(store: ParquetDataStore, trade_date: str) -> pd.DataFrame:
    daily = store.read_dataset("daily", start_date=trade_date, end_date=trade_date)
    factors = store.read_dataset(
        "adj_factor", start_date=trade_date, end_date=trade_date
    )
    return daily.merge(factors, on=["ts_code", "trade_date"], how="left")


def _history(store: ParquetDataStore, end_date: str) -> pd.DataFrame:
    daily = store.read_dataset("daily", end_date=end_date)
    factors = store.read_dataset("adj_factor", end_date=end_date)
    return daily.merge(factors, on=["ts_code", "trade_date"], how="left")
