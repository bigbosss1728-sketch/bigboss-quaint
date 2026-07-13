from enum import StrEnum
from typing import Literal

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
    bars: list[DailyBar] = Field(default_factory=list)
    indicators: list[str] = Field(default_factory=list)


class DataTaskRequest(BaseModel):
    start_date: str | None = Field(default=None, pattern=r"^\d{8}$")
    end_date: str | None = Field(default=None, pattern=r"^\d{8}$")


class QueuedTaskResponse(BaseModel):
    id: str
    status: Literal["queued"] = "queued"


class TaskResponse(BaseModel):
    id: str
    task_type: str
    status: Literal["queued", "running", "succeeded", "failed", "interrupted"]
    stage: str
    progress: int
    error_message: str | None
    created_at: str
    started_at: str | None
    finished_at: str | None
    duration_ms: int | None


class UniverseMemberResponse(BaseModel):
    ts_code: str
    eligible: bool
    reasons: list[str]
    average_amount_20d: float | None


class UniverseResponse(BaseModel):
    id: str
    trade_date: str
    task_run_id: str
    params: dict[str, object]
    funnel: dict[str, int]
    published_at: str
    members: list[UniverseMemberResponse]


class StockBarResponse(BaseModel):
    ts_code: str
    trade_date: str
    open: float
    high: float
    low: float
    close: float
    vol: float = 0.0
    amount: float = 0.0
