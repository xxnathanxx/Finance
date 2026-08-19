import { useState } from "react";
import { api } from "../lib/api";
import ConfirmarAcaoPerigosa from "../components/ConfirmarAcaoPerigosa";
import { IconeAlerta } from "../components/Icones";

type ModalAberto = "transacoes" | "tudo" | null;

type LimparTransacoesOut = {
  transacoes_apagadas: number;
};

type RestaurarPadraoOut = {
  transacoes_apagadas: number;
  regras_importacao_apagadas: number;
  categorias_removidas: number;
};

export default function Configuracoes() {
  const [modalAberto, setModalAberto] = useState<ModalAberto>(null);
  const [executando, setExecutando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function apagarTransacoes() {
    setExecutando(true);
    setErro(null);

    try {
      const res = await api.delete<LimparTransacoesOut>("/account/transactions");
      setResultado(
        `${res.data.transacoes_apagadas} transação(ões) apagada(s). Categorias, meta e regras de importação continuam como estavam.`
      );
      setModalAberto(null);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Falha ao apagar transações";
      setErro(msg);
    } finally {
      setExecutando(false);
    }
  }

  async function restaurarPadrao() {
    setExecutando(true);
    setErro(null);

    try {
      const res = await api.delete<RestaurarPadraoOut>("/account/reset");
      setResultado(
        `Conta restaurada: ${res.data.transacoes_apagadas} transação(ões), ` +
          `${res.data.regras_importacao_apagadas} regra(s) de importação e ` +
          `${res.data.categorias_removidas} categoria(s) personalizada(s) apagadas.`
      );
      setModalAberto(null);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Falha ao restaurar a conta";
      setErro(msg);
    } finally {
      setExecutando(false);
    }
  }

  return (
    <div>
      <div className="cabecalho-pagina">
        <h2 className="titulo-pagina">Configurações</h2>
        <p className="subtitulo-pagina">Preferências e opções avançadas da conta.</p>
      </div>

      {resultado && (
        <div className="aviso aviso-sucesso" role="status">
          {resultado}
        </div>
      )}
      {erro && (
        <div className="aviso aviso-erro" role="alert">
          {erro}
        </div>
      )}

      <div className="cartao cartao-zona-perigo">
        <div className="cabecalho-cartao cabecalho-zona-perigo">
          <IconeAlerta className="icone-perigo" /> Zona de perigo
        </div>

        <div className="zona-perigo-item">
          <div>
            <strong>Apagar todas as transações</strong>
            <p>
              Remove permanentemente todas as receitas e despesas registradas. Categorias, meta mensal e
              regras de importação continuam como estão.
            </p>
          </div>
          <button className="botao botao-perigo" onClick={() => setModalAberto("transacoes")}>
            Apagar transações
          </button>
        </div>

        <div className="zona-perigo-item">
          <div>
            <strong>Restaurar para o padrão de fábrica</strong>
            <p>
              Apaga todas as transações, a meta mensal e as regras de importação aprendidas, e restaura as
              categorias para a lista original - como se a conta tivesse acabado de ser criada.
            </p>
          </div>
          <button className="botao botao-perigo" onClick={() => setModalAberto("tudo")}>
            Restaurar tudo
          </button>
        </div>
      </div>

      {modalAberto === "transacoes" && (
        <ConfirmarAcaoPerigosa
          titulo="Apagar todas as transações"
          descricao="Isso vai apagar permanentemente todas as suas receitas e despesas. Essa ação não pode ser desfeita."
          palavraConfirmacao="APAGAR"
          textoBotao="Apagar transações"
          executando={executando}
          onConfirmar={apagarTransacoes}
          onCancelar={() => setModalAberto(null)}
        />
      )}

      {modalAberto === "tudo" && (
        <ConfirmarAcaoPerigosa
          titulo="Restaurar para o padrão de fábrica"
          descricao="Isso vai apagar todas as transações, a meta mensal e as regras de importação aprendidas, e restaurar as categorias originais. Essa ação não pode ser desfeita."
          palavraConfirmacao="RESTAURAR"
          textoBotao="Restaurar tudo"
          executando={executando}
          onConfirmar={restaurarPadrao}
          onCancelar={() => setModalAberto(null)}
        />
      )}
    </div>
  );
}
