import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { formatarMoeda, mesAtualComoValorDeInput } from "../lib/formatacao";

type Categoria = {
  id: number;
  name: string;
  is_active: boolean;
};

type Transacao = {
  id: number;
  description: string;
  amount: number;
  date: string;
  type: "income" | "expense";
  category_id: number | null;
  category: Categoria | null;
};

type FormularioEdicao = {
  descricao: string;
  valor: string;
  tipo: "income" | "expense";
  categoriaId: string;
  data: string;
};

function hojeComoValorDeInput(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function Transacoes() {
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [mesSelecionado, setMesSelecionado] = useState(mesAtualComoValorDeInput());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [tipo, setTipo] = useState<"income" | "expense">("expense");
  const [categoriaId, setCategoriaId] = useState("");
  const [data, setData] = useState(hojeComoValorDeInput());
  const [salvando, setSalvando] = useState(false);

  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [edicao, setEdicao] = useState<FormularioEdicao | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function carregar() {
    setLoading(true);
    setError(null);

    try {
      const [resTransacoes, resCategorias] = await Promise.all([
        api.get<Transacao[]>("/transactions"),
        api.get<Categoria[]>("/categories"),
      ]);
      setTransacoes(resTransacoes.data);
      setCategorias(resCategorias.data);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Falha ao carregar transações";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const transacoesDoMes = useMemo(() => {
    return transacoes
      .filter((t) => t.date.startsWith(mesSelecionado))
      .sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1));
  }, [transacoes, mesSelecionado]);

  const categoriasAtivas = useMemo(() => categorias.filter((c) => c.is_active), [categorias]);

  const saldoDoMes = transacoesDoMes.reduce(
    (soma, t) => soma + (t.type === "income" ? t.amount : -t.amount),
    0
  );

  async function criarTransacao(e: React.FormEvent) {
    e.preventDefault();
    if (!descricao.trim() || !valor) return;

    setSalvando(true);
    setError(null);

    try {
      const res = await api.post<Transacao>("/transactions", {
        description: descricao.trim(),
        amount: Number(valor),
        type: tipo,
        category_id: categoriaId ? Number(categoriaId) : null,
        date: data,
      });
      setTransacoes((prev) => [res.data, ...prev]);
      setDescricao("");
      setValor("");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Falha ao criar transação";
      setError(msg);
    } finally {
      setSalvando(false);
    }
  }

  function iniciarEdicao(t: Transacao) {
    setEditandoId(t.id);
    setEdicao({
      descricao: t.description,
      valor: String(t.amount),
      tipo: t.type,
      categoriaId: t.category_id ? String(t.category_id) : "",
      data: t.date,
    });
    setError(null);
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setEdicao(null);
  }

  async function salvarEdicao(id: number) {
    if (!edicao || !edicao.descricao.trim() || !edicao.valor) return;

    setBusyId(id);
    setError(null);

    try {
      const res = await api.patch<Transacao>(`/transactions/${id}`, {
        description: edicao.descricao.trim(),
        amount: Number(edicao.valor),
        type: edicao.tipo,
        category_id: edicao.categoriaId ? Number(edicao.categoriaId) : null,
        date: edicao.data,
      });
      setTransacoes((prev) => prev.map((t) => (t.id === id ? res.data : t)));
      cancelarEdicao();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Falha ao atualizar transação";
      setError(msg);
    } finally {
      setBusyId(null);
    }
  }

  async function excluirTransacao(id: number) {
    const ok = window.confirm("Excluir esta transação? Essa ação não pode ser desfeita.");
    if (!ok) return;

    setBusyId(id);
    setError(null);

    try {
      await api.delete(`/transactions/${id}`);
      setTransacoes((prev) => prev.filter((t) => t.id !== id));
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Falha ao excluir transação";
      setError(msg);
    } finally {
      setBusyId(null);
    }
  }

  function formatarData(data: string): string {
    const [ano, mes, dia] = data.split("-");
    return `${dia}/${mes}/${ano}`;
  }

  return (
    <div>
      <div className="cabecalho-pagina">
        <h2 className="titulo-pagina">Transações</h2>
        <p className="subtitulo-pagina">Registre e acompanhe seus gastos e receitas.</p>
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

      <form className="formulario-transacao" onSubmit={criarTransacao}>
        <input
          className="campo-descricao"
          placeholder="Descrição (ex: Supermercado)"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
        <input
          className="campo-valor"
          type="number"
          step="0.01"
          min="0"
          placeholder="Valor"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
        />
        <select value={tipo} onChange={(e) => setTipo(e.target.value as "income" | "expense")}>
          <option value="expense">Despesa</option>
          <option value="income">Receita</option>
        </select>
        <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
          <option value="">Sem categoria</option>
          {categoriasAtivas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        <button type="submit" className="botao botao-primario" disabled={salvando}>
          {salvando ? "Salvando..." : "Adicionar"}
        </button>
      </form>

      {error && <div className="aviso aviso-erro">{error}</div>}

      <div className="cartao">
        <div className="cabecalho-cartao">
          <strong>{transacoesDoMes.length}</strong> transação(ões) em {mesSelecionado}
          <span> · saldo do mês: {formatarMoeda(saldoDoMes)}</span>
        </div>

        {transacoesDoMes.length === 0 ? (
          <div className="estado-vazio">Nenhuma transação neste mês.</div>
        ) : (
          transacoesDoMes.map((t) => {
            const emEdicao = editandoId === t.id;
            const ocupado = busyId === t.id;

            if (emEdicao && edicao) {
              return (
                <div key={t.id} className="linha-transacao linha-transacao-edicao">
                  <input
                    type="date"
                    value={edicao.data}
                    onChange={(e) => setEdicao({ ...edicao, data: e.target.value })}
                  />
                  <input
                    className="campo-descricao"
                    value={edicao.descricao}
                    onChange={(e) => setEdicao({ ...edicao, descricao: e.target.value })}
                  />
                  <select
                    value={edicao.categoriaId}
                    onChange={(e) => setEdicao({ ...edicao, categoriaId: e.target.value })}
                  >
                    <option value="">Sem categoria</option>
                    {categoriasAtivas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={edicao.tipo}
                    onChange={(e) => setEdicao({ ...edicao, tipo: e.target.value as "income" | "expense" })}
                  >
                    <option value="expense">Despesa</option>
                    <option value="income">Receita</option>
                  </select>
                  <input
                    className="campo-valor"
                    type="number"
                    step="0.01"
                    min="0"
                    value={edicao.valor}
                    onChange={(e) => setEdicao({ ...edicao, valor: e.target.value })}
                  />
                  <div className="acoes-linha">
                    <button className="botao botao-primario" onClick={() => salvarEdicao(t.id)} disabled={ocupado}>
                      {ocupado ? "Salvando..." : "Salvar"}
                    </button>
                    <button className="botao botao-secundario" onClick={cancelarEdicao} disabled={ocupado}>
                      Cancelar
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={t.id} className="linha-transacao">
                <span className="transacao-data">{formatarData(t.date)}</span>
                <span className="transacao-descricao">{t.description}</span>
                <span className="transacao-categoria">{t.category?.name ?? "Sem categoria"}</span>
                <span className={`selo-tipo ${t.type === "income" ? "selo-tipo-receita" : "selo-tipo-despesa"}`}>
                  {t.type === "income" ? "Receita" : "Despesa"}
                </span>
                <span className={`transacao-valor ${t.type === "income" ? "valor-receita" : "valor-despesa"}`}>
                  {t.type === "income" ? "+" : "-"}
                  {formatarMoeda(t.amount)}
                </span>
                <div className="acoes-linha">
                  <button className="botao botao-secundario" onClick={() => iniciarEdicao(t)} disabled={ocupado}>
                    Editar
                  </button>
                  <button className="botao botao-perigo" onClick={() => excluirTransacao(t.id)} disabled={ocupado}>
                    {ocupado ? "Excluindo..." : "Excluir"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
