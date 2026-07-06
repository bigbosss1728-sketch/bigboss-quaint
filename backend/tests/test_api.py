from fastapi.testclient import TestClient

from backend.app.main import create_app


def test_latest_signals_returns_sample_payload_when_store_is_empty(tmp_path):
    app = create_app(data_dir=tmp_path)
    client = TestClient(app)

    response = client.get("/api/signals/latest")

    assert response.status_code == 200
    payload = response.json()
    assert payload["source"] == "sample"
    assert len(payload["signals"]) >= 1
    assert {"ts_code", "name", "rating", "action", "score"}.issubset(
        payload["signals"][0].keys()
    )


def test_health_endpoint_reports_service_name(tmp_path):
    app = create_app(data_dir=tmp_path)
    client = TestClient(app)

    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "quant-platform-backend"}
