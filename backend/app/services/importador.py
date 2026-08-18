"""
Importação de fatura de cartão, extrato (CSV/Excel/PDF) ou boleto avulso
(conta de luz, água, telefone etc).

Fluxo:
1. `processar_arquivo` extrai as transações do arquivo e sugere uma
   categoria pra cada uma (regra aprendida do usuário > regra padrão
   embutida > sem categoria).
2. O usuário revisa/ajusta na tela antes de confirmar - nada é salvo
   nessa etapa.
3. Ao confirmar (rota separada), pra cada item com categoria escolhida
   guardamos/atualizamos uma regra aprendida (`ImportRule`), pra próxima
   importação já vir classificada certa sem precisar ajustar de novo.
"""
from __future__ import annotations

import csv
import datetime as dt
import io
import re
import unicodedata
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

import openpyxl
import pdfplumber
from pdfminer.pdfdocument import PDFPasswordIncorrect
from pdfplumber.utils.exceptions import PdfminerException
from sqlalchemy.orm import Session

from app.models import Category, ImportRule, Transaction
from app.schemas import ItemImportado

EXTENSOES_SUPORTADAS = ("csv", "xlsx", "xls", "pdf")


# =========================
# Normalização de texto
# =========================

def _normalizar(texto: str) -> str:
    """Maiúsculo, sem acento, espaços colapsados - usado pra comparar descrições."""
    texto = unicodedata.normalize("NFKD", texto)
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    texto = re.sub(r"\s+", " ", texto).strip().upper()
    return texto


def extrair_palavra_chave(descricao: str) -> str:
    """
    A partir de uma descrição já confirmada pelo usuário, monta a
    palavra-chave que vai virar uma regra aprendida: remove sufixos tipo
    número de parcela, código de autorização e UF, pra generalizar entre
    compras do mesmo estabelecimento.
    """
    texto = _normalizar(descricao)
    texto = re.sub(r"\s*\d{1,2}/\d{1,2}\s*$", "", texto)
    texto = re.sub(r"\s*\*\S+$", "", texto)
    texto = re.sub(r"\s+[A-Z]{2}$", "", texto)
    texto = re.sub(r"\s+\d{4,}$", "", texto)
    return texto.strip()


# =========================
# Regras padrão (built-in) - usadas quando não existe regra aprendida
# =========================

