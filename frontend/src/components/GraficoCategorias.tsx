import { formatarMoeda } from "../lib/formatacao";

type CategoriaExibida = {
  nome: string;
  total: number;
  percentual: number;
  cor: string;
};

type TipoGrafico = "pizza" | "barras";
type VisaoCategoria = "despesas" | "receitas";

type Props = {
  categorias: CategoriaExibida[];
  rotuloPeriodo: string;
  visaoCategoria: VisaoCategoria;
  onChangeVisaoCategoria: (visao: VisaoCategoria) => void;
  tipoGrafico: TipoGrafico;
  onChangeTipoGrafico: (tipo: TipoGrafico) => void;
  gradientePizza: string;
  maiorValor: number;
};

export default function GraficoCategorias({
  categorias,
  rotuloPeriodo,
  visaoCategoria,
  onChangeVisaoCategoria,
  tipoGrafico,
  onChangeTipoGrafico,
  gradientePizza,
  maiorValor,
}: Props) {
  return (
    <div className="cartao">
      <div className="cabecalho-cartao cabecalho-cartao-com-acoes">
        <div className="alternador-grafico">
          <button
            type="button"
            className={`botao-alternador${
              visaoCategoria === "despesas" ? " botao-alternador-ativo botao-alternador-despesa" : ""
            }`}
            onClick={() => onChangeVisaoCategoria("despesas")}
          >
            Despesas
          </button>
          <button
            type="button"
            className={`botao-alternador${
              visaoCategoria === "receitas" ? " botao-alternador-ativo botao-alternador-receita" : ""
            }`}
            onClick={() => onChangeVisaoCategoria("receitas")}
          >
            Receitas
          </button>
        </div>

        {categorias.length > 0 && (
          <div className="alternador-grafico">
            <button
              type="button"
              className={`botao-alternador${tipoGrafico === "pizza" ? " botao-alternador-ativo" : ""}`}
              onClick={() => onChangeTipoGrafico("pizza")}
            >
              Pizza
            </button>
            <button
              type="button"
              className={`botao-alternador${tipoGrafico === "barras" ? " botao-alternador-ativo" : ""}`}
              onClick={() => onChangeTipoGrafico("barras")}
            >
              Barras
            </button>
          </div>
        )}
      </div>

      <div className="cabecalho-cartao">
        <strong>{visaoCategoria === "despesas" ? "Despesas" : "Receitas"} por categoria</strong>
        <span> · {rotuloPeriodo}</span>
      </div>

      {categorias.length === 0 ? (
        <div className="estado-vazio">
          Nenhuma {visaoCategoria === "despesas" ? "despesa" : "receita"} registrada nesse período.
        </div>
      ) : tipoGrafico === "pizza" ? (
        <div className="grafico-pizza-container">
          <div className="grafico-pizza-donut" style={{ background: gradientePizza }}>
            <div className="grafico-pizza-furo">
              <span className="grafico-pizza-furo-rotulo">
                {visaoCategoria === "despesas" ? "Despesas" : "Receitas"}
              </span>
              <span className="grafico-pizza-furo-valor">
                {formatarMoeda(categorias.reduce((soma, c) => soma + c.total, 0))}
              </span>
            </div>
          </div>

          <div className="grafico-pizza-legenda">
            {categorias.map((cat) => (
              <div key={cat.nome} className="legenda-item">
                <span className="legenda-cor" style={{ backgroundColor: cat.cor }} />
                <span className="legenda-nome">{cat.nome}</span>
                <span className="legenda-valor" style={{ color: cat.cor }}>
                  {formatarMoeda(cat.total)} · {cat.percentual.toFixed(1)}% do total
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grafico-barras">
          {categorias.map((cat) => (
            <div key={cat.nome} className="linha-barra">
              <div className="rotulo-barra">
                <span className="rotulo-barra-nome">{cat.nome}</span>
                <span className="rotulo-barra-valor" style={{ color: cat.cor }}>
                  {formatarMoeda(cat.total)} · {cat.percentual.toFixed(1)}% do total
                </span>
              </div>
              <div className="trilha-barra">
                <div
                  className="preenchimento-barra"
                  style={{
                    width: `${maiorValor > 0 ? (cat.total / maiorValor) * 100 : 0}%`,
                    backgroundColor: cat.cor,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
