# Qlib Platform Phase 1 Data and Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the local SQLite task system, resumable Tushare/Parquet data pipeline, dynamic A-share universe, task APIs, and the first real run-history UI.

**Architecture:** FastAPI only validates requests and creates SQLite task rows. A separate `python -m backend.app.worker --once` process atomically claims one queued task, writes progress and duration, and publishes validated Parquet/universe results without blocking HTTP requests.

**Tech Stack:** Python 3.11, FastAPI, Pydantic 2, stdlib `sqlite3`, pandas, PyArrow, Tushare, pytest, React 19, TypeScript, native `fetch`.

## Global Constraints

- Keep `docs/superpowers/specs/2026-07-10-qlib-stock-research-platform-design.md` unchanged and tracked.
- Preserve the user's currently staged UI work; backend commits must use `git commit --only -- <task files>`.
- Store runtime data only under ignored `backend/.data`; never persist or return `TUSHARE_TOKEN`.
- Use SQLite + Parquet; do not add SQLAlchemy, Alembic, Redis, Celery, PostgreSQL, Docker, or a frontend state library.
- Historical data starts at `2015-01-01`; all operations must be idempotent and resumable.
- Default universe filters: ST/退市整理, suspension, fewer than 120 trading days, 20-day average amount below CNY 50,000,000, and untradable limit state.
- Every task records `started_at`, `finished_at`, server-computed `duration_ms`, stage, progress, immutable parameters, and error summary.

---

## File Map

- `backend/app/database.py`: SQLite connection, schema bootstrap, JSON serialization.
- `backend/app/task_repository.py`: task creation, atomic claim, progress, success/failure/interruption.
- `backend/app/task_process.py`: start a detached single-run worker from FastAPI.
- `backend/app/worker.py`: CLI task dispatcher.
- `backend/app/market_data.py`: Tushare dataset adapter returning normalized DataFrames.
- `backend/app/data_store.py`: partitioned Parquet reads/writes and dataset manifests.
- `backend/app/data_pipeline.py`: initialize/incremental orchestration and validation.
- `backend/app/universe_service.py`: point-in-time filter engine and funnel output.
- `backend/app/main.py`: task, data-status, universe, and bars endpoints.
- `frontend/src/api/quantApi.ts`: typed native-fetch client.
- `frontend/src/components/qlib/RunHistoryPage.tsx`: initialization controls and task table.
- `frontend/src/components/qlib/QlibWorkspace.tsx`: phase-1 Qlib route shell.

### Task 1: SQLite task repository

**Files:**
- Create: `backend/app/database.py`
- Create: `backend/app/task_repository.py`
- Create: `backend/tests/test_task_repository.py`

**Interfaces:**
- Produces: `connect_database(path: Path) -> sqlite3.Connection`
- Produces: `TaskRepository.create(task_type: str, params: dict) -> str`
- Produces: `TaskRepository.claim_next() -> TaskRun | None`
- Produces: `TaskRepository.progress(run_id: str, stage: str, progress: int) -> None`
- Produces: `TaskRepository.succeed(run_id: str, result: dict) -> None`
- Produces: `TaskRepository.fail(run_id: str, message: str) -> None`
- Produces: `TaskRepository.list(limit: int = 100) -> list[TaskRun]`

- [ ] **Step 1: Write repository tests**

