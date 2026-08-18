from __future__ import annotations

import os
import sys
import threading
import time
from pathlib import Path


def _base_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS)  # type: ignore[attr-defined]
    return Path(__file__).resolve().parent


BASE_DIR = _base_dir()
FRONTEND_DIST = BASE_DIR / "frontend_dist"

DATA_DIR = Path(os.getenv("LOCALAPPDATA", str(Path.home()))) / "FinancePro"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "finance.db"

# Configuração 100% local: SQLite em arquivo, sem Postgres/Docker/internet.
os.environ.setdefault("DATABASE_URL", f"sqlite:///{DB_PATH.as_posix()}")
os.environ.setdefault("JWT_SECRET_KEY", "chave-local-para-uso-offline-do-finance-pro-desktop")
os.environ.setdefault("ADMIN_EMAIL", "admin@local.app")
os.environ.setdefault("ADMIN_PASSWORD", "admin123456")
os.environ.setdefault("ADMIN_NAME", "Admin")

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.main import app

if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    @app.get("/")
    def _servir_index():
        return FileResponse(str(FRONTEND_DIST / "index.html"))

    @app.get("/vite.svg")
    def _servir_favicon():
        return FileResponse(str(FRONTEND_DIST / "vite.svg"))


def _rodar_servidor() -> None:
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")


def main() -> None:
    thread = threading.Thread(target=_rodar_servidor, daemon=True)
    thread.start()
    time.sleep(1.5)

    import webview

    webview.create_window(
        "Finance Pro",
        "http://127.0.0.1:8000",
        width=1100,
        height=800,
        min_size=(800, 600),
    )
    webview.start()


if __name__ == "__main__":
    main()
