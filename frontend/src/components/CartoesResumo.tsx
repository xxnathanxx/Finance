import { formatarMoeda } from "../lib/formatacao";

type Props = {
  receita: number;
  despesa: number;
  saldo: number;
  rotuloReceita?: string;
  rotuloDespesa?: string;
  rotuloSaldo?: string;
};

export default function CartoesResumo({
  receita,
  despesa,
  saldo,
  rotuloReceita = "Receita",
  rotuloDespesa = "Despesa",
  rotuloSaldo = "Saldo",
}: Props) {
  return (
    <div className="grade-resumo">
      <div className="cartao-resumo resumo-receita">
        <div className="cartao-resumo-rotulo">{rotuloReceita}</div>
        <div className="cartao-resumo-valor">{formatarMoeda(receita)}</div>
      </div>
      <div className="cartao-resumo resumo-despesa">
        <div className="cartao-resumo-rotulo">{rotuloDespesa}</div>
        <div className="cartao-resumo-valor">{formatarMoeda(despesa)}</div>
      </div>
      <div className={`cartao-resumo ${saldo >= 0 ? "resumo-saldo-positivo" : "resumo-saldo-negativo"}`}>
        <div className="cartao-resumo-rotulo">{rotuloSaldo}</div>
        <div className="cartao-resumo-valor">{formatarMoeda(saldo)}</div>
      </div>
    </div>
  );
}
