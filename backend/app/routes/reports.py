from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import Category, Transaction, User
from app.schemas import CategorySummary, MonthlySummary


router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/monthly/{year}/{month}", response_model=MonthlySummary)
def monthly_report(
    year: int,
    month: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if month < 1 or month > 12:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mês inválido")

    start = dt.date(year, month, 1)
    # próximo mês
    if month == 12:
        end = dt.date(year + 1, 1, 1)
    else:
        end = dt.date(year, month + 1, 1)

    # --- Totais do mês (income/expense por type) ---
    totals = (
        db.query(
            func.coalesce(
                func.sum(case((Transaction.type == "income", Transaction.value), else_=0)),
                0,
            ).label("total_income"),
            func.coalesce(
                func.sum(case((Transaction.type == "expense", Transaction.value), else_=0)),
                0,
            ).label("total_expense"),
        )
        .filter(Transaction.user_id == current_user.id)
        .filter(Transaction.date >= start, Transaction.date < end)
        .one()
    )

    total_income = float(totals.total_income or 0)
    total_expense = float(totals.total_expense or 0)
    balance = total_income - total_expense

    # --- Despesas por categoria ---
    # Só despesas (type = expense)
    rows = (
        db.query(
            Transaction.category_id.label("category_id"),
            Category.name.label("category_name"),
            func.coalesce(func.sum(Transaction.value), 0).label("total"),
        )
        .outerjoin(Category, Category.id == Transaction.category_id)
        .filter(Transaction.user_id == current_user.id)
        .filter(Transaction.type == "expense")
        .filter(Transaction.date >= start, Transaction.date < end)
        .group_by(Transaction.category_id, Category.name)
        .order_by(func.sum(Transaction.value).desc())
        .all()
    )

    expenses_by_category: list[CategorySummary] = []
    for r in rows:
        expenses_by_category.append(
            CategorySummary(
                category_id=r.category_id,
                category_name=r.category_name,
                total=float(r.total or 0),
            )
        )

    return MonthlySummary(
        month=f"{year:04d}-{month:02d}",
        total_income=total_income,
        total_expense=total_expense,
        balance=balance,
        expenses_by_category=expenses_by_category,
    )