```python
def test_claim_next_is_fifo_and_atomic(tmp_path):
    repo = TaskRepository(tmp_path / "quant.db")
    first = repo.create("data_initialize", {"start_date": "20150101"})
    second = repo.create("data_incremental", {})
    assert repo.claim_next().id == first
    assert repo.claim_next() is None
    repo.succeed(first, {"rows": 1})
    assert repo.claim_next().id == second
    assert repo.claim_next() is None

def test_success_records_server_duration(tmp_path, monkeypatch):
    clock = iter([100.0, 100.125])
    monkeypatch.setattr(task_repository.time, "time", lambda: next(clock))
    repo = TaskRepository(tmp_path / "quant.db")
    run_id = repo.create("data_initialize", {})
    repo.claim_next()
    repo.succeed(run_id, {"rows": 2})
    run = repo.get(run_id)
    assert run.status == "succeeded"
    assert run.duration_ms == 125
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `.\.venv\Scripts\python.exe -m pytest backend/tests/test_task_repository.py -q`  
Expected: FAIL because `backend.app.task_repository` does not exist.

- [ ] **Step 3: Implement the minimal schema and repository**

Use `sqlite3.connect(..., timeout=30)`, `PRAGMA journal_mode=WAL`, `BEGIN IMMEDIATE` for `claim_next`, UUID strings for IDs, UTC ISO timestamps, and JSON text for params/result. Create only these phase-1 tables:

```sql
CREATE TABLE IF NOT EXISTS task_runs (
  id TEXT PRIMARY KEY,
  task_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('queued','running','succeeded','failed','interrupted')),
  stage TEXT NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
  params_json TEXT NOT NULL,
  result_json TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  duration_ms INTEGER
);
```

`TaskRun` is a frozen dataclass with fields matching the table and decoded `params`/`result` dictionaries. `claim_next` first checks that no row is `running`; if one exists it returns `None`, so independently spawned workers still execute heavy tasks globally in series. Expose `mark_running_interrupted()` and call it once during FastAPI/CLI startup before any new worker is spawned; repository construction itself must not interrupt a live task.

- [ ] **Step 4: Run tests**

Run: `.\.venv\Scripts\python.exe -m pytest backend/tests/test_task_repository.py -q`  
Expected: PASS.

- [ ] **Step 5: Commit only task files**

```powershell
git add backend/app/database.py backend/app/task_repository.py backend/tests/test_task_repository.py
git commit --only -m "feat: add local task repository" -- backend/app/database.py backend/app/task_repository.py backend/tests/test_task_repository.py
```

### Task 2: Parquet data store and Tushare datasets

**Files:**
- Modify: `backend/pyproject.toml`
- Create: `backend/app/data_store.py`
- Create: `backend/app/market_data.py`
- Modify: `backend/app/tushare_client.py`
- Create: `backend/tests/test_data_store.py`
- Create: `backend/tests/test_market_data.py`

**Interfaces:**
- Consumes: `load_environment()` from `backend.app.settings`
- Produces: `ParquetDataStore.write_partition(dataset: str, trade_date: str, frame: DataFrame) -> Path`
- Produces: `ParquetDataStore.read_dataset(dataset: str, start_date: str | None = None, end_date: str | None = None) -> DataFrame`
- Produces: `TushareMarketData.fetch_trade_date(trade_date: str) -> MarketDayFrames`

- [ ] **Step 1: Add failing store/adapter tests**

```python
def test_partition_write_is_idempotent(tmp_path):
    store = ParquetDataStore(tmp_path)
    frame = pd.DataFrame([{"ts_code": "000001.SZ", "trade_date": "20260709", "close": 10.0}])
    store.write_partition("daily", "20260709", frame)
    store.write_partition("daily", "20260709", frame)
    assert len(store.read_dataset("daily")) == 1

def test_fetch_trade_date_normalizes_keys(fake_pro):
    result = TushareMarketData(pro=fake_pro).fetch_trade_date("20260709")
    assert set(result.daily.columns) >= {"ts_code", "trade_date", "open", "high", "low", "close", "amount"}
    assert result.trade_date == "20260709"
```

- [ ] **Step 2: Verify failure**

Run: `.\.venv\Scripts\python.exe -m pytest backend/tests/test_data_store.py backend/tests/test_market_data.py -q`  
Expected: FAIL for missing modules.

- [ ] **Step 3: Add the one required storage dependency**

Add `"pyarrow>=16"` to `[project].dependencies`. Keep `pyqlib` in the existing `quant` optional extra for phase 2.

- [ ] **Step 4: Implement storage and adapter**

Write each partition to a temporary sibling file and replace the final file only after `DataFrame.to_parquet` succeeds. Use paths `raw/<dataset>/trade_date=YYYYMMDD/data.parquet`. Normalize Tushare frames into `MarketDayFrames(trade_date, daily, adj_factor, suspend, limit)` and fetch static `stock_basic`, `namechange`, and `trade_cal` through separate methods so they are not re-downloaded for every symbol.

Keep the existing `TushareClient.fetch_daily_bars` compatibility methods, but implement them through the new adapter rather than duplicating Tushare calls.

- [ ] **Step 5: Run focused and existing Tushare tests**

Run: `.\.venv\Scripts\python.exe -m pytest backend/tests/test_data_store.py backend/tests/test_market_data.py backend/tests/test_tushare_client.py -q`  
Expected: PASS without network access.

- [ ] **Step 6: Commit**

```powershell
git add backend/pyproject.toml backend/app/data_store.py backend/app/market_data.py backend/app/tushare_client.py backend/tests/test_data_store.py backend/tests/test_market_data.py
git commit --only -m "feat: add resumable market data storage" -- backend/pyproject.toml backend/app/data_store.py backend/app/market_data.py backend/app/tushare_client.py backend/tests/test_data_store.py backend/tests/test_market_data.py
```

### Task 3: Data validation and point-in-time universe

**Files:**
- Create: `backend/app/data_validation.py`
- Create: `backend/app/universe_service.py`
- Create: `backend/tests/test_data_validation.py`
- Create: `backend/tests/test_universe_service.py`

**Interfaces:**
- Produces: `validate_market_frame(frame: DataFrame) -> list[ValidationIssue]`
- Produces: `UniverseParams(listing_days=120, liquidity_days=20, min_average_amount=50_000_000)`
- Produces: `build_universe(trade_date: str, daily_history: DataFrame, stocks: DataFrame, names: DataFrame, suspensions: DataFrame, limits: DataFrame, params: UniverseParams) -> UniverseResult`

- [ ] **Step 1: Write boundary tests**

Create fixtures containing one eligible stock and one stock for each exclusion reason. Assert exact reason codes: `not_listed`, `st`, `suspended`, `new_listing`, `low_liquidity`, `limit_locked`, `invalid_market_data`. Assert funnel counts decrease monotonically and an exactly 120-trading-day stock plus exactly CNY 50,000,000 average amount remains eligible.

- [ ] **Step 2: Verify tests fail**

Run: `.\.venv\Scripts\python.exe -m pytest backend/tests/test_data_validation.py backend/tests/test_universe_service.py -q`  
Expected: FAIL for missing functions.

- [ ] **Step 3: Implement validation and filters as pure functions**

`validate_market_frame` rejects duplicate `(ts_code, trade_date)`, null/non-positive OHLC, `high < max(open, close)`, `low > min(open, close)`, negative volume/amount, and missing adjustment factors. `build_universe` computes listing age from the supplied trade calendar/history, rolling amount with `min_periods=20`, and never calls Tushare or SQLite.

Return immutable records:

```python
@dataclass(frozen=True)
class UniverseMember:
    ts_code: str
    eligible: bool
    reasons: tuple[str, ...]
    average_amount_20d: float | None

