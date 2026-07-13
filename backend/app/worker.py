import argparse
from pathlib import Path

from backend.app.data_pipeline import (
    Services,
    run_data_incremental,
    run_data_initialize,
)
from backend.app.data_store import ParquetDataStore
from backend.app.market_data import TushareMarketData
from backend.app.task_process import spawn_worker_once
from backend.app.task_repository import TaskRepository
from backend.app.universe_repository import UniverseRepository


DISPATCH = {
    "data_initialize": run_data_initialize,
    "data_incremental": run_data_incremental,
}


def run_once(services: Services, dispatch=DISPATCH) -> bool:
    task = services.tasks.claim_next()
    if task is None:
        return False
    handler = dispatch.get(task.task_type)
    if handler is None:
        services.tasks.fail(task.id, f"Unknown task type: {task.task_type}")
    else:
        try:
            result = handler(task.id, task.params, services)
        except Exception as exc:
            services.tasks.fail(task.id, str(exc))
        else:
            services.tasks.succeed(task.id, result)
    if services.tasks.has_queued():
        spawn_worker_once()
    return True


def build_services(workspace_root: Path | None = None) -> Services:
    root = workspace_root or Path(__file__).resolve().parents[2]
    data_root = root / "backend" / ".data"
    database_path = data_root / "quant.db"
    tasks = TaskRepository(database_path)
    return Services(
        tasks=tasks,
        universe=UniverseRepository(database_path),
        market_data=TushareMarketData(),
        store=ParquetDataStore(data_root / "market"),
    )


def main(argv=None, services: Services | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    parser.parse_args(argv)
    services = services or build_services()
    run_once(services)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
