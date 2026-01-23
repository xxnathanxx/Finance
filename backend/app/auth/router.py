from __future__ import annotations

import datetime as dt
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, is_jti_revoked, revoke_jti
from app.auth.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.database import get_db
from app.models import User
from app.schemas import BaseSchema, LogoutIn, RefreshIn, TokenPairOut

router = APIRouter(prefix="/auth", tags=["Auth"])


# -----------------------------------------------------------------------------
# Schemas locais (porque seu schemas.py não define RegisterIn/UserOut)
# -----------------------------------------------------------------------------

class RegisterIn(BaseSchema):
    email: str
    password: str
    name: str | None = None


class UserOut(BaseSchema):
    id: int
    email: str
    name: str | None = None
    role: str


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

def _exp_to_dt(exp_value: Any) -> dt.datetime | None:
    """
    Converte claim exp (epoch) em datetime UTC.
    """
    try:
        exp_ts = int(exp_value)
    except Exception:
        return None
    return dt.datetime.fromtimestamp(exp_ts, tz=dt.timezone.utc)


def _extract_bearer_token(request: Request) -> str | None:
    """
    Lê Authorization: Bearer <token>
    Retorna o token ou None.
    """
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth:
        return None
    parts = auth.split()
    if len(parts) != 2:
        return None
    if parts[0].lower() != "bearer":
        return None
    return parts[1].strip() or None


# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn, db: Session = Depends(get_db)) -> User:
    email = payload.email.strip().lower()

    exists = db.query(User).filter(User.email == email).first()
    if exists:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=email,
        name=payload.name,
        role="USER",
        is_active=True,
        password_hash=hash_password(payload.password),
    )

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenPairOut)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> TokenPairOut:
    """
    OAuth2PasswordRequestForm sempre manda:
      - username
      - password

    Aqui, username = email.
    """
    email = (form_data.username or "").strip().lower()
    password = form_data.password or ""

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    access_jti = str(uuid.uuid4())
    refresh_jti = str(uuid.uuid4())

    access_token, _access_exp = create_access_token(subject=str(user.id), jti=access_jti)
    refresh_token, _refresh_exp = create_refresh_token(subject=str(user.id), jti=refresh_jti)

    return TokenPairOut(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> User:
    """
    Rota protegida para validar o access token na prática.
    """
    return current_user


@router.post("/refresh", response_model=TokenPairOut)
def refresh(payload: RefreshIn, db: Session = Depends(get_db)) -> TokenPairOut:
    """
    Valida refresh_token e rotaciona:
      - revoga refresh antigo (jti)
      - emite novo access + novo refresh
    """
    try:
        data = decode_token(payload.refresh_token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    if data.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    subject = data.get("sub")
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    old_jti = data.get("jti")
    if old_jti and is_jti_revoked(db, str(old_jti)):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token revoked")

    # Revoga refresh antigo (se possível)
    old_exp_dt = _exp_to_dt(data.get("exp"))
    if old_jti and old_exp_dt is not None:
        revoke_jti(
            db,
            jti=str(old_jti),
            token_type="refresh",
            user_id=int(subject),
            expires_at=old_exp_dt,
        )

    new_access_jti = str(uuid.uuid4())
    new_refresh_jti = str(uuid.uuid4())

    access_token, _access_exp = create_access_token(subject=str(subject), jti=new_access_jti)
    refresh_token, _refresh_exp = create_refresh_token(subject=str(subject), jti=new_refresh_jti)

    return TokenPairOut(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    payload: LogoutIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    """
    Logout revoga:
      - refresh_token (vem no body; seu LogoutIn exige isso)
      - access_token (opcional; lido do header Authorization: Bearer ...)
    """
    # 1) revoga refresh do body (best-effort)
    try:
        refresh_data = decode_token(payload.refresh_token)
    except Exception:
        refresh_data = None

    if refresh_data and refresh_data.get("type") == "refresh":
        refresh_jti = refresh_data.get("jti")
        refresh_exp_dt = _exp_to_dt(refresh_data.get("exp"))
        refresh_sub = refresh_data.get("sub")

        if refresh_jti and refresh_exp_dt is not None and refresh_sub:
            revoke_jti(
                db,
                jti=str(refresh_jti),
                token_type="refresh",
                user_id=int(refresh_sub),
                expires_at=refresh_exp_dt,
            )

    # 2) revoga access do Authorization header (best-effort)
    access_token = _extract_bearer_token(request)
    if access_token:
        try:
            access_data = decode_token(access_token)
        except Exception:
            access_data = None

        if access_data and access_data.get("type") == "access":
            access_jti = access_data.get("jti")
            access_exp_dt = _exp_to_dt(access_data.get("exp"))
            access_sub = access_data.get("sub")

            # garante que só revoga access do próprio user logado
            if access_sub and str(access_sub) == str(user.id):
                if access_jti and access_exp_dt is not None:
                    revoke_jti(
                        db,
                        jti=str(access_jti),
                        token_type="access",
                        user_id=int(access_sub),
                        expires_at=access_exp_dt,
                    )

    return None
