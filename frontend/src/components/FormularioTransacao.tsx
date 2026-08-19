type Categoria = {
  id: number;
  name: string;
  is_active: boolean;
};

type Props = {
  descricao: string;
  valor: string;
  tipo: "income" | "expense";
  categoriaId: string;
  data: string;
  categorias: Categoria[];
  salvando: boolean;
  onChangeDescricao: (v: string) => void;
  onChangeValor: (v: string) => void;
  onChangeTipo: (v: "income" | "expense") => void;
  onChangeCategoriaId: (v: string) => void;
  onChangeData: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
};

export default function FormularioTransacao({
  descricao,
  valor,
  tipo,
  categoriaId,
  data,
  categorias,
  salvando,
  onChangeDescricao,
  onChangeValor,
  onChangeTipo,
  onChangeCategoriaId,
  onChangeData,
  onSubmit,
}: Props) {
  return (
    <form className="formulario-transacao" onSubmit={onSubmit}>
      <input
        className="campo-descricao"
        aria-label="Descrição"
        placeholder="Descrição (ex: Supermercado)"
        value={descricao}
        onChange={(e) => onChangeDescricao(e.target.value)}
      />
      <input
        className="campo-valor"
        type="number"
        step="0.01"
        min="0"
        aria-label="Valor"
        placeholder="Valor"
        value={valor}
        onChange={(e) => onChangeValor(e.target.value)}
      />
      <select aria-label="Tipo" value={tipo} onChange={(e) => onChangeTipo(e.target.value as "income" | "expense")}>
        <option value="expense">Despesa</option>
        <option value="income">Receita</option>
      </select>
      <select aria-label="Categoria" value={categoriaId} onChange={(e) => onChangeCategoriaId(e.target.value)}>
        <option value="">Sem categoria</option>
        {categorias.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <input type="date" aria-label="Data" value={data} onChange={(e) => onChangeData(e.target.value)} />
      <button type="submit" className="botao botao-primario" disabled={salvando}>
        {salvando ? "Salvando..." : "Adicionar"}
      </button>
    </form>
  );
}
