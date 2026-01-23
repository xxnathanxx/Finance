from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.security import create_access_token, hash_password, verify_password
from app.database import get_db
from app.models import User
from app.schemas import BaseSchema, TokenOut


router = APIRouter(prefix="/auth", tags=["Auth"])


class RegisterIn(BaseSchema):
    email: str
    password: str
    name: str | None = None


class UserOut(BaseSchema):
    id: int
    email: str
    name: str | None = None
    role: str


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterIn,
    db: Session = Depends(get_db),
):
    email = payload.email.strip().lower()

    exists = db.query(User.id).filter(User.email == email).first()
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email já cadastrado")

    user = User(
        email=email,
        name=payload.name,
        password_hash=hash_password(payload.password),
        role="USER",
        is_active=True,
    )

    try:
        db.add(user)
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(user)
    return UserOut.model_validate(user)


@router.post("/login", response_model=TokenOut)
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    OAuth2PasswordRequestForm usa:
    - username (vamos tratar como email)
    - password
    """
    email = form.username.strip().lower()

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais inválidas")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário inativo")

    if not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais inválidas")

    token = create_access_token(subject=str(user.id))

    return TokenOut(access_token=token, token_type="bearer")


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)
