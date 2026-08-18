from __future__ import annotations

import datetime as dt

from app.services.importador import _extrair_boleto_pdf, _extrair_holerite_pdf, _extrair_linhas_pdf_fatura


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


# Padrões abaixo replicam formatos reais de fatura testados contra PDFs
# de Bradesco, Caixa e Sicoob (ver histórico da importação).


def test_extrai_linhas_com_sinal_negativo_depois_do_valor_formato_bradesco():
    pagina = "10/07 KARSTEN S.A. BLUMENAU 449,99-\n"
    itens = _extrair_linhas_pdf_fatura([pagina], ano_ref=2026, mes_ref=8)

    assert len(itens) == 1
    assert itens[0].credito is True
    assert float(itens[0].valor) == 449.99


def test_extrai_linhas_com_sufixo_d_ou_c_formato_caixa():
    pagina = "29/06 SUPERMERCADOS BH CONTAGEM 77,42D\n03/07 OBRIGADO PELO PAGAMENTO 1.084,46C\n"
    itens = _extrair_linhas_pdf_fatura([pagina], ano_ref=2026, mes_ref=8)

    # a linha de agradecimento de pagamento é ignorada (não é um gasto)
    assert len(itens) == 1
    assert itens[0].descricao == "SUPERMERCADOS BH CONTAGEM"
    assert itens[0].credito is False
    assert float(itens[0].valor) == 77.42


def test_extrai_linhas_com_data_por_extenso_formato_sicoob():
    pagina = "31 JUL DL*UberRidesV Sao Paulo R$ 7,97\n30 JUL MERCADO*MERCADOLIVRE SAO PAULO -R$ 799,90\n"
    itens = _extrair_linhas_pdf_fatura([pagina], ano_ref=2026, mes_ref=8)

    assert len(itens) == 2
    assert itens[0].data == dt.date(2026, 7, 31)
    assert itens[0].descricao == "DL*UberRidesV Sao Paulo"
    assert itens[1].credito is True


def test_extrai_primeiro_valor_quando_colunas_do_pdf_se_misturam_na_mesma_linha():
    # layout em coluna dupla: a segunda coluna ("Compras R$ 4.996,88") não
    # tem relação com a transação da esquerda - o valor certo é o primeiro
    pagina = "30/06 SUPERMERCADOS BH CONTAGEM 262,02 Compras R$ 4.996,88\n"
    itens = _extrair_linhas_pdf_fatura([pagina], ano_ref=2026, mes_ref=8)

    assert len(itens) == 1
    assert itens[0].descricao == "SUPERMERCADOS BH CONTAGEM"
    assert float(itens[0].valor) == 262.02


def test_ignora_linha_sem_descricao_de_verdade_apos_quebra_de_coluna():
    # a descrição real ("ANUIDADE MASTERCARD") ficou numa linha separada
    # no PDF original - sem ela, só sobra "R$" antes do valor
    pagina = "ANUIDADE MASTERCARD\n02 MAR R$ 35,50\n(5716) 05/12\n"
    itens = _extrair_linhas_pdf_fatura([pagina], ano_ref=2026, mes_ref=8)

    assert len(itens) == 0


# Holerite - o rótulo do líquido e o layout mudam de empresa pra empresa
# (depende do sistema de folha de pagamento), então testamos alguns
# formatos/rótulos comuns.


def test_extrai_holerite_com_rotulo_valor_liquido_e_periodo():
    texto = (
        "00098 EMPRESA EXEMPLO LTDA Demonstrativo de Pagamento de Salário\n"
        "01/07/2026 a 31/07/2026 ADMINISTRACAO 00442351000152\n"
        "001 Salário Base 3.058,05\n"
        "903 INSS Folha 530,88\n"
        "Valor Líquido 4.634,00\n"
    )
    item = _extrair_holerite_pdf(texto)

    assert item is not None
    assert float(item.valor) == 4634.00
    assert item.data == dt.date(2026, 7, 31)
    assert item.credito is True
    assert item.incluir_por_padrao is True
    assert "EMPRESA EXEMPLO LTDA" in item.descricao


def test_extrai_holerite_com_rotulo_liquido_a_receber():
    texto = (
        "Recibo de Pagamento de Salário\n"
        "01/08/2026 a 31/08/2026\n"
        "Líquido a Receber: R$ 2.500,50\n"
    )
    item = _extrair_holerite_pdf(texto)

    assert item is not None
    assert float(item.valor) == 2500.50
    assert item.data == dt.date(2026, 8, 31)


def test_extrai_holerite_com_rotulo_salario_liquido_e_competencia():
    texto = (
        "Contracheque\n"
        "Competência: 09/2026\n"
        "Salário Líquido 3.200,00\n"
    )
    item = _extrair_holerite_pdf(texto)

    assert item is not None
    assert float(item.valor) == 3200.00
    assert item.data == dt.date(2026, 9, 30)


def test_nao_confunde_documento_qualquer_com_holerite():
    # tem um valor parecido mas não é um holerite - não deve confundir
    texto = "Comprovante de transferência\nValor líquido enviado: R$ 100,00\n"
    item = _extrair_holerite_pdf(texto)
    assert item is None


def test_holerite_sem_data_reconhecivel_retorna_none():
    texto = "Demonstrativo de Pagamento de Salário\nValor Líquido 1.000,00\n"
    item = _extrair_holerite_pdf(texto)
    assert item is None
