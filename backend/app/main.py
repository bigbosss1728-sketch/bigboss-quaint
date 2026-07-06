import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend.app.repository import JsonSignalRepository
from backend.app.settings import load_environment
from backend.app.signal_service import generate_signals
from backend.app.tushare_client import TushareClient


def create_app(data_dir: Path | None = None) -> FastAPI:
    load_environment()
    app = FastAPI(title="Personal Quant Platform")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
        allow_methods=["*"],
        allow_headers=["*"],
    )

    repository = JsonSignalRepository(data_dir or Path("backend/.data"))

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

    return app


app = create_app()
