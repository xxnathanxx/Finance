import { useState } from "react";
import { login, me } from "../lib/auth";
import type { UserOut } from "../lib/auth";

type Props = {
  onLoggedIn: (user: UserOut) => void;
};

export default function Login({ onLoggedIn }: Props) {
  const [username, setUsername] = useState("admin@finance.local");
  const [password, setPassword] = useState("Admin#123456");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(username, password);
      const user = await me();
      onLoggedIn(user);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Falha ao fazer login";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 40, maxWidth: 420 }}>
      <h1 style={{ marginBottom: 8 }}>Finance Pro</h1>
      <p style={{ marginTop: 0, opacity: 0.7 }}>Entre para continuar</p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Email</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="email@exemplo.com"
            style={{ padding: 10 }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Senha</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="********"
            style={{ padding: 10 }}
          />
        </label>

        {error && (
          <div style={{ padding: 10, border: "1px solid #f5c2c7", background: "#f8d7da" }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} style={{ padding: 10 }}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