@dataclass(frozen=True)
class UniverseResult:
    trade_date: str
    members: tuple[UniverseMember, ...]
    funnel: dict[str, int]
```

- [ ] **Step 4: Run tests**

Run: `.\.venv\Scripts\python.exe -m pytest backend/tests/test_data_validation.py backend/tests/test_universe_service.py -q`  
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add backend/app/data_validation.py backend/app/universe_service.py backend/tests/test_data_validation.py backend/tests/test_universe_service.py
git commit --only -m "feat: build point-in-time stock universe" -- backend/app/data_validation.py backend/app/universe_service.py backend/tests/test_data_validation.py backend/tests/test_universe_service.py
```

### Task 4: Worker, pipeline, and result persistence

**Files:**
- Modify: `backend/app/database.py`
- Create: `backend/app/universe_repository.py`
- Create: `backend/app/data_pipeline.py`
- Create: `backend/app/worker.py`
- Create: `backend/app/task_process.py`
- Create: `backend/tests/test_data_pipeline.py`
- Create: `backend/tests/test_worker.py`

**Interfaces:**
- Consumes: Task 1 repository, Task 2 store/adapter, Task 3 pure filters.
- Produces: `run_data_initialize(run_id: str, params: dict, services: Services) -> dict`
- Produces: `run_data_incremental(run_id: str, params: dict, services: Services) -> dict`
- Produces: `spawn_worker_once() -> None`

- [ ] **Step 1: Write pipeline and worker tests**

Assert that two-run initialization skips existing partitions, progress stages appear in this order—`calendar`, `static_data`, `market_data`, `validation`, `universe`, `publish`—and a validation failure leaves the previously published universe untouched. Assert a second worker cannot claim a task while any task is running. Assert unknown task types fail with a concise error and no traceback/token is stored in `error_message`.

- [ ] **Step 2: Verify failure**

Run: `.\.venv\Scripts\python.exe -m pytest backend/tests/test_data_pipeline.py backend/tests/test_worker.py -q`  
Expected: FAIL for missing pipeline/worker.

- [ ] **Step 3: Add universe tables and repository**

```sql
CREATE TABLE IF NOT EXISTS universe_runs (
  id TEXT PRIMARY KEY,
  trade_date TEXT NOT NULL,
  task_run_id TEXT NOT NULL,
  params_json TEXT NOT NULL,
  funnel_json TEXT NOT NULL,
  published_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS universe_members (
  universe_run_id TEXT NOT NULL,
  ts_code TEXT NOT NULL,
  eligible INTEGER NOT NULL,
  reasons_json TEXT NOT NULL,
  average_amount_20d REAL,
  PRIMARY KEY (universe_run_id, ts_code)
);
```

Publish a run and all members in one SQLite transaction.

- [ ] **Step 4: Implement worker dispatch and subprocess start**

