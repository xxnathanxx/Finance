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

const CORES_CATEGORIA = [
  "#2a78d6", // azul
  "#eb6834", // laranja
  "#1baf7a", // água-marinha
  "#eda100", // amarelo
  "#e87ba4", // magenta
  "#008300", // verde
  "#4a3aa7", // violeta
];
const COR_OUTRAS = "#898781";
const MAX_CATEGORIAS_EXIBIDAS = 7;

type TipoGrafico = "pizza" | "barras";

export default function Relatorio() {
  const [mesSelecionado, setMesSelecionado] = useState(mesAtualComoValorDeInput());
  const [resumo, setResumo] = useState<ResumoMensal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tipoGrafico, setTipoGrafico] = useState<TipoGrafico>("pizza");

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

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesSelecionado]);

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
