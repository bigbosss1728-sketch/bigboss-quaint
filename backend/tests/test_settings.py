from backend.app.settings import load_environment


def test_load_environment_reads_project_env_file(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("TUSHARE_TOKEN", raising=False)
    (tmp_path / ".env").write_text("TUSHARE_TOKEN=local-token\n", encoding="utf-8")

    load_environment()

    assert __import__("os").environ["TUSHARE_TOKEN"] == "local-token"
