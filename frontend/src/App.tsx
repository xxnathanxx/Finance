import { useEffect, useState } from "react";
import Login from "./pages/Login";
import Categories from "./pages/Categories";
import Relatorio from "./pages/Relatorio";
import Transacoes from "./pages/Transacoes";
import { isLoggedIn, logout, me } from "./lib/auth";
import type { UserOut } from "./lib/auth";
import "./App.css";

type AppState =
  | { status: "loading" }
  | { status: "loggedOut" }
  | { status: "loggedIn"; user: UserOut }
  | { status: "error"; message: string };

type Aba = "transacoes" | "categorias" | "relatorio";

export default function App() {
  const [state, setState] = useState<AppState>({ status: "loading" });
  const [abaAtiva, setAbaAtiva] = useState<Aba>("transacoes");

  async function loadSession() {
    if (!isLoggedIn()) {
      setState({ status: "loggedOut" });
      return;
    }

    try {
      const user = await me();
      setState({ status: "loggedIn", user });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Falha ao carregar sessão";
      setState({ status: "error", message: msg });
    }
  }

  useEffect(() => {
    loadSession();

    const onLoggedOut = () => setState({ status: "loggedOut" });
    window.addEventListener("finance:loggedOut", onLoggedOut);
    return () => window.removeEventListener("finance:loggedOut", onLoggedOut);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.status === "loading") {
    return <div className="tela-central">Carregando...</div>;
  }

  if (state.status === "loggedOut") {
    return <Login onLoggedIn={(user) => setState({ status: "loggedIn", user })} />;
  }

  if (state.status === "error") {
    return (
      <div className="tela-login">
        <div className="cartao-login">
          <div className="cabecalho-login">
            <div className="titulo-login">Algo deu errado</div>
            <p className="subtitulo-login">{state.message}</p>
          </div>
          <button className="botao botao-primario botao-bloco" onClick={loadSession}>
            Tentar novamente
          </button>
          <div style={{ marginTop: 10 }}>
            <button className="botao botao-secundario botao-bloco" onClick={() => logout()}>
              Voltar para login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="estrutura-app">
      <header className="cabecalho-app">
        <div className="marca">
          <span className="selo-marca">Ó</span>
          <span className="nome-marca">Órbita</span>
        </div>

        <div className="info-sessao">
          <span className="usuario-sessao">{state.user.email}</span>
          <span className="selo-cargo">{state.user.role}</span>
          <button className="botao botao-secundario" onClick={() => logout()}>
            Sair
          </button>
        </div>
      </header>

      <nav className="navegacao-abas">
        <button
          className={`aba-botao${abaAtiva === "transacoes" ? " aba-ativa" : ""}`}
          onClick={() => setAbaAtiva("transacoes")}
        >
          Transações
        </button>
        <button
          className={`aba-botao${abaAtiva === "relatorio" ? " aba-ativa" : ""}`}
          onClick={() => setAbaAtiva("relatorio")}
        >
          Relatório
        </button>
        <button
          className={`aba-botao${abaAtiva === "categorias" ? " aba-ativa" : ""}`}
          onClick={() => setAbaAtiva("categorias")}
        >
          Categorias
        </button>
      </nav>

      <main className="conteudo-app">
        {abaAtiva === "transacoes" && <Transacoes />}
        {abaAtiva === "relatorio" && <Relatorio />}
        {abaAtiva === "categorias" && <Categories />}
      </main>
    </div>
  );
}
