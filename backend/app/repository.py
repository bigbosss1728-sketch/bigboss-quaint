import json
from pathlib import Path

from backend.app.domain import DailyBar, StockSignal


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
    from backend.app.signal_service import generate_signals

    first = _sample_history(
        ts_code="000001.SZ",
        name="Ping An Bank",
        start_price=9.7,
        closes=[9.8, 9.95, 10.1, 10.0, 10.8],
    )
    second = _sample_history(
        ts_code="600000.SH",
        name="SPD Bank",
        start_price=7.9,
        closes=[7.95, 8.0, 7.98, 8.0, 8.1],
    )
    latest = [first[-1], second[-1]]
    return generate_signals(
        latest,
        history_by_code={
            "000001.SZ": first,
            "600000.SH": second,
        },
    )


def _sample_history(
    ts_code: str,
    name: str,
    start_price: float,
    closes: list[float],
) -> list[DailyBar]:
    bars: list[DailyBar] = []
    previous_close = start_price
    for index, close in enumerate(closes, start=1):
        open_price = previous_close
        high = round(max(open_price, close) * 1.015, 2)
        low = round(min(open_price, close) * 0.985, 2)
        bars.append(
            DailyBar(
                ts_code=ts_code,
                name=name,
                trade_date=f"2026070{index}",
                open=open_price,
                high=high,
                low=low,
                close=close,
                pre_close=previous_close,
                pct_chg=round((close - previous_close) / previous_close * 100, 2),
                vol=700000.0 + index * 50000.0,
                amount=800000.0 + index * 60000.0,
            )
        )
        previous_close = close
    return bars
