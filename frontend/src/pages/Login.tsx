import { useEffect, useState } from "react";
import {
  limparCredenciaisLembradas,
  login,
  me,
  obterCredenciaisLembradas,
  registrar,
  salvarCredenciaisLembradas,
} from "../lib/auth";
import type { UserOut } from "../lib/auth";

type Props = {
  onLoggedIn: (user: UserOut) => void;
};

type Modo = "entrar" | "cadastrar";

export default function Login({ onLoggedIn }: Props) {
  const [modo, setModo] = useState<Modo>("entrar");

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [lembrar, setLembrar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const lembradas = obterCredenciaisLembradas();
    if (lembradas) {
      setEmail(lembradas.email);
      setSenha(lembradas.password);
      setLembrar(true);
    }
  }, []);

  function alternarModo() {
    setModo((m) => (m === "entrar" ? "cadastrar" : "entrar"));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (modo === "cadastrar") {
        await registrar(email, senha, nome);
      }
      await login(email, senha);

      if (lembrar) {
        salvarCredenciaisLembradas(email, senha);
      } else {
        limparCredenciaisLembradas();
      }

      const user = await me();
      onLoggedIn(user);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        (modo === "cadastrar" ? "Falha ao cadastrar" : "Falha ao fazer login");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="tela-login">
      <div className="cartao-login">
        <div className="cabecalho-login">
          <div className="titulo-login">Órbita</div>
          <p className="subtitulo-login">
            {modo === "entrar" ? "Entre para continuar" : "Crie sua conta"}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {modo === "cadastrar" && (
            <div className="campo-formulario">
              <label htmlFor="campo-nome">Nome</label>
              <input
                id="campo-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
              />
            </div>
          )}

          <div className="campo-formulario">
            <label htmlFor="campo-email">Email</label>
            <input
              id="campo-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
            />
          </div>

          <div className="campo-formulario">
            <label htmlFor="campo-senha">Senha</label>
            <input
              id="campo-senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              type="password"
              placeholder="********"
            />
          </div>

          <label className="rotulo-checkbox rotulo-checkbox-login">
            <input
              type="checkbox"
              checked={lembrar}
              onChange={(e) => setLembrar(e.target.checked)}
            />
            Lembrar usuário e senha
          </label>

          {error && <div className="aviso aviso-erro">{error}</div>}

          <button type="submit" className="botao botao-primario botao-bloco" disabled={loading}>
            {loading
              ? modo === "entrar"
                ? "Entrando..."
                : "Cadastrando..."
              : modo === "entrar"
                ? "Entrar"
                : "Criar conta"}
          </button>
        </form>

        <div className="alternar-modo-login">
          {modo === "entrar" ? (
            <>
              Não tem conta?{" "}
              <button type="button" className="link-botao" onClick={alternarModo}>
                Cadastre-se
              </button>
            </>
          ) : (
            <>
              Já tem conta?{" "}
              <button type="button" className="link-botao" onClick={alternarModo}>
                Entrar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
