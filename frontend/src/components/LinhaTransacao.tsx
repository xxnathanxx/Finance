import { formatarData, formatarMoeda } from "../lib/formatacao";
import { IconeEditar, IconeExcluir } from "./Icones";

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

export type FormularioEdicao = {
  descricao: string;
  valor: string;
  tipo: "income" | "expense";
  categoriaId: string;
  data: string;
};

type Props = {
  transacao: Transacao;
  categorias: Categoria[];
  emEdicao: boolean;
  edicao: FormularioEdicao | null;
  ocupado: boolean;
  onChangeEdicao: (edicao: FormularioEdicao) => void;
  onIniciarEdicao: () => void;
  onCancelarEdicao: () => void;
  onSalvarEdicao: () => void;
  onExcluir: () => void;
};

export default function LinhaTransacao({
  transacao: t,
  categorias,
  emEdicao,
  edicao,
  ocupado,
  onChangeEdicao,
  onIniciarEdicao,
  onCancelarEdicao,
  onSalvarEdicao,
  onExcluir,
}: Props) {
  if (emEdicao && edicao) {
    return (
      <div className="linha-transacao linha-transacao-edicao">
        <input
          type="date"
          aria-label="Data"
          value={edicao.data}
          onChange={(e) => onChangeEdicao({ ...edicao, data: e.target.value })}
        />
        <input
          className="campo-descricao"
          aria-label="Descrição"
          value={edicao.descricao}
          onChange={(e) => onChangeEdicao({ ...edicao, descricao: e.target.value })}
        />
        <select
          aria-label="Categoria"
          value={edicao.categoriaId}
          onChange={(e) => onChangeEdicao({ ...edicao, categoriaId: e.target.value })}
        >
          <option value="">Sem categoria</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Tipo"
          value={edicao.tipo}
          onChange={(e) => onChangeEdicao({ ...edicao, tipo: e.target.value as "income" | "expense" })}
        >
          <option value="expense">Despesa</option>
          <option value="income">Receita</option>
        </select>
        <input
          className="campo-valor"
          type="number"
          step="0.01"
          min="0"
          aria-label="Valor"
          value={edicao.valor}
          onChange={(e) => onChangeEdicao({ ...edicao, valor: e.target.value })}
        />
        <div className="acoes-linha">
          <button className="botao botao-primario" onClick={onSalvarEdicao} disabled={ocupado}>
            {ocupado ? "Salvando..." : "Salvar"}
          </button>
          <button className="botao botao-secundario" onClick={onCancelarEdicao} disabled={ocupado}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="linha-transacao">
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
        <button className="botao botao-secundario botao-com-icone" onClick={onIniciarEdicao} disabled={ocupado}>
          <IconeEditar /> Editar
        </button>
        <button className="botao botao-perigo botao-com-icone" onClick={onExcluir} disabled={ocupado}>
          <IconeExcluir /> {ocupado ? "Excluindo..." : "Excluir"}
        </button>
      </div>
    </div>
  );
}
