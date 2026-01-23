from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.auth.security import hash_password
from app.models import User
from app.settings import settings

logger = logging.getLogger(__name__)


def ensure_admin(db: Session) -> None:
    """
    Cria um ADMIN inicial, idempotente.
    NÃO derruba o app se der erro.
    """
    if not settings.ADMIN_EMAIL or not settings.ADMIN_PASSWORD:
        return

    email = settings.ADMIN_EMAIL.strip().lower()

    try:
        exists = db.query(User.id).filter(User.email == email).first()
        if exists:
            return

        admin = User(
            email=email,
            name=settings.ADMIN_NAME or "Admin",
            password_hash=hash_password(settings.ADMIN_PASSWORD),
            role="ADMIN",
            is_active=True,
        )

        db.add(admin)
        db.commit()

    except Exception as e:
        db.rollback()
        logger.exception("Falha ao criar admin inicial: %s", e)
        # não relança para não matar o startup
        return