REGRAS_PADRAO: dict[str, str] = {
    # Alimentação
    "IFOOD": "Alimentação",
    "RAPPI": "Alimentação",
    "UBER EATS": "Alimentação",
    "MCDONALD": "Alimentação",
    "BURGER KING": "Alimentação",
    "HABIBS": "Alimentação",
    "RESTAURANTE": "Alimentação",
    "PADARIA": "Alimentação",
    "LANCHONETE": "Alimentação",
    "PIZZARIA": "Alimentação",
    # Transporte
    "UBER": "Transporte",
    "99APP": "Transporte",
    "99POP": "Transporte",
    "CABIFY": "Transporte",
    "METRO": "Transporte",
    "BILHETE UNICO": "Transporte",
    "ESTACIONAMENTO": "Transporte",
    "PEDAGIO": "Transporte",
    "SEM PARAR": "Transporte",
    # Combustível
    "POSTO": "Combustível",
    "SHELL": "Combustível",
    "IPIRANGA": "Combustível",
    "PETROBRAS": "Combustível",
    "ALESAT": "Combustível",
    "RAIZEN": "Combustível",
    # Mercado
    "MERCADO": "Mercado",
    "SUPERMERCADO": "Mercado",
    "PAO DE ACUCAR": "Mercado",
    "CARREFOUR": "Mercado",
    "EXTRA": "Mercado",
    "ATACADAO": "Mercado",
    "ASSAI": "Mercado",
    "DIA SUPERMERCADO": "Mercado",
    "HORTIFRUTI": "Mercado",
    # Saúde
    "FARMACIA": "Saúde",
    "DROGARIA": "Saúde",
    "DROGASIL": "Saúde",
    "PAGUE MENOS": "Saúde",
    "PACHECO": "Saúde",
    "HOSPITAL": "Saúde",
    "CLINICA": "Saúde",
    "LABORATORIO": "Saúde",
    "ODONTO": "Saúde",
    # Assinaturas
    "NETFLIX": "Assinaturas",
    "SPOTIFY": "Assinaturas",
    "DISNEY PLUS": "Assinaturas",
    "AMAZON PRIME": "Assinaturas",
    "HBO MAX": "Assinaturas",
    "YOUTUBE PREMIUM": "Assinaturas",
    "PARAMOUNT": "Assinaturas",
    "ICLOUD": "Assinaturas",
    "GOOGLE ONE": "Assinaturas",
    "DEEZER": "Assinaturas",
    # Lazer
    "CINEMA": "Lazer",
    "INGRESSO": "Lazer",
    "STEAM": "Lazer",
    "PLAYSTATION": "Lazer",
    "XBOX": "Lazer",
    "NINTENDO": "Lazer",
    # Contas (luz, água, telefone, internet, tv por assinatura)
    "CEMIG": "Contas",
    "ENEL": "Contas",
    "COPEL": "Contas",
    "LIGHT SA": "Contas",
    "CPFL": "Contas",
    "EQUATORIAL": "Contas",
    "ELEKTRO": "Contas",
    "CELESC": "Contas",
    "COELBA": "Contas",
    "SABESP": "Contas",
    "COPASA": "Contas",
    "CEDAE": "Contas",
    "CAESB": "Contas",
    "EMBASA": "Contas",
    "CAGECE": "Contas",
    "VIVO": "Contas",
    "CLARO": "Contas",
    "TIM": "Contas",
    "OI SA": "Contas",
    "ALGAR": "Contas",
    "SKY": "Contas",
    "NET SERVICOS": "Contas",
    # Pets
    "PETSHOP": "Pets",
    "PET SHOP": "Pets",
    "COBASI": "Pets",
    "PETZ": "Pets",
    # Educação
    "ESCOLA": "Educação",
    "FACULDADE": "Educação",
    "UDEMY": "Educação",
    "ALURA": "Educação",
    # Salário / Investimentos (receitas comuns em extrato)
    "SALARIO": "Salário",
    "FOLHA PAGAMENTO": "Salário",
    "RENDIMENTO": "Investimentos",
}


def _classificar_por_regra_padrao(descricao_normalizada: str, categorias_por_nome: dict[str, Category]) -> Category | None:
    melhor: tuple[int, str] | None = None
    for chave, nome_categoria in REGRAS_PADRAO.items():
        if re.search(rf"\b{re.escape(chave)}\b", descricao_normalizada):
            if melhor is None or len(chave) > melhor[0]:
                melhor = (len(chave), nome_categoria)
    if melhor:
        return categorias_por_nome.get(melhor[1])
    return None


def classificar(
    descricao: str,
    regras_usuario: list[ImportRule],
    categorias_por_nome: dict[str, Category],
) -> Category | None:
    normalizada = _normalizar(descricao)

    for regra in regras_usuario:  # já ordenadas da mais específica pra menos específica
        if regra.keyword and regra.keyword in normalizada:
            return regra.category

    return _classificar_por_regra_padrao(normalizada, categorias_por_nome)


# =========================
# Valor / data (formato brasileiro)
# =========================

def _parse_valor_brl(texto: str) -> Decimal | None:
    if texto is None:
        return None
    texto = str(texto).strip()
    if not texto:
        return None

    texto = re.sub(r"[R$\s]", "", texto, flags=re.IGNORECASE)
    negativo = texto.startswith("-") or (texto.startswith("(") and texto.endswith(")"))
    texto = texto.strip("-()")
    if not texto:
        return None

    if "," in texto:
        texto = texto.replace(".", "").replace(",", ".")

    try:
        valor = Decimal(texto)
    except InvalidOperation:
        return None

    return -valor if negativo else valor


_FORMATOS_DATA = ("%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d", "%d-%m-%Y")


def _resolver_ano(mes: int, mes_ref: int, ano_ref: int) -> int:
    # se o mês da transação for bem maior que o mês de referência,
    # provavelmente é do ano anterior (ex: compra em dezembro numa fatura de janeiro)
    if mes - mes_ref > 6:
        return ano_ref - 1
    if mes_ref - mes > 6:
        return ano_ref + 1
    return ano_ref


