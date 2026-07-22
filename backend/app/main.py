import json
import os
from contextlib import asynccontextmanager, closing
from datetime import date
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware

from backend.app.data_store import ParquetDataStore
from backend.app.database import connect_database
from backend.app.domain import (
    DataTaskRequest,
    QueuedTaskResponse,
    StockBarResponse,
    TaskResponse,
    UniverseResponse,
)
from backend.app.repository import JsonSignalRepository
from backend.app.settings import load_environment
from backend.app.signal_service import generate_signals
from backend.app.task_process import spawn_worker_once
from backend.app.task_repository import TaskRepository, TaskRun
from backend.app.tushare_client import TushareClient
from backend.app.universe_repository import UniverseRepository


def create_app(data_dir: Path | None = None) -> FastAPI:
    load_environment()
    data_root = data_dir or Path("backend/.data")
    database_path = data_root / "quant.db"
    tasks = TaskRepository(database_path)
    UniverseRepository(database_path)
    market_store = ParquetDataStore(data_root / "market")

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        tasks.mark_running_interrupted()
        yield

    app = FastAPI(title="Personal Quant Platform", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
        allow_methods=["*"],
        allow_headers=["*"],
    )

    repository = JsonSignalRepository(data_root)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "quant-platform-backend"}

    @app.get("/api/signals/latest")
    def latest_signals() -> dict[str, object]:
        source, signals = repository.latest()
        return {
            "source": source,
            "signals": [item.model_dump(mode="json") for item in signals],
        }

    @app.post("/api/pipeline/run")
    def run_pipeline(trade_date: str, limit: int = 200) -> dict[str, object]:
        client = TushareClient()
        try:
            bars = client.fetch_daily_bars(trade_date=trade_date, limit=limit)
        except RuntimeError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        history_by_code = {
            bar.ts_code: client.fetch_recent_bars(
                ts_code=bar.ts_code,
                end_date=trade_date,
                limit=30,
            )
            or [bar]
            for bar in bars
        }
        signals = generate_signals(bars, history_by_code=history_by_code)
        repository.save_latest(signals, source="tushare")
        return {
            "source": "tushare",
            "signals": [item.model_dump(mode="json") for item in signals],
        }

    def queue_data_task(task_type: str, request: DataTaskRequest) -> QueuedTaskResponse:
        today = date.today().strftime("%Y%m%d")
        params = {
            "start_date": request.start_date
            or ("20150101" if task_type == "data_initialize" else today),
            "end_date": request.end_date or today,
        }
        run_id = tasks.create(task_type, params)
        spawn_worker_once()
        return QueuedTaskResponse(id=run_id)

    @app.post(
        "/api/tasks/data/initialize",
        response_model=QueuedTaskResponse,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def initialize_data(request: DataTaskRequest) -> QueuedTaskResponse:
        return queue_data_task("data_initialize", request)

    @app.post(
        "/api/tasks/data/update",
        response_model=QueuedTaskResponse,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def update_data(request: DataTaskRequest) -> QueuedTaskResponse:
        return queue_data_task("data_incremental", request)

    @app.get("/api/tasks", response_model=list[TaskResponse])
    def list_tasks(
        limit: int = Query(default=50, ge=1, le=200),
        offset: int = Query(default=0, ge=0, le=10_000),
    ) -> list[TaskResponse]:
        return [_task_response(run) for run in tasks.list(limit=limit + offset)[offset:]]

    @app.get("/api/tasks/{run_id}", response_model=TaskResponse)
    def get_task(run_id: str) -> TaskResponse:
        run = tasks.get(run_id)
        if run is None:
            raise HTTPException(status_code=404, detail="Task not found.")
        return _task_response(run)

    @app.get("/api/universe/latest", response_model=UniverseResponse)
    def latest_universe() -> UniverseResponse:
        with closing(connect_database(database_path)) as connection:
            run = connection.execute(
                "SELECT * FROM universe_runs ORDER BY rowid DESC LIMIT 1"
            ).fetchone()
            if run is None:
                raise HTTPException(
                    status_code=404,
                    detail="Universe has not been initialized.",
                )
            members = connection.execute(
                "SELECT * FROM universe_members WHERE universe_run_id = ? ORDER BY ts_code",
                (run["id"],),
            ).fetchall()
        return UniverseResponse(
            id=run["id"],
            trade_date=run["trade_date"],
            task_run_id=run["task_run_id"],
            params=json.loads(run["params_json"]),
            funnel=json.loads(run["funnel_json"]),
            published_at=run["published_at"],
            members=[
                {
                    "ts_code": member["ts_code"],
                    "eligible": bool(member["eligible"]),
                    "reasons": json.loads(member["reasons_json"]),
                    "average_amount_20d": member["average_amount_20d"],
                }
                for member in members
            ],
        )

    @app.get("/api/stocks/{ts_code}/bars", response_model=list[StockBarResponse])
    def stock_bars(
        ts_code: str,
        start_date: str | None = Query(default=None, pattern=r"^\d{8}$"),
        end_date: str | None = Query(default=None, pattern=r"^\d{8}$"),
        limit: int = Query(default=500, ge=1, le=5000),
        refresh: bool = Query(default=False),
    ) -> list[StockBarResponse]:
        if refresh:
            try:
                live_bars = TushareClient().fetch_recent_bars(
                    ts_code=ts_code,
                    end_date=end_date or date.today().strftime("%Y%m%d"),
                    limit=limit,
                )
            except Exception as exc:
                raise HTTPException(
                    status_code=502,
                    detail=f"Tushare market data request failed: {exc}",
                ) from exc
            return [
                StockBarResponse(
                    ts_code=bar.ts_code,
                    trade_date=bar.trade_date,
                    open=bar.open,
                    high=bar.high,
                    low=bar.low,
                    close=bar.close,
                    vol=bar.vol,
                    amount=0.0,
                )
                for bar in live_bars
                if start_date is None or bar.trade_date >= start_date
            ]

        frame = market_store.read_dataset("daily", start_date, end_date)
        if frame.empty:
            return []
        rows = frame[frame["ts_code"].astype(str) == ts_code].copy()
        rows["trade_date"] = rows["trade_date"].astype(str)
        rows = rows.sort_values("trade_date").drop_duplicates("trade_date").tail(limit)
        return [
            StockBarResponse(
                ts_code=str(row.ts_code),
                trade_date=str(row.trade_date),
                open=float(row.open),
                high=float(row.high),
                low=float(row.low),
                close=float(row.close),
                vol=float(getattr(row, "vol", 0.0)),
                amount=float(getattr(row, "amount", 0.0)),
            )
            for row in rows.itertuples(index=False)
        ]

    return app


def _task_response(run: TaskRun) -> TaskResponse:
    error_message = run.error_message
    if error_message and "traceback" in error_message.casefold():
        lines = [line for line in error_message.splitlines() if "traceback" not in line.casefold()]
        error_message = lines[-1] if lines else "Task failed."
    return TaskResponse(
        id=run.id,
        task_type=run.task_type,
        status=run.status,
        stage=run.stage,
        progress=run.progress,
        error_message=error_message,
        created_at=run.created_at,
        started_at=run.started_at,
        finished_at=run.finished_at,
        duration_ms=run.duration_ms,
    )


app = create_app()
