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

## Binary converter

`dump_bin.py` is vendored unchanged from Microsoft/qlib tag `v0.9.7`, commit
`da920b7f954f48ab1bb64117c976710de198373e`:

https://github.com/microsoft/qlib/blob/v0.9.7/scripts/dump_bin.py
