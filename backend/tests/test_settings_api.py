from __future__ import annotations


def test_obter_meta_sem_autenticacao_retorna_401(client):
    resposta = client.get("/settings")
    assert resposta.status_code == 401


def test_obter_meta_sem_ter_configurado_retorna_nulo(client, auth_headers):
    resposta = client.get("/settings", headers=auth_headers)
    assert resposta.status_code == 200
    assert resposta.json() == {"monthly_goal": None}


def test_definir_meta_e_depois_ler(client, auth_headers):
    resposta = client.put("/settings", json={"monthly_goal": 500.0}, headers=auth_headers)
    assert resposta.status_code == 200
    assert resposta.json() == {"monthly_goal": 500.0}

    resposta_get = client.get("/settings", headers=auth_headers)
    assert resposta_get.json() == {"monthly_goal": 500.0}


def test_atualizar_meta_existente_sobrescreve(client, auth_headers):
    client.put("/settings", json={"monthly_goal": 500.0}, headers=auth_headers)
    resposta = client.put("/settings", json={"monthly_goal": 1200.0}, headers=auth_headers)
    assert resposta.status_code == 200
    assert resposta.json() == {"monthly_goal": 1200.0}


def test_definir_meta_com_valor_invalido_retorna_422(client, auth_headers):
    resposta = client.put("/settings", json={"monthly_goal": -100.0}, headers=auth_headers)
    assert resposta.status_code == 422


def test_meta_de_um_usuario_nao_afeta_outro(client, auth_headers):
    from tests.conftest import registrar_e_logar

    client.put("/settings", json={"monthly_goal": 500.0}, headers=auth_headers)

    headers_outro_usuario = registrar_e_logar(client, "outro.usuario.meta@example.com")
    resposta = client.get("/settings", headers=headers_outro_usuario)
    assert resposta.json() == {"monthly_goal": None}
