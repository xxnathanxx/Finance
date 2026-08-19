from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import Category, ImportRule, Transaction, User, UserSettings
from app.schemas import LimparDadosOut, RestaurarPadraoOut
from app.seed_categories import DEFAULT_CATEGORIES, ensure_default_categories

router = APIRouter(prefix="/account", tags=["Account"])


@router.delete("/transactions", response_model=LimparDadosOut)
def limpar_transacoes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Apaga todas as transações do usuário. Categorias, meta e regras aprendidas continuam intactas."""
    apagadas = (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return LimparDadosOut(transacoes_apagadas=apagadas)


@router.delete("/reset", response_model=RestaurarPadraoOut)
def restaurar_padrao(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Restaura a conta pro estado de recém-criada: apaga transações, regras
    de importação aprendidas e a meta mensal do usuário, e devolve a lista
    de categorias pro padrão de fábrica (categorias que não são padrão são
    removidas; as padrão voltam a existir e ficam ativas).

    Como categorias não são por usuário (são uma lista compartilhada do
    app), isso reseta a lista de categorias inteira - faz sentido no uso
    normal do Órbita, que é uma instalação por pessoa.
    """
    transacoes_apagadas = (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id)
        .delete(synchronize_session=False)
    )

    regras_apagadas = (
        db.query(ImportRule)
        .filter(ImportRule.user_id == current_user.id)
        .delete(synchronize_session=False)
    )

    db.query(UserSettings).filter(UserSettings.user_id == current_user.id).delete(synchronize_session=False)

    nomes_padrao = {nome.strip().lower() for nome in DEFAULT_CATEGORIES}
    categorias_removidas = 0
    for categoria in db.query(Category).all():
        if categoria.name.strip().lower() not in nomes_padrao:
            db.delete(categoria)
            categorias_removidas += 1
        else:
            categoria.is_active = True

    db.commit()

    ensure_default_categories(db)

    return RestaurarPadraoOut(
        transacoes_apagadas=transacoes_apagadas,
        regras_importacao_apagadas=regras_apagadas,
        categorias_removidas=categorias_removidas,
    )
