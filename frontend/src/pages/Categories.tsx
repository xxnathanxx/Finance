import { useMemo, useState } from "react";
import { api } from "../lib/api";
import { useCarregar } from "../lib/useCarregar";
import { IconeVazio } from "../components/Icones";

type CategoryOut = {
  id: number;
  name: string;
  is_active: boolean;
};

export default function Categories() {
  const [busyId, setBusyId] = useState<number | null>(null);

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  const [showHidden, setShowHidden] = useState(false);

  const {
    dados: items,
    setDados: setItems,
    carregando: loading,
    erro: error,
    setErro: setError,
    recarregar: load,
  } = useCarregar<CategoryOut[]>(
    [],
    async () => {
      // se showHidden=true, pede tudo; se false, pede só ativas (default)
      const url = showHidden ? "/categories?active_only=false" : "/categories";
      const res = await api.get<CategoryOut[]>(url);
      return res.data;
    },
    [showHidden]
  );

  const sorted = useMemo(() => {
    const visible = showHidden ? items : items.filter((c) => c.is_active);
    return [...visible].sort((a, b) => a.name.localeCompare(b.name));
  }, [items, showHidden]);

  async function createCategory() {
    const name = newName.trim();
    if (!name) return;

    setBusyId(-1);
    setError(null);

    try {
      const res = await api.post<CategoryOut>(
        "/categories",
        { name },
        { headers: { "Content-Type": "application/json" } }
      );

      // se a API retornar uma categoria que já existia, pode ser duplicata no state
      setItems((prev) => {
        const exists = prev.some((c) => c.id === res.data.id);
        if (exists) return prev.map((c) => (c.id === res.data.id ? res.data : c));
        return [...prev, res.data];
      });

      setNewName("");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Falha ao criar categoria";
      setError(msg);
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(cat: CategoryOut) {
    setEditingId(cat.id);
    setEditingName(cat.name);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName("");
  }

  async function saveEdit(id: number) {
    const name = editingName.trim();
    if (!name) return;

    setBusyId(id);
    setError(null);

    try {
      const res = await api.patch<CategoryOut>(
        `/categories/${id}`,
        { name },
        { headers: { "Content-Type": "application/json" } }
      );

      setItems((prev) => prev.map((c) => (c.id === id ? res.data : c)));
      cancelEdit();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Falha ao atualizar categoria";
      setError(msg);
    } finally {
      setBusyId(null);
    }
  }

  async function hideCategory(id: number) {
    const ok = window.confirm("Ocultar esta categoria? (Ela não será apagada)");
    if (!ok) return;

    setBusyId(id);
    setError(null);

    try {
      const res = await api.patch<CategoryOut>(`/categories/${id}/hide`, null);
      setItems((prev) => prev.map((c) => (c.id === id ? res.data : c)));
      if (editingId === id) cancelEdit();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Falha ao ocultar categoria";
      setError(msg);
    } finally {
      setBusyId(null);
    }
  }

  async function showCategory(id: number) {
    setBusyId(id);
    setError(null);

    try {
      const res = await api.patch<CategoryOut>(`/categories/${id}/show`, null);
      setItems((prev) => prev.map((c) => (c.id === id ? res.data : c)));
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Falha ao reativar categoria";
      setError(msg);
    } finally {
      setBusyId(null);
    }
  }

  const totalVisible = sorted.length;
  const totalAll = items.length;
  const totalHidden = items.filter((c) => !c.is_active).length;

  return (
    <div>
      <div className="cabecalho-pagina">
        <h2 className="titulo-pagina">Categorias</h2>
        <p className="subtitulo-pagina">Criar, editar e ocultar categorias (sem apagar).</p>
      </div>

      <div className="barra-ferramentas">
        <div className="barra-ferramentas-esquerda">
          <label className="rotulo-checkbox">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(e) => setShowHidden(e.target.checked)}
            />
            Mostrar ocultas {totalHidden > 0 ? `(ocultas: ${totalHidden})` : ""}
          </label>
        </div>

        <button className="botao botao-secundario" onClick={load} disabled={loading}>
          {loading ? "Atualizando..." : "Recarregar"}
        </button>
      </div>

      <div className="linha-adicionar">
        <input
          placeholder="Nova categoria (ex: Mercado)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") createCategory();
          }}
        />
        <button className="botao botao-primario" onClick={createCategory} disabled={busyId === -1 || loading}>
          {busyId === -1 ? "Criando..." : "Adicionar"}
        </button>
      </div>

      {error && (
        <div className="aviso aviso-erro" role="alert">
          {error}
        </div>
      )}

      <div className="cartao">
        <div className="cabecalho-cartao">
          <strong>Total exibido:</strong> {totalVisible}
          <span> · no banco: {totalAll}</span>
        </div>

        {sorted.length === 0 && (
          <div className="estado-vazio">
            <IconeVazio />
            {showHidden
              ? "Nenhuma categoria cadastrada ainda."
              : "Nenhuma categoria ativa. Marque “Mostrar ocultas” para ver as ocultas."}
          </div>
        )}

        {sorted.map((cat) => {
          const isEditing = editingId === cat.id;
          const isBusy = busyId === cat.id;

          return (
            <div key={cat.id} className={`linha-categoria${cat.is_active ? "" : " esta-oculta"}`}>
              <div className="id-categoria">#{cat.id}</div>

              {!isEditing ? (
                <div className="nome-categoria">
                  {cat.name}
                  {!cat.is_active && <span className="selo-oculta">oculta</span>}
                </div>
              ) : (
                <div className="nome-categoria">
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(cat.id);
                      if (e.key === "Escape") cancelEdit();
                    }}
                    autoFocus
                  />
                </div>
              )}

              {!isEditing ? (
                <div className="acoes-linha">
                  <button className="botao botao-secundario" onClick={() => startEdit(cat)} disabled={isBusy}>
                    Editar
                  </button>

                  {cat.is_active ? (
                    <button className="botao botao-perigo" onClick={() => hideCategory(cat.id)} disabled={isBusy}>
                      {isBusy ? "Ocultando..." : "Ocultar"}
                    </button>
                  ) : (
                    <button className="botao botao-primario" onClick={() => showCategory(cat.id)} disabled={isBusy}>
                      {isBusy ? "Reativando..." : "Reativar"}
                    </button>
                  )}
                </div>
              ) : (
                <div className="acoes-linha">
                  <button className="botao botao-primario" onClick={() => saveEdit(cat.id)} disabled={isBusy}>
                    {isBusy ? "Salvando..." : "Salvar"}
                  </button>
                  <button className="botao botao-secundario" onClick={cancelEdit} disabled={isBusy}>
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
