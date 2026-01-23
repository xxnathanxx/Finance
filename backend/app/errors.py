from __future__ import annotations

import os
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.schemas import ApiError


def _is_debug() -> bool:
    """
    Controla se vamos expor detalhes técnicos no response.
    Use DEBUG=1 ou DEBUG=true no .env para habilitar.
    """
    v = (os.getenv("DEBUG") or "").strip().lower()
    return v in {"1", "true", "yes", "on"}


def _error_payload(
    *,
    code: str,
    message: str,
    details: Optional[Any] = None,
) -> dict[str, Any]:
    """
    Monta o payload padronizado de erro.
    """
    err = ApiError(code=code, message=message, details=details)
    return err.model_dump()


def register_exception_handlers(app: FastAPI) -> None:
    """
    Registra handlers globais no FastAPI.
    """

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        # exc.detail pode ser str/dict/list — mantemos como details se não for string
        if isinstance(exc.detail, str):
            message = exc.detail
            details = None
        else:
            message = "Request failed."
            details = exc.detail if _is_debug() else None

        payload = _error_payload(
            code="http_error",
            message=message,
            details=details,
        )
        return JSONResponse(status_code=exc.status_code, content=payload)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        payload = _error_payload(
            code="validation_error",
            message="Dados inválidos.",
            details=exc.errors(),
        )
        return JSONResponse(status_code=422, content=payload)

    @app.exception_handler(IntegrityError)
    async def integrity_error_handler(request: Request, exc: IntegrityError):
        # Não vazar detalhes sensíveis do banco; em DEBUG pode mostrar
        details = None
        if _is_debug():
            details = str(getattr(exc, "orig", None) or exc)

        payload = _error_payload(
            code="conflict",
            message="Conflito ao salvar no banco de dados.",
            details=details,
        )
        return JSONResponse(status_code=409, content=payload)

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        details = str(exc) if _is_debug() else None
        payload = _error_payload(
            code="internal_error",
            message="Erro interno inesperado.",
            details=details,
        )
        return JSONResponse(status_code=500, content=payload)
