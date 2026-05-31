#!/usr/bin/env python3
"""Skinalizer — one-command launcher (Windows / macOS / Linux).

The ONLY thing you need installed first: Python 3.10+ and Node.js 18+.
This script creates the backend virtualenv, installs all dependencies, installs
the frontend packages, and starts both servers — then opens in your browser.

    python run.py            # set up (first run) + start everything
    python run.py setup      # just install dependencies, don't start
    python run.py backend    # only run the backend  (http://127.0.0.1:8000)
    python run.py frontend   # only run the frontend (http://localhost:5173)

No global installs, no database, no dataset download. Everything stays inside
backend/.venv and frontend/node_modules (both git-ignored), so the repo itself
stays tiny.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
IS_WINDOWS = os.name == "nt"

BACKEND_URL = "http://127.0.0.1:8000"
FRONTEND_URL = "http://localhost:5173"
MIN_PY = (3, 10)


# --------------------------------------------------------------------- helpers
def info(msg: str) -> None:
    print(f"\033[33m›\033[0m {msg}" if not IS_WINDOWS else f"> {msg}")


def die(msg: str) -> None:
    print(f"\nERROR: {msg}\n", file=sys.stderr)
    sys.exit(1)


def venv_python() -> Path:
    """Path to the python interpreter inside the backend venv (per-OS)."""
    if IS_WINDOWS:
        return BACKEND / ".venv" / "Scripts" / "python.exe"
    return BACKEND / ".venv" / "bin" / "python"


def run(cmd: list[str], cwd: Path) -> None:
    info(f"{' '.join(str(c) for c in cmd)}")
    result = subprocess.run(cmd, cwd=str(cwd))
    if result.returncode != 0:
        die(f"command failed (exit {result.returncode}): {' '.join(map(str, cmd))}")


def npm_exe() -> str:
    npm = shutil.which("npm")
    if not npm:
        die("Node.js / npm not found. Install Node 18+ from https://nodejs.org and re-run.")
    return npm


# --------------------------------------------------------------------- setup
def ensure_backend() -> None:
    if sys.version_info < MIN_PY:
        die(f"Python {MIN_PY[0]}.{MIN_PY[1]}+ required (you have {sys.version.split()[0]}).")
    vpy = venv_python()
    if not vpy.exists():
        info("Creating backend virtualenv (backend/.venv)…")
        run([sys.executable, "-m", "venv", ".venv"], BACKEND)
        run([str(vpy), "-m", "pip", "install", "--upgrade", "pip"], BACKEND)
    info("Installing backend dependencies…")
    run([str(vpy), "-m", "pip", "install", "-q", "-r", "requirements.txt"], BACKEND)


def ensure_frontend() -> None:
    if (FRONTEND / "node_modules").exists():
        return
    info("Installing frontend dependencies (npm install)…")
    # npm is a shell script/.cmd; run through the shell on Windows.
    if IS_WINDOWS:
        subprocess.run("npm install", cwd=str(FRONTEND), shell=True, check=True)
    else:
        run([npm_exe(), "install"], FRONTEND)


# --------------------------------------------------------------------- servers
def backend_proc() -> subprocess.Popen:
    return subprocess.Popen(
        [str(venv_python()), "-m", "uvicorn", "skinalizer.api.app:app",
         "--host", "127.0.0.1", "--port", "8000"],
        cwd=str(BACKEND),
    )


def frontend_proc() -> subprocess.Popen:
    if IS_WINDOWS:
        return subprocess.Popen("npm run dev", cwd=str(FRONTEND), shell=True)
    return subprocess.Popen([npm_exe(), "run", "dev"], cwd=str(FRONTEND))


def start(which: str) -> None:
    procs: list[subprocess.Popen] = []
    try:
        if which in ("all", "backend"):
            info(f"Starting backend → {BACKEND_URL}")
            procs.append(backend_proc())
        if which in ("all", "frontend"):
            info(f"Starting frontend → {FRONTEND_URL}")
            procs.append(frontend_proc())
        if which == "all":
            time.sleep(4)
            try:
                webbrowser.open(FRONTEND_URL)
            except Exception:
                pass
        print("\n" + "=" * 56)
        print("  Skinalizer is running.  Press Ctrl+C to stop.")
        if which in ("all", "frontend"):
            print(f"  App      {FRONTEND_URL}")
        if which in ("all", "backend"):
            print(f"  API      {BACKEND_URL}/api/health")
        print("=" * 56 + "\n")

        # Wait until any child exits (or Ctrl+C).
        while True:
            for p in procs:
                if p.poll() is not None:
                    return
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nShutting down…")
    finally:
        for p in procs:
            if p.poll() is None:
                p.terminate()
        for p in procs:
            try:
                p.wait(timeout=5)
            except subprocess.TimeoutExpired:
                p.kill()


# --------------------------------------------------------------------- main
def main() -> None:
    cmd = (sys.argv[1] if len(sys.argv) > 1 else "all").lower()
    if cmd not in ("all", "setup", "backend", "frontend"):
        die(f"unknown command '{cmd}'. Use: setup | backend | frontend | (none)")

    if cmd in ("all", "setup", "backend"):
        ensure_backend()
    if cmd in ("all", "setup", "frontend"):
        ensure_frontend()

    if cmd == "setup":
        info("Setup complete. Run `python run.py` to start.")
        return
    start("all" if cmd == "all" else cmd)


if __name__ == "__main__":
    main()
