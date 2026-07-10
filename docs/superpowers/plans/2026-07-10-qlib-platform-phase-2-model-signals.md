# Qlib Platform Phase 2 Models and Signals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert validated local data to Qlib format, train 1/5/10/20-day Alpha158 LightGBM models, manage candidate/production versions, and generate reproducible daily ratings and target weights.

**Architecture:** A versioned Qlib provider directory is created from phase-1 prepared Parquet using Qlib's official `dump_bin.py` workflow. Pure label/rating code is tested independently; worker task handlers wrap Qlib training/prediction and atomically publish model/signal metadata to SQLite.

**Tech Stack:** Python 3.11, pyqlib 0.9.6+, LightGBM through Qlib, pandas, SQLite, pytest, Qlib workflow recorder.

## Global Constraints

- Phase 1 APIs and task interfaces are prerequisites and remain backward compatible.
- Support exactly horizons `1, 5, 10, 20`; default `5`.
- Label for horizon `h`: enter at T+1 open and exit at T+h+1 open; exclude untradable entry/exit samples.
- Chronological candidate split is 70% train, 15% validation, 15% untouched test.
- Promotion refits fixed features/parameters through the latest label-complete date; never auto-promote.
- A/B/C/D percentiles are 5/20/50/100; pool Top 50; buy Top 20; equal weight capped at 5%.
- Signal and ratings update daily; portfolios rebalance all holdings only every `h` trading days.

---

## File Map

- `backend/app/qlib_data.py`: prepared files, Qlib conversion command, provider version switching.
- `backend/app/labels.py`: horizon label expression and tradability mask.
- `backend/app/model_service.py`: Qlib task config, train, evaluate, refit, predict.
- `backend/app/model_repository.py`: model metadata and lifecycle.
- `backend/app/strategy_repository.py`: versioned strategy configurations and immutable task snapshots.
- `backend/app/rating_service.py`: deterministic ranking, rating, action, target weight.
- `backend/app/signal_repository.py`: atomic daily signal publication.
- `research/qlib/dump_bin.py`: exact upstream Qlib converter pinned to installed pyqlib version if it is absent from the wheel.

### Task 1: Qlib dependency and versioned provider conversion

**Files:**
- Modify: `backend/pyproject.toml`
- Create: `backend/app/qlib_data.py`
- Create or verify: `research/qlib/dump_bin.py`
- Create: `backend/tests/test_qlib_data.py`

**Interfaces:**
- Produces: `prepare_qlib_source(raw: DataFrame, destination: Path) -> list[Path]`
- Produces: `build_qlib_provider(source: Path, destination: Path) -> QlibDataVersion`

- [ ] Write a failing test with two symbols, ordered dates, `open/high/low/close/volume/factor`, asserting the built provider can be initialized and queried for both instruments.
- [ ] Run `.\.venv\Scripts\python.exe -m pytest backend/tests/test_qlib_data.py -q`; expected FAIL before implementation.
- [ ] Keep `pyqlib>=0.9.6` in `[project.optional-dependencies].quant`; install with `.\.venv\Scripts\python.exe -m pip install -e ".\backend[dev,quant]"`.
- [ ] Use Qlib's official command shape: `python research/qlib/dump_bin.py dump_all --data_path <prepared> --qlib_dir <version_dir> --include_fields open,close,high,low,volume,factor --file_suffix .parquet`. If the installed distribution includes the official script, invoke it directly; otherwise vendor the matching upstream script unchanged and record its upstream commit in `research/qlib/README.md`.
- [ ] Build into a temporary version directory, run a Qlib query smoke test, then atomically update a small `current.json` manifest; never overwrite the last valid provider.
- [ ] Run the focused test; expected PASS. Commit provider code, test, dependency metadata, and the pinned converter/reference.

### Task 2: Multi-horizon labels without leakage

**Files:**
- Create: `backend/app/labels.py`
- Create: `backend/tests/test_labels.py`

**Interfaces:**
- Produces: `label_expression(horizon: int) -> str`
- Produces: `label_frame(bars: DataFrame, horizon: int, tradability: DataFrame) -> Series`

- [ ] Write parameterized tests for 1/5/10/20 using hand-computed T+1-open to T+h+1-open returns; assert T features cannot observe either future price, and locked/suspended entry/exit becomes null.
- [ ] Verify failure with `.\.venv\Scripts\python.exe -m pytest backend/tests/test_labels.py -q`.
- [ ] Implement `label_expression` with Qlib `Ref($open, ...)` offsets matching the hand-computed test and reject all other horizons with Pydantic/`ValueError` message `horizon must be one of 1, 5, 10, 20`.
- [ ] Run tests; expected PASS. Commit label module and tests.

### Task 3: Model metadata and lifecycle

**Files:**
- Modify: `backend/app/database.py`
- Create: `backend/app/model_repository.py`
- Create: `backend/tests/test_model_repository.py`

**Interfaces:**
- Produces: `ModelRepository.create_candidate(...) -> str`
- Produces: `ModelRepository.promote(candidate_id: str, production_artifact: Path) -> ModelVersion`
- Produces: `ModelRepository.rollback(model_id: str) -> ModelVersion`
- Produces: `ModelRepository.production(horizon: int) -> ModelVersion | None`

