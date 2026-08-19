import { formatarMoeda } from "../lib/formatacao";

type Props = {
  saldo: number;
  meta: number | null;
  editando: boolean;
  valorInput: string;
  salvando: boolean;
  onChangeValorInput: (valor: string) => void;
  onIniciarEdicao: () => void;
  onCancelarEdicao: () => void;
  onSalvar: (e: React.FormEvent) => void;
};

export default function CartaoMeta({
  saldo,
  meta,
  editando,
  valorInput,
  salvando,
  onChangeValorInput,
  onIniciarEdicao,
  onCancelarEdicao,
  onSalvar,
}: Props) {
  const metaAtingida = meta !== null && saldo >= meta;
  const progresso = meta ? Math.min(100, Math.max(0, (saldo / meta) * 100)) : 0;

  return (
    <div className="cartao cartao-meta">
      <div className="cartao-meta-cabecalho">
        <span className="cartao-meta-titulo">Meta do mês</span>

        {meta !== null && !editando && (
          <span
            className={`cartao-meta-status ${
              metaAtingida ? "cartao-meta-status-atingida" : "cartao-meta-status-em-andamento"
            }`}
          >
            {metaAtingida ? "Meta atingida! 🎉" : "Em andamento"}
          </span>
        )}
        {meta === null && !editando && (
          <span className="cartao-meta-status cartao-meta-status-sem-meta">Sem meta definida</span>
        )}
      </div>

      {editando ? (
        <form className="form-editar-meta" onSubmit={onSalvar}>
          <input
            type="number"
            step="0.01"
            min="0.01"
            placeholder="Ex: 500"
            value={valorInput}
            onChange={(e) => onChangeValorInput(e.target.value)}
            autoFocus
          />
          <button type="submit" className="botao botao-primario" disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </button>
          <button type="button" className="botao botao-secundario" onClick={onCancelarEdicao} disabled={salvando}>
            Cancelar
          </button>
        </form>
      ) : meta !== null ? (
        <>
          <div className="trilha-meta">
            <div
              className={`preenchimento-meta ${metaAtingida ? "preenchimento-meta-atingida" : ""}`}
              style={{ width: `${progresso}%` }}
            />
          </div>
          <p className="cartao-meta-texto">
            {formatarMoeda(saldo)} de {formatarMoeda(meta)}
            {!metaAtingida && meta - saldo > 0 && <> · faltam {formatarMoeda(meta - saldo)}</>}
            {" · "}
            <button type="button" className="link-botao" onClick={onIniciarEdicao}>
              Editar meta
            </button>
          </p>
        </>
      ) : (
        <p className="cartao-meta-texto">
          Defina uma meta de saldo positivo pra acompanhar seu progresso todo mês.{" "}
          <button type="button" className="link-botao" onClick={onIniciarEdicao}>
            Definir meta
          </button>
        </p>
      )}
    </div>
  );
}
