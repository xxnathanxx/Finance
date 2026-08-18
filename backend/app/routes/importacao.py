from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import Category, Transaction, User
from app.schemas import ConfirmarImportacaoIn, ConfirmarImportacaoOut, PreviewImportacaoOut
from app.services.importador import EXTENSOES_SUPORTADAS, aprender_regra, processar_arquivo

router = APIRouter(prefix="/import", tags=["Import"])

TAMANHO_MAXIMO_BYTES = 15 * 1024 * 1024  # 15 MB


@router.post("/preview", response_model=PreviewImportacaoOut)
async def preview_importacao(
    file: UploadFile = File(...),
    mes_referencia: str | None = Form(default=None),
    senha_pdf: str | None = Form(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    nome_arquivo = file.filename or ""
    extensao = nome_arquivo.rsplit(".", 1)[-1].lower() if "." in nome_arquivo else ""
    if extensao not in EXTENSOES_SUPORTADAS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de arquivo não suportado. Envie um CSV, Excel (.xlsx) ou PDF.",
        )

    conteudo = await file.read()
    if not conteudo:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Arquivo vazio.")
    if len(conteudo) > TAMANHO_MAXIMO_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Arquivo muito grande (máximo 15 MB).")

    try:
        itens, avisos = processar_arquivo(db, current_user.id, nome_arquivo, conteudo, mes_referencia, senha_pdf)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return PreviewImportacaoOut(nome_arquivo=nome_arquivo, itens=itens, avisos=avisos)


@router.post("/confirm", response_model=ConfirmarImportacaoOut, status_code=status.HTTP_201_CREATED)
def confirmar_importacao(
    payload: ConfirmarImportacaoIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ids_categoria = {item.category_id for item in payload.itens if item.category_id is not None}
    if ids_categoria:
        validas = {
            c.id for c in db.query(Category.id).filter(Category.id.in_(ids_categoria)).all()
        }
        invalidas = ids_categoria - validas
        if invalidas:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Categoria inválida")

    criadas = 0
    try:
        for item in payload.itens:
            db.add(
                Transaction(
                    description=item.descricao.strip(),
                    value=item.valor,
                    date=item.data,
                    type=item.tipo,
                    user_id=current_user.id,
                    category_id=item.category_id,
                )
            )
            criadas += 1

            if item.category_id is not None:
                aprender_regra(db, current_user.id, item.descricao, item.category_id)

        db.commit()
    except Exception:
        db.rollback()
        raise

    return ConfirmarImportacaoOut(criadas=criadas)
