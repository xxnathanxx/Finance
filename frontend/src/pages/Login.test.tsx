import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Login from "./Login";
import * as auth from "../lib/auth";

vi.mock("../lib/auth");

const authMock = vi.mocked(auth);

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.obterCredenciaisLembradas.mockReturnValue(null);
  });

  it("mostra o formulário de entrar por padrão", () => {
    render(<Login onLoggedIn={vi.fn()} />);

    expect(screen.getByText("Entre para continuar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Nome")).not.toBeInTheDocument();
  });

  it("alterna para o modo de cadastro e mostra o campo Nome", async () => {
    const user = userEvent.setup();
    render(<Login onLoggedIn={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Cadastre-se" }));

    expect(screen.getByText("Crie sua conta")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar conta" })).toBeInTheDocument();
  });

  it("faz login com sucesso e chama onLoggedIn com o usuário", async () => {
    const user = userEvent.setup();
    const usuario = { id: 1, email: "teste@example.com", name: "Teste", role: "USER" as const };
    authMock.login.mockResolvedValue({ access_token: "a", refresh_token: "b", token_type: "bearer" });
    authMock.me.mockResolvedValue(usuario);
    const onLoggedIn = vi.fn();

    render(<Login onLoggedIn={onLoggedIn} />);

    await user.type(screen.getByLabelText("Email"), "teste@example.com");
    await user.type(screen.getByLabelText("Senha"), "senha-forte-123");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(onLoggedIn).toHaveBeenCalledWith(usuario));
    expect(authMock.login).toHaveBeenCalledWith("teste@example.com", "senha-forte-123");
    expect(authMock.registrar).not.toHaveBeenCalled();
  });

  it("no modo cadastro chama registrar antes de login", async () => {
    const user = userEvent.setup();
    const usuario = { id: 2, email: "novo@example.com", name: "Novo", role: "USER" as const };
    authMock.registrar.mockResolvedValue(usuario);
    authMock.login.mockResolvedValue({ access_token: "a", refresh_token: "b", token_type: "bearer" });
    authMock.me.mockResolvedValue(usuario);

    render(<Login onLoggedIn={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Cadastre-se" }));
    await user.type(screen.getByLabelText("Nome"), "Novo");
    await user.type(screen.getByLabelText("Email"), "novo@example.com");
    await user.type(screen.getByLabelText("Senha"), "senha-forte-123");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    await waitFor(() => expect(authMock.login).toHaveBeenCalled());
    expect(authMock.registrar).toHaveBeenCalledWith("novo@example.com", "senha-forte-123", "Novo");
  });

  it("mostra mensagem de erro quando o login falha", async () => {
    const user = userEvent.setup();
    authMock.login.mockRejectedValue({ response: { data: { detail: "Credenciais inválidas" } } });

    render(<Login onLoggedIn={vi.fn()} />);

    await user.type(screen.getByLabelText("Email"), "teste@example.com");
    await user.type(screen.getByLabelText("Senha"), "senha-errada");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Credenciais inválidas")).toBeInTheDocument();
  });

  it("salva as credenciais lembradas quando o checkbox está marcado", async () => {
    const user = userEvent.setup();
    const usuario = { id: 1, email: "teste@example.com", name: "Teste", role: "USER" as const };
    authMock.login.mockResolvedValue({ access_token: "a", refresh_token: "b", token_type: "bearer" });
    authMock.me.mockResolvedValue(usuario);

    render(<Login onLoggedIn={vi.fn()} />);

    await user.type(screen.getByLabelText("Email"), "teste@example.com");
    await user.type(screen.getByLabelText("Senha"), "senha-forte-123");
    await user.click(screen.getByLabelText("Lembrar usuário e senha"));
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() =>
      expect(authMock.salvarCredenciaisLembradas).toHaveBeenCalledWith("teste@example.com", "senha-forte-123")
    );
    expect(authMock.limparCredenciaisLembradas).not.toHaveBeenCalled();
  });

  it("pré-preenche o formulário quando já existem credenciais lembradas", () => {
    authMock.obterCredenciaisLembradas.mockReturnValue({
      email: "salvo@example.com",
      password: "senha-salva",
    });

    render(<Login onLoggedIn={vi.fn()} />);

    expect(screen.getByLabelText("Email")).toHaveValue("salvo@example.com");
    expect(screen.getByLabelText("Senha")).toHaveValue("senha-salva");
    expect(screen.getByLabelText("Lembrar usuário e senha")).toBeChecked();
  });
});
