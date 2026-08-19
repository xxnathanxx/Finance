import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { mesAtualComoValorDeInput } from "../lib/formatacao";
import { useCarregar } from "../lib/useCarregar";
import CartoesResumo from "../components/CartoesResumo";
import CartaoMeta from "../components/CartaoMeta";
import GraficoCategorias from "../components/GraficoCategorias";

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

  const [tipoGrafico, setTipoGrafico] = useState<TipoGrafico>("pizza");
  const [visaoCategoria, setVisaoCategoria] = useState<VisaoCategoria>("despesas");

  const [meta, setMeta] = useState<number | null>(null);
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [valorMetaInput, setValorMetaInput] = useState("");
  const [salvandoMeta, setSalvandoMeta] = useState(false);

  const {
    dados: resumo,
    carregando: loading,
    erro: error,
    setErro: setError,
    recarregar: carregar,
  } = useCarregar<ResumoCarregado | null>(
    null,
    async () => {
      if (tipoPeriodo === "mensal") {
        const [ano, mes] = mesSelecionado.split("-").map(Number);
        const res = await api.get<ResumoMensal>(`/reports/monthly/${ano}/${mes}`);
        return { rotulo: res.data.month, ...res.data };
      }
      if (tipoPeriodo === "semanal") {
        const { inicio, fimExclusivo } = semanaISOParaIntervalo(semanaSelecionada);
        const res = await api.get<ResumoPeriodo>("/reports/period", {
          params: { start: inicio, end: fimExclusivo },
        });
        const ultimoDia = new Date(fimExclusivo + "T00:00:00Z");
        ultimoDia.setUTCDate(ultimoDia.getUTCDate() - 1);
        const rotulo = `${formatarDataBr(inicio)} a ${formatarDataBr(ultimoDia.toISOString().slice(0, 10))}`;
        return { rotulo, ...res.data };
      }
      if (tipoPeriodo === "anual") {
        const inicio = `${anoSelecionado}-01-01`;
        const fimExclusivo = `${anoSelecionado + 1}-01-01`;
        const res = await api.get<ResumoPeriodo>("/reports/period", {
          params: { start: inicio, end: fimExclusivo },
        });
        return { rotulo: String(anoSelecionado), ...res.data };
      }
      const res = await api.get<ResumoPeriodo>("/reports/period", {
        params: { start: "2000-01-01", end: "2100-01-01" },
      });
      return { rotulo: "todo o período", ...res.data };
    },
    [tipoPeriodo, mesSelecionado, semanaSelecionada, anoSelecionado],
    { limparAoErrar: true }
  );

  async function carregarMeta() {
    try {
      const res = await api.get<Configuracoes>("/settings");
      setMeta(res.data.monthly_goal);
    } catch {
      // meta é um extra - se falhar em carregar, só não mostra nada
    }
  }

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

      {error && (
        <div className="aviso aviso-erro" role="alert">
          {error}
        </div>
      )}

      {resumo && (
        <>
          <CartoesResumo receita={resumo.total_income} despesa={resumo.total_expense} saldo={resumo.balance} />

          {tipoPeriodo === "mensal" && (
            <CartaoMeta
              saldo={resumo.balance}
              meta={meta}
              editando={editandoMeta}
              valorInput={valorMetaInput}
              salvando={salvandoMeta}
              onChangeValorInput={setValorMetaInput}
              onIniciarEdicao={iniciarEdicaoMeta}
              onCancelarEdicao={() => setEditandoMeta(false)}
              onSalvar={salvarMeta}
            />
          )}

          <GraficoCategorias
            categorias={categorias}
            rotuloPeriodo={resumo.rotulo}
            visaoCategoria={visaoCategoria}
            onChangeVisaoCategoria={setVisaoCategoria}
            tipoGrafico={tipoGrafico}
            onChangeTipoGrafico={setTipoGrafico}
            gradientePizza={gradientePizza}
            maiorValor={maiorValor}
          />
        </>
      )}
    </div>
  );
}
