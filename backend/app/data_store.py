from pathlib import Path

import pandas as pd


class ParquetDataStore:
    def __init__(self, root: str | Path):
        self.root = Path(root)

    def write_partition(
        self,
        dataset: str,
        trade_date: str,
        frame: pd.DataFrame,
    ) -> Path:
        path = self.root / "raw" / dataset / f"trade_date={trade_date}" / "data.parquet"
        temporary_path = path.with_suffix(".parquet.tmp")
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            frame.to_parquet(temporary_path, index=False)
            temporary_path.replace(path)
        finally:
            temporary_path.unlink(missing_ok=True)
        return path

    def read_dataset(
        self,
        dataset: str,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> pd.DataFrame:
        paths = self.root.glob(f"raw/{dataset}/trade_date=*/data.parquet")
        selected = [
            path
            for path in paths
            if (start_date is None or _trade_date(path) >= start_date)
            and (end_date is None or _trade_date(path) <= end_date)
        ]
        if not selected:
            return pd.DataFrame()
        return pd.concat((pd.read_parquet(path) for path in sorted(selected)), ignore_index=True)


def _trade_date(path: Path) -> str:
    return path.parent.name.removeprefix("trade_date=")
