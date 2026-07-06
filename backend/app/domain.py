from enum import StrEnum

from pydantic import BaseModel, Field


class SignalRating(StrEnum):
    A = "A"
    B = "B"
    C = "C"
    D = "D"


class DailyBar(BaseModel):
    ts_code: str
    name: str = ""
    trade_date: str
    open: float
    high: float
    low: float
    close: float
    pre_close: float
    pct_chg: float
    vol: float = 0.0
    amount: float = 0.0


class StockSignal(BaseModel):
    ts_code: str
    name: str
    trade_date: str
    rating: SignalRating
    action: str
    score: float
    suggested_weight: float = Field(ge=0.0, le=1.0)
    reason: str
