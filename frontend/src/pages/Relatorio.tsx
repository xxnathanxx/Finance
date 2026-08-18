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
};

type Configuracoes = {
  monthly_goal: number | null;
};

const CORES_CATEGORIA = [
  "#3987e5", // azul
  "#d95926", // laranja
  "#199e70", // água-marinha
  "#c98500", // amarelo
  "#d55181", // magenta
  "#22d97a", // verde
  "#9085e9", // violeta
];
const COR_OUTRAS = "#6b7280";
const MAX_CATEGORIAS_EXIBIDAS = 7;

type TipoGrafico = "pizza" | "barras";

export default function Relatorio() {
  const [mesSelecionado, setMesSelecionado] = useState(mesAtualComoValorDeInput());
  const [resumo, setResumo] = useState<ResumoMensal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tipoGrafico, setTipoGrafico] = useState<TipoGrafico>("pizza");

  const [meta, setMeta] = useState<number | null>(null);
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [valorMetaInput, setValorMetaInput] = useState("");
  const [salvandoMeta, setSalvandoMeta] = useState(false);

  async function carregar() {
    const [ano, mes] = mesSelecionado.split("-").map(Number);
    setLoading(true);
    setError(null);

    try {
      const res = await api.get<ResumoMensal>(`/reports/monthly/${ano}/${mes}`);
      setResumo(res.data);
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
  }, [mesSelecionado]);

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

    const ordenadas = [...resumo.expenses_by_category]
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);

    const principais = ordenadas.slice(0, MAX_CATEGORIAS_EXIBIDAS);
    const restante = ordenadas.slice(MAX_CATEGORIAS_EXIBIDAS);
    const totalRestante = restante.reduce((soma, c) => soma + c.total, 0);

    const totalGeral = ordenadas.reduce((soma, c) => soma + c.total, 0) || 1;

    const linhas = principais.map((c, i) => ({
      nome: c.category_name ?? "Sem categoria",
      total: c.total,
      percentual: (c.total / totalGeral) * 100,
      cor: CORES_CATEGORIA[i % CORES_CATEGORIA.length],
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
  }, [resumo]);

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
        <p className="subtitulo-pagina">Veja para onde seu dinheiro está indo em cada mês.</p>
      </div>

      <div className="barra-ferramentas">
        <div className="barra-ferramentas-esquerda">
          <label className="rotulo-checkbox">
            Mês
            <input
              type="month"
              value={mesSelecionado}
              onChange={(e) => setMesSelecionado(e.target.value)}
            />
          </label>
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

          <div className="cartao">
            <div className="cabecalho-cartao cabecalho-cartao-com-acoes">
              <div>
                <strong>Despesas por categoria</strong>
                <span> · {mesSelecionado}</span>
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

            {categorias.length === 0 ? (
              <div className="estado-vazio">Nenhuma despesa registrada neste mês.</div>
            ) : tipoGrafico === "pizza" ? (
              <div className="grafico-pizza-container">
                <div className="grafico-pizza-donut" style={{ background: gradientePizza }}>
                  <div className="grafico-pizza-furo">
                    <span className="grafico-pizza-furo-rotulo">Despesas</span>
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
                      <span className="legenda-valor">
                        {formatarMoeda(cat.total)} · {cat.percentual.toFixed(1)}%
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
                      <span className="rotulo-barra-valor">
                        {formatarMoeda(cat.total)} · {cat.percentual.toFixed(1)}%
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