def _parse_data(texto: str, ano_ref: int | None = None, mes_ref: int | None = None) -> dt.date | None:
    if texto is None:
        return None
    texto = str(texto).strip()
    if not texto:
        return None

    for fmt in _FORMATOS_DATA:
        try:
            return dt.datetime.strptime(texto, fmt).date()
        except ValueError:
            continue

    m = re.match(r"^(\d{1,2})/(\d{1,2})$", texto)
    if m:
        dia, mes = int(m.group(1)), int(m.group(2))
        ano = _resolver_ano(mes, mes_ref, ano_ref) if (ano_ref and mes_ref) else dt.date.today().year
        try:
            return dt.date(ano, mes, dia)
        except ValueError:
            return None

    return None


# =========================
# Item bruto (antes de virar ItemImportado)
# =========================

@dataclass
class ItemBruto:
    descricao: str
    valor: Decimal
    data: dt.date
    credito: bool = False  # linha negativa na fatura (pagamento/estorno)


# =========================
# CSV / Excel
# =========================

_COLUNAS_DATA = ("data", "dt lancamento", "date")
_COLUNAS_DESCRICAO = ("descri", "estabelecimento", "historico", "lancamento", "local", "title")
_COLUNAS_VALOR = ("valor", "montante", "amount", "vlr")


def _achar_coluna(cabecalho: list[str], candidatos: tuple[str, ...]) -> int | None:
    normalizados = [_normalizar(c).lower() for c in cabecalho]
    for i, col in enumerate(normalizados):
        if any(cand in col for cand in candidatos):
            return i
    return None


def _decodificar(conteudo: bytes) -> str:
    for codificacao in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return conteudo.decode(codificacao)
        except UnicodeDecodeError:
            continue
    return conteudo.decode("utf-8", errors="replace")


def _detectar_delimitador(texto: str) -> str:
    amostra = texto[:4096]
    try:
        return csv.Sniffer().sniff(amostra, delimiters=";,\t").delimiter
    except csv.Error:
        return ";" if amostra.count(";") >= amostra.count(",") else ","


def _parsear_csv(conteudo: bytes, ano_ref: int | None, mes_ref: int | None) -> list[ItemBruto]:
    texto = _decodificar(conteudo)
    delimitador = _detectar_delimitador(texto)
    leitor = csv.reader(io.StringIO(texto), delimiter=delimitador)
    linhas = [l for l in leitor if any(c.strip() for c in l)]
    if not linhas:
        return []

    cabecalho = linhas[0]
    idx_data = _achar_coluna(cabecalho, _COLUNAS_DATA)
    idx_descricao = _achar_coluna(cabecalho, _COLUNAS_DESCRICAO)
    idx_valor = _achar_coluna(cabecalho, _COLUNAS_VALOR)

    inicio = 1
    if idx_data is None or idx_descricao is None or idx_valor is None:
        idx_data, idx_descricao, idx_valor = 0, 1, 2
        inicio = 0

    brutos: list[ItemBruto] = []
    for linha in linhas[inicio:]:
        if len(linha) <= max(idx_data, idx_descricao, idx_valor):
            continue
        item = _linha_para_item(linha[idx_data], linha[idx_descricao], linha[idx_valor], ano_ref, mes_ref)
        if item:
            brutos.append(item)
    return brutos


def _parsear_xlsx(conteudo: bytes, ano_ref: int | None, mes_ref: int | None) -> list[ItemBruto]:
    pasta = openpyxl.load_workbook(io.BytesIO(conteudo), data_only=True)
    planilha = pasta.active
    linhas = [list(l) for l in planilha.iter_rows(values_only=True)]
    linhas = [l for l in linhas if any(c is not None and str(c).strip() for c in l)]
    if not linhas:
        return []

    cabecalho = [str(c) if c is not None else "" for c in linhas[0]]
    idx_data = _achar_coluna(cabecalho, _COLUNAS_DATA)
    idx_descricao = _achar_coluna(cabecalho, _COLUNAS_DESCRICAO)
    idx_valor = _achar_coluna(cabecalho, _COLUNAS_VALOR)

    inicio = 1
    if idx_data is None or idx_descricao is None or idx_valor is None:
        idx_data, idx_descricao, idx_valor = 0, 1, 2
        inicio = 0

    brutos: list[ItemBruto] = []
    for linha in linhas[inicio:]:
        if len(linha) <= max(idx_data, idx_descricao, idx_valor):
            continue
        item = _linha_para_item(linha[idx_data], linha[idx_descricao], linha[idx_valor], ano_ref, mes_ref)
        if item:
            brutos.append(item)
    return brutos


