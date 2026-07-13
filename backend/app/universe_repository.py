import json
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from backend.app.database import UNIVERSE_SCHEMA, connect_database
from backend.app.universe_service import UniverseResult


class UniverseRepository:
    def __init__(self, path: Path):
        self._path = path
        with closing(connect_database(path)) as connection:
            connection.executescript(UNIVERSE_SCHEMA)
            connection.commit()

    def published_trade_dates(self, trade_dates: list[str]) -> set[str]:
        if not trade_dates:
            return set()
        placeholders = ",".join("?" for _ in trade_dates)
        with closing(connect_database(self._path)) as connection:
            rows = connection.execute(
                f"SELECT DISTINCT trade_date FROM universe_runs WHERE trade_date IN ({placeholders})",
                trade_dates,
            ).fetchall()
        return {row["trade_date"] for row in rows}

    def publish(
        self,
        task_run_id: str,
        params: dict,
        result: UniverseResult,
    ) -> str:
        universe_run_id = str(uuid4())
        with closing(connect_database(self._path)) as connection:
            connection.execute("BEGIN IMMEDIATE")
            connection.execute(
                """
                INSERT INTO universe_runs
                  (id, trade_date, task_run_id, params_json, funnel_json, published_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    universe_run_id,
                    result.trade_date,
                    task_run_id,
                    json.dumps(params),
                    json.dumps(dict(result.funnel)),
                    datetime.now(timezone.utc).isoformat(),
                ),
            )
            connection.executemany(
                """
                INSERT INTO universe_members
                  (universe_run_id, ts_code, eligible, reasons_json, average_amount_20d)
                VALUES (?, ?, ?, ?, ?)
                """,
                [
                    (
                        universe_run_id,
                        member.ts_code,
                        int(member.eligible),
                        json.dumps(member.reasons),
                        member.average_amount_20d,
                    )
                    for member in result.members
                ],
            )
            connection.commit()
        return universe_run_id
