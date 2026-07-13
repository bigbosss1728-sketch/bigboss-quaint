import sqlite3
from pathlib import Path


UNIVERSE_SCHEMA = """
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
"""


def connect_database(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=30)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    return connection
