import pandas as pd
import pytest

from backend.app.data_validation import validate_market_frame


def valid_frame() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "ts_code": "000001.SZ",
                "trade_date": "20260710",
                "open": 10.0,
                "high": 11.0,
                "low": 9.0,
                "close": 10.5,
                "vol": 1_000.0,
                "amount": 50_000_000.0,
                "adj_factor": 1.0,
            }
        ]
    )


def test_validate_market_frame_accepts_valid_data():
    assert validate_market_frame(valid_frame()) == []


def test_validate_market_frame_rejects_duplicate_security_date():
    frame = pd.concat([valid_frame(), valid_frame()], ignore_index=True)

    assert {issue.code for issue in validate_market_frame(frame)} == {"duplicate_key"}


@pytest.mark.parametrize("column", ["open", "high", "low", "close"])
def test_validate_market_frame_rejects_null_ohlc(column):
    frame = valid_frame()
    frame.loc[0, column] = None

    assert {issue.code for issue in validate_market_frame(frame)} == {"null_ohlc"}


@pytest.mark.parametrize("column", ["open", "high", "low", "close"])
@pytest.mark.parametrize("value", [0.0, -1.0])
def test_validate_market_frame_rejects_non_positive_ohlc(column, value):
    frame = valid_frame()
    frame.loc[0, column] = value

    codes = {issue.code for issue in validate_market_frame(frame)}

    assert "non_positive_ohlc" in codes


def test_validate_market_frame_rejects_high_below_open_or_close():
    frame = valid_frame()
    frame.loc[0, "high"] = 10.25

    assert {issue.code for issue in validate_market_frame(frame)} == {"invalid_high"}


def test_validate_market_frame_rejects_low_above_open_or_close():
    frame = valid_frame()
    frame.loc[0, "low"] = 10.25

    assert {issue.code for issue in validate_market_frame(frame)} == {"invalid_low"}


@pytest.mark.parametrize(
    ("column", "code"),
    [("vol", "negative_volume"), ("amount", "negative_amount")],
)
def test_validate_market_frame_rejects_negative_activity(column, code):
    frame = valid_frame()
    frame.loc[0, column] = -1.0

    assert {issue.code for issue in validate_market_frame(frame)} == {code}


def test_validate_market_frame_rejects_missing_adjustment_factor():
    frame = valid_frame()
    frame.loc[0, "adj_factor"] = None

    assert {issue.code for issue in validate_market_frame(frame)} == {
        "missing_adjustment_factor"
    }
