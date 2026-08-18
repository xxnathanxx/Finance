import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type CategoryOut = {
  id: number;
  name: string;
  is_active: boolean;
};

export default function Categories() {
  const [items, setItems] = useState<CategoryOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  const [showHidden, setShowHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const visible = showHidden ? items : items.filter((c) => c.is_active);
    return [...visible].sort((a, b) => a.name.localeCompare(b.name));
  }, [items, showHidden]);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      // se showHidden=true, pede tudo; se false, pede só ativas (default)
      const url = showHidden ? "/categories?active_only=false" : "/categories";
      const res = await api.get<CategoryOut[]>(url);
      setItems(res.data);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Falha ao carregar categorias";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHidden]);

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
      <div className="page-header">
        <h2 className="page-title">Categorias</h2>
        <p className="page-subtitle">Criar, editar e ocultar categorias (sem apagar).</p>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(e) => setShowHidden(e.target.checked)}
            />
            Mostrar ocultas {totalHidden > 0 ? `(ocultas: ${totalHidden})` : ""}
          </label>
        </div>

        <button className="btn btn-ghost" onClick={load} disabled={loading}>
          {loading ? "Atualizando..." : "Recarregar"}
        </button>
      </div>

      <div className="add-row">
        <input
          placeholder="Nova categoria (ex: Mercado)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") createCategory();
          }}
        />
        <button className="btn btn-primary" onClick={createCategory} disabled={busyId === -1 || loading}>
          {busyId === -1 ? "Criando..." : "Adicionar"}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="card-header">
          <strong>Total exibido:</strong> {totalVisible}
          <span> · no banco: {totalAll}</span>
        </div>

        {sorted.length === 0 && (
          <div className="empty-state">
            {showHidden
              ? "Nenhuma categoria cadastrada ainda."
              : "Nenhuma categoria ativa. Marque “Mostrar ocultas” para ver as ocultas."}
          </div>
        )}

        {sorted.map((cat) => {
          const isEditing = editingId === cat.id;
          const isBusy = busyId === cat.id;

          return (
            <div key={cat.id} className={`category-row${cat.is_active ? "" : " is-hidden"}`}>
              <div className="category-id">#{cat.id}</div>

              {!isEditing ? (
                <div className="category-name">
                  {cat.name}
                  {!cat.is_active && <span className="badge-hidden">oculta</span>}
                </div>
              ) : (
                <div className="category-name">
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
                <div className="row-actions">
                  <button className="btn btn-ghost" onClick={() => startEdit(cat)} disabled={isBusy}>
                    Editar
                  </button>

                  {cat.is_active ? (
                    <button className="btn btn-danger" onClick={() => hideCategory(cat.id)} disabled={isBusy}>
                      {isBusy ? "Ocultando..." : "Ocultar"}
                    </button>
                  ) : (
                    <button className="btn btn-primary" onClick={() => showCategory(cat.id)} disabled={isBusy}>
                      {isBusy ? "Reativando..." : "Reativar"}
                    </button>
                  )}
                </div>
              ) : (
                <div className="row-actions">
                  <button className="btn btn-primary" onClick={() => saveEdit(cat.id)} disabled={isBusy}>
                    {isBusy ? "Salvando..." : "Salvar"}
                  </button>
                  <button className="btn btn-ghost" onClick={cancelEdit} disabled={isBusy}>
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
