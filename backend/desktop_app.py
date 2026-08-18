from __future__ import annotations

import os
import sys
import threading
import time
import traceback
import urllib.error
import urllib.request
from pathlib import Path


def _base_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS)  # type: ignore[attr-defined]
    return Path(__file__).resolve().parent


BASE_DIR = _base_dir()
FRONTEND_DIST = BASE_DIR / "frontend_dist"

DATA_DIR = Path(os.getenv("LOCALAPPDATA", str(Path.home()))) / "Orbita"

# Migração de instalações antigas (quando o app se chamava Finance Pro)
_DATA_DIR_ANTIGA = Path(os.getenv("LOCALAPPDATA", str(Path.home()))) / "FinancePro"
if _DATA_DIR_ANTIGA.exists() and not DATA_DIR.exists():
    _DATA_DIR_ANTIGA.rename(DATA_DIR)

DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "finance.db"
LOG_PATH = DATA_DIR / "desktop_app.log"

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


def _registrar_erro(origem: str, exc: BaseException) -> None:
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(f"\n--- {origem} ({time.strftime('%Y-%m-%d %H:%M:%S')}) ---\n")
        f.write("".join(traceback.format_exception(exc)))


def _rodar_servidor() -> None:
    import uvicorn

    try:
        uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")
    except BaseException as exc:  # captura até erro de porta ocupada
        _registrar_erro("servidor", exc)


def _aguardar_servidor_pronto(url: str, timeout: float = 45.0) -> bool:
    inicio = time.time()
    while time.time() - inicio < timeout:
        try:
            with urllib.request.urlopen(url, timeout=1) as resp:
                if resp.status == 200:
                    return True
        except (urllib.error.URLError, ConnectionError, TimeoutError, OSError):
            pass
        time.sleep(0.3)
    return False


def main() -> None:
    if LOG_PATH.exists():
        try:
            LOG_PATH.unlink()
        except OSError:
            pass

    thread = threading.Thread(target=_rodar_servidor, daemon=True)
    thread.start()

    import webview

    servidor_pronto = _aguardar_servidor_pronto("http://127.0.0.1:8000/health")

    if servidor_pronto:
        webview.create_window(
            "Órbita",
            "http://127.0.0.1:8000",
            width=1100,
            height=800,
            min_size=(800, 600),
        )
    else:
        detalhe = ""
        if LOG_PATH.exists():
            detalhe = f"<pre>{LOG_PATH.read_text(encoding='utf-8')}</pre>"

        html_erro = f"""
        <html><body style="font-family: sans-serif; padding: 32px;">
          <h2>O servidor local não respondeu a tempo</h2>
          <p>Tente fechar e abrir o programa de novo. Se persistir, veja o
          arquivo de log em:</p>
          <p><code>{LOG_PATH}</code></p>
          {detalhe}
        </body></html>
        """
        webview.create_window("Órbita", html=html_erro, width=900, height=600)

    webview.start()


if __name__ == "__main__":
    main()
