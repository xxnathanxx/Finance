from __future__ import annotations

import datetime as dt

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
)
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)

    email = Column(String(255), unique=True, index=True, nullable=False)

    # nome é opcional (facilita na UI)
    name = Column(String(120), nullable=True)

    # AUTH
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="USER")  # USER | ADMIN
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, nullable=False, default=dt.datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=dt.datetime.utcnow,
        onupdate=dt.datetime.utcnow,
    )

    transactions = relationship(
        "Transaction",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class UserSettings(Base):
    """
    Preferências do usuário que não fazem parte da conta em si.
    Uma linha por usuário, criada só quando ele configura algo pela
    primeira vez (não existe uma linha default criada no cadastro).
    """
    __tablename__ = "user_settings"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)

    # Meta de saldo positivo (receita - despesa) que o usuário quer bater todo mês.
    monthly_goal = Column(Numeric(10, 2), nullable=True)

    user = relationship("User")


class RevokedToken(Base):
    """
    Revogação por JTI.
    - Guardamos o jti (id único do token), tipo e expiração.
    - Se o jti estiver aqui, o token é inválido.
    """
    __tablename__ = "revoked_tokens"

    id = Column(Integer, primary_key=True)

    jti = Column(String(64), unique=True, index=True, nullable=False)
    token_type = Column(String(20), nullable=False)  # "access" | "refresh"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)

    revoked_at = Column(DateTime, nullable=False, default=dt.datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)

    user = relationship("User")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True)
    name = Column(String(80), unique=True, index=True, nullable=False)

    # NOVO: permite esconder sem apagar
    is_active = Column(Boolean, nullable=False, default=True, index=True)

    created_at = Column(DateTime, nullable=False, default=dt.datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=dt.datetime.utcnow,
        onupdate=dt.datetime.utcnow,
    )

    transactions = relationship("Transaction", back_populates="category")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True)

    description = Column(String(140), index=True, nullable=False)

    # manter "value" por compatibilidade (depois a gente pode renomear pra amount)
    value = Column(Numeric(10, 2), nullable=False)

    date = Column(Date, index=True, nullable=False)

    # NOVO: income | expense
    type = Column(String(10), nullable=False, default="expense")

    # vínculos
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), index=True, nullable=True)

    created_at = Column(DateTime, nullable=False, default=dt.datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=dt.datetime.utcnow,
        onupdate=dt.datetime.utcnow,
    )

    user = relationship("User", back_populates="transactions")
    category = relationship("Category", back_populates="transactions")
