import sys
from types import SimpleNamespace

import pandas as pd

from backend.app.tushare_client import TushareClient


def test_fetch_recent_bars_returns_latest_rows_in_date_order(monkeypatch):
    class FakePro:
        def daily(self, ts_code: str, end_date: str):
            assert ts_code == "000001.SZ"
            assert end_date == "20260703"
            return pd.DataFrame(
                [
                    {
                        "ts_code": "000001.SZ",
                        "trade_date": "20260703",
                        "open": 10.0,
                        "high": 11.0,
                        "low": 9.9,
                        "close": 10.8,
                        "pre_close": 10.0,
                        "pct_chg": 8.0,
                    },
                    {
                        "ts_code": "000001.SZ",
                        "trade_date": "20260701",
                        "open": 9.8,
                        "high": 10.0,
                        "low": 9.7,
                        "close": 9.9,
                        "pre_close": 9.8,
                        "pct_chg": 1.02,
                    },
                    {
                        "ts_code": "000001.SZ",
                        "trade_date": "20260702",
                        "open": 9.9,
                        "high": 10.1,
                        "low": 9.8,
                        "close": 10.0,
                        "pre_close": 9.9,
                        "pct_chg": 1.01,
                    },
                ]
            )

    monkeypatch.setitem(sys.modules, "tushare", SimpleNamespace(pro_api=lambda token: FakePro()))

    bars = TushareClient(token="token").fetch_recent_bars("000001.SZ", "20260703", limit=2)

    assert [bar.trade_date for bar in bars] == ["20260702", "20260703"]
