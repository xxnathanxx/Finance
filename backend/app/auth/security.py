from __future__ import annotations

import datetime as dt
from typing import Any

from jose import jwt
from passlib.context import CryptContext

from app.settings import settings


# -----------------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------------

SECRET_KEY = settings.JWT_SECRET_KEY
ALGORITHM = settings.JWT_ALGORITHM

ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_DAYS = settings.REFRESH_TOKEN_EXPIRE_DAYS

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


# -----------------------------------------------------------------------------
# Password helpers
# -----------------------------------------------------------------------------

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# -----------------------------------------------------------------------------
# JWT helpers
# -----------------------------------------------------------------------------

def create_access_token(*, subject: str, jti: str | None = None) -> tuple[str, dt.datetime]:
    """
    Access token payload:
      - sub: subject (user id)
      - type: "access"
      - jti: optional (revogação)
      - iat/exp: epoch UTC
    """
    now = _utcnow()
    exp = now + dt.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    payload: dict[str, Any] = {
        "sub": subject,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    if jti:
        payload["jti"] = jti

    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token, exp


def create_refresh_token(*, subject: str, jti: str | None = None) -> tuple[str, dt.datetime]:
    """
    Refresh token payload:
      - sub: subject (user id)
      - type: "refresh"
      - jti: optional (revogação)
      - iat/exp: epoch UTC
    """
    now = _utcnow()
    exp = now + dt.timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    payload: dict[str, Any] = {
        "sub": subject,
        "type": "refresh",
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    if jti:
        payload["jti"] = jti

    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token, exp


def decode_token(token: str) -> dict[str, Any]:
    """
    Decodifica e valida assinatura + exp.
    Retorna o payload.
    """
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
