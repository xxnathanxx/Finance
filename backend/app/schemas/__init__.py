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
# Error / Standard responses (opcional)
# =========================

class ApiError(BaseSchema):
    code: str = Field(
        ...,
        examples=["validation_error", "not_found", "conflict", "unauthorized", "http_error", "internal_error"],
    )
    message: str = Field(..., examples=["Dados inválidos.", "Recurso não encontrado."])
    details: Optional[Any] = None


T = TypeVar("T")


class ApiResponse(BaseSchema, Generic[T]):
    data: T
    meta: Optional[dict[str, Any]] = None


class PaginationMeta(BaseSchema):
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=200)
    total_items: int = Field(0, ge=0)
    total_pages: int = Field(0, ge=0)


class Paginated(BaseSchema, Generic[T]):
    items: List[T]
    meta: PaginationMeta


# =========================
# Category
# =========================

class CategoryCreate(BaseSchema):
    name: str = Field(..., min_length=1, max_length=80)


class CategoryUpdate(BaseSchema):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)


class CategoryOut(BaseSchema):
    id: int
    name: str
    is_active: bool = True


# =========================
# Transaction
# =========================

class TransactionCreate(BaseSchema):
    description: str = Field(..., min_length=1, max_length=140)
    amount: float = Field(..., gt=0)
    date: dt.date
    type: str = Field(..., pattern="^(income|expense)$")
    category_id: Optional[int] = Field(default=None, ge=1)


class TransactionUpdate(BaseSchema):
    description: Optional[str] = Field(default=None, min_length=1, max_length=140)
    amount: Optional[float] = Field(default=None, gt=0)
    date: Optional[dt.date] = None
    type: Optional[str] = Field(default=None, pattern="^(income|expense)$")
    category_id: Optional[int] = Field(default=None, ge=1)


class TransactionOut(BaseSchema):
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
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


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
    income_by_category: list[CategorySummary] = []


class PeriodSummary(BaseSchema):
    start_date: dt.date
    end_date: dt.date
    total_income: float
    total_expense: float
    balance: float
    expenses_by_category: list[CategorySummary]
    income_by_category: list[CategorySummary] = []


# =========================
# Importação de fatura/conta
# =========================

class ItemImportado(BaseSchema):
    descricao: str
    valor: float
    data: dt.date
    tipo: str = Field(..., pattern="^(income|expense)$")
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    duplicada: bool = False
    incluir: bool = True


class PreviewImportacaoOut(BaseSchema):
    nome_arquivo: str
    itens: list[ItemImportado]
    avisos: list[str] = []


class ItemConfirmacaoIn(BaseSchema):
    descricao: str = Field(..., min_length=1, max_length=140)
    valor: float = Field(..., gt=0)
    data: dt.date
    tipo: str = Field(..., pattern="^(income|expense)$")
    category_id: Optional[int] = Field(default=None, ge=1)


class ConfirmarImportacaoIn(BaseSchema):
    itens: list[ItemConfirmacaoIn] = Field(..., min_length=1)


class ConfirmarImportacaoOut(BaseSchema):
    criadas: int


# =========================
# Settings
# =========================

class SettingsOut(BaseSchema):
    monthly_goal: Optional[float] = None


class SettingsUpdate(BaseSchema):
    monthly_goal: float = Field(..., gt=0)


# =========================
# Conta - limpar dados / restaurar padrão
# =========================

class LimparDadosOut(BaseSchema):
    transacoes_apagadas: int


class RestaurarPadraoOut(BaseSchema):
    transacoes_apagadas: int
    regras_importacao_apagadas: int
    categorias_removidas: int
