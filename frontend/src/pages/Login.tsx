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
    <div className="login-screen">
      <div className="login-card">
        <div className="login-header">
          <div className="login-title">Finance Pro</div>
          <p className="login-subtitle">Entre para continuar</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label>Email</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="email@exemplo.com"
            />
          </div>

          <div className="form-field">
            <label>Senha</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="********"
            />
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
