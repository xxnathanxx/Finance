import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { formatarMoeda, mesAtualComoValorDeInput } from "../lib/formatacao";

type ResumoCategoria = {
  category_id: number | null;
  category_name: string | null;
  total: number;
};

type ResumoMensal = {
  month: string;
  total_income: number;
  total_expense: number;
  balance: number;
  expenses_by_category: ResumoCategoria[];
  income_by_category: ResumoCategoria[];
};

type ResumoPeriodo = {
  start_date: string;
  end_date: string;
  total_income: number;
  total_expense: number;
  balance: number;
  expenses_by_category: ResumoCategoria[];
  income_by_category: ResumoCategoria[];
};

type ResumoCarregado = {
  rotulo: string;
  total_income: number;
  total_expense: number;
  balance: number;
  expenses_by_category: ResumoCategoria[];
  income_by_category: ResumoCategoria[];
};

type Configuracoes = {
  monthly_goal: number | null;
};

const CORES_DESPESA = [
  "#3987e5", // azul
  "#d95926", // laranja
  "#199e70", // água-marinha
  "#c98500", // amarelo
  "#d55181", // magenta
  "#9085e9", // violeta
  "#e66767", // vermelho
];
const CORES_RECEITA = [
  "#22d97a", // verde
  "#16a866", // verde escuro
  "#5eead4", // verde-água claro
  "#84cc16", // verde-lima
  "#0d9488", // teal
  "#4ade80", // verde claro
  "#059669", // esmeralda
];
const COR_OUTRAS = "#6b7280";
const MAX_CATEGORIAS_EXIBIDAS = 7;

type TipoGrafico = "pizza" | "barras";
type TipoPeriodo = "semanal" | "mensal" | "anual" | "tudo";
type VisaoCategoria = "despesas" | "receitas";

