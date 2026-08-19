import { useMemo, useState } from "react";
import { api } from "../lib/api";
import { formatarMoeda, mesAtualComoValorDeInput } from "../lib/formatacao";
import { IconeVazio } from "./Icones";

type Categoria = {
  id: number;
  name: string;
  is_active: boolean;
};

type ItemImportado = {
  descricao: string;
  valor: number;
  data: string;
  tipo: "income" | "expense";
  category_id: number | null;
  category_name: string | null;
  duplicada: boolean;
  incluir: boolean;
};

type PreviewImportacao = {
  nome_arquivo: string;
  itens: ItemImportado[];
  avisos: string[];
};

type Props = {
  categorias: Categoria[];
  aoFechar: () => void;
  aoConcluir: (periodoImportado: { inicio: string; fim: string }) => void;
};

const EXTENSOES_ACEITAS = ".csv,.xlsx,.xls,.pdf";

export default function ImportarFatura({ categorias, aoFechar, aoConcluir }: Props) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [mesReferencia, setMesReferencia] = useState(mesAtualComoValorDeInput());
  const [senhaPdf, setSenhaPdf] = useState("");
  const [pdfPrecisaSenha, setPdfPrecisaSenha] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [itens, setItens] = useState<ItemImportado[] | null>(null);
  const [nomeArquivoAnalisado, setNomeArquivoAnalisado] = useState("");
  const [mostrarDuplicadas, setMostrarDuplicadas] = useState(false);

  const categoriasAtivas = useMemo(() => categorias.filter((c) => c.is_active), [categorias]);

  const selecionados = useMemo(() => (itens ?? []).filter((i) => i.incluir), [itens]);

  const itensComIndice = useMemo(
    () => (itens ?? []).map((item, indice) => ({ item, indice })),
    [itens]
  );

  const duplicadasCount = useMemo(() => itensComIndice.filter((x) => x.item.duplicada).length, [itensComIndice]);

  const itensParaExibir = useMemo(
    () => (mostrarDuplicadas ? itensComIndice : itensComIndice.filter((x) => !x.item.duplicada)),
    [itensComIndice, mostrarDuplicadas]
  );

  async function analisar() {
    if (!arquivo) return;

    setAnalisando(true);
    setErro(null);
    setItens(null);
    setMostrarDuplicadas(false);

    try {
      const formData = new FormData();
      formData.append("file", arquivo);
      if (mesReferencia) formData.append("mes_referencia", mesReferencia);
      if (senhaPdf) formData.append("senha_pdf", senhaPdf);

      const res = await api.post<PreviewImportacao>("/import/preview", formData);
      setItens(res.data.itens);
      setAvisos(res.data.avisos);
      setNomeArquivoAnalisado(res.data.nome_arquivo);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Falha ao analisar o arquivo";
      setErro(msg);
      if (typeof msg === "string" && msg.toLowerCase().includes("senha")) {
        setPdfPrecisaSenha(true);
      }
    } finally {
      setAnalisando(false);
    }
  }

  function atualizarItem(indice: number, mudanca: Partial<ItemImportado>) {
    setItens((prev) => {
      if (!prev) return prev;
      const copia = [...prev];
      copia[indice] = { ...copia[indice], ...mudanca };
      return copia;
    });
  }

  async function confirmar() {
    if (!itens || selecionados.length === 0) return;

    setConfirmando(true);
    setErro(null);

    try {
      await api.post("/import/confirm", {
        itens: selecionados.map((i) => ({
          descricao: i.descricao,
          valor: i.valor,
          data: i.data,
          tipo: i.tipo,
          category_id: i.category_id,
        })),
      });

      const datas = selecionados.map((i) => i.data).sort();
      aoConcluir({ inicio: datas[0], fim: datas[datas.length - 1] });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Falha ao confirmar a importação";
      setErro(msg);
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <div className="sobreposicao-modal" onClick={aoFechar}>
      <div className="modal-importacao" onClick={(e) => e.stopPropagation()}>
        <div className="cabecalho-modal">
          <div>
            <h3>Importar fatura, conta ou holerite</h3>
            <p className="subtitulo-pagina">
              Envie o CSV/Excel do cartão, o PDF da fatura, o PDF de um boleto (luz, água, telefone...) ou o
              PDF do seu holerite. Nada é salvo até você revisar e confirmar.
            </p>
          </div>
          <button className="botao botao-secundario" onClick={aoFechar}>
            Fechar
          </button>
        </div>

        {!itens && (
          <div className="formulario-importacao">
            <label className="campo-formulario">
              <span>Arquivo (CSV, Excel ou PDF)</span>
              <input
                type="file"
                accept={EXTENSOES_ACEITAS}
                onChange={(e) => {
                  setArquivo(e.target.files?.[0] ?? null);
                  setPdfPrecisaSenha(false);
                  setSenhaPdf("");
                  setErro(null);
                  // limpa o valor do input: se o navegador não fizer isso sozinho,
                  // escolher o MESMO arquivo de novo depois não dispara onChange
                  e.target.value = "";
                }}
              />
            </label>
            <label className="campo-formulario">
              <span>Mês de referência (usado quando o arquivo não tem o ano na data)</span>
              <input type="month" value={mesReferencia} onChange={(e) => setMesReferencia(e.target.value)} />
            </label>

            {pdfPrecisaSenha && (
              <label className="campo-formulario">
                <span>Senha do PDF</span>
                <input
                  type="password"
                  value={senhaPdf}
                  onChange={(e) => setSenhaPdf(e.target.value)}
                  placeholder="Esse arquivo é protegido por senha"
                  autoFocus
                />
              </label>
            )}

            {erro && (
              <div className="aviso aviso-erro" role="alert">
                {erro}
              </div>
            )}

            <button className="botao botao-primario" onClick={analisar} disabled={!arquivo || analisando}>
              {analisando ? "Analisando..." : "Analisar arquivo"}
            </button>
          </div>
        )}

        {itens && (
          <>
            {avisos.length > 0 && (
              <div className="aviso aviso-erro" role="alert">
                {avisos.map((a, i) => (
                  <div key={i}>{a}</div>
                ))}
              </div>
            )}

            {erro && (
              <div className="aviso aviso-erro" role="alert">
                {erro}
              </div>
            )}

            {itens.length === 0 ? (
              <div className="estado-vazio">
                <IconeVazio />
                Nenhuma transação encontrada em {nomeArquivoAnalisado}.
              </div>
            ) : (
              <>
                <div className="resumo-importacao">
                  <strong>{selecionados.length}</strong> de {itens.length} serão importadas de{" "}
                  {nomeArquivoAnalisado}
                  {duplicadasCount > 0 && (
                    <>
                      {" "}
                      ·{" "}
                      {mostrarDuplicadas ? (
                        <button className="link-botao" onClick={() => setMostrarDuplicadas(false)}>
                          ocultar {duplicadasCount} já importada(s) antes
                        </button>
                      ) : (
                        <button className="link-botao" onClick={() => setMostrarDuplicadas(true)}>
                          {duplicadasCount} já importada(s) antes estão ocultas - mostrar
                        </button>
                      )}
                    </>
                  )}
                </div>

                {itensParaExibir.length === 0 ? (
                  <div className="estado-vazio">
                    <IconeVazio />
                    Todas as transações desse arquivo já foram importadas antes.
                  </div>
                ) : (
                  <div className="tabela-importacao-wrapper">
                    <table className="tabela-importacao">
                      <thead>
                        <tr>
                          <th></th>
                          <th>Data</th>
                          <th>Descrição</th>
                          <th>Valor</th>
                          <th>Tipo</th>
                          <th>Categoria</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itensParaExibir.map(({ item, indice }) => (
                          <tr key={indice} className={item.duplicada ? "linha-importacao-duplicada" : ""}>
                            <td>
                              <input
                                type="checkbox"
                                checked={item.incluir}
                                onChange={(e) => atualizarItem(indice, { incluir: e.target.checked })}
                              />
                            </td>
                            <td>
                              <input
                                type="date"
                                value={item.data}
                                onChange={(e) => atualizarItem(indice, { data: e.target.value })}
                              />
                            </td>
                            <td>
                              <input
                                className="campo-descricao-importacao"
                                value={item.descricao}
                                onChange={(e) => atualizarItem(indice, { descricao: e.target.value })}
                              />
                              {item.duplicada && <span className="selo-duplicada">possível duplicata</span>}
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="campo-valor-importacao"
                                value={item.valor}
                                onChange={(e) => atualizarItem(indice, { valor: Number(e.target.value) })}
                              />
                            </td>
                            <td>
                              <select
                                value={item.tipo}
                                onChange={(e) =>
                                  atualizarItem(indice, { tipo: e.target.value as "income" | "expense" })
                                }
                              >
                                <option value="expense">Despesa</option>
                                <option value="income">Receita</option>
                              </select>
                            </td>
                            <td>
                              <select
                                value={item.category_id ?? ""}
                                onChange={(e) =>
                                  atualizarItem(indice, {
                                    category_id: e.target.value ? Number(e.target.value) : null,
                                  })
                                }
                              >
                                <option value="">Sem categoria</option>
                                {categoriasAtivas.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="rodape-modal">
                  <span className="subtitulo-pagina">
                    Total selecionado:{" "}
                    {formatarMoeda(
                      selecionados.reduce((soma, i) => soma + (i.tipo === "income" ? i.valor : -i.valor), 0)
                    )}
                  </span>
                  <div className="acoes-linha">
                    <button className="botao botao-secundario" onClick={() => setItens(null)} disabled={confirmando}>
                      Voltar
                    </button>
                    <button
                      className="botao botao-primario"
                      onClick={confirmar}
                      disabled={confirmando || selecionados.length === 0}
                    >
                      {confirmando ? "Importando..." : `Confirmar importação (${selecionados.length})`}
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