def _linha_para_item(valor_data, valor_descricao, valor_valor, ano_ref, mes_ref) -> ItemBruto | None:
    if isinstance(valor_data, dt.datetime):
        data = valor_data.date()
    elif isinstance(valor_data, dt.date):
        data = valor_data
    else:
        data = _parse_data(valor_data, ano_ref, mes_ref)

    if isinstance(valor_valor, (int, float, Decimal)):
        valor = Decimal(str(valor_valor))
    else:
        valor = _parse_valor_brl(valor_valor)

    descricao = str(valor_descricao).strip() if valor_descricao is not None else ""

    if not data or valor is None or valor == 0 or not descricao:
        return None

    return ItemBruto(descricao=descricao, valor=abs(valor), data=data, credito=(valor < 0))


# =========================
# PDF - fatura com várias linhas
#
# Bancos diferentes formatam a linha de lançamento de jeitos bem
# diferentes - testado contra faturas reais de Bradesco, Caixa e
# Sicoob:
#   - data numérica "dd/mm" ou nome do mês "dd MES" (ex: "30 JUL")
#   - valor com "R$" ou sem, com separador de milhar por ponto
#   - crédito/estorno indicado de formas diferentes: sinal "-" antes
#     do valor (Sicoob: "-R$ 799,90"), sinal "-" depois do valor
#     (Bradesco: "757,49-"), ou sufixo D/C colado no valor (Caixa:
#     "77,42D" débito, "1.084,46C" crédito)
# =========================

_MESES_ABREV = {
    "JAN": 1, "FEV": 2, "MAR": 3, "ABR": 4, "MAI": 5, "JUN": 6,
    "JUL": 7, "AGO": 8, "SET": 9, "OUT": 10, "NOV": 11, "DEZ": 12,
}


# Não ancora no fim da linha ($) de propósito: faturas com layout em
# colunas (ex: Bradesco) às vezes colam uma segunda coluna sem relação
# na mesma linha de texto extraído ("30/06 MERCADO 262,02 Compras R$
# 4.996,88") - pegando o primeiro valor depois da descrição (e não o
# último da linha) a gente acerta o valor real da transação.
_FIM_LINHA_VALOR = r"\s+(?P<sinal_pre>-\s?)?R?\$?\s?(?P<valor>\d{1,3}(?:\.\d{3})*,\d{2})(?P<sinal_pos>[-DC])?"

_LINHA_DATA_NUMERICA_RE = re.compile(
    r"^(?P<data>\d{2}/\d{2}(?:/\d{2,4})?)\s+(?P<descricao>.+?)" + _FIM_LINHA_VALOR
)

_LINHA_DATA_MES_NOME_RE = re.compile(
    r"^(?P<dia>\d{1,2})\s+(?P<mes_nome>JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s+(?P<descricao>.+?)"
    + _FIM_LINHA_VALOR,
    re.IGNORECASE,
)

_LINHAS_IGNORAR = (
    "SALDO ANTERIOR",
    "SALDO ATUAL",
    "TOTAL DA FATURA",
    "TOTAL DESTA FATURA",
    "FATURA ANTERIOR",
    "LIMITE DISPONIVEL",
    "LIMITE TOTAL",
    "PAGAMENTO MINIMO",
    "PAGAMENTOS RECEBIDOS",
    "PAGAMENTO-BOLETO",
    "PAGAMENTO BOLETO",
    "PAGTO. POR DEB",
    "OBRIGADO PELO PAGAMENTO",
    "TOTAL DE ENCARGOS",
    "VALOR TOTAL",
    "ENCARGOS DE ATRASO",
)


def _resolver_credito(sinal_pre: str | None, sinal_pos: str | None) -> bool:
    if sinal_pre:
        return True
    if sinal_pos and sinal_pos.upper() in ("-", "C"):
        return True
    return False


