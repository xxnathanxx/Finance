from __future__ import annotations

from math import ceil
from typing import Any, Callable, Generic, List, Optional, TypeVar

from sqlalchemy.orm import Query

from app.schemas import Paginated, PaginationMeta

T = TypeVar("T")


def paginate_query(
    query: Query,
    *,
    page: int = 1,
    page_size: int = 20,
) -> tuple[List[Any], PaginationMeta]:
    """
    Paginação padrão para queries SQLAlchemy.

    Retorna:
      - items (lista já paginada)
      - meta (PaginationMeta)
    """
    if page < 1:
        page = 1
    if page_size < 1:
        page_size = 20
    if page_size > 200:
        page_size = 200

    total_items = query.order_by(None).count()
    total_pages = ceil(total_items / page_size) if total_items else 0

    offset = (page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()

    meta = PaginationMeta(
        page=page,
        page_size=page_size,
        total_items=total_items,
        total_pages=total_pages,
    )
    return items, meta


def to_paginated(
    items: List[Any],
    meta: PaginationMeta,
    mapper: Optional[Callable[[Any], T]] = None,
) -> Paginated[T]:
    """
    Converte uma lista + meta em Paginated[T].
    mapper: função opcional para mapear item ORM -> DTO
    """
    if mapper:
        mapped = [mapper(i) for i in items]
        return Paginated[T](items=mapped, meta=meta)

    # type: ignore - se não mapear, assume que items já são do tipo T
    return Paginated[T](items=items, meta=meta)  # pyright: ignore[reportGeneralTypeIssues]