function dataParaSemanaISO(data: Date): string {
  const d = new Date(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()));
  const diaSemana = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - diaSemana);
  const inicioAno = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((d.getTime() - inicioAno.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(semana).padStart(2, "0")}`;
}

function semanaISOParaIntervalo(valor: string): { inicio: string; fimExclusivo: string } {
  const [anoStr, semanaStr] = valor.split("-W");
  const ano = Number(anoStr);
  const semana = Number(semanaStr);

  // 4 de janeiro está sempre na semana 1 (definição da ISO 8601)
  const quatroJaneiro = new Date(Date.UTC(ano, 0, 4));
  const diaSemanaQuatro = quatroJaneiro.getUTCDay() || 7;
  const segundaSemana1 = new Date(quatroJaneiro);
  segundaSemana1.setUTCDate(quatroJaneiro.getUTCDate() - diaSemanaQuatro + 1);

  const inicio = new Date(segundaSemana1);
  inicio.setUTCDate(segundaSemana1.getUTCDate() + (semana - 1) * 7);
  const fimExclusivo = new Date(inicio);
  fimExclusivo.setUTCDate(inicio.getUTCDate() + 7);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { inicio: fmt(inicio), fimExclusivo: fmt(fimExclusivo) };
}

function formatarDataBr(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

export default function Relatorio() {
  const [tipoPeriodo, setTipoPeriodo] = useState<TipoPeriodo>("mensal");
  const [mesSelecionado, setMesSelecionado] = useState(mesAtualComoValorDeInput());
  const [semanaSelecionada, setSemanaSelecionada] = useState(() => dataParaSemanaISO(new Date()));
  const [anoSelecionado, setAnoSelecionado] = useState(() => new Date().getFullYear());

  const [resumo, setResumo] = useState<ResumoCarregado | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tipoGrafico, setTipoGrafico] = useState<TipoGrafico>("pizza");
  const [visaoCategoria, setVisaoCategoria] = useState<VisaoCategoria>("despesas");

  const [meta, setMeta] = useState<number | null>(null);
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [valorMetaInput, setValorMetaInput] = useState("");
  const [salvandoMeta, setSalvandoMeta] = useState(false);

  async function carregar() {
    setLoading(true);
    setError(null);

    try {
      if (tipoPeriodo === "mensal") {
        const [ano, mes] = mesSelecionado.split("-").map(Number);
        const res = await api.get<ResumoMensal>(`/reports/monthly/${ano}/${mes}`);
        setResumo({ rotulo: res.data.month, ...res.data });
      } else if (tipoPeriodo === "semanal") {
        const { inicio, fimExclusivo } = semanaISOParaIntervalo(semanaSelecionada);
        const res = await api.get<ResumoPeriodo>("/reports/period", {
          params: { start: inicio, end: fimExclusivo },
        });
        const ultimoDia = new Date(fimExclusivo + "T00:00:00Z");
        ultimoDia.setUTCDate(ultimoDia.getUTCDate() - 1);
        const rotulo = `${formatarDataBr(inicio)} a ${formatarDataBr(ultimoDia.toISOString().slice(0, 10))}`;
        setResumo({ rotulo, ...res.data });
      } else if (tipoPeriodo === "anual") {
        const inicio = `${anoSelecionado}-01-01`;
        const fimExclusivo = `${anoSelecionado + 1}-01-01`;
        const res = await api.get<ResumoPeriodo>("/reports/period", {
          params: { start: inicio, end: fimExclusivo },
        });
        setResumo({ rotulo: String(anoSelecionado), ...res.data });
      } else {
        const res = await api.get<ResumoPeriodo>("/reports/period", {
          params: { start: "2000-01-01", end: "2100-01-01" },
        });
        setResumo({ rotulo: "todo o período", ...res.data });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Falha ao carregar relatório";
      setError(msg);
      setResumo(null);
    } finally {
      setLoading(false);
    }
  }

  async function carregarMeta() {
    try {
      const res = await api.get<Configuracoes>("/settings");
      setMeta(res.data.monthly_goal);
    } catch {
      // meta é um extra - se falhar em carregar, só não mostra nada
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoPeriodo, mesSelecionado, semanaSelecionada, anoSelecionado]);

  useEffect(() => {
    carregarMeta();
  }, []);

  function iniciarEdicaoMeta() {
    setValorMetaInput(meta !== null ? String(meta) : "");
    setEditandoMeta(true);
  }

  async function salvarMeta(e: React.FormEvent) {
    e.preventDefault();
    if (!valorMetaInput) return;

    setSalvandoMeta(true);
    try {
      const res = await api.put<Configuracoes>("/settings", { monthly_goal: Number(valorMetaInput) });
      setMeta(res.data.monthly_goal);
      setEditandoMeta(false);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Falha ao salvar meta";
      setError(msg);
    } finally {
      setSalvandoMeta(false);
    }
  }

  const categorias = useMemo(() => {
    if (!resumo) return [];

    const listaBruta =
      visaoCategoria === "despesas" ? resumo.expenses_by_category : resumo.income_by_category;
    const paleta = visaoCategoria === "despesas" ? CORES_DESPESA : CORES_RECEITA;

    const ordenadas = [...listaBruta].filter((c) => c.total > 0).sort((a, b) => b.total - a.total);

    const principais = ordenadas.slice(0, MAX_CATEGORIAS_EXIBIDAS);
    const restante = ordenadas.slice(MAX_CATEGORIAS_EXIBIDAS);
    const totalRestante = restante.reduce((soma, c) => soma + c.total, 0);

    const totalGeral = ordenadas.reduce((soma, c) => soma + c.total, 0) || 1;

    const linhas = principais.map((c, i) => ({
      nome: c.category_name ?? "Sem categoria",
      total: c.total,
      percentual: (c.total / totalGeral) * 100,
      cor: paleta[i % paleta.length],
    }));

    if (totalRestante > 0) {
      linhas.push({
        nome: "Outras",
        total: totalRestante,
        percentual: (totalRestante / totalGeral) * 100,
        cor: COR_OUTRAS,
      });
    }

    return linhas;
  }, [resumo, visaoCategoria]);

  const maiorValor = categorias.length > 0 ? categorias[0].total : 0;

  const gradientePizza = useMemo(() => {
    let acumulado = 0;
    const trechos = categorias.map((cat) => {
      const inicio = acumulado;
      acumulado += cat.percentual;
      return `${cat.cor} ${inicio}% ${acumulado}%`;
    });
    return `conic-gradient(${trechos.join(", ")})`;
  }, [categorias]);

  const metaAtingida = resumo && meta !== null && resumo.balance >= meta;
  const progressoMeta =
    resumo && meta ? Math.min(100, Math.max(0, (resumo.balance / meta) * 100)) : 0;

  return (
    <div>
      <div className="cabecalho-pagina">
        <h2 className="titulo-pagina">Relatório</h2>
        <p className="subtitulo-pagina">Veja para onde seu dinheiro está indo.</p>
      </div>

      <div className="barra-ferramentas">
        <div className="barra-ferramentas-esquerda">
          <div className="alternador-grafico">
            <button
              type="button"
              className={`botao-alternador${tipoPeriodo === "semanal" ? " botao-alternador-ativo" : ""}`}
              onClick={() => setTipoPeriodo("semanal")}
            >
              Semanal
            </button>
            <button
              type="button"
              className={`botao-alternador${tipoPeriodo === "mensal" ? " botao-alternador-ativo" : ""}`}
              onClick={() => setTipoPeriodo("mensal")}
            >
              Mensal
            </button>
            <button
              type="button"
              className={`botao-alternador${tipoPeriodo === "anual" ? " botao-alternador-ativo" : ""}`}
              onClick={() => setTipoPeriodo("anual")}
            >
              Anual
            </button>
            <button
              type="button"
              className={`botao-alternador${tipoPeriodo === "tudo" ? " botao-alternador-ativo" : ""}`}
              onClick={() => setTipoPeriodo("tudo")}
            >
              Todas
            </button>
          </div>

          {tipoPeriodo === "semanal" && (
            <input
              type="week"
              value={semanaSelecionada}
              onChange={(e) => setSemanaSelecionada(e.target.value)}
            />
          )}
          {tipoPeriodo === "mensal" && (
            <input
              type="month"
              value={mesSelecionado}
              onChange={(e) => setMesSelecionado(e.target.value)}
            />
          )}
          {tipoPeriodo === "anual" && (
            <input
              type="number"
              value={anoSelecionado}
              onChange={(e) => setAnoSelecionado(Number(e.target.value))}
              min="2000"
              max="2100"
              style={{ maxWidth: 100 }}
            />
          )}
        </div>

        <button className="botao botao-secundario" onClick={carregar} disabled={loading}>
          {loading ? "Atualizando..." : "Recarregar"}
        </button>
      </div>

      {error && <div className="aviso aviso-erro">{error}</div>}

      {resumo && (
        <>
          <div className="grade-resumo">
            <div className="cartao-resumo resumo-receita">
              <div className="cartao-resumo-rotulo">Receita</div>
              <div className="cartao-resumo-valor">{formatarMoeda(resumo.total_income)}</div>
            </div>
            <div className="cartao-resumo resumo-despesa">
              <div className="cartao-resumo-rotulo">Despesa</div>
              <div className="cartao-resumo-valor">{formatarMoeda(resumo.total_expense)}</div>
            </div>
            <div
              className={`cartao-resumo ${resumo.balance >= 0 ? "resumo-saldo-positivo" : "resumo-saldo-negativo"}`}
            >
              <div className="cartao-resumo-rotulo">Saldo</div>
              <div className="cartao-resumo-valor">{formatarMoeda(resumo.balance)}</div>
            </div>
          </div>

          {tipoPeriodo === "mensal" && (
            <div className="cartao cartao-meta">
              <div className="cartao-meta-cabecalho">
                <span className="cartao-meta-titulo">Meta do mês</span>

                {meta !== null && !editandoMeta && (
                  <span
                    className={`cartao-meta-status ${
                      metaAtingida ? "cartao-meta-status-atingida" : "cartao-meta-status-em-andamento"
                    }`}
                  >
                    {metaAtingida ? "Meta atingida! 🎉" : "Em andamento"}
                  </span>
                )}
                {meta === null && !editandoMeta && (
                  <span className="cartao-meta-status cartao-meta-status-sem-meta">Sem meta definida</span>
                )}
              </div>

              {editandoMeta ? (
                <form className="form-editar-meta" onSubmit={salvarMeta}>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="Ex: 500"
                    value={valorMetaInput}
                    onChange={(e) => setValorMetaInput(e.target.value)}
                    autoFocus
                  />
                  <button type="submit" className="botao botao-primario" disabled={salvandoMeta}>
                    {salvandoMeta ? "Salvando..." : "Salvar"}
                  </button>
                  <button
                    type="button"
                    className="botao botao-secundario"
                    onClick={() => setEditandoMeta(false)}
                    disabled={salvandoMeta}
                  >
                    Cancelar
                  </button>
                </form>
              ) : (
                <>
                  {meta !== null ? (
                    <>
                      <div className="trilha-meta">
                        <div
                          className={`preenchimento-meta ${metaAtingida ? "preenchimento-meta-atingida" : ""}`}
                          style={{ width: `${progressoMeta}%` }}
                        />
                      </div>
                      <p className="cartao-meta-texto">
                        {formatarMoeda(resumo.balance)} de {formatarMoeda(meta)}
                        {!metaAtingida && meta - resumo.balance > 0 && (
                          <> · faltam {formatarMoeda(meta - resumo.balance)}</>
                        )}
                        {" · "}
                        <button type="button" className="link-botao" onClick={iniciarEdicaoMeta}>
                          Editar meta
                        </button>
                      </p>
                    </>
                  ) : (
                    <p className="cartao-meta-texto">
                      Defina uma meta de saldo positivo pra acompanhar seu progresso todo mês.{" "}
                      <button type="button" className="link-botao" onClick={iniciarEdicaoMeta}>
                        Definir meta
                      </button>
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          <div className="cartao">
            <div className="cabecalho-cartao cabecalho-cartao-com-acoes">
              <div className="alternador-grafico">
                <button
                  type="button"
                  className={`botao-alternador${visaoCategoria === "despesas" ? " botao-alternador-ativo botao-alternador-despesa" : ""}`}
                  onClick={() => setVisaoCategoria("despesas")}
                >
                  Despesas
                </button>
                <button
                  type="button"
                  className={`botao-alternador${visaoCategoria === "receitas" ? " botao-alternador-ativo botao-alternador-receita" : ""}`}
                  onClick={() => setVisaoCategoria("receitas")}
                >
                  Receitas
                </button>
              </div>

              {categorias.length > 0 && (
                <div className="alternador-grafico">
                  <button
                    type="button"
                    className={`botao-alternador${tipoGrafico === "pizza" ? " botao-alternador-ativo" : ""}`}
                    onClick={() => setTipoGrafico("pizza")}
                  >
                    Pizza
                  </button>
                  <button
                    type="button"
                    className={`botao-alternador${tipoGrafico === "barras" ? " botao-alternador-ativo" : ""}`}
                    onClick={() => setTipoGrafico("barras")}
                  >
                    Barras
                  </button>
                </div>
              )}
            </div>

            <div className="cabecalho-cartao">
              <strong>{visaoCategoria === "despesas" ? "Despesas" : "Receitas"} por categoria</strong>
              <span> · {resumo.rotulo}</span>
            </div>

            {categorias.length === 0 ? (
              <div className="estado-vazio">
                Nenhuma {visaoCategoria === "despesas" ? "despesa" : "receita"} registrada nesse período.
              </div>
            ) : tipoGrafico === "pizza" ? (
              <div className="grafico-pizza-container">
                <div className="grafico-pizza-donut" style={{ background: gradientePizza }}>
                  <div className="grafico-pizza-furo">
                    <span className="grafico-pizza-furo-rotulo">
                      {visaoCategoria === "despesas" ? "Despesas" : "Receitas"}
                    </span>
                    <span className="grafico-pizza-furo-valor">
                      {formatarMoeda(categorias.reduce((soma, c) => soma + c.total, 0))}
                    </span>
                  </div>
                </div>

                <div className="grafico-pizza-legenda">
                  {categorias.map((cat) => (
                    <div key={cat.nome} className="legenda-item">
                      <span className="legenda-cor" style={{ backgroundColor: cat.cor }} />
                      <span className="legenda-nome">{cat.nome}</span>
                      <span className="legenda-valor" style={{ color: cat.cor }}>
                        {formatarMoeda(cat.total)} · {cat.percentual.toFixed(1)}% do total
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grafico-barras">
                {categorias.map((cat) => (
                  <div key={cat.nome} className="linha-barra">
                    <div className="rotulo-barra">
                      <span className="rotulo-barra-nome">{cat.nome}</span>
                      <span className="rotulo-barra-valor" style={{ color: cat.cor }}>
                        {formatarMoeda(cat.total)} · {cat.percentual.toFixed(1)}% do total
                      </span>
                    </div>
                    <div className="trilha-barra">
                      <div
                        className="preenchimento-barra"
                        style={{
                          width: `${maiorValor > 0 ? (cat.total / maiorValor) * 100 : 0}%`,
                          backgroundColor: cat.cor,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