def _extrair_linhas_pdf_fatura(paginas_texto: list[str], ano_ref: int | None, mes_ref: int | None) -> list[ItemBruto]:
    itens: list[ItemBruto] = []
    for pagina in paginas_texto:
        for linha in pagina.splitlines():
            linha = linha.strip()
            if not linha:
                continue

            m = _LINHA_DATA_NUMERICA_RE.match(linha)
            if m:
                data_txt = m.group("data")
                if data_txt.count("/") == 1:
                    dia, mes = map(int, data_txt.split("/"))
                    if not (ano_ref and mes_ref):
                        continue
                    ano = _resolver_ano(mes, mes_ref, ano_ref)
                else:
                    partes = data_txt.split("/")
                    dia, mes, ano = int(partes[0]), int(partes[1]), int(partes[2])
                    if ano < 100:
                        ano += 2000
            else:
                m = _LINHA_DATA_MES_NOME_RE.match(linha)
                if not m:
                    continue
                dia = int(m.group("dia"))
                mes = _MESES_ABREV[m.group("mes_nome").upper()]
                if not (ano_ref and mes_ref):
                    continue
                ano = _resolver_ano(mes, mes_ref, ano_ref)

            descricao = m.group("descricao").strip()
            if re.fullmatch(r"-?\s*R\$?", descricao, re.IGNORECASE) or not re.search(r"[A-Za-zÀ-ÿ]", descricao):
                # só sobrou "R$"/"-R$" (ou nenhuma letra) - a descrição de
                # verdade ficou numa coluna/linha separada no PDF original;
                # sem ela não dá pra confiar nem no valor encontrado
                continue

            normalizada = _normalizar(descricao)
            if any(ignorar in normalizada for ignorar in _LINHAS_IGNORAR):
                continue

            try:
                data = dt.date(ano, mes, dia)
            except ValueError:
                continue

            valor = _parse_valor_brl(m.group("valor"))
            if valor is None or valor == 0:
                continue

            credito = _resolver_credito(m.group("sinal_pre"), m.group("sinal_pos"))
            itens.append(ItemBruto(descricao=descricao, valor=abs(valor), data=data, credito=credito))

    return itens


# =========================
# PDF - boleto avulso (conta de luz, água, telefone etc)
# =========================

_VENCIMENTO_RE = re.compile(r"vencimento[:\s]*?(\d{2}/\d{2}/\d{2,4})", re.IGNORECASE)
_VALOR_DOCUMENTO_RE = re.compile(r"valor(?:\s+do)?\s+documento[:\s]*R?\$?\s*([\d.,]+)", re.IGNORECASE)
_CEDENTE_RE = re.compile(r"cedente[:\s]*([^\n]+)", re.IGNORECASE)
_SACADO_RE = re.compile(r"(?:beneficiario|sacado)[:\s]*([^\n]+)", re.IGNORECASE)


def _extrair_boleto_pdf(texto_completo: str) -> ItemBruto | None:
    m_venc = _VENCIMENTO_RE.search(texto_completo)
    m_valor = _VALOR_DOCUMENTO_RE.search(texto_completo)
    if not m_venc or not m_valor:
        return None

    data = _parse_data(m_venc.group(1))
    valor = _parse_valor_brl(m_valor.group(1))
    if not data or valor is None or valor == 0:
        return None

    m_nome = _CEDENTE_RE.search(texto_completo) or _SACADO_RE.search(texto_completo)
    descricao = m_nome.group(1).strip()[:80] if m_nome else "Conta importada"

    return ItemBruto(descricao=descricao, valor=abs(valor), data=data, credito=False)


def _eh_erro_de_senha(e: Exception) -> bool:
    if isinstance(e, PDFPasswordIncorrect):
        return True
    if isinstance(e, PdfminerException) and e.args and isinstance(e.args[0], PDFPasswordIncorrect):
        return True
    return False


def _parsear_pdf(conteudo: bytes, ano_ref: int | None, mes_ref: int | None, senha: str | None = None) -> list[ItemBruto]:
    paginas_texto: list[str] = []
    try:
        with pdfplumber.open(io.BytesIO(conteudo), password=senha or "") as pdf:
            for pagina in pdf.pages:
                paginas_texto.append(pagina.extract_text() or "")
    except Exception as e:
        if _eh_erro_de_senha(e):
            if senha:
                raise ValueError("A senha informada está incorreta.")
            raise ValueError("Esse PDF é protegido por senha. Informe a senha pra continuar.")
        raise

    itens = _extrair_linhas_pdf_fatura(paginas_texto, ano_ref, mes_ref)
    if len(itens) >= 2:
        return itens

    boleto = _extrair_boleto_pdf("\n".join(paginas_texto))
    if boleto:
        return [boleto]

    return itens


