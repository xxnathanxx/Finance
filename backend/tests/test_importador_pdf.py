from __future__ import annotations

import datetime as dt

from app.services.importador import _extrair_boleto_pdf, _extrair_linhas_pdf_fatura


def test_extrai_linhas_de_fatura_pdf_com_data_completa():
    pagina = (
        "COMPRAS NACIONAIS\n"
        "01/08/2026 IFOOD *IFOOD SAO PAULO 45,90\n"
        "02/08/2026 UBER *TRIP HELP.UBER.COM 18,50\n"
        "SALDO ANTERIOR 120,00\n"
    )
    itens = _extrair_linhas_pdf_fatura([pagina], ano_ref=2026, mes_ref=8)

    assert len(itens) == 2
    assert itens[0].descricao == "IFOOD *IFOOD SAO PAULO"
    assert itens[0].valor == 45.90 or str(itens[0].valor) == "45.90"
    assert itens[0].data == dt.date(2026, 8, 1)
    assert itens[1].data == dt.date(2026, 8, 2)


def test_extrai_linhas_de_fatura_pdf_so_com_dia_mes_usa_mes_referencia():
    pagina = "05/08 FARMACIA DROGASIL 32,10\n"
    itens = _extrair_linhas_pdf_fatura([pagina], ano_ref=2026, mes_ref=8)

    assert len(itens) == 1
    assert itens[0].data == dt.date(2026, 8, 5)


def test_extrai_linhas_de_fatura_pdf_compra_de_dezembro_em_fatura_de_janeiro():
    # fatura fecha em janeiro mas tem uma compra de dezembro do ano anterior
    pagina = "28/12 COMPRA FIM DE ANO 200,00\n"
    itens = _extrair_linhas_pdf_fatura([pagina], ano_ref=2027, mes_ref=1)

    assert len(itens) == 1
    assert itens[0].data == dt.date(2026, 12, 28)


def test_extrai_linhas_de_fatura_pdf_marca_pagamento_como_credito():
    pagina = "10/08/2026 PAGAMENTO RECEBIDO -500,00\n"
    itens = _extrair_linhas_pdf_fatura([pagina], ano_ref=2026, mes_ref=8)

    assert len(itens) == 1
    assert itens[0].credito is True


def test_extrai_linhas_de_fatura_pdf_ignora_linhas_de_totais():
    pagina = (
        "31/08/2026 TOTAL DA FATURA 1.234,56\n"
        "31/08/2026 LIMITE DISPONIVEL 5.000,00\n"
        "01/08/2026 COMPRA VALIDA 10,00\n"
    )
    itens = _extrair_linhas_pdf_fatura([pagina], ano_ref=2026, mes_ref=8)

    assert len(itens) == 1
    assert itens[0].descricao == "COMPRA VALIDA"


def test_extrai_boleto_pdf_com_vencimento_e_valor():
    texto = (
        "COMPANHIA DE ENERGIA\n"
        "Cedente: CEMIG DISTRIBUICAO S.A.\n"
        "Vencimento: 15/09/2026\n"
        "Valor Documento: R$ 189,45\n"
    )
    item = _extrair_boleto_pdf(texto)

    assert item is not None
    assert item.data == dt.date(2026, 9, 15)
    assert float(item.valor) == 189.45
    assert "CEMIG" in item.descricao


def test_extrai_boleto_pdf_sem_vencimento_retorna_none():
    texto = "Documento sem os campos esperados\nValor: 10,00\n"
    item = _extrair_boleto_pdf(texto)
    assert item is None
