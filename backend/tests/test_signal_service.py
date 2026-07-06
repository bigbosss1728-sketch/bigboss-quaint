from backend.app.domain import DailyBar, SignalRating
from backend.app.signal_service import generate_signals


def test_generate_signals_ranks_positive_momentum_above_weak_stock():
    strong = DailyBar(
        ts_code="000001.SZ",
        name="Ping An Bank",
        trade_date="20260703",
        open=10.0,
        high=11.2,
        low=9.9,
        close=11.0,
        pre_close=10.0,
        pct_chg=10.0,
        vol=900000.0,
        amount=1200000.0,
    )
    weak = DailyBar(
        ts_code="000002.SZ",
        name="Vanke A",
        trade_date="20260703",
        open=10.0,
        high=10.1,
        low=9.5,
        close=9.6,
        pre_close=10.0,
        pct_chg=-4.0,
        vol=800000.0,
        amount=900000.0,
    )

    signals = generate_signals([weak, strong])

    assert [item.ts_code for item in signals] == ["000001.SZ", "000002.SZ"]
    assert signals[0].rating == SignalRating.A
    assert signals[0].action == "buy"
    assert signals[1].rating == SignalRating.D
    assert signals[1].action == "avoid"


def test_generate_signals_limits_position_for_extreme_daily_move():
    bar = DailyBar(
        ts_code="600000.SH",
        name="SPD Bank",
        trade_date="20260703",
        open=10.0,
        high=12.0,
        low=9.8,
        close=11.2,
        pre_close=10.0,
        pct_chg=12.0,
        vol=1000000.0,
        amount=1300000.0,
    )

    signal = generate_signals([bar])[0]

    assert signal.rating == SignalRating.B
    assert signal.action == "watch"
    assert signal.suggested_weight == 0.0