# =========================
# Duplicadas
# =========================

def _ja_existe_no_banco(
    db: Session, user_id: int, data: dt.date, valor: Decimal, descricao_normalizada: str, credito: bool
) -> bool:
    tipo_esperado = "income" if credito else "expense"
    candidatos = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id, Transaction.date == data, Transaction.type == tipo_esperado)
        .all()
    )
    for t in candidatos:
        if Decimal(str(t.value)) == valor and _normalizar(t.description) == descricao_normalizada:
            return True
    return False


# =========================
# Orquestração
# =========================

def processar_arquivo(
    db: Session,
    user_id: int,
    nome_arquivo: str,
    conteudo: bytes,
    mes_referencia: str | None = None,
    senha_pdf: str | None = None,
) -> tuple[list[ItemImportado], list[str]]:
    avisos: list[str] = []
    extensao = nome_arquivo.rsplit(".", 1)[-1].lower() if "." in nome_arquivo else ""

    if extensao not in EXTENSOES_SUPORTADAS:
        raise ValueError("Formato de arquivo não suportado. Envie um CSV, Excel (.xlsx) ou PDF.")

    ano_ref = mes_ref = None
    if mes_referencia:
        try:
            ano_ref, mes_ref = (int(p) for p in mes_referencia.split("-"))
        except ValueError:
            pass

    if extensao == "csv":
        brutos = _parsear_csv(conteudo, ano_ref, mes_ref)
    elif extensao in ("xlsx", "xls"):
        brutos = _parsear_xlsx(conteudo, ano_ref, mes_ref)
    else:
        brutos = _parsear_pdf(conteudo, ano_ref, mes_ref, senha_pdf)

    if not brutos:
        avisos.append(
            "Não encontrei nenhuma transação nesse arquivo. Confira se é o arquivo certo "
            "(em PDFs, o layout varia de banco pra banco e nem sempre dá pra ler automaticamente)."
        )
        return [], avisos

    categorias_por_nome = {c.name: c for c in db.query(Category).filter(Category.is_active.is_(True)).all()}

    regras_usuario = db.query(ImportRule).filter(ImportRule.user_id == user_id).all()
    regras_usuario.sort(key=lambda r: len(r.keyword), reverse=True)

    itens: list[ItemImportado] = []
    vistos_no_lote: set[tuple] = set()

    for bruto in brutos:
        descricao = bruto.descricao.strip()[:140]
        normalizada = _normalizar(descricao)
        chave = (bruto.data, bruto.valor, normalizada, bruto.credito)

        duplicada = chave in vistos_no_lote or _ja_existe_no_banco(
            db, user_id, bruto.data, bruto.valor, normalizada, bruto.credito
        )
        vistos_no_lote.add(chave)

        categoria = classificar(descricao, regras_usuario, categorias_por_nome)

        itens.append(
            ItemImportado(
                descricao=descricao,
                valor=float(bruto.valor),
                data=bruto.data,
                tipo="income" if bruto.credito else "expense",
                category_id=categoria.id if categoria else None,
                category_name=categoria.name if categoria else None,
                duplicada=duplicada,
                # linhas de crédito (pagamento da fatura, estorno) não entram marcadas
                # por padrão - geralmente não são um gasto/receita pessoal de verdade
                incluir=not duplicada and not bruto.credito,
            )
        )

    if len(itens) > 300:
        avisos.append(f"Foram encontradas {len(itens)} transações - revise com atenção antes de confirmar.")

    return itens, avisos


def aprender_regra(db: Session, user_id: int, descricao: str, category_id: int) -> None:
    """Guarda/atualiza a regra aprendida a partir de uma categoria confirmada pelo usuário."""
    palavra_chave = extrair_palavra_chave(descricao)
    if not palavra_chave or len(palavra_chave) < 3:
        return

    regra = (
        db.query(ImportRule)
        .filter(ImportRule.user_id == user_id, ImportRule.keyword == palavra_chave)
        .first()
    )
    if regra:
        regra.category_id = category_id
    else:
        db.add(ImportRule(user_id=user_id, keyword=palavra_chave, category_id=category_id))
