from __future__ import annotations

from typing import Any, Optional, TypeVar

from app.schemas import ApiResponse

T = TypeVar("T")


def ok(data: T, meta: Optional[dict[str, Any]] = None) -> ApiResponse[T]:
    """
    Envelope padrão de sucesso.
    Uso: return ok(TransactionOut(...))
    """
    return ApiResponse[T](data=data, meta=meta)
