# Qlib Platform Phase 4 Backtest and Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cost-aware full-replacement backtests, reports/comparison, CSV exports, daily 18:00 and monthly candidate-training automation, and the final operator runbook.

**Architecture:** Backtests run as existing local worker tasks and persist summary metrics in SQLite while larger curves/holdings/trades live under the run artifact directory. One CLI entry executes the same daily pipeline as the API; Windows Task Scheduler only invokes that CLI.

**Tech Stack:** Qlib portfolio analysis where its execution semantics match the design, pandas fallback for deterministic aggregation, FastAPI, SQLite, React/TypeScript, Windows Task Scheduler.

## Global Constraints

- Signals are generated after T close, enter at T+1 open, and fully replace holdings every selected horizon trading days.
- Default benchmark CSI 300; allow CSI 500/CSI 1000.
- Default costs: commission 0.0003 both sides, stamp duty 0.0005 sell only, slippage 0.0005 both sides.
- A failed backtest or scheduled run never replaces the previous production model/signals.
- Daily schedule is 18:00 on trading days; monthly training starts after the first trading day's successful daily pipeline and creates candidates only.
- Do not auto-submit real trades.

---

### Task 1: Cost-aware rebalance backtest engine

**Files:**
- Create: `backend/app/backtest_service.py`
- Create: `backend/tests/test_backtest_service.py`

**Interfaces:**
- Produces: `run_backtest(request: BacktestRequest, data: BacktestData) -> BacktestResult`

- [ ] Build a hand-computed fixture with 10 dates, two rebalance dates, one suspension, one locked limit day, commission/stamp/slippage; assert positions replace only on horizon boundaries and exact cash/equity/cost values.
- [ ] Verify failure before implementation.
- [ ] Use Qlib exchange/portfolio analysis only if its open-price and full-replacement semantics match the fixture. Otherwise keep the model/predictions in Qlib and implement the small deterministic execution loop locally; the fixture is the contract. Apply costs exactly as:

```python
buy_cost = buy_notional * (commission + slippage)
sell_cost = sell_notional * (commission + stamp_duty + slippage)
cash_after = cash_before + sell_notional - sell_cost - buy_notional - buy_cost
```
- [ ] Return daily strategy/benchmark net value, drawdown, monthly return, holdings, trades, annualized return, excess return, max drawdown, Sharpe, turnover, and before/after-cost return.
- [ ] Run focused tests; expected PASS. Commit engine and test.

### Task 2: Backtest persistence, worker, and APIs

**Files:**
- Modify: `backend/app/database.py`
- Create: `backend/app/backtest_repository.py`
- Modify: `backend/app/worker.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/domain.py`
- Modify: `backend/tests/test_api.py`
- Create: `backend/tests/test_backtest_repository.py`

**Interfaces:**
- Consumes: `run_backtest` and the existing worker/task repository.
- Produces: backtest task creation, paged summaries, detail, holdings CSV, and trades CSV APIs.

- [ ] Add `backtest_runs` with model/config/task IDs, date range, benchmark, costs, metrics JSON and artifact path. Write curves/holdings/trades as Parquet under `backend/.data/runs/<run_id>/backtest/`.
- [ ] Test atomic summary publish and that API never returns a path outside the runtime root.
- [ ] Add worker handler `backtest_run`, `POST /api/tasks/backtests/run`, `GET /api/backtests`, `GET /api/backtests/{id}`, and CSV response endpoints for holdings/trades.
- [ ] Run repository/API/worker tests and then the complete backend suite; expected PASS. Commit backend changes.

### Task 3: Backtest report and comparison UI

**Files:**
- Create: `frontend/src/components/qlib/BacktestsPage.tsx`
- Modify: `frontend/src/components/qlib/QlibWorkspace.tsx`
- Modify: `frontend/src/api/quantApi.ts`
- Modify: `frontend/src/types/qlib.ts`

**Interfaces:**
- Consumes: phase-4 backtest APIs.
- Produces: `BacktestsPage` routed by `QlibWorkspace`.

- [ ] Add form fields model, config, range, benchmark and costs; submit a worker task and show run ID/status/duration.
- [ ] Render strategy vs benchmark and drawdown with existing SVG/CSS primitives; render metric cards, monthly table, holdings and trades without adding a chart package.
- [ ] Allow selecting exactly two completed runs for side-by-side metric comparison; disable incompatible in-progress entries with an explanation.
- [ ] Export holdings/trades through server CSV endpoints.
- [ ] Run `npm.cmd run build`; expected PASS. Commit page/client/type changes.

### Task 4: Daily/monthly CLI and Windows schedule

**Files:**
- Create: `backend/app/automation.py`
- Create: `run-daily-pipeline.cmd`
- Create: `install-daily-task.ps1`
- Create: `backend/tests/test_automation.py`

**Interfaces:**
- Produces: `enqueue_daily(now: datetime, repositories: Repositories) -> str | None`
- Produces: CLI `python -m backend.app.automation daily --run-now`.

- [ ] Test weekend/non-trading-day no-op, duplicate same-date task no-op, normal daily enqueue, and first-trading-day monthly candidate tasks for 1/5/10/20 after daily success.
- [ ] Implement CLI using the same task repository/worker dispatch as API. `--run-now` processes the queued daily task in the current process so the schedule works even when FastAPI is stopped.
- [ ] `run-daily-pipeline.cmd` resolves the repo directory and invokes `.venv\Scripts\python.exe -m backend.app.automation daily --run-now`.
- [ ] `install-daily-task.ps1` creates one task named `PersonalQuantPlatformDaily` at 18:00 with the absolute command path and working directory. It must be idempotent and print the installed action/trigger.
- [ ] Run automation tests; expected PASS. With user-approved system mutation, run the installer and verify via `schtasks /Query /TN PersonalQuantPlatformDaily /V /FO LIST`.
- [ ] Commit automation code, scripts, and tests.

### Task 5: Documentation, live smoke test, and final verification

**Files:**
- Modify: `README.md`
- Modify: `docs/operation-guide.md`
- Modify: `research/qlib/README.md`
- Keep: `docs/superpowers/specs/2026-07-10-qlib-stock-research-platform-design.md`

- [ ] Document installation with `backend[dev,quant]`, storage layout, initialization, worker/task recovery, model training/promotion/rollback, strategy rerun, backtest, schedule install/query/remove, and no-auto-trading boundary.
- [ ] Run `.\.venv\Scripts\python.exe -m pytest backend/tests -q`; expected all PASS.
- [ ] Run `npm.cmd run build` in `frontend`; expected PASS.
- [ ] Run a small real Tushare permission/data smoke test for recent completed dates; redact token and record only counts/status.
- [ ] Run a tiny Qlib train/predict/backtest, publish a test candidate, and verify no production switch occurs without explicit promotion.
- [ ] Start backend/frontend, complete the UI path `运行历史 -> 数据更新 -> 模型训练 -> 发布 -> 信号重跑 -> 股票 K 线 -> 回测`, and confirm every completed task displays server duration.
- [ ] Review `git status`, preserve unrelated user changes, and commit only final docs/fixes after verification.
