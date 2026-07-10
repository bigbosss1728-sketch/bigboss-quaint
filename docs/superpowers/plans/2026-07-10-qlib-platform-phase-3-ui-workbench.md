# Qlib Platform Phase 3 Research UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace generic research screens and stock-related mock data with a real Qlib research workbench for pools, ratings, strategy parameters, models, tasks, and linked K-line details.

**Architecture:** The existing `QuantLayout` remains the application shell. A focused `QlibWorkspace` selects small page components; each page calls the phase-1/2 APIs through one typed native-fetch client and owns only its loading/error/polling state.

**Tech Stack:** React 19, TypeScript 5.9, Tailwind CSS, existing local shadcn-style primitives, lightweight-charts, native `fetch` and `AbortController`.

## Global Constraints

- Preserve the approved design document and current dark terminal visual language.
- Merge the old mock `策略回测模拟器` into `Qlib 选股研究`; do not keep duplicate backtest navigation.
- Do not add React Query, Redux, chart packages, component libraries, or new mock Qlib data.
- Show explicit uninitialized, queued, running, succeeded, failed, interrupted, empty, and network-error states.
- Display server `duration_ms`; never infer final computation time in the browser.
- Clicking a stock must load real ascending unique daily bars and its signal history.

---

## File Map

- `frontend/src/types/qlib.ts`: API/domain types.
- `frontend/src/api/quantApi.ts`: all requests, query construction, error normalization.
- `frontend/src/components/qlib/QlibWorkspace.tsx`: submenu router.
- `frontend/src/components/qlib/StockPoolPage.tsx`: latest/date pool and funnel.
- `frontend/src/components/qlib/SignalsPage.tsx`: ratings, Top 20, contributions.
- `frontend/src/components/qlib/StrategyPage.tsx`: saved parameters and rerun.
- `frontend/src/components/qlib/ModelsPage.tsx`: train, compare, promote, rollback.
- `frontend/src/components/qlib/RunHistoryPage.tsx`: task polling/detail.
- Existing `ChartWorkspace.tsx`, `LightweightChart.tsx`, `RightInfoDrawer.tsx`: real stock linkage.

### Task 1: Typed API boundary and Qlib navigation

