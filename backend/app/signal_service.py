from backend.app.domain import DailyBar, SignalRating, StockSignal


def generate_signals(rows: list[DailyBar]) -> list[StockSignal]:
    signals = [_score_bar(row) for row in rows]
    return sorted(signals, key=lambda item: item.score, reverse=True)


def _score_bar(row: DailyBar) -> StockSignal:
    intraday_range = ((row.high - row.low) / row.pre_close * 100) if row.pre_close else 0.0
    score = round(row.pct_chg - intraday_range * 0.2, 2)

    if row.pct_chg > 10.0 or row.pct_chg <= -9.5:
        return StockSignal(
            ts_code=row.ts_code,
            name=row.name,
            trade_date=row.trade_date,
            rating=SignalRating.B,
            action="watch",
            score=score,
            suggested_weight=0.0,
            reason="Extreme daily move; wait for next tradable session.",
        )

    if score >= 5.0:
        rating, action, weight, reason = (
            SignalRating.A,
            "buy",
            0.10,
            "Positive daily momentum with controlled intraday range.",
        )
    elif score >= 1.0:
        rating, action, weight, reason = (
            SignalRating.B,
            "watch",
            0.05,
            "Positive but not strong enough for priority pool.",
        )
    elif score >= -2.0:
        rating, action, weight, reason = (
            SignalRating.C,
            "hold",
            0.0,
            "Neutral signal.",
        )
    else:
        rating, action, weight, reason = (
            SignalRating.D,
            "avoid",
            0.0,
            "Weak momentum.",
        )

    return StockSignal(
        ts_code=row.ts_code,
        name=row.name,
        trade_date=row.trade_date,
        rating=rating,
        action=action,
        score=score,
        suggested_weight=weight,
        reason=reason,
    )
