import os

import pandas as pd

from backend.app.domain import DailyBar
from backend.app.settings import load_environment


class TushareClient:
    def __init__(self, token: str | None = None):
        load_environment()
        self._token = token or os.getenv("TUSHARE_TOKEN")

    def fetch_daily_bars(
        self,
        trade_date: str,
        limit: int = 200,
    ) -> list[DailyBar]:
        if not self._token:
            raise RuntimeError("TUSHARE_TOKEN is required to fetch market data.")

        import tushare as ts

        pro = ts.pro_api(self._token)
        daily = pro.daily(trade_date=trade_date)
        names = pro.stock_basic(
            exchange="",
            list_status="L",
            fields="ts_code,name",
        )
        data = daily.merge(names, on="ts_code", how="left").head(limit)
        return [_daily_bar_from_row(row) for _, row in data.iterrows()]


def _daily_bar_from_row(row: pd.Series) -> DailyBar:
    return DailyBar(
        ts_code=str(row["ts_code"]),
        name=str(row.get("name") or ""),
        trade_date=str(row["trade_date"]),
        open=float(row["open"]),
        high=float(row["high"]),
        low=float(row["low"]),
        close=float(row["close"]),
        pre_close=float(row["pre_close"]),
        pct_chg=float(row["pct_chg"]),
        vol=float(row.get("vol") or 0.0),
        amount=float(row.get("amount") or 0.0),
    )