**Files:**
- Create: `frontend/src/types/qlib.ts`
- Modify: `frontend/src/api/quantApi.ts`
- Modify: `frontend/src/data/mockQuant.ts`
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/components/QuantLayout.tsx`
- Modify: `frontend/src/components/qlib/QlibWorkspace.tsx`

**Interfaces:**
- Produces: `quantApi` methods returning the exact types in `frontend/src/types/qlib.ts`.
- Produces: `QlibWorkspace({ submenu, onSelectStock })` used by `QuantLayout`.

- [ ] Define exact types `TaskRun`, `UniverseSummary`, `UniverseMember`, `StockSignal`, `StrategyConfig`, `ModelVersion`, and paged responses matching backend Pydantic models; ratings are the union `"A" | "B" | "C" | "D"` and horizons `1 | 5 | 10 | 20`.

```ts
export type Horizon = 1 | 5 | 10 | 20;
export type Rating = "A" | "B" | "C" | "D";
export type TaskStatus = "queued" | "running" | "succeeded" | "failed" | "interrupted";
export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };
```
- [ ] Implement `request<T>(path, init, signal)` that parses FastAPI `detail` into `QuantApiError`, plus query helpers that omit undefined values.
- [ ] Replace the old backtest menu with `Qlib 选股研究` children `今日股票池`, `评级与信号`, `策略参数`, `模型训练`, `回测报告`, `运行历史`.
- [ ] Route all children through `QlibWorkspace`; unknown child renders a visible error instead of the generic mock `MenuPage`.
- [ ] Run `npm.cmd run build`; expected PASS. Commit navigation/types/client intentionally with the existing approved UI baseline.

### Task 2: Today pool and rating pages

**Files:**
- Create: `frontend/src/components/qlib/StockPoolPage.tsx`
- Create: `frontend/src/components/qlib/SignalsPage.tsx`
- Modify: `frontend/src/components/qlib/QlibWorkspace.tsx`

**Interfaces:**
- Consumes: `quantApi.getUniverse`, `quantApi.getSignals`, and `onSelectStock({tsCode,name})` from Task 1.
- Produces: `StockPoolPage` and `SignalsPage` with no mock-data dependency.

- [ ] Implement a shared local hook pattern in each page: create `AbortController`, set loading, call API, normalize error, abort on cleanup. Do not create a generic hook framework.
- [ ] Stock pool summary cards show data date, model/horizon, eligible count, last duration, last rebalance, next rebalance. Funnel uses existing cards/bars; table supports date, rating, industry, code/name and client-visible CSV export of the currently filtered server result.
- [ ] Signals page shows A-D counts, Top 20 target table, action, weight, rank change, and expandable positive/negative factor contributions. Include `模型评级是相对判断，不构成收益保证。`.
- [ ] For both pages, uninitialized state links to `运行历史`; empty filter state does not look like a backend failure.
- [ ] Run `npm.cmd run build`; expected PASS. Commit the two pages and route changes.

### Task 3: Strategy parameters and manual rerun

**Files:**
- Create: `frontend/src/components/qlib/StrategyPage.tsx`
- Modify: `frontend/src/api/quantApi.ts`
- Modify: `frontend/src/components/qlib/QlibWorkspace.tsx`

**Interfaces:**
- Consumes: strategy/task APIs from phase 2.
- Produces: a saved strategy version ID and a signal task run ID.

- [ ] Build one controlled form for horizon, pool Top N, buy Top N, A/B/C thresholds, listing days, liquidity window/amount, max stock weight, benchmark, commission, stamp duty, and slippage.
- [ ] Validate locally before POST: horizons only 1/5/10/20; `buy_top_n <= pool_top_n`; thresholds strictly increasing; max weight `(0,1]`; non-negative costs. Backend remains authoritative.
- [ ] Save config first, then create `signal_run` with the returned immutable config ID. Show run ID immediately, poll status, and display server duration/failure.
- [ ] Prevent double submission while queued/running; do not disable editing after the task finishes.
- [ ] Run `npm.cmd run build`; expected PASS. Commit strategy page/client changes.

### Task 4: Model training and lifecycle UI

**Files:**
- Create: `frontend/src/components/qlib/ModelsPage.tsx`
- Modify: `frontend/src/api/quantApi.ts`
- Modify: `frontend/src/components/qlib/QlibWorkspace.tsx`

**Interfaces:**
- Consumes: model list/train/promote/rollback APIs from phase 2.
- Produces: model lifecycle controls that refresh only after terminal API success.

- [ ] Show models grouped by horizon with status badges candidate/production/archived, training ranges, data version, IC, Rank IC, annualized return, max drawdown, Sharpe, turnover, after-cost return, and duration.
- [ ] Training form selects horizon and optional date range, creates a task, and polls only that run until terminal.
- [ ] Promote and rollback require the existing dialog primitive, state that promotion refits the approved configuration, and refresh the model list only after success.
- [ ] Never label a candidate as production while promotion is running.
- [ ] Run `npm.cmd run build`; expected PASS. Commit model page/client changes.

### Task 5: Real K-line and signal drawer linkage

**Files:**
- Modify: `frontend/src/components/QuantLayout.tsx`
- Modify: `frontend/src/components/ChartWorkspace.tsx`
- Modify: `frontend/src/components/LightweightChart.tsx`
- Modify: `frontend/src/components/RightInfoDrawer.tsx`
- Modify: `frontend/src/api/quantApi.ts`
- Modify: `frontend/src/types/quant.ts`

**Interfaces:**
- Consumes: `onSelectStock({tsCode,name})` and stock bar/signal-history APIs.
- Produces: selected-stock state shared by Qlib tables, `ChartWorkspace`, and `RightInfoDrawer`.

- [ ] Add a selected-stock navigation payload `{tsCode, name}` in `QuantLayout`; clicking any pool/signal code sets it and opens the chart view.
- [ ] Fetch real bars by code, reject duplicate/out-of-order dates before passing to lightweight-charts, and show loading/error/no-bars overlays.
- [ ] Keep mock chart bars only as an explicitly labeled demo when no real data has ever been initialized; never present IF2409 as selected after navigating from a stock signal.
- [ ] When a real stock is selected, enable only the daily timeframe because the current backend supplies daily bars; keep minute controls disabled with the explanation `当前研究数据为日频`.
- [ ] Right drawer fetches signal history and displays latest score, rating, action, target weight, model/horizon, contributions, last/next rebalance and rank history.
- [ ] Run `npm.cmd run build`; expected PASS. Manually click from Top 50 to chart and back. Commit linked chart/drawer changes.

### Task 6: UI state verification

- [ ] Verify each page against API fixtures for uninitialized, queued, running, succeeded, failed, interrupted, empty, and HTTP/network error states.
- [ ] Verify sidebar expanded/collapsed and viewport widths 1440, 1024, and 768 without horizontal page loss.
- [ ] Verify all interactive controls have keyboard focus and dialogs have labels.
- [ ] Run `npm.cmd run build`; expected PASS with no TypeScript errors.
- [ ] Run full backend tests to ensure response shapes still match.
