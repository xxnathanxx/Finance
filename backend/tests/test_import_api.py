from __future__ import annotations

import io

from fpdf import FPDF


def _id_categoria(client, headers, nome: str) -> int:
    resposta = client.get("/categories", headers=headers)
    assert resposta.status_code == 200
    for categoria in resposta.json():
        if categoria["name"] == nome:
            return categoria["id"]
    raise AssertionError(f"Categoria '{nome}' não encontrada nos padrões")


def _upload_csv(client, headers, conteudo: str, nome_arquivo: str = "fatura.csv", mes_referencia: str | None = None):
    arquivos = {"file": (nome_arquivo, io.BytesIO(conteudo.encode("utf-8")), "text/csv")}
    dados = {"mes_referencia": mes_referencia} if mes_referencia else {}
    return client.post("/import/preview", files=arquivos, data=dados, headers=headers)


def _boleto_pdf_criptografado(senha: str) -> bytes:
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=12)
    for linha in ("Cedente: CEMIG DISTRIBUICAO SA", "Vencimento: 15/09/2026", "Valor Documento: R$ 189,45"):
        pdf.cell(0, 10, linha, new_x="LMARGIN", new_y="NEXT")
    pdf.set_encryption(owner_password="dono-qualquer", user_password=senha)
    return bytes(pdf.output())


def _upload_pdf(client, headers, conteudo: bytes, nome_arquivo="boleto.pdf", senha_pdf: str | None = None):
    arquivos = {"file": (nome_arquivo, io.BytesIO(conteudo), "application/pdf")}
    dados = {"senha_pdf": senha_pdf} if senha_pdf else {}
    return client.post("/import/preview", files=arquivos, data=dados, headers=headers)


def test_preview_sem_autenticacao_retorna_401(client):
    resposta = _upload_csv(client, {}, "Data;Descrição;Valor\n01/08/2026;IFOOD;45,90\n")
    assert resposta.status_code == 401


def test_preview_extensao_nao_suportada_retorna_400(client, auth_headers):
    arquivos = {"file": ("fatura.txt", io.BytesIO(b"qualquer coisa"), "text/plain")}
    resposta = client.post("/import/preview", files=arquivos, headers=auth_headers)
    assert resposta.status_code == 400


def test_preview_csv_classifica_por_regra_padrao(client, auth_headers):
    csv_conteudo = (
        "Data;Descrição;Valor\n"
        "01/08/2026;IFOOD *IFOOD SAO PAULO;45,90\n"
        "02/08/2026;UBER *TRIP HELP.UBER.COM;18,50\n"
        "03/08/2026;COMPRA SEM CATEGORIA COMUM;10,00\n"
    )
    resposta = _upload_csv(client, auth_headers, csv_conteudo)
    assert resposta.status_code == 200, resposta.text

    corpo = resposta.json()
    itens = corpo["itens"]
    assert len(itens) == 3

    assert itens[0]["category_name"] == "Alimentação"
    assert itens[0]["valor"] == 45.90
    assert itens[0]["tipo"] == "expense"
    assert itens[0]["incluir"] is True
    assert itens[0]["duplicada"] is False

    assert itens[1]["category_name"] == "Transporte"

    assert itens[2]["category_id"] is None
    assert itens[2]["category_name"] is None


def test_preview_marca_valor_negativo_como_receita(client, auth_headers):
    csv_conteudo = "Data;Descrição;Valor\n05/08/2026;PAGAMENTO RECEBIDO;-500,00\n"
    resposta = _upload_csv(client, auth_headers, csv_conteudo)
    assert resposta.status_code == 200

    item = resposta.json()["itens"][0]
    assert item["tipo"] == "income"
    assert item["valor"] == 500.00


def test_preview_detecta_duplicada_ja_existente_no_banco(client, auth_headers):
    categoria_id = _id_categoria(client, auth_headers, "Mercado")
    resposta_criacao = client.post(
        "/transactions",
        json={
            "description": "Supermercado Extra",
            "amount": 120.50,
            "type": "expense",
            "category_id": categoria_id,
            "date": "2026-08-05",
        },
        headers=auth_headers,
    )
    assert resposta_criacao.status_code == 201

    csv_conteudo = "Data;Descrição;Valor\n05/08/2026;Supermercado Extra;120,50\n"
    resposta = _upload_csv(client, auth_headers, csv_conteudo)
    assert resposta.status_code == 200

    item = resposta.json()["itens"][0]
    assert item["duplicada"] is True
    assert item["incluir"] is False