`worker.main()` claims one task, dispatches through a fixed dictionary, records success/failure, then exits. `spawn_worker_once()` runs `[sys.executable, "-m", "backend.app.worker", "--once"]` with workspace root as `cwd`, `CREATE_NO_WINDOW` on Windows, and no shell string. A SQLite atomic claim plus the no-running-row rule prevents duplicate or concurrent heavy execution.

- [ ] **Step 5: Run tests**

Run: `.\.venv\Scripts\python.exe -m pytest backend/tests/test_data_pipeline.py backend/tests/test_worker.py -q`  
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add backend/app/database.py backend/app/universe_repository.py backend/app/data_pipeline.py backend/app/worker.py backend/app/task_process.py backend/tests/test_data_pipeline.py backend/tests/test_worker.py
git commit --only -m "feat: run market data tasks outside API requests" -- backend/app/database.py backend/app/universe_repository.py backend/app/data_pipeline.py backend/app/worker.py backend/app/task_process.py backend/tests/test_data_pipeline.py backend/tests/test_worker.py
```

### Task 5: Phase-1 APIs and run-history UI

**Files:**
- Modify: `backend/app/main.py`
- Modify: `backend/app/domain.py`
- Modify: `backend/tests/test_api.py`
- Create: `frontend/src/api/quantApi.ts`
- Create: `frontend/src/components/qlib/QlibWorkspace.tsx`
- Create: `frontend/src/components/qlib/RunHistoryPage.tsx`
- Modify: `frontend/src/components/QuantLayout.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/data/mockQuant.ts`

**Interfaces:**
- Produces: `POST /api/tasks/data/initialize`, `POST /api/tasks/data/update`, `GET /api/tasks`, `GET /api/tasks/{id}`, `GET /api/universe/latest`, `GET /api/stocks/{ts_code}/bars`.
- Produces: `quantApi.createDataTask(kind)`, `quantApi.listTasks()`, and `RunHistoryPage`.

- [ ] **Step 1: Add API tests**

Assert task POST returns HTTP 202 and `{id,status:"queued"}`, spawns the worker after the row is committed, task GET exposes duration but not token/traceback, missing universe returns HTTP 404 with `detail="Universe has not been initialized."`, and bars are ordered ascending with unique dates.

- [ ] **Step 2: Verify backend failure**

Run: `.\.venv\Scripts\python.exe -m pytest backend/tests/test_api.py -q`  
Expected: FAIL for missing routes.

- [ ] **Step 3: Implement routes and typed responses**

Use Pydantic request/response models, HTTP 202 for task creation, 404 for absent results, and `Query` bounds for pagination. Keep `/api/signals/latest` compatibility unchanged until phase 2.

- [ ] **Step 4: Build the smallest real run-history page**

Use native `fetch` with an `AbortController`. Poll every two seconds only while a row is `queued` or `running`; stop polling when all rows are terminal. Show data initialization/update buttons, status, stage, progress, start/end timestamps, `duration_ms`, and error text. Empty state copy is `尚未初始化数据，请先运行历史数据初始化。`; do not import task mock data.

Add sidebar entry `Qlib 选股研究` with child `运行历史`; route it through `QlibWorkspace`. Do not alter unrelated K-line styling.

- [ ] **Step 5: Verify backend and frontend**

Run: `.\.venv\Scripts\python.exe -m pytest backend/tests -q`  
Expected: all backend tests PASS.  
Run: `npm.cmd run build` in `frontend`  
Expected: TypeScript check and Vite build PASS.

- [ ] **Step 6: Commit the phase-1 UI intentionally**

Before committing, inspect `git diff --cached` because the user UI baseline is already staged. Commit the complete approved dashboard baseline plus this Qlib navigation only after confirming every staged frontend file belongs to the platform UI scope.

```powershell
git add backend/app/main.py backend/app/domain.py backend/tests/test_api.py frontend/src/api/quantApi.ts frontend/src/components/qlib/QlibWorkspace.tsx frontend/src/components/qlib/RunHistoryPage.tsx frontend/src/components/QuantLayout.tsx frontend/src/components/Sidebar.tsx frontend/src/data/mockQuant.ts
git commit -m "feat: add data task workbench"
```

### Task 6: Phase-1 verification

**Files:**
- Modify: `docs/operation-guide.md`

- [ ] Run `.\.venv\Scripts\python.exe -m pytest backend/tests -q`; expected all PASS.
- [ ] Run `npm.cmd run build` in `frontend`; expected PASS.
- [ ] Start backend and create a fixture-backed initialization task; verify API remains responsive while the worker runs.
- [ ] With local Tushare configuration, probe one recent completed trade date and record only endpoint availability/counts, never the token.
- [ ] Update the operation guide with data initialization, update, task status, runtime directories, and failure recovery commands.
- [ ] Commit only the operation guide and any verification fixes with a message describing the actual change.
