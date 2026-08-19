import { useState } from "react";

type Props = {
  titulo: string;
  descricao: string;
  palavraConfirmacao: string;
  textoBotao: string;
  executando: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
};

export default function ConfirmarAcaoPerigosa({
  titulo,
  descricao,
  palavraConfirmacao,
  textoBotao,
  executando,
  onConfirmar,
  onCancelar,
}: Props) {
  const [textoDigitado, setTextoDigitado] = useState("");
  const confirmado = textoDigitado.trim().toUpperCase() === palavraConfirmacao.toUpperCase();

  return (
    <div className="sobreposicao-modal" onClick={onCancelar}>
      <div className="modal-confirmacao" onClick={(e) => e.stopPropagation()}>
        <h3>{titulo}</h3>
        <p>{descricao}</p>

        <label className="campo-formulario">
          <span>
            Pra confirmar, digite <strong>{palavraConfirmacao}</strong> abaixo
          </span>
          <input
            value={textoDigitado}
            onChange={(e) => setTextoDigitado(e.target.value)}
            placeholder={palavraConfirmacao}
            autoFocus
          />
        </label>

        <div className="acoes-linha">
          <button className="botao botao-secundario" onClick={onCancelar} disabled={executando}>
            Cancelar
          </button>
          <button className="botao botao-perigo" onClick={onConfirmar} disabled={!confirmado || executando}>
            {executando ? "Processando..." : textoBotao}
          </button>
        </div>
      </div>
    </div>
  );
}
