import json
from pathlib import Path

from backend.app.domain import StockSignal


class JsonSignalRepository:
    def __init__(self, data_dir: Path):
        self._data_dir = data_dir
        self._latest_path = data_dir / "latest_signals.json"

    def save_latest(self, signals: list[StockSignal], source: str) -> None:
        self._data_dir.mkdir(parents=True, exist_ok=True)
        payload = {
            "source": source,
            "signals": [item.model_dump(mode="json") for item in signals],
        }
        self._latest_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def latest(self) -> tuple[str, list[StockSignal]]:
        if not self._latest_path.exists():
            return "sample", sample_signals()

        payload = json.loads(self._latest_path.read_text(encoding="utf-8"))
        signals = [StockSignal.model_validate(item) for item in payload["signals"]]
        return payload.get("source", "local"), signals


def sample_signals() -> list[StockSignal]:
    from backend.app.domain import DailyBar
    from backend.app.signal_service import generate_signals

    return generate_signals(
        [
            DailyBar(
                ts_code="000001.SZ",
                name="Ping An Bank",
                trade_date="20260703",
                open=10.0,
                high=11.0,
                low=9.8,
                close=10.8,
                pre_close=10.0,
                pct_chg=8.0,
                vol=900000.0,
                amount=1200000.0,
            ),
            DailyBar(
                ts_code="600000.SH",
                name="SPD Bank",
                trade_date="20260703",
                open=8.0,
                high=8.2,
                low=7.9,
                close=8.1,
                pre_close=8.0,
                pct_chg=1.25,
                vol=700000.0,
                amount=800000.0,
            ),
        ]
    )
