from dataclasses import dataclass

import pandas as pd


@dataclass(frozen=True)
class ValidationIssue:
    code: str
    ts_code: str
    trade_date: str


def validate_market_frame(frame: pd.DataFrame) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []

    def add(code: str, mask: pd.Series) -> None:
        for row in frame.loc[mask.fillna(False), ["ts_code", "trade_date"]].itertuples(
            index=False
        ):
            issues.append(ValidationIssue(code, str(row.ts_code), str(row.trade_date)))

    add("duplicate_key", frame.duplicated(["ts_code", "trade_date"], keep=False))

    ohlc = frame[["open", "high", "low", "close"]]
    add("null_ohlc", ohlc.isna().any(axis=1))
    add("non_positive_ohlc", ohlc.le(0).any(axis=1))
    add("invalid_high", frame["high"] < frame[["open", "close"]].max(axis=1))
    add("invalid_low", frame["low"] > frame[["open", "close"]].min(axis=1))
    add("negative_volume", frame["vol"] < 0)
    add("negative_amount", frame["amount"] < 0)
    missing_factor = (
        frame["adj_factor"].isna()
        if "adj_factor" in frame
        else pd.Series(True, index=frame.index)
    )
    add("missing_adjustment_factor", missing_factor)
    return issues
