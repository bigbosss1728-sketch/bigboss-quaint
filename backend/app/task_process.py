import os
import subprocess
import sys
from pathlib import Path


def spawn_worker_once() -> None:
    arguments = [sys.executable, "-m", "backend.app.worker", "--once"]
    options = {
        "cwd": Path(__file__).resolve().parents[2],
        "shell": False,
        "stdin": subprocess.DEVNULL,
        "stdout": subprocess.DEVNULL,
        "stderr": subprocess.DEVNULL,
    }
    if os.name == "nt":
        options["creationflags"] = subprocess.CREATE_NO_WINDOW
    subprocess.Popen(arguments, **options)
