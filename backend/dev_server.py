import sys
from pathlib import Path

import uvicorn


def ensure_project_root_on_path() -> None:
    project_root = Path(__file__).resolve().parents[1]
    root = str(project_root)
    if root not in sys.path:
        sys.path.insert(0, root)


if __name__ == "__main__":
    ensure_project_root_on_path()
    log_path = Path("backend/.data/dev_server.log")
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.write_text("starting backend dev server\n", encoding="utf-8")
    try:
        uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000)
    except Exception as exc:
        log_path.write_text(f"backend dev server failed: {exc!r}\n", encoding="utf-8")
        raise