def test_preview_nao_marca_duplicada_quando_valor_ou_data_diferem(client, auth_headers):
    categoria_id = _id_categoria(client, auth_headers, "Mercado")
    client.post(
        "/transactions",
        json={
            "description": "Supermercado Extra",
            "amount": 120.50,
            "type": "expense",
            "category_id": categoria_id,
            "date": "2026-08-05",
        },
        headers=auth_headers,
    )

    # mesmo estabelecimento, valor diferente -> não é duplicada
    csv_conteudo = "Data;Descrição;Valor\n05/08/2026;Supermercado Extra;80,00\n"
    resposta = _upload_csv(client, auth_headers, csv_conteudo)
    item = resposta.json()["itens"][0]
    assert item["duplicada"] is False
    assert item["incluir"] is True


def test_preview_duas_linhas_identicas_no_mesmo_arquivo_marca_a_segunda_como_duplicada(client, auth_headers):
    csv_conteudo = (
        "Data;Descrição;Valor\n"
        "10/08/2026;NETFLIX.COM;39,90\n"
        "10/08/2026;NETFLIX.COM;39,90\n"
    )
    resposta = _upload_csv(client, auth_headers, csv_conteudo)
    itens = resposta.json()["itens"]
    assert itens[0]["duplicada"] is False
    assert itens[1]["duplicada"] is True


def test_confirmar_importacao_cria_transacoes_e_aprende_regra(client, auth_headers):
    categoria_id = _id_categoria(client, auth_headers, "Educação")

    resposta_confirm = client.post(
        "/import/confirm",
        json={
            "itens": [
                {
                    "descricao": "ACADEMIA SMART FIT UNIDADE CENTRO",
                    "valor": 99.90,
                    "data": "2026-08-01",
                    "tipo": "expense",
                    "category_id": categoria_id,
                }
            ]
        },
        headers=auth_headers,
    )
    assert resposta_confirm.status_code == 201, resposta_confirm.text
    assert resposta_confirm.json()["criadas"] == 1

    resposta_transacoes = client.get("/transactions", headers=auth_headers)
    descricoes = [t["description"] for t in resposta_transacoes.json()]
    assert "ACADEMIA SMART FIT UNIDADE CENTRO" in descricoes

    # nova importação com um estabelecimento parecido deve vir classificada
    # automaticamente pela regra aprendida na confirmação anterior
    csv_conteudo = "Data;Descrição;Valor\n01/09/2026;ACADEMIA SMART FIT UNIDADE CENTRO 2/3;99,90\n"
    resposta_preview = _upload_csv(client, auth_headers, csv_conteudo)
    item = resposta_preview.json()["itens"][0]
    assert item["category_id"] == categoria_id
    assert item["category_name"] == "Educação"


def test_confirmar_importacao_com_categoria_invalida_retorna_400(client, auth_headers):
    resposta = client.post(
        "/import/confirm",
        json={
            "itens": [
                {
                    "descricao": "Compra qualquer",
                    "valor": 10.0,
                    "data": "2026-08-01",
                    "tipo": "expense",
                    "category_id": 999999,
                }
            ]
        },
        headers=auth_headers,
    )
    assert resposta.status_code == 400


def test_preview_aceita_mes_referencia_para_datas_sem_ano(client, auth_headers):
    # linha no formato de fatura PDF já parseada como texto: só dia/mês, sem ano
    csv_conteudo = "Data;Descrição;Valor\n15/08;Compra sem ano;25,00\n"
    resposta = _upload_csv(client, auth_headers, csv_conteudo, mes_referencia="2026-08")
    assert resposta.status_code == 200
    item = resposta.json()["itens"][0]
    assert item["data"] == "2026-08-15"


def test_preview_pdf_protegido_sem_senha_pede_senha(client, auth_headers):
    pdf_bytes = _boleto_pdf_criptografado("segredo123")
    resposta = _upload_pdf(client, auth_headers, pdf_bytes)
    assert resposta.status_code == 400
    assert "senha" in resposta.json()["detail"].lower()


def test_preview_pdf_protegido_com_senha_errada_retorna_400(client, auth_headers):
    pdf_bytes = _boleto_pdf_criptografado("segredo123")
    resposta = _upload_pdf(client, auth_headers, pdf_bytes, senha_pdf="chute-errado")
    assert resposta.status_code == 400
    assert "incorreta" in resposta.json()["detail"].lower()


def test_preview_pdf_protegido_com_senha_certa_extrai_boleto(client, auth_headers):
    pdf_bytes = _boleto_pdf_criptografado("segredo123")
    resposta = _upload_pdf(client, auth_headers, pdf_bytes, senha_pdf="segredo123")
    assert resposta.status_code == 200

    item = resposta.json()["itens"][0]
    assert item["valor"] == 189.45
    assert item["data"] == "2026-09-15"
    assert "CEMIG" in item["descricao"]
