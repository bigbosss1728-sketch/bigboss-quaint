import pandas as pd

from backend.app.data_store import ParquetDataStore


def test_partition_write_is_idempotent(tmp_path):
    store = ParquetDataStore(tmp_path)
    frame = pd.DataFrame(
        [{"ts_code": "000001.SZ", "trade_date": "20260709", "close": 10.0}]
    )

    path = store.write_partition("daily", "20260709", frame)
    store.write_partition("daily", "20260709", frame)

    assert path == tmp_path / "raw" / "daily" / "trade_date=20260709" / "data.parquet"
    assert len(store.read_dataset("daily")) == 1


def test_read_dataset_filters_trade_dates(tmp_path):
    store = ParquetDataStore(tmp_path)
    for trade_date in ("20260708", "20260709", "20260710"):
        store.write_partition(
            "daily",
            trade_date,
            pd.DataFrame([{"ts_code": "000001.SZ", "trade_date": trade_date}]),
        )

    result = store.read_dataset("daily", start_date="20260709", end_date="20260709")

    assert result["trade_date"].tolist() == ["20260709"]

