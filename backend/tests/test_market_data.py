import pandas as pd
import pytest

from backend.app.market_data import TushareMarketData


class FakePro:
    def __init__(self):
        self.calls = []

    def _frame(self, endpoint, **kwargs):
        self.calls.append((endpoint, kwargs))
        return pd.DataFrame([{"ts_code": "000001.SZ", "trade_date": 20260709}])

    def daily(self, **kwargs):
        frame = self._frame("daily", **kwargs)
        return frame.assign(open=10.0, high=11.0, low=9.0, close=10.5, amount=100.0)

    def adj_factor(self, **kwargs):
        return self._frame("adj_factor", **kwargs).assign(adj_factor=1.0)

    def suspend_d(self, **kwargs):
        return self._frame("suspend_d", **kwargs).assign(suspend_type="S")

    def stk_limit(self, **kwargs):
        return self._frame("stk_limit", **kwargs).assign(up_limit=11.0, down_limit=9.0)

    def stock_basic(self, **kwargs):
        self.calls.append(("stock_basic", kwargs))
        status = kwargs["list_status"]
        rows = [
            {
                "ts_code": f"00000{len(self.calls)}.SZ",
                "name": status,
                "industry": "Bank",
                "list_date": "20000101",
                "delist_date": None,
                "list_status": status,
                "exchange": "SZSE",
                "market": "Main Board",
            }
        ]
        if status == "P":
            rows.append({**rows[0], "ts_code": "000001.SZ", "name": "duplicate"})
        return pd.DataFrame(rows)

    def namechange(self, **kwargs):
        return self._frame("namechange", **kwargs)

    def trade_cal(self, **kwargs):
        return self._frame("trade_cal", **kwargs)


@pytest.fixture
def fake_pro():
    return FakePro()


def test_fetch_trade_date_normalizes_keys(fake_pro):
    result = TushareMarketData(pro=fake_pro).fetch_trade_date("20260709")

    assert set(result.daily.columns) >= {
        "ts_code",
        "trade_date",
        "open",
        "high",
        "low",
        "close",
        "amount",
    }
    assert result.trade_date == "20260709"
    assert result.daily.loc[0, "trade_date"] == "20260709"
    assert [call[0] for call in fake_pro.calls] == [
        "daily",
        "adj_factor",
        "suspend_d",
        "stk_limit",
    ]
    assert all(call[1] == {"trade_date": "20260709"} for call in fake_pro.calls)


def test_static_datasets_are_fetched_separately(fake_pro):
    market_data = TushareMarketData(pro=fake_pro)

    stock_basic = market_data.fetch_stock_basic()
    market_data.fetch_namechange()
    market_data.fetch_trade_cal()

    assert [call[0] for call in fake_pro.calls] == [
        "stock_basic",
        "stock_basic",
        "stock_basic",
        "namechange",
        "trade_cal",
    ]
    stock_calls = [kwargs for endpoint, kwargs in fake_pro.calls if endpoint == "stock_basic"]
    assert [call["list_status"] for call in stock_calls] == ["L", "D", "P"]
    assert all(
        call["fields"]
        == "ts_code,name,industry,list_date,delist_date,list_status,exchange,market"
        for call in stock_calls
    )
    assert stock_basic["ts_code"].tolist() == ["000001.SZ", "000002.SZ", "000003.SZ"]
    assert set(stock_basic.columns) >= {
        "ts_code",
        "name",
        "industry",
        "list_date",
        "delist_date",
        "list_status",
        "exchange",
        "market",
    }
