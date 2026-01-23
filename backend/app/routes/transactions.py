from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import Category, Transaction, User
from app.schemas import TransactionCreate, TransactionOut, TransactionUpdate


router = APIRouter(prefix="/transactions", tags=["Transactions"])


def _to_amount(value_db) -> float:
    # Numeric -> float (para resposta)
    return float(value_db) if value_db is not None else 0.0


@router.get("", response_model=list[TransactionOut])
def list_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items = (
        db.query(Transaction)
        .options(joinedload(Transaction.category))
        .filter(Transaction.user_id == current_user.id)
        .order_by(Transaction.date.desc(), Transaction.id.desc())
        .all()
    )

    out: list[TransactionOut] = []
    for x in items:
        out.append(
            TransactionOut(
                id=x.id,
                description=x.description,
                amount=_to_amount(x.value),
                date=x.date,
                type=x.type,
                category_id=x.category_id,
                category=x.category,
                created_at=x.created_at,
                updated_at=x.updated_at,
            )
        )
    return out


@router.post("", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
def create_transaction(
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # valida category_id (se vier)
    if payload.category_id is not None:
        cat = db.query(Category.id).filter(Category.id == payload.category_id).first()
        if not cat:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Categoria inválida")

    item = Transaction(
        description=payload.description.strip(),
        value=payload.amount,
        date=payload.date,
        type=payload.type,  # ✅ NOVO
        user_id=current_user.id,
        category_id=payload.category_id,
    )

    try:
        db.add(item)
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(item)

    # carregar category pra resposta
    item = (
        db.query(Transaction)
        .options(joinedload(Transaction.category))
        .filter(Transaction.id == item.id)
        .first()
    )

    return TransactionOut(
        id=item.id,
        description=item.description,
        amount=_to_amount(item.value),
        date=item.date,
        type=item.type,
        category_id=item.category_id,
        category=item.category,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.patch("/{transaction_id}", response_model=TransactionOut)
def update_transaction(
    transaction_id: int,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = (
        db.query(Transaction)
        .filter(Transaction.id == transaction_id, Transaction.user_id == current_user.id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transação não encontrada")

    if payload.description is not None:
        item.description = payload.description.strip()

    if payload.amount is not None:
        item.value = payload.amount

    if payload.date is not None:
        item.date = payload.date

    if payload.type is not None:
        item.type = payload.type  # ✅ NOVO

    if payload.category_id is not None:
        if payload.category_id is not None:
            cat = db.query(Category.id).filter(Category.id == payload.category_id).first()
            if not cat:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Categoria inválida")
        item.category_id = payload.category_id

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(item)

    item = (
        db.query(Transaction)
        .options(joinedload(Transaction.category))
        .filter(Transaction.id == item.id)
        .first()
    )

    return TransactionOut(
        id=item.id,
        description=item.description,
        amount=_to_amount(item.value),
        date=item.date,
        type=item.type,
        category_id=item.category_id,
        category=item.category,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = (
        db.query(Transaction)
        .filter(Transaction.id == transaction_id, Transaction.user_id == current_user.id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transação não encontrada")

    try:
        db.delete(item)
        db.commit()
    except Exception:
        db.rollback()
        raise

    return None
