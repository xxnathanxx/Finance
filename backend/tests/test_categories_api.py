from __future__ import annotations


def test_listar_categorias_sem_autenticacao_retorna_401(client):
    resposta = client.get("/categories")
    assert resposta.status_code == 401


def test_listar_categorias_retorna_as_categorias_padrao_ativas(client, auth_headers):
    resposta = client.get("/categories", headers=auth_headers)
    assert resposta.status_code == 200

    categorias = resposta.json()
    assert len(categorias) > 0
    assert all(c["is_active"] for c in categorias)
    nomes = {c["name"] for c in categorias}
    assert "Mercado" in nomes


def test_criar_categoria_nova(client, auth_headers):
    resposta = client.post("/categories", json={"name": "Categoria de Teste"}, headers=auth_headers)
    assert resposta.status_code == 201

    corpo = resposta.json()
    assert corpo["name"] == "Categoria de Teste"
    assert corpo["is_active"] is True


def test_criar_categoria_com_nome_ja_usado_mas_oculta_reativa_em_vez_de_duplicar(client, auth_headers):
    criada = client.post("/categories", json={"name": "Assinaturas de Streaming"}, headers=auth_headers).json()
    client.patch(f"/categories/{criada['id']}/hide", headers=auth_headers)

    resposta = client.post("/categories", json={"name": "Assinaturas de Streaming"}, headers=auth_headers)
    assert resposta.status_code == 201

    corpo = resposta.json()
    assert corpo["id"] == criada["id"]
    assert corpo["is_active"] is True


def test_ocultar_categoria_some_da_listagem_padrao_mas_aparece_com_active_only_false(client, auth_headers):
    criada = client.post("/categories", json={"name": "Vai Sumir"}, headers=auth_headers).json()

    resposta_hide = client.patch(f"/categories/{criada['id']}/hide", headers=auth_headers)
    assert resposta_hide.status_code == 200
    assert resposta_hide.json()["is_active"] is False

    ativas = client.get("/categories", headers=auth_headers).json()
    assert criada["id"] not in [c["id"] for c in ativas]

    todas = client.get("/categories?active_only=false", headers=auth_headers).json()
    assert criada["id"] in [c["id"] for c in todas]


def test_reexibir_categoria_oculta(client, auth_headers):
    criada = client.post("/categories", json={"name": "Vai e Volta"}, headers=auth_headers).json()
    client.patch(f"/categories/{criada['id']}/hide", headers=auth_headers)

    resposta = client.patch(f"/categories/{criada['id']}/show", headers=auth_headers)
    assert resposta.status_code == 200
    assert resposta.json()["is_active"] is True


def test_deletar_categoria(client, auth_headers):
    criada = client.post("/categories", json={"name": "Vai Ser Apagada"}, headers=auth_headers).json()

    resposta = client.delete(f"/categories/{criada['id']}", headers=auth_headers)
    assert resposta.status_code == 204

    todas = client.get("/categories?active_only=false", headers=auth_headers).json()
    assert criada["id"] not in [c["id"] for c in todas]


def test_atualizar_nome_de_categoria_com_nome_duplicado_falha(client, auth_headers):
    a = client.post("/categories", json={"name": "Categoria A"}, headers=auth_headers).json()
    b = client.post("/categories", json={"name": "Categoria B"}, headers=auth_headers).json()

    resposta = client.patch(f"/categories/{b['id']}", json={"name": "Categoria A"}, headers=auth_headers)
    assert resposta.status_code == 409
    assert a["name"] == "Categoria A"
