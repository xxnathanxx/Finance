from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.router import router as auth_router
from app.auth.seed_admin import ensure_admin
from app.database import Base, SessionLocal, engine
from app.routes.account import router as account_router
from app.routes.categories import router as categories_router
from app.routes.importacao import router as import_router
from app.routes.reports import router as reports_router
from app.routes.settings import router as settings_router
from app.routes.transactions import router as transactions_router
from app.seed_categories import ensure_default_categories

app = FastAPI(title="Órbita API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        ensure_admin(db)
        ensure_default_categories(db)
    finally:
        db.close()


app.include_router(auth_router)
app.include_router(categories_router)
app.include_router(transactions_router)
app.include_router(reports_router)
app.include_router(settings_router)
app.include_router(import_router)
app.include_router(account_router)


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
