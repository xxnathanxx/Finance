from __future__ import annotations

from tests.conftest import registrar_e_logar


def _criar_categoria(client, headers, nome="Categoria de Teste"):
    resposta = client.post("/categories", json={"name": nome}, headers=headers)
    assert resposta.status_code == 201
    return resposta.json()["id"]


def test_listar_transacoes_sem_autenticacao_retorna_401(client):
    resposta = client.get("/transactions")
    assert resposta.status_code == 401


def test_criar_e_listar_transacao(client, auth_headers):
    categoria_id = _criar_categoria(client, auth_headers)

    resposta = client.post(
        "/transactions",
        json={
            "description": "Compra no mercado",
            "amount": 150.75,
            "type": "expense",
            "category_id": categoria_id,
            "date": "2026-08-05",
        },
        headers=auth_headers,
    )
    assert resposta.status_code == 201

    criada = resposta.json()
    assert criada["description"] == "Compra no mercado"
    assert criada["amount"] == 150.75
    assert criada["type"] == "expense"
    assert criada["category"]["id"] == categoria_id

    listadas = client.get("/transactions", headers=auth_headers).json()
    assert len(listadas) == 1
    assert listadas[0]["id"] == criada["id"]


def test_criar_transacao_com_categoria_inexistente_retorna_400(client, auth_headers):
    resposta = client.post(
        "/transactions",
        json={
            "description": "Gasto qualquer",
            "amount": 10.0,
            "type": "expense",
            "category_id": 999999,
            "date": "2026-08-05",
        },
        headers=auth_headers,
    )
    assert resposta.status_code == 400


def test_criar_transacao_com_tipo_invalido_retorna_422(client, auth_headers):
    resposta = client.post(
        "/transactions",
        json={
            "description": "Tipo errado",
            "amount": 10.0,
            "type": "saida",
            "date": "2026-08-05",
        },
        headers=auth_headers,
    )
    assert resposta.status_code == 422


def test_atualizar_transacao(client, auth_headers):
    categoria_id = _criar_categoria(client, auth_headers)
    criada = client.post(
        "/transactions",
        json={
            "description": "Original",
            "amount": 50.0,
            "type": "expense",
            "category_id": categoria_id,
            "date": "2026-08-01",
        },
        headers=auth_headers,
    ).json()

    resposta = client.patch(
        f"/transactions/{criada['id']}",
        json={"description": "Atualizada", "amount": 75.5},
        headers=auth_headers,
    )
    assert resposta.status_code == 200

    atualizada = resposta.json()
    assert atualizada["description"] == "Atualizada"
    assert atualizada["amount"] == 75.5


def test_deletar_transacao(client, auth_headers):
    categoria_id = _criar_categoria(client, auth_headers)
    criada = client.post(
        "/transactions",
        json={
            "description": "Para apagar",
            "amount": 20.0,
            "type": "income",
            "category_id": categoria_id,
            "date": "2026-08-01",
        },
        headers=auth_headers,
    ).json()

    resposta = client.delete(f"/transactions/{criada['id']}", headers=auth_headers)
    assert resposta.status_code == 204

    listadas = client.get("/transactions", headers=auth_headers).json()
    assert listadas == []


def test_transacao_de_um_usuario_nao_aparece_para_outro(client, auth_headers):
    categoria_id = _criar_categoria(client, auth_headers)
    client.post(
        "/transactions",
        json={
            "description": "Transação do usuário 1",
            "amount": 30.0,
            "type": "expense",
            "category_id": categoria_id,
            "date": "2026-08-01",
        },
        headers=auth_headers,
    )

    headers_outro_usuario = registrar_e_logar(client, "outro.usuario@example.com")
    listadas = client.get("/transactions", headers=headers_outro_usuario).json()
    assert listadas == []
