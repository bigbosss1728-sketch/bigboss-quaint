# Multi-Day Stock Cards Design

## Goal

Show every selected stock as a card with a multi-day candlestick chart, Chinese selection rationale, and the technical indicators used by the signal.

## Assumptions

- The existing FastAPI and React MVP stays the delivery path.
- No new frontend chart dependency is needed for compact card charts.
- The UI must remain useful without `TUSHARE_TOKEN`, so sample signals include deterministic multi-day bars.
- Live Tushare runs should attach recent bars when a token is available.

## Backend Design

- Extend `StockSignal` with `bars: list[DailyBar]` and `indicators: list[str]`.
- Keep `generate_signals(rows: list[DailyBar]) -> list[StockSignal]` as the main signal API and add an optional `history_by_code` argument for callers that have multi-day data.
- Produce Chinese `reason` copy from the current scoring rules.
- Add `TushareClient.fetch_recent_bars(ts_code, end_date, limit)` to fetch recent daily OHLC bars for one stock.
- In `/api/pipeline/run`, fetch the current daily pool first, generate each stock's recent history, then save signals with attached bars.

## Frontend Design

- Replace the daily stock table with a responsive card grid.
- Each card shows stock code/name, rating, action, score, suggested weight, SVG candlestick chart, Chinese reason, and indicator tags.
- Draw candlesticks with local React/SVG code to avoid adding a charting library for the first card view.

## Testing

- Backend tests verify sample/API payloads include `bars`, `indicators`, and Chinese reasons.
- Signal tests verify history is attached and sorted with the generated signal.
- Frontend build verifies TypeScript and Vite output.
