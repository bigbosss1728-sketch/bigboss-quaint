import sys
from pathlib import Path

from backend.dev_server import ensure_project_root_on_path


def test_ensure_project_root_on_path_adds_workspace_root(monkeypatch):
    project_root = Path(__file__).resolve().parents[2]
    monkeypatch.setattr(sys, "path", [str(project_root / "backend")])

    ensure_project_root_on_path()

    assert str(project_root) in sys.path
