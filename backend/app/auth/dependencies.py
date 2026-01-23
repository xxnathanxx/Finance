from __future__ import annotations

import datetime as dt
from typing import Any, Iterable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.auth.security import decode_token
from app.database import get_db
from app.models import RevokedToken, User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def is_jti_revoked(db: Session, jti: str) -> bool:
    """
    Retorna True se o jti estiver revogado.
    Se jti vier vazio/None, considera revogado por segurança.
    """
    if not jti:
        return True
    exists = db.query(RevokedToken.id).filter(RevokedToken.jti == jti).first()
    return exists is not None


def revoke_jti(
    db: Session,
    *,
    jti: str,
    token_type: str,
    user_id: int,
    expires_at: dt.datetime,
) -> None:
    """
    Persiste revogação do jti até expires_at.
    """
    item = RevokedToken(
        jti=jti,
        token_type=token_type,
        user_id=user_id,
        expires_at=expires_at,
    )
    db.add(item)
    db.commit()


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload: dict[str, Any] = decode_token(token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    jti = payload.get("jti")
    if is_jti_revoked(db, str(jti)):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token revogado")

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    user = db.query(User).filter(User.id == int(sub)).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário inválido/inativo")

    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """
    Compatível com seu código atual.
    """
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")
    return current_user


def require_roles(allowed_roles: Iterable[str]):
    """
    Dependency factory para RBAC:
      - allowed_roles: ex ["ADMIN"] ou ["ADMIN", "USER"]

    Uso:
      @router.get(..., dependencies=[Depends(require_roles(["ADMIN"]))])
      ou
      def endpoint(user=Depends(require_roles(["ADMIN"]))): ...
    """
    allowed = {r.upper() for r in allowed_roles}

    def _dep(current_user: User = Depends(get_current_user)) -> User:
        if (current_user.role or "").upper() not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")
        return current_user

    return _dep
