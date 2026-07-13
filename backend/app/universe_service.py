from dataclasses import dataclass

import pandas as pd

from backend.app.data_validation import validate_market_frame


@dataclass(frozen=True)
class UniverseParams:
    listing_days: int = 120
    liquidity_days: int = 20
    min_average_amount: float = 50_000_000


@dataclass(frozen=True)
class UniverseMember:
    ts_code: str
    eligible: bool
    reasons: tuple[str, ...]
    average_amount_20d: float | None


@dataclass(frozen=True)
class UniverseResult:
    trade_date: str
    members: tuple[UniverseMember, ...]
    funnel: dict[str, int]


REASON_ORDER = (
    "not_listed",
    "st",
    "suspended",
    "new_listing",
    "low_liquidity",
    "limit_locked",
    "invalid_market_data",
)


def build_universe(
    trade_date: str,
    daily_history: pd.DataFrame,
    stocks: pd.DataFrame,
    names: pd.DataFrame,
    suspensions: pd.DataFrame,
    limits: pd.DataFrame,
    params: UniverseParams,
) -> UniverseResult:
    trade_date = str(trade_date)
    history = daily_history.copy()
    history["trade_date"] = history["trade_date"].astype(str)
    history = history[history["trade_date"] <= trade_date]
    current = history[history["trade_date"] == trade_date]
    stock_rows = stocks.drop_duplicates("ts_code")
    stock_codes = set(stock_rows["ts_code"].astype(str))

    calendar = sorted(history["trade_date"].unique())
    current_close = current.drop_duplicates("ts_code").set_index("ts_code")["close"]
    invalid_codes = {issue.ts_code for issue in validate_market_frame(current)}
    invalid_codes |= stock_codes - set(current["ts_code"].astype(str))
    suspended_codes = _codes_on_date(suspensions, trade_date)
    st_codes = _st_codes_on_date(names, trade_date)
    locked_codes = _locked_codes_on_date(limits, current_close, trade_date)

    amount_averages = {}
    for code, rows in history.sort_values("trade_date").groupby("ts_code"):
        amounts = pd.to_numeric(rows["amount"], errors="coerce").tail(
            params.liquidity_days
        )
        amount_averages[str(code)] = (
            float(amounts.mean()) if amounts.count() >= params.liquidity_days else None
        )

    reasons_by_code: dict[str, tuple[str, ...]] = {}
    for stock in stock_rows.itertuples(index=False):
        code = str(stock.ts_code)
        list_date = _date_value(getattr(stock, "list_date", None))
        delist_date = _date_value(getattr(stock, "delist_date", None))
        listed = bool(
            list_date
            and list_date <= trade_date
            and (not delist_date or delist_date > trade_date)
        )
        listing_days = (
            sum(list_date <= date <= trade_date for date in calendar) if list_date else 0
        )
        average = amount_averages.get(code)
        flags = {
            "not_listed": not listed,
            "st": code in st_codes,
            "suspended": code in suspended_codes,
            "new_listing": listing_days < params.listing_days,
            "low_liquidity": average is None
            or average < params.min_average_amount,
            "limit_locked": code in locked_codes,
            "invalid_market_data": code in invalid_codes,
        }
        reasons_by_code[code] = tuple(reason for reason in REASON_ORDER if flags[reason])

    active = set(reasons_by_code)
    funnel = {"initial": len(active)}
    for reason in REASON_ORDER:
        active -= {code for code in active if reason in reasons_by_code[code]}
        funnel[reason] = len(active)

    members = tuple(
        UniverseMember(
            ts_code=code,
            eligible=not reasons,
            reasons=reasons,
            average_amount_20d=amount_averages.get(code),
        )
        for code, reasons in reasons_by_code.items()
    )
    return UniverseResult(trade_date=trade_date, members=members, funnel=funnel)


def _date_value(value) -> str | None:
    if value is None or pd.isna(value):
        return None
    value = str(value)
    return value or None


def _codes_on_date(frame: pd.DataFrame, trade_date: str) -> set[str]:
    if frame.empty:
        return set()
    rows = frame[frame["trade_date"].astype(str) == trade_date]
    return set(rows["ts_code"].astype(str))


def _st_codes_on_date(names: pd.DataFrame, trade_date: str) -> set[str]:
    if names.empty:
        return set()
    starts = names["start_date"].fillna("").astype(str)
    ends = names["end_date"].fillna("").astype(str)
    effective = (starts <= trade_date) & ((ends == "") | (ends >= trade_date))
    st_names = names["name"].fillna("").astype(str).str.upper()
    return set(names.loc[effective & st_names.str.contains("ST|退", regex=True), "ts_code"].astype(str))


def _locked_codes_on_date(
    limits: pd.DataFrame, current_close: pd.Series, trade_date: str
) -> set[str]:
    if limits.empty:
        return set()
    rows = limits[limits["trade_date"].astype(str) == trade_date]
    locked = set()
    for row in rows.itertuples(index=False):
        code = str(row.ts_code)
        close = current_close.get(code)
        if pd.notna(close) and (
            (pd.notna(row.up_limit) and close >= row.up_limit)
            or (pd.notna(row.down_limit) and close <= row.down_limit)
        ):
            locked.add(code)
    return locked
