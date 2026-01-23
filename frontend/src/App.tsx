import { useEffect, useState } from "react";
import Login from "./pages/Login";
import Categories from "./pages/Categories";
import { isLoggedIn, logout, me } from "./lib/auth";
import type { UserOut } from "./lib/auth";

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

  if (state.status === "loading") return <div style={{ padding: 40 }}>Carregando...</div>;

  if (state.status === "loggedOut") {
    return <Login onLoggedIn={(user) => setState({ status: "loggedIn", user })} />;
  }

  if (state.status === "error") {
    return (
      <div style={{ padding: 40 }}>
        <h2>Erro</h2>
        <p>{state.message}</p>
        <button onClick={loadSession}>Tentar novamente</button>
        <div style={{ marginTop: 12 }}>
          <button onClick={() => logout()}>Voltar para login</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "sans-serif" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 24px",
          borderBottom: "1px solid #eee",
        }}
      >
        <div>
          <strong>Finance Pro</strong>{" "}
          <span style={{ opacity: 0.7 }}>
            — {state.user.email} ({state.user.role})
          </span>
        </div>
        <button onClick={() => logout()} style={{ padding: "8px 12px" }}>
          Logout
        </button>
      </header>

      <main>
        <Categories />
      </main>
    </div>
  );
}
