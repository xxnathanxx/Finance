from __future__ import annotations

from tests.conftest import registrar_e_logar


def _id_categoria(client, headers, nome: str) -> int:
    resposta = client.get("/categories", headers=headers)
    assert resposta.status_code == 200
    for categoria in resposta.json():
        if categoria["name"] == nome:
            return categoria["id"]
    raise AssertionError(f"Categoria '{nome}' não encontrada")


def _criar_transacao(client, headers, **kwargs):
    payload = {
        "description": "Transação de teste",
        "amount": 100.0,
        "type": "expense",
        "category_id": None,
        "date": "2026-08-15",
    }
    payload.update(kwargs)
    resposta = client.post("/transactions", json=payload, headers=headers)
    assert resposta.status_code == 201
    return resposta.json()


def test_limpar_transacoes_sem_autenticacao_retorna_401(client):
    resposta = client.delete("/account/transactions")
    assert resposta.status_code == 401


def test_limpar_transacoes_apaga_todas_do_usuario(client, auth_headers):
    _criar_transacao(client, auth_headers, description="A")
    _criar_transacao(client, auth_headers, description="B")

    resposta = client.delete("/account/transactions", headers=auth_headers)
    assert resposta.status_code == 200
    assert resposta.json()["transacoes_apagadas"] == 2

    resposta_lista = client.get("/transactions", headers=auth_headers)
    assert resposta_lista.json() == []


def test_limpar_transacoes_nao_afeta_outro_usuario(client, auth_headers):
    headers_b = registrar_e_logar(client, "outro.usuario@example.com")
    _criar_transacao(client, auth_headers, description="Minha")
    _criar_transacao(client, headers_b, description="Do outro usuário")

    client.delete("/account/transactions", headers=auth_headers)

    minhas = client.get("/transactions", headers=auth_headers).json()
    do_outro = client.get("/transactions", headers=headers_b).json()
    assert minhas == []
    assert len(do_outro) == 1
    assert do_outro[0]["description"] == "Do outro usuário"


def test_limpar_transacoes_mantem_categorias_e_meta(client, auth_headers):
    _criar_transacao(client, auth_headers)
    client.put("/settings", json={"monthly_goal": 500}, headers=auth_headers)

    client.delete("/account/transactions", headers=auth_headers)

    categorias = client.get("/categories", headers=auth_headers).json()
    assert len(categorias) > 0

    settings = client.get("/settings", headers=auth_headers).json()
    assert settings["monthly_goal"] == 500.0


def test_restaurar_padrao_sem_autenticacao_retorna_401(client):
    resposta = client.delete("/account/reset")
    assert resposta.status_code == 401


def test_restaurar_padrao_apaga_transacoes_e_meta(client, auth_headers):
    _criar_transacao(client, auth_headers)
    client.put("/settings", json={"monthly_goal": 500}, headers=auth_headers)

    resposta = client.delete("/account/reset", headers=auth_headers)
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["transacoes_apagadas"] == 1

    assert client.get("/transactions", headers=auth_headers).json() == []

    settings = client.get("/settings", headers=auth_headers).json()
    assert settings["monthly_goal"] is None


def test_restaurar_padrao_remove_categoria_customizada_e_restaura_renomeada(client, auth_headers):
    client.post("/categories", json={"name": "Categoria Bem Específica Minha"}, headers=auth_headers)

    id_mercado = _id_categoria(client, auth_headers, "Mercado")
    client.patch(f"/categories/{id_mercado}", json={"name": "Compras da Casa"}, headers=auth_headers)

    resposta = client.delete("/account/reset", headers=auth_headers)
    assert resposta.status_code == 200
    assert resposta.json()["categorias_removidas"] >= 1

    nomes = {c["name"] for c in client.get("/categories", headers=auth_headers).json()}
    assert "Categoria Bem Específica Minha" not in nomes
    assert "Compras da Casa" not in nomes
    assert "Mercado" in nomes


def test_restaurar_padrao_esquece_regra_de_importacao_aprendida(client, auth_headers):
    categoria_id = _id_categoria(client, auth_headers, "Educação")

    client.post(
        "/import/confirm",
        json={
            "itens": [
                {
                    "descricao": "ACADEMIA SMART FIT",
                    "valor": 99.90,
                    "data": "2026-08-01",
                    "tipo": "expense",
                    "category_id": categoria_id,
                }
            ]
        },
        headers=auth_headers,
    )

    client.delete("/account/reset", headers=auth_headers)

    import io

    csv_conteudo = "Data;Descrição;Valor\n01/09/2026;ACADEMIA SMART FIT;99,90\n"
    arquivos = {"file": ("fatura.csv", io.BytesIO(csv_conteudo.encode("utf-8")), "text/csv")}
    resposta = client.post("/import/preview", files=arquivos, headers=auth_headers)
    item = resposta.json()["itens"][0]
    assert item["category_id"] is None


def test_restaurar_padrao_nao_afeta_transacoes_de_outro_usuario(client, auth_headers):
    headers_b = registrar_e_logar(client, "outro.usuario2@example.com")
    _criar_transacao(client, auth_headers, description="Minha")
    _criar_transacao(client, headers_b, description="Do outro usuário")

    client.delete("/account/reset", headers=auth_headers)

    do_outro = client.get("/transactions", headers=headers_b).json()
    assert len(do_outro) == 1
    assert do_outro[0]["description"] == "Do outro usuário"
