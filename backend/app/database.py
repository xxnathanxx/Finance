from __future__ import annotations

import logging

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.settings import settings

logger = logging.getLogger(__name__)

Base = declarative_base()

# SQLite precisa do check_same_thread=False
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """
    Cria tabelas e garante o ADMIN inicial.
    """
    # importa models para registrar mapeamento no Base.metadata
    from app import models  # noqa: F401
    from app.seed import ensure_admin

    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        ensure_admin(db)
    except Exception as e:
        logger.exception("Falha no init_db: %s", e)
    finally:
        db.close()
