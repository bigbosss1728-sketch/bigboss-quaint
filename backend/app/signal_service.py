from backend.app.domain import DailyBar, SignalRating, StockSignal

INDICATORS = ["涨跌幅", "日内振幅", "动量评分", "建议仓位"]


def generate_signals(
    rows: list[DailyBar],
    history_by_code: dict[str, list[DailyBar]] | None = None,
) -> list[StockSignal]:
    history_by_code = history_by_code or {}
    signals = [_score_bar(row, history_by_code.get(row.ts_code, [row])) for row in rows]
    return sorted(signals, key=lambda item: item.score, reverse=True)


def _score_bar(row: DailyBar, bars: list[DailyBar]) -> StockSignal:
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
            reason="单日波动过大，先等待下一交易日确认。",
            bars=bars,
            indicators=INDICATORS,
        )

    if score >= 5.0:
        rating, action, weight, reason = (
            SignalRating.A,
            "buy",
            0.10,
            "日线动量较强，日内振幅可控，纳入优先观察买入池。",
        )
    elif score >= 1.0:
        rating, action, weight, reason = (
            SignalRating.B,
            "watch",
            0.05,
            "动量为正但强度不足，适合继续观察。",
        )
    elif score >= -2.0:
        rating, action, weight, reason = (
            SignalRating.C,
            "hold",
            0.0,
            "动量信号中性，暂不提高仓位。",
        )
    else:
        rating, action, weight, reason = (
            SignalRating.D,
            "avoid",
            0.0,
            "动量偏弱，暂时回避。",
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
        bars=bars,
        indicators=INDICATORS,
    )
