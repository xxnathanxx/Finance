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
    <div style={{ padding: 24 }}>
      <h2 style={{ margin: 0 }}>Categorias</h2>
      <p style={{ marginTop: 6, opacity: 0.7 }}>
        Criar, editar e <strong>ocultar</strong> categorias (sem apagar).
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, userSelect: "none" }}>
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
          />
          Mostrar ocultas {totalHidden > 0 ? `(ocultas: ${totalHidden})` : ""}
        </label>

        <button onClick={load} disabled={loading} style={{ padding: "8px 12px" }}>
          {loading ? "Atualizando..." : "Recarregar"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <input
          placeholder="Nova categoria (ex: Mercado)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{ padding: 10, width: 320 }}
          onKeyDown={(e) => {
            if (e.key === "Enter") createCategory();
          }}
        />
        <button onClick={createCategory} disabled={busyId === -1 || loading} style={{ padding: "10px 14px" }}>
          {busyId === -1 ? "Criando..." : "Adicionar"}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 14, padding: 10, border: "1px solid #ffb3b3", background: "#ffe6e6" }}>
          <strong>Erro:</strong> {error}
        </div>
      )}

      <div style={{ marginTop: 18, border: "1px solid #eee", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ padding: 12, background: "#fafafa", borderBottom: "1px solid #eee" }}>
          <strong>Total exibido:</strong> {totalVisible}
          <span style={{ opacity: 0.7 }}> (no banco: {totalAll})</span>
        </div>

        {sorted.length === 0 && (
          <div style={{ padding: 12, opacity: 0.7 }}>
            {showHidden
              ? "Nenhuma categoria cadastrada ainda."
              : "Nenhuma categoria ativa. Marque “Mostrar ocultas” para ver as ocultas."}
          </div>
        )}

        {sorted.map((cat) => {
          const isEditing = editingId === cat.id;
          const isBusy = busyId === cat.id;

          return (
            <div
              key={cat.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 12,
                borderBottom: "1px solid #eee",
                opacity: cat.is_active ? 1 : 0.6,
              }}
            >
              <div style={{ width: 60, opacity: 0.6 }}>#{cat.id}</div>

              {!isEditing ? (
                <div style={{ flex: 1 }}>
                  {cat.name}{" "}
                  {!cat.is_active && (
                    <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.8 }}>
                      (oculta)
                    </span>
                  )}
                </div>
              ) : (
                <input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  style={{ padding: 8, flex: 1 }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit(cat.id);
                    if (e.key === "Escape") cancelEdit();
                  }}
                />
              )}

              {!isEditing ? (
                <>
                  <button onClick={() => startEdit(cat)} disabled={isBusy} style={{ padding: "8px 10px" }}>
                    Editar
                  </button>

                  {cat.is_active ? (
                    <button onClick={() => hideCategory(cat.id)} disabled={isBusy} style={{ padding: "8px 10px" }}>
                      {isBusy ? "Ocultando..." : "Ocultar"}
                    </button>
                  ) : (
                    <button onClick={() => showCategory(cat.id)} disabled={isBusy} style={{ padding: "8px 10px" }}>
                      {isBusy ? "Reativando..." : "Reativar"}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button onClick={() => saveEdit(cat.id)} disabled={isBusy} style={{ padding: "8px 10px" }}>
                    {isBusy ? "Salvando..." : "Salvar"}
                  </button>
                  <button onClick={cancelEdit} disabled={isBusy} style={{ padding: "8px 10px" }}>
                    Cancelar
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
