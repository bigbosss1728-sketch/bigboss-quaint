import pandas as pd

from backend.app.universe_service import UniverseParams, build_universe


TRADE_DATE = "20260710"
CODES = {
    "eligible": "000001.SZ",
    "not_listed": "000002.SZ",
    "st": "000003.SZ",
    "suspended": "000004.SZ",
    "new_listing": "000005.SZ",
    "low_liquidity": "000006.SZ",
    "limit_locked": "000007.SZ",
    "invalid_market_data": "000008.SZ",
}


def universe_frames():
    dates = pd.bdate_range(end=TRADE_DATE, periods=120).strftime("%Y%m%d").tolist()
    daily_rows = []
    for code in CODES.values():
        for date in dates:
            daily_rows.append(
                {
                    "ts_code": code,
                    "trade_date": date,
                    "open": 10.0,
                    "high": 11.0,
                    "low": 9.0,
                    "close": 10.0,
                    "vol": 1_000_000.0,
                    "amount": 50_000_000.0,
                    "adj_factor": 1.0,
                }
            )
    daily = pd.DataFrame(daily_rows)
    daily.loc[daily["ts_code"] == CODES["low_liquidity"], "amount"] = 49_999_999.0
    invalid_row = (daily["ts_code"] == CODES["invalid_market_data"]) & (
        daily["trade_date"] == TRADE_DATE
    )
    daily.loc[invalid_row, "high"] = 9.0

    stocks = pd.DataFrame(
        [
            {
                "ts_code": code,
                "name": code,
                "list_date": dates[0],
                "delist_date": None,
                "list_status": "L",
            }
            for code in CODES.values()
        ]
    )
    stocks.loc[stocks["ts_code"] == CODES["not_listed"], "delist_date"] = TRADE_DATE
    stocks.loc[stocks["ts_code"] == CODES["not_listed"], "list_status"] = "D"
    stocks.loc[stocks["ts_code"] == CODES["new_listing"], "list_date"] = dates[1]

    names = pd.DataFrame(
        [
            {
                "ts_code": CODES["eligible"],
                "name": "ST old name",
                "start_date": dates[0],
                "end_date": dates[-2],
            },
            {
                "ts_code": CODES["st"],
                "name": "*ST target",
                "start_date": dates[-2],
                "end_date": None,
            },
        ]
    )
    suspensions = pd.DataFrame(
        [{"ts_code": CODES["suspended"], "trade_date": TRADE_DATE}]
    )
    limits = pd.DataFrame(
        [
            {
                "ts_code": CODES["limit_locked"],
                "trade_date": TRADE_DATE,
                "up_limit": 10.0,
                "down_limit": 9.0,
            }
        ]
    )
    return daily, stocks, names, suspensions, limits


def test_build_universe_assigns_each_exact_exclusion_reason():
    result = build_universe(TRADE_DATE, *universe_frames(), UniverseParams())
    by_code = {member.ts_code: member for member in result.members}

    assert by_code[CODES["eligible"]].reasons == ()
    assert by_code[CODES["eligible"]].eligible is True
    for reason in (
        "not_listed",
        "st",
        "suspended",
        "new_listing",
        "low_liquidity",
        "limit_locked",
        "invalid_market_data",
    ):
        assert by_code[CODES[reason]].reasons == (reason,)
        assert by_code[CODES[reason]].eligible is False


def test_build_universe_keeps_inclusive_listing_and_liquidity_boundaries():
    result = build_universe(TRADE_DATE, *universe_frames(), UniverseParams())
    member = next(item for item in result.members if item.ts_code == CODES["eligible"])

    assert member.eligible is True
    assert member.average_amount_20d == 50_000_000.0


def test_build_universe_funnel_counts_are_monotonic():
    result = build_universe(TRADE_DATE, *universe_frames(), UniverseParams())

    counts = list(result.funnel.values())
    assert counts == sorted(counts, reverse=True)
    assert counts[0] == len(CODES)
    assert counts[-1] == 1


def test_build_universe_uses_historical_dates_not_current_list_status():
    daily, stocks, names, suspensions, limits = universe_frames()
    eligible = stocks["ts_code"] == CODES["eligible"]
    stocks.loc[eligible, "list_status"] = "D"
    stocks.loc[eligible, "delist_date"] = "20260713"
    delisted = stocks["ts_code"] == CODES["not_listed"]
    stocks.loc[delisted, "list_date"] = daily["trade_date"].min()
    stocks.loc[delisted, "list_status"] = "L"
    stocks.loc[delisted, "delist_date"] = TRADE_DATE

    result = build_universe(
        TRADE_DATE,
        daily,
        stocks,
        names,
        suspensions,
        limits,
        UniverseParams(),
    )
    by_code = {member.ts_code: member for member in result.members}

    assert by_code[CODES["eligible"]].eligible is True
    assert by_code[CODES["not_listed"]].reasons == ("not_listed",)


def test_build_universe_requires_twenty_amount_observations():
    daily, stocks, names, suspensions, limits = universe_frames()
    code = CODES["eligible"]
    code_rows = daily[daily["ts_code"] == code].index
    daily = daily.drop(code_rows[:-19])

    result = build_universe(
        TRADE_DATE,
        daily,
        stocks,
        names,
        suspensions,
        limits,
        UniverseParams(),
    )
    member = next(item for item in result.members if item.ts_code == code)

    assert member.average_amount_20d is None
    assert member.reasons == ("low_liquidity",)


def test_build_universe_rejects_missing_target_day_market_data():
    daily, stocks, names, suspensions, limits = universe_frames()
    code = CODES["eligible"]
    daily = daily[
        ~((daily["ts_code"] == code) & (daily["trade_date"] == TRADE_DATE))
    ]

    result = build_universe(
        TRADE_DATE,
        daily,
        stocks,
        names,
        suspensions,
        limits,
        UniverseParams(),
    )
    member = next(item for item in result.members if item.ts_code == code)

    assert member.reasons == ("invalid_market_data",)
