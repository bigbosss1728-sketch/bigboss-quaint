# Multi-Day Stock Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build stock signal cards with multi-day candlestick charts, Chinese rationale, and visible technical indicators.

**Architecture:** Extend the existing backend signal payload so each `StockSignal` carries its recent `DailyBar` list and indicator names. Render the existing `/api/signals/latest` response as frontend cards using a small local SVG candlestick component.

**Tech Stack:** Python 3.11, FastAPI, Pydantic, pytest, React, TypeScript, Vite, Ant Design, SVG.

## Global Constraints

- Keep the app usable without `TUSHARE_TOKEN` by serving deterministic sample signals.
- Do not add a frontend charting dependency for this compact card chart.
- Keep changes limited to signal payload generation, Tushare history fetch, frontend signal display, and matching tests.

---

### Task 1: Backend Signal Payload

**Files:**
- Modify: `backend/app/domain.py`
- Modify: `backend/app/signal_service.py`
- Modify: `backend/app/repository.py`
- Test: `backend/tests/test_signal_service.py`
- Test: `backend/tests/test_api.py`

**Interfaces:**
- Consumes: `DailyBar`
- Produces: `StockSignal.bars: list[DailyBar]`
- Produces: `StockSignal.indicators: list[str]`
- Produces: `generate_signals(rows: list[DailyBar], history_by_code: dict[str, list[DailyBar]] | None = None) -> list[StockSignal]`

- [ ] **Step 1: Write failing backend tests**

Add assertions that generated signals include historical bars, indicator names, and Chinese rationale:

```python
signals = generate_signals([strong], history_by_code={"000001.SZ": [older, strong]})
assert signals[0].bars == [older, strong]
assert signals[0].indicators == ["涨跌幅", "日内振幅", "动量评分", "建议仓位"]
assert "动量" in signals[0].reason
```

Add API assertions:

```python
signal = payload["signals"][0]
assert len(signal["bars"]) >= 5
assert signal["indicators"] == ["涨跌幅", "日内振幅", "动量评分", "建议仓位"]
assert any("\u4e00" <= char <= "\u9fff" for char in signal["reason"])
```

- [ ] **Step 2: Run tests to verify failure**

Run: `..\\.venv\\Scripts\\python.exe -m pytest tests\\test_signal_service.py tests\\test_api.py -q` from `backend`.

Expected: FAIL because `bars`, `indicators`, and optional history are not implemented.

- [ ] **Step 3: Implement minimal backend payload changes**

Add the two fields to `StockSignal`, pass history through `generate_signals`, convert reasons to Chinese, and update `sample_signals()` to create deterministic recent bars.

- [ ] **Step 4: Run backend tests**

Run: `..\\.venv\\Scripts\\python.exe -m pytest tests\\test_signal_service.py tests\\test_api.py -q` from `backend`.

Expected: PASS.

### Task 2: Tushare Recent Bars

**Files:**
- Modify: `backend/app/tushare_client.py`
- Modify: `backend/app/main.py`

**Interfaces:**
- Produces: `TushareClient.fetch_recent_bars(ts_code: str, end_date: str, limit: int = 30) -> list[DailyBar]`
- Consumes: `generate_signals(rows, history_by_code=...)`

- [ ] **Step 1: Add recent-bar fetch helper**

Fetch `pro.daily(ts_code=ts_code, end_date=end_date)`, sort by `trade_date`, keep the latest `limit` rows, and map rows through `_daily_bar_from_row`.

- [ ] **Step 2: Attach histories in pipeline**

After fetching current daily bars, build `history_by_code` by calling `fetch_recent_bars` for each candidate and pass it into `generate_signals`.

- [ ] **Step 3: Run backend tests**

Run: `..\\.venv\\Scripts\\python.exe -m pytest tests -q` from `backend`.

Expected: PASS.

### Task 3: Frontend Card Grid and K-Line SVG

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Consumes: `StockSignal.bars`
- Consumes: `StockSignal.indicators`
- Produces: card grid with SVG candlestick chart per signal

- [ ] **Step 1: Update TypeScript types**

Add a `DailyBar` type and `bars`/`indicators` fields to `StockSignal`.

- [ ] **Step 2: Add local candlestick component**

Create a small `CandlestickChart({ bars })` component inside `App.tsx` that maps OHLC values to SVG wick/body elements.

- [ ] **Step 3: Replace table with cards**

Render `signals.map(...)` into a responsive card grid. Each card must show stock identity, rating, action, score, weight, chart, Chinese reason, and indicator tags.

- [ ] **Step 4: Run frontend build**

Run: `npm.cmd run build` from `frontend`.

Expected: PASS.
