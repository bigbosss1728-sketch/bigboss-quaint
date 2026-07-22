from dataclasses import dataclass
import json
from pathlib import Path
import shutil
import subprocess
import sys
from uuid import uuid4

import pandas as pd


FIELDS = ("open", "close", "high", "low", "volume", "factor")


@dataclass(frozen=True)
class QlibDataVersion:
    name: str
    path: Path


def prepare_qlib_source(raw: pd.DataFrame, destination: Path) -> list[Path]:
    frame = raw.rename(
        columns={
            "ts_code": "symbol",
            "trade_date": "date",
            "vol": "volume",
            "adj_factor": "factor",
        }
    ).copy()
    frame["date"] = pd.to_datetime(frame["date"])
    destination.mkdir(parents=True, exist_ok=True)

    paths = []
    for symbol, bars in frame.groupby("symbol", sort=True):
        path = destination / f"{symbol}.parquet"
        bars.loc[:, ["date", *FIELDS]].sort_values("date").to_parquet(path, index=False)
        paths.append(path)
    return paths


def build_qlib_provider(source: Path, destination: Path) -> QlibDataVersion:
    destination.mkdir(parents=True, exist_ok=True)
    name = uuid4().hex
    temporary_path = destination / f".{name}.tmp"
    version = QlibDataVersion(name=name, path=destination / name)
    script = Path(__file__).parents[2] / "research" / "qlib" / "dump_bin.py"
    command = [
        sys.executable,
        str(script),
        "dump_all",
        "--data_path",
        str(source),
        "--qlib_dir",
        str(temporary_path),
        "--include_fields",
        ",".join(FIELDS),
        "--file_suffix",
        ".parquet",
    ]

    try:
        subprocess.run(command, check=True)
        _smoke_provider(temporary_path)
        temporary_path.replace(version.path)
        manifest = destination / f".current.{name}.tmp"
        manifest.write_text(json.dumps({"version": name}), encoding="utf-8")
        manifest.replace(destination / "current.json")
        return version
    finally:
        shutil.rmtree(temporary_path, ignore_errors=True)


def _smoke_provider(provider_path: Path) -> None:
    import qlib
    from qlib.data import D

    qlib.init(provider_uri=str(provider_path))
    instruments = [
        line.split("\t", 1)[0]
        for line in (provider_path / "instruments" / "all.txt").read_text().splitlines()
    ]
    features = D.features(instruments, ["$close"], freq="day")
    if features.empty:
        raise RuntimeError("Qlib provider smoke query returned no data")
