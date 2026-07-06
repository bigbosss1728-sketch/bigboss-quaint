# Quant Platform MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable personal A-share quant platform slice: Tushare ingestion boundary, daily stock ratings/signals, backend APIs, and a React + Ant Design dashboard.

**Architecture:** Keep the first version as a single repo with a Python FastAPI backend and Vite React frontend. Qlib and vn.py are explicit integration boundaries, but the first working path does not require installing either heavy framework before data and signal APIs work.

**Tech Stack:** Python 3.11, FastAPI, Pydantic, Pandas, Tushare, pytest, React, TypeScript, Vite, Ant Design.

## Global Constraints

- Market: A-shares.
- Frequency: medium-low frequency daily workflow.
- Data source: Tushare Pro.
- UI: React + Ant Design.
- Quant framework direction: Qlib for research/signals, vn.py for later execution integration.
- MVP must work without a Tushare token by serving deterministic sample signals.
- No automatic live order placement in MVP.

---

### Task 1: Backend Signal Core

**Files:**
- Create: `backend/app/domain.py`
- Create: `backend/app/signal_service.py`
- Test: `backend/tests/test_signal_service.py`

**Interfaces:**
- Produces: `generate_signals(rows: list[DailyBar]) -> list[StockSignal]`
- Produces: `DailyBar`, `StockSignal`, and `SignalRating` domain models.

- [x] **Step 1: Write the failing test**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Write minimal implementation**
- [x] **Step 4: Run test to verify it passes**

### Task 2: Backend API and Tushare Boundary

**Files:**
- Create: `backend/app/main.py`
- Create: `backend/app/repository.py`
- Create: `backend/app/tushare_client.py`
- Create: `backend/tests/test_api.py`

**Interfaces:**
- Produces: `create_app() -> FastAPI`
- Produces: `JsonSignalRepository.latest_signals() -> list[StockSignal]`
- Produces: `TushareClient.fetch_daily_bars(...) -> list[DailyBar]`

- [x] **Step 1: Write the failing API test**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Write minimal implementation**
- [x] **Step 4: Run tests to verify they pass**

### Task 3: Frontend Dashboard

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/index.html`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/styles.css`

**Interfaces:**
- Consumes: `GET /api/signals/latest`
- Produces: dashboard cards and an Ant Design table for stock ratings/signals.

- [x] **Step 1: Add minimal Vite React app**
- [x] **Step 2: Use Ant Design Table/Card/Tag components**
- [x] **Step 3: Fetch backend signals with fallback message**

### Task 4: Project Operations

**Files:**
- Create: `README.md`
- Create: `.env.example`
- Create: `backend/pyproject.toml`
- Create: `research/qlib/README.md`
- Create: `trading/vnpy/README.md`

**Interfaces:**
- Produces: local setup commands and environment variables.

- [x] **Step 1: Document backend and frontend run commands**
- [x] **Step 2: Document Tushare token configuration**
- [x] **Step 3: Document Qlib/vn.py next integration boundary**
