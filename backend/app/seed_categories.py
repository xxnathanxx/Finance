from __future__ import annotations

import logging
from sqlalchemy.orm import Session

from app.models import Category

logger = logging.getLogger(__name__)

DEFAULT_CATEGORIES: list[str] = [
    "Mercado",
    "Transporte",
    "Alimentação",
    "Saúde",
    "Moradia",
    "Lazer",
    "Educação",
    "Assinaturas",
    "Contas",
    "Outros",
    "Salário",
    "Investimentos",
    "Presentes",
    "Viagem",
    "Pets",
    "Seguros",
    "Combustível",
    "Cuidados pessoais",
    "Doações",
    "Impostos",
]


def ensure_default_categories(db: Session) -> None:
    """
    Cria categorias padrão (idempotente):
    - se a categoria já existir, não faz nada
    - se existir mas estiver inativa, reativa (is_active=True)
    """
    try:
        existing = db.query(Category).all()
        by_name = {c.name.strip().lower(): c for c in existing}

        created_any = False

        for name in DEFAULT_CATEGORIES:
            key = name.strip().lower()
            if not key:
                continue

            cat = by_name.get(key)
            if cat:
                if not cat.is_active:
                    cat.is_active = True
                    created_any = True
                continue

            db.add(Category(name=name.strip(), is_active=True))
            created_any = True

        if created_any:
            db.commit()

    except Exception as e:
        db.rollback()
        logger.exception("Falha ao criar categorias padrão: %s", e)
        return
