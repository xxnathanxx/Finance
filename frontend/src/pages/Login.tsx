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
    <div className="tela-login">
      <div className="cartao-login">
        <div className="cabecalho-login">
          <div className="titulo-login">Finance Pro</div>
          <p className="subtitulo-login">Entre para continuar</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="campo-formulario">
            <label>Email</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="email@exemplo.com"
            />
          </div>

          <div className="campo-formulario">
            <label>Senha</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="********"
            />
          </div>

          {error && <div className="aviso aviso-erro">{error}</div>}

          <button type="submit" className="botao botao-primario botao-bloco" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
