from __future__ import annotations


def _criar_categoria(client, headers, nome="Categoria de Teste"):
    resposta = client.post("/categories", json={"name": nome}, headers=headers)
    assert resposta.status_code == 201
    return resposta.json()["id"]


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


def test_relatorio_mensal_sem_autenticacao_retorna_401(client):
    resposta = client.get("/reports/monthly/2026/8")
    assert resposta.status_code == 401


def test_relatorio_mensal_com_mes_invalido_retorna_400(client, auth_headers):
    resposta = client.get("/reports/monthly/2026/13", headers=auth_headers)
    assert resposta.status_code == 400


def test_relatorio_mensal_soma_receitas_e_despesas_do_mes(client, auth_headers):
    categoria_id = _criar_categoria(client, auth_headers)
    _criar_transacao(client, auth_headers, type="income", amount=3000.0, date="2026-08-01")
    _criar_transacao(client, auth_headers, type="expense", amount=800.0, category_id=categoria_id, date="2026-08-10")
    # fora do mês - não deve entrar na soma
    _criar_transacao(client, auth_headers, type="expense", amount=500.0, date="2026-07-20")

    resposta = client.get("/reports/monthly/2026/8", headers=auth_headers)
    assert resposta.status_code == 200

    corpo = resposta.json()
    assert corpo["month"] == "2026-08"
    assert corpo["total_income"] == 3000.0
    assert corpo["total_expense"] == 800.0
    assert corpo["balance"] == 2200.0
    assert len(corpo["expenses_by_category"]) == 1
    assert corpo["expenses_by_category"][0]["total"] == 800.0


def test_relatorio_por_periodo_sem_autenticacao_retorna_401(client):
    resposta = client.get("/reports/period", params={"start": "2026-08-01", "end": "2026-08-31"})
    assert resposta.status_code == 401


def test_relatorio_por_periodo_com_data_final_antes_da_inicial_retorna_400(client, auth_headers):
    resposta = client.get(
        "/reports/period", params={"start": "2026-08-10", "end": "2026-08-01"}, headers=auth_headers
    )
    assert resposta.status_code == 400


def test_relatorio_por_periodo_filtra_intervalo_exclusivo_no_fim(client, auth_headers):
    _criar_transacao(client, auth_headers, type="expense", amount=100.0, date="2026-08-01")
    _criar_transacao(client, auth_headers, type="expense", amount=200.0, date="2026-08-07")
    # no dia "end" exato - não deve entrar (intervalo é [start, end))
    _criar_transacao(client, auth_headers, type="expense", amount=999.0, date="2026-08-08")

    resposta = client.get(
        "/reports/period", params={"start": "2026-08-01", "end": "2026-08-08"}, headers=auth_headers
    )
    assert resposta.status_code == 200

    corpo = resposta.json()
    assert corpo["start_date"] == "2026-08-01"
    assert corpo["end_date"] == "2026-08-08"
    assert corpo["total_expense"] == 300.0


def test_relatorio_por_periodo_anual(client, auth_headers):
    _criar_transacao(client, auth_headers, type="income", amount=1000.0, date="2026-02-10")
    _criar_transacao(client, auth_headers, type="income", amount=1000.0, date="2026-11-20")
    _criar_transacao(client, auth_headers, type="expense", amount=500.0, date="2026-06-01")

    resposta = client.get(
        "/reports/period", params={"start": "2026-01-01", "end": "2027-01-01"}, headers=auth_headers
    )
    assert resposta.status_code == 200

    corpo = resposta.json()
    assert corpo["total_income"] == 2000.0
    assert corpo["total_expense"] == 500.0
    assert corpo["balance"] == 1500.0
