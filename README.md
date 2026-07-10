# Personal Quant Platform

个人自用 A 股日频量化平台 MVP。

## Current Scope

- Tushare Pro data boundary.
- Daily stock pool, rating, and signal API.
- React + TypeScript dark quant dashboard using TailwindCSS, local shadcn-style components, and lightweight-charts.
- Qlib and vn.py integration boundaries documented, not forced into the first runnable path.
- No automatic live trading in this MVP.

## Backend

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".\backend[dev]"
$env:TUSHARE_TOKEN="your_token"
.\.venv\Scripts\python.exe backend/dev_server.py
```

APIs:

- `GET /api/health`
- `GET /api/signals/latest`
- `POST /api/pipeline/run?trade_date=20260703&limit=200`

Without `TUSHARE_TOKEN`, `GET /api/signals/latest` returns sample signals so the UI remains usable.

## Frontend

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Open `http://127.0.0.1:5173`.

## Tests

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests -q
```

## Operation Guide

See `docs/operation-guide.md`.

## Next Implementation Steps

1. Replace the simple daily momentum score with Qlib factor/model outputs.
2. Persist raw Tushare data and generated signals in PostgreSQL.
3. Add scheduled daily pipeline execution after market close.
4. Add vn.py paper-trading adapter for target-position review.
