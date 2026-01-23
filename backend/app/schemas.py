from __future__ import annotations

import datetime as dt
from typing import Any, Generic, List, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, Field


# =========================
# Base / Shared
# =========================

class BaseSchema(BaseModel):
    """
    Base para todos os schemas públicos (DTOs).
    - from_attributes=True permite criar schema a partir de ORM (SQLAlchemy)
    """
    model_config = ConfigDict(from_attributes=True)


# =========================
# Error / Standard responses
# =========================

class ApiError(BaseSchema):
    """
    Formato de erro padronizado (para a UI exibir sem gambiarra).
    """
    code: str = Field(
        ...,
        examples=["validation_error", "not_found", "conflict", "unauthorized", "http_error", "internal_error"],
    )
    message: str = Field(..., examples=["Dados inválidos.", "Recurso não encontrado."])
    details: Optional[Any] = Field(default=None, description="Detalhes extras (ex: campos inválidos)")


T = TypeVar("T")


class ApiResponse(BaseSchema, Generic[T]):
    """
    Envelope padrão de sucesso (opcional).
    Se preferir retornar o DTO direto (sem envelope), pode ignorar este.
    """
    data: T
    meta: Optional[dict[str, Any]] = None


class PaginationMeta(BaseSchema):
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=200)
    total_items: int = Field(0, ge=0)
    total_pages: int = Field(0, ge=0)


class Paginated(BaseSchema, Generic[T]):
    """
    Resposta paginada padrão: items + meta.
    """
    items: List[T]
    meta: PaginationMeta


# =========================
# Category
# =========================

class CategoryBase(BaseSchema):
    name: str = Field(..., min_length=1, max_length=80, examples=["Mercado", "Transporte"])


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseSchema):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)


class CategoryOut(CategoryBase):
    id: int
    is_active: bool = True


# =========================
# Transaction
# =========================

class TransactionBase(BaseSchema):
    """
    DTO base.
    - type: "income" ou "expense"
    """
    description: str = Field(..., min_length=1, max_length=140, examples=["Uber", "Salário"])
    amount: float = Field(..., gt=0, examples=[50.0, 1200.0])
    date: dt.date = Field(..., examples=["2025-12-25"])
    type: str = Field(..., pattern="^(income|expense)$", examples=["expense"])
    category_id: Optional[int] = Field(default=None, ge=1)


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseSchema):
    """
    Update parcial (PATCH).
    """
    description: Optional[str] = Field(default=None, min_length=1, max_length=140)
    amount: Optional[float] = Field(default=None, gt=0)
    date: Optional[dt.date] = None
    type: Optional[str] = Field(default=None, pattern="^(income|expense)$")
    category_id: Optional[int] = Field(default=None, ge=1)


class TransactionOut(BaseSchema):
    """
    DTO público de saída.
    - category: embed opcional pra UI não precisar chamar categoria a cada item
    """
    id: int
    description: str
    amount: float
    date: dt.date
    type: str
    category_id: Optional[int] = None
    category: Optional[CategoryOut] = None

    created_at: Optional[dt.datetime] = None
    updated_at: Optional[dt.datetime] = None


# =========================
# Auth
# =========================

class TokenOut(BaseSchema):
    access_token: str
    token_type: str = "bearer"


class TokenPairOut(BaseSchema):
    """
    Login/Refresh retornam access + refresh.
    """
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginIn(BaseSchema):
    username: str
    password: str


class RefreshIn(BaseSchema):
    refresh_token: str


class LogoutIn(BaseSchema):
    refresh_token: str


# =========================
# Reports / Summary
# =========================

class CategorySummary(BaseSchema):
    category_id: int | None
    category_name: str | None
    total: float


class MonthlySummary(BaseSchema):
    month: str
    total_income: float
    total_expense: float
    balance: float
    expenses_by_category: list[CategorySummary]
