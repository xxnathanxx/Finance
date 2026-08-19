import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Configuracoes from "./Configuracoes";
import { api } from "../lib/api";

vi.mock("../lib/api", () => ({
  api: {
    delete: vi.fn(),
  },
}));

const apiMock = vi.mocked(api, true);

function modal(): HTMLElement {
  return document.querySelector(".modal-confirmacao") as HTMLElement;
}

describe("Configuracoes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não apaga nada sem abrir a confirmação", () => {
    render(<Configuracoes />);
    expect(apiMock.delete).not.toHaveBeenCalled();
  });

  it("o botão de confirmar fica desabilitado até digitar a palavra certa", async () => {
    const user = userEvent.setup();
    render(<Configuracoes />);

    await user.click(screen.getByRole("button", { name: "Apagar transações" }));

    const botaoConfirmar = within(modal()).getByRole("button", { name: "Apagar transações" });
    expect(botaoConfirmar).toBeDisabled();

    await user.type(within(modal()).getByPlaceholderText("APAGAR"), "coisa errada");
    expect(botaoConfirmar).toBeDisabled();

    await user.clear(within(modal()).getByPlaceholderText("APAGAR"));
    await user.type(within(modal()).getByPlaceholderText("APAGAR"), "apagar");
    expect(botaoConfirmar).toBeEnabled();
  });

  it("apaga as transações depois de confirmar com a palavra certa", async () => {
    const user = userEvent.setup();
    apiMock.delete.mockResolvedValue({ data: { transacoes_apagadas: 12 } });

    render(<Configuracoes />);

    await user.click(screen.getByRole("button", { name: "Apagar transações" }));
    await user.type(within(modal()).getByPlaceholderText("APAGAR"), "APAGAR");
    await user.click(within(modal()).getByRole("button", { name: "Apagar transações" }));

    expect(await screen.findByText(/12 transação\(ões\) apagada\(s\)/)).toBeInTheDocument();
    expect(apiMock.delete).toHaveBeenCalledWith("/account/transactions");
    expect(document.querySelector(".modal-confirmacao")).not.toBeInTheDocument();
  });

  it("cancelar fecha o modal sem apagar nada", async () => {
    const user = userEvent.setup();
    render(<Configuracoes />);

    await user.click(screen.getByRole("button", { name: "Apagar transações" }));
    await user.click(within(modal()).getByRole("button", { name: "Cancelar" }));

    expect(apiMock.delete).not.toHaveBeenCalled();
    expect(document.querySelector(".modal-confirmacao")).not.toBeInTheDocument();
  });

  it("restaura o padrão de fábrica depois de confirmar", async () => {
    const user = userEvent.setup();
    apiMock.delete.mockResolvedValue({
      data: { transacoes_apagadas: 5, regras_importacao_apagadas: 3, categorias_removidas: 2 },
    });

    render(<Configuracoes />);

    await user.click(screen.getByRole("button", { name: "Restaurar tudo" }));
    await user.type(within(modal()).getByPlaceholderText("RESTAURAR"), "RESTAURAR");
    await user.click(within(modal()).getByRole("button", { name: "Restaurar tudo" }));

    await waitFor(() => expect(apiMock.delete).toHaveBeenCalledWith("/account/reset"));
    expect(await screen.findByText(/5 transação\(ões\)/)).toBeInTheDocument();
  });

  it("mostra erro quando a chamada falha", async () => {
    const user = userEvent.setup();
    apiMock.delete.mockRejectedValue({ response: { data: { detail: "Falha no servidor" } } });

    render(<Configuracoes />);

    await user.click(screen.getByRole("button", { name: "Apagar transações" }));
    await user.type(within(modal()).getByPlaceholderText("APAGAR"), "APAGAR");
    await user.click(within(modal()).getByRole("button", { name: "Apagar transações" }));

    expect(await screen.findByText("Falha no servidor")).toBeInTheDocument();
  });
});