- [ ] Test one-production-per-horizon, candidate metrics immutability, promotion archiving, rollback, and isolation between 5-day and 10-day production models.
- [ ] Add `data_versions` and `model_versions` tables with JSON params/metrics and unique partial index `WHERE status='production'` on horizon.
- [ ] Implement all lifecycle transitions in one `BEGIN IMMEDIATE` transaction and never delete artifact paths.
- [ ] Run repository tests; expected PASS. Commit schema, repository, and tests.

### Task 4: Qlib training, evaluation, and production refit

**Files:**
- Create: `backend/app/model_service.py`
- Create: `backend/tests/test_model_service.py`
- Modify: `backend/app/worker.py`

**Interfaces:**
- Produces: `train_candidate(request: TrainRequest, paths: DataPaths) -> CandidateResult`
- Produces: `refit_for_production(candidate: ModelVersion, paths: DataPaths) -> Path`
- Produces: worker task `model_train`.

- [ ] Write a tiny-provider integration test asserting chronological segment boundaries, saved model artifact, predictions only in test, and metrics keys `ic`, `rank_ic`, `annualized_return`, `max_drawdown`, `sharpe`, `turnover`, `return_after_cost`, `duration_ms`.
- [ ] Verify failure before implementation.
- [ ] Build the Qlib `DatasetH` with `Alpha158`, the horizon label from Task 2, `LGBModel`, fixed random seed, and explicit train/valid/test dates calculated by trading-date count. Use Qlib recorder to save the trained model and predictions under `backend/.data/runs/<run_id>`.
- [ ] Generate per-stock factor contributions with LightGBM prediction contributions from the fitted booster, store the five largest positive and five largest negative values, and assert their sum plus bias matches the prediction within floating-point tolerance. Do not add the SHAP package.
- [ ] On promotion, refit the approved fixed configuration through the latest label-complete date and publish only after the artifact reloads and predicts successfully.
- [ ] Run focused tests and existing worker tests; expected PASS. Commit service, worker handler, and tests.

### Task 5: Strategy configuration, ratings, signals, and rebalance calendar

**Files:**
- Create: `backend/app/rating_service.py`
- Create: `backend/app/strategy_repository.py`
- Create: `backend/app/signal_repository.py`
- Create: `backend/tests/test_rating_service.py`
- Create: `backend/tests/test_strategy_repository.py`
- Create: `backend/tests/test_signal_repository.py`
- Modify: `backend/app/database.py`

**Interfaces:**
- Produces: `rate_predictions(predictions: DataFrame, params: SignalParams, previous: DataFrame | None) -> list[RatedSignal]`
- Produces: `StrategyRepository.create(name: str, params: SignalParams) -> StrategyConfig`
- Produces: `StrategyRepository.snapshot(strategy_id: str) -> StrategySnapshot`
- Produces: `is_rebalance_day(trade_dates: Sequence[str], last_rebalance: str | None, horizon: int) -> bool`
- Produces: `SignalRepository.publish(run: SignalRun, signals: Sequence[RatedSignal]) -> None`

- [ ] Test strategy validation and versioning: only 1/5/10/20 horizons, `buy_top_n <= pool_top_n`, strictly increasing rating thresholds, positive listing/liquidity windows, `(0,1]` max weight, non-negative costs, and old snapshots unchanged after editing a strategy.
- [ ] Test exact percentile boundaries, deterministic code tie-breaks, Top 50/20, equal 5% weights, prior-rank changes, and full replacement only every horizon trading days.
- [ ] Add `strategy_configs`, `signal_runs`, and `stock_signals` tables from the design, including model/config/task IDs and JSON contribution factors. Store each edit as a new strategy version rather than updating the JSON used by an old task.
- [ ] Implement pure ranking with stable `score DESC, ts_code ASC`; compute weights only for the next rebalance target while still publishing daily ratings.
- [ ] Publish a signal run and all stocks in one transaction; failed runs leave the previous latest run queryable.
- [ ] Run `.\.venv\Scripts\python.exe -m pytest backend/tests/test_strategy_repository.py backend/tests/test_rating_service.py backend/tests/test_signal_repository.py -q`; expected PASS. Commit strategy/rating repositories, schema, and tests.

### Task 6: Model/signal APIs and compatibility

**Files:**
- Modify: `backend/app/main.py`
- Modify: `backend/app/domain.py`
- Modify: `backend/tests/test_api.py`
- Modify: `backend/app/worker.py`

- [ ] Add failing API tests for strategy create/edit/list, train/signal tasks, model list, promote, rollback, latest/date-filtered signals, pagination, missing production model, and absence of mock fallback after database initialization.
- [ ] Implement `GET /api/strategies`, `POST /api/strategies`, `PUT /api/strategies/{id}`, `POST /api/tasks/models/train`, `POST /api/tasks/signals/run`, `GET /api/models`, `POST /api/models/{id}/promote`, `POST /api/models/{id}/rollback`, `GET /api/signals/latest`, and `GET /api/signals/{trade_date}`.
- [ ] Add worker handlers `signal_run` and `daily_pipeline`. `daily_pipeline` must call phase-1 incremental data update, rebuild the point-in-time universe, require the selected horizon's production model, predict/rate, and atomically publish signals; it must not duplicate those component functions.
- [ ] Keep the legacy response keys `source` and `signals`, but populate them from SQLite. Return explicit empty/uninitialized state rather than sample predictions when real storage exists.
- [ ] Run `.\.venv\Scripts\python.exe -m pytest backend/tests -q`; expected all PASS.
- [ ] Run one tiny-provider end-to-end workflow and commit API/worker changes.
