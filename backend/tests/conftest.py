import os
import pathlib
import tempfile

_CAMINHO_DB_TESTE = pathlib.Path(tempfile.gettempdir()) / "finance_test.db"
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_CAMINHO_DB_TESTE.as_posix()}")
os.environ.setdefault("JWT_SECRET_KEY", "chave-secreta-de-teste-usada-so-nos-testes")

import pytest
from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app


@pytest.fixture()
def client():
    """
    Cliente de teste com um banco SQLite recriado do zero a cada teste.
    """
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    with TestClient(app) as test_client:
        yield test_client


def registrar_e_logar(client: TestClient, email: str, senha: str = "senha-forte-123") -> dict[str, str]:
    """
    Registra um usuário novo, loga, e retorna o header de Authorization pronto.
    """
    resposta_registro = client.post(
        "/auth/register",
        json={"email": email, "password": senha, "name": "Usuário de Teste"},
    )
    assert resposta_registro.status_code == 201, resposta_registro.text

    resposta_login = client.post(
        "/auth/login",
        data={"username": email, "password": senha},
    )
    assert resposta_login.status_code == 200, resposta_login.text

    token = resposta_login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def auth_headers(client) -> dict[str, str]:
    return registrar_e_logar(client, "usuario.teste@example.com")
