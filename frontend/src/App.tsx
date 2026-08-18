import { useEffect, useState } from "react";
import Login from "./pages/Login";
import Categories from "./pages/Categories";
import { isLoggedIn, logout, me } from "./lib/auth";
import type { UserOut } from "./lib/auth";
import "./App.css";

type AppState =
  | { status: "loading" }
  | { status: "loggedOut" }
  | { status: "loggedIn"; user: UserOut }
  | { status: "error"; message: string };

export default function App() {
  const [state, setState] = useState<AppState>({ status: "loading" });

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
    return <div className="center-screen">Carregando...</div>;
  }

  if (state.status === "loggedOut") {
    return <Login onLoggedIn={(user) => setState({ status: "loggedIn", user })} />;
  }

  if (state.status === "error") {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-header">
            <div className="login-title">Algo deu errado</div>
            <p className="login-subtitle">{state.message}</p>
          </div>
          <button className="btn btn-primary btn-block" onClick={loadSession}>
            Tentar novamente
          </button>
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-ghost btn-block" onClick={() => logout()}>
              Voltar para login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">F</span>
          <span className="brand-name">Finance Pro</span>
        </div>

        <div className="session-info">
          <span className="session-user">{state.user.email}</span>
          <span className="role-badge">{state.user.role}</span>
          <button className="btn btn-ghost" onClick={() => logout()}>
            Logout
          </button>
        </div>
      </header>

      <main className="app-main">
        <Categories />
      </main>
    </div>
  );
}
