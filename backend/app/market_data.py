import os
from dataclasses import dataclass

import pandas as pd

from backend.app.settings import load_environment


@dataclass(frozen=True)
class MarketDayFrames:
    trade_date: str
    daily: pd.DataFrame
    adj_factor: pd.DataFrame
    suspend: pd.DataFrame
    limit: pd.DataFrame


class TushareMarketData:
    def __init__(self, pro=None, token: str | None = None):
        load_environment()
        if pro is None:
            token = token or os.getenv("TUSHARE_TOKEN")
            if not token:
                raise RuntimeError("TUSHARE_TOKEN is required to fetch market data.")
            import tushare as ts

            pro = ts.pro_api(token)
        self._pro = pro

    def fetch_trade_date(self, trade_date: str) -> MarketDayFrames:
        return MarketDayFrames(
            trade_date=trade_date,
            daily=self.fetch_daily(trade_date=trade_date),
            adj_factor=_normalize_keys(self._pro.adj_factor(trade_date=trade_date)),
            suspend=_normalize_keys(self._pro.suspend_d(trade_date=trade_date)),
            limit=_normalize_keys(self._pro.stk_limit(trade_date=trade_date)),
        )

    def fetch_daily(
        self,
        *,
        trade_date: str | None = None,
        ts_code: str | None = None,
        end_date: str | None = None,
    ) -> pd.DataFrame:
        arguments = {
            key: value
            for key, value in {
                "trade_date": trade_date,
                "ts_code": ts_code,
                "end_date": end_date,
            }.items()
            if value is not None
        }
        return _normalize_keys(self._pro.daily(**arguments))

    def fetch_stock_basic(self) -> pd.DataFrame:
        fields = "ts_code,name,industry,list_date,delist_date,list_status,exchange,market"
        return _normalize_keys(
            pd.concat(
                [
                    self._pro.stock_basic(exchange="", list_status=status, fields=fields)
                    for status in ("L", "D", "P")
                ],
                ignore_index=True,
            ).drop_duplicates(subset="ts_code")
        )

    def fetch_namechange(self) -> pd.DataFrame:
        return _normalize_keys(self._pro.namechange())

    def fetch_trade_cal(self) -> pd.DataFrame:
        return _normalize_keys(self._pro.trade_cal())


def _normalize_keys(frame: pd.DataFrame) -> pd.DataFrame:
    frame = frame.copy()
    for column in ("ts_code", "trade_date"):
        if column in frame:
            frame[column] = frame[column].astype(str)
    return frame
