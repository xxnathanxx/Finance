from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import require_admin
from app.database import get_db
from app.models import User

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/ping")
def admin_ping(_: User = Depends(require_admin)):
    """
    Endpoint simples só pra provar que RBAC está funcionando.
    """
    return {"ok": True, "message": "Você é ADMIN."}


@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """
    Lista usuários (exemplo de endpoint ADMIN).
    Retorna campos básicos pra não vazar info sensível.
    """
    users = db.query(User).order_by(User.id.asc()).all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "name": u.name,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at,
        }
        for u in users
    ]


@router.post("/users/{user_id}/deactivate")
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """
    Exemplo: desativa um usuário.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return {"ok": False, "detail": "Usuário não encontrado"}

    user.is_active = False
    db.add(user)
    db.commit()
    db.refresh(user)

    return {"ok": True, "id": user.id, "is_active": user.is_active}
