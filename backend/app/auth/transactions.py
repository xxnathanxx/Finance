from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Transaction, User
from app.auth.auth import get_current_user

router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.get("/")
def list_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Transaction)

    # USER vê só as dele, ADMIN vê todas
    if current_user.role != "ADMIN":
        q = q.filter(Transaction.user_id == current_user.id)

    return q.all()


@router.post("/")
def create_transaction(
    transaction: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        new_tx = Transaction(**transaction)
    except TypeError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Campos inválidos no payload da transação",
        )

    new_tx.user_id = current_user.id

    db.add(new_tx)
    db.commit()
    db.refresh(new_tx)
    return new_tx


@router.get("/{transaction_id}")
def get_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()

    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transação não encontrada")

    # USER só acessa a própria transação
    if current_user.role != "ADMIN" and tx.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão")

    return tx


@router.delete("/{transaction_id}")
def delete_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()

    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transação não encontrada")

    # ADMIN pode deletar qualquer, USER só a própria
    if current_user.role != "ADMIN" and tx.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão")

    db.delete(tx)
    db.commit()
    return {"message": "Transação removida"}
