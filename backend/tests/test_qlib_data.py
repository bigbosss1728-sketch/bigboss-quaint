import json

import pandas as pd
import pytest

qlib = pytest.importorskip("qlib")
D = pytest.importorskip("qlib.data").D

from backend.app import qlib_data
from backend.app.qlib_data import build_qlib_provider, prepare_qlib_source


def _bars() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "ts_code": symbol,
                "trade_date": date,
                "open": price,
                "high": price + 1,
                "low": price - 1,
                "close": price + 0.5,
                "vol": 1_000,
                "adj_factor": 1.0,
            }
            for symbol, base in (("000001.SZ", 10.0), ("600000.SH", 20.0))
            for offset, date in enumerate(("20260709", "20260710"))
            for price in (base + offset,)
        ]
    )


def test_build_provider_can_be_queried_for_both_instruments(tmp_path):
    source = tmp_path / "backend" / ".data" / "qlib-source"
    provider_root = tmp_path / "backend" / ".data" / "qlib-provider"

    files = prepare_qlib_source(_bars(), source)
    version = build_qlib_provider(source, provider_root)

    assert [path.name for path in files] == ["000001.SZ.parquet", "600000.SH.parquet"]
    qlib.init(provider_uri=str(version.path))
    features = D.features(
        ["000001.SZ", "600000.SH"],
        ["$open", "$close", "$volume", "$factor"],
        start_time="2026-07-09",
        end_time="2026-07-10",
        freq="day",
    )
    assert set(features.index.get_level_values("instrument")) == {
        "000001.SZ",
        "600000.SH",
    }
    assert len(features) == 4
    assert json.loads((provider_root / "current.json").read_text()) == {
        "version": version.name
    }


def test_smoke_failure_preserves_current_provider(tmp_path, monkeypatch):
    source = tmp_path / "backend" / ".data" / "qlib-source"
    provider_root = tmp_path / "backend" / ".data" / "qlib-provider"
    prepare_qlib_source(_bars(), source)
    previous = build_qlib_provider(source, provider_root)
    manifest = (provider_root / "current.json").read_bytes()

    def fail_smoke(_path):
        raise RuntimeError("smoke failed")

    monkeypatch.setattr(qlib_data, "_smoke_provider", fail_smoke)
    with pytest.raises(RuntimeError, match="smoke failed"):
        build_qlib_provider(source, provider_root)

    assert (provider_root / "current.json").read_bytes() == manifest
    assert previous.path.exists()
