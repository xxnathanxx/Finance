from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import Category, User
from app.schemas import CategoryCreate, CategoryOut, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[Category]:
    q = db.query(Category)
    if active_only:
        q = q.filter(Category.is_active.is_(True))
    return q.order_by(Category.name.asc()).all()


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> Category:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nome inválido")

    exists = db.query(Category).filter(Category.name == name).first()
    if exists:
        # Se existe, reativa e retorna
        if not exists.is_active:
            exists.is_active = True
            db.commit()
            db.refresh(exists)
        return exists

    cat = Category(name=name, is_active=True)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.patch("/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> Category:
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")

    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Nome inválido")

        # garante unicidade
        dup = db.query(Category).filter(Category.name == name, Category.id != category_id).first()
        if dup:
            raise HTTPException(status_code=409, detail="Já existe uma categoria com esse nome")

        cat.name = name

    db.commit()
    db.refresh(cat)
    return cat


@router.patch("/{category_id}/hide", response_model=CategoryOut)
def hide_category(
    category_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> Category:
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")

    cat.is_active = False
    db.commit()
    db.refresh(cat)
    return cat


@router.patch("/{category_id}/show", response_model=CategoryOut)
def show_category(
    category_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> Category:
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")

    cat.is_active = True
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> None:
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        return None
    db.delete(cat)
    db.commit()
    return None
