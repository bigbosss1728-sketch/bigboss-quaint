# Qlib Integration Boundary

Qlib will own research data, factor/model experiments, backtests, and daily prediction output.

MVP boundary:

- Backend currently emits deterministic daily signals from Tushare daily bars.
- Next step is to write Tushare raw data into a Qlib-compatible dataset.
- Qlib model output should be normalized into the backend `StockSignal` shape:
  - `ts_code`
  - `trade_date`
  - `score`
  - `rating`
  - `action`
  - `suggested_weight`
  - `reason`

Keep Qlib optional until the data pipeline is stable.
