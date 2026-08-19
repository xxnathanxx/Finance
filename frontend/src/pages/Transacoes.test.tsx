import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Transacoes from "./Transacoes";
import { api } from "../lib/api";

vi.mock("../lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const apiMock = vi.mocked(api, true);

const categorias = [
  { id: 1, name: "Mercado", is_active: true },
  { id: 2, name: "Salário", is_active: true },
];

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function mesAtual(): string {
  return hoje().slice(0, 7);
}

function transacaoBase(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    description: "Supermercado",
    amount: 150.5,
    date: hoje(),
    type: "expense" as const,
    category_id: 1,
    category: categorias[0],
    ...overrides,
  };
}

describe("Transacoes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (!("createObjectURL" in URL)) {
      // @ts-expect-error jsdom não implementa isso
      URL.createObjectURL = vi.fn();
    }
    if (!("revokeObjectURL" in URL)) {
      // @ts-expect-error jsdom não implementa isso
      URL.revokeObjectURL = vi.fn();
    }
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  function mockCarregar(transacoes: ReturnType<typeof transacaoBase>[] = []) {
    apiMock.get.mockImplementation((url: string) => {
      if (url === "/transactions") return Promise.resolve({ data: transacoes });
      if (url === "/categories") return Promise.resolve({ data: categorias });
      return Promise.reject(new Error(`GET não mockado: ${url}`));
    });
  }

  it("carrega e mostra as transações do mês atual", async () => {
    mockCarregar([transacaoBase()]);

    render(<Transacoes />);

    expect(await screen.findByText("Supermercado")).toBeInTheDocument();
    expect(
      screen.getByText((_, node) => node?.textContent === "1 transação(ões) em " + mesAtual())
    ).toBeInTheDocument();
  });

  it("mostra estado vazio quando não há transações no período", async () => {
    mockCarregar([]);

    render(<Transacoes />);

    expect(await screen.findByText("Nenhuma transação nesse período.")).toBeInTheDocument();
  });

  it("filtro de mês esconde transações de outros meses, e 'Todas' mostra tudo", async () => {
    const user = userEvent.setup();
    mockCarregar([
      transacaoBase({ id: 1, description: "Deste mês", date: hoje() }),
      transacaoBase({ id: 2, description: "De 2015", date: "2015-01-10" }),
    ]);

    render(<Transacoes />);

    await screen.findByText("Deste mês");
    expect(screen.queryByText("De 2015")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Todas" }));

    expect(await screen.findByText("De 2015")).toBeInTheDocument();
    expect(screen.getByText("Deste mês")).toBeInTheDocument();
  });

  it("calcula os cartões de total recebido, gasto e saldo", async () => {
    mockCarregar([
      transacaoBase({
        id: 1,
        description: "Salário do mês",
        type: "income",
        amount: 1000,
        category: categorias[1],
        category_id: 2,
      }),
      transacaoBase({ id: 2, description: "Mercado do mês", type: "expense", amount: 400 }),
    ]);

    render(<Transacoes />);

    await screen.findByText("Salário do mês");

    const cartaoReceita = screen.getByText("Total recebido").closest(".cartao-resumo") as HTMLElement;
    const cartaoDespesa = screen.getByText("Total gasto").closest(".cartao-resumo") as HTMLElement;
    const cartaoSaldo = screen.getByText("Saldo do período").closest(".cartao-resumo") as HTMLElement;

    expect(within(cartaoReceita!).getByText(/1\.000,00/)).toBeInTheDocument();
    expect(within(cartaoDespesa!).getByText(/400,00/)).toBeInTheDocument();
    expect(within(cartaoSaldo!).getByText(/600,00/)).toBeInTheDocument();
  });

  it("cria uma nova transação e a mostra na lista", async () => {
    const user = userEvent.setup();
    mockCarregar([]);
    const criada = transacaoBase({ id: 99, description: "Padaria", amount: 25 });
    apiMock.post.mockResolvedValue({ data: criada });

    render(<Transacoes />);
    await screen.findByText("Nenhuma transação nesse período.");

    await user.type(screen.getByLabelText("Descrição"), "Padaria");
    await user.type(screen.getByLabelText("Valor"), "25");
    await user.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(await screen.findByText("Padaria")).toBeInTheDocument();
    expect(apiMock.post).toHaveBeenCalledWith(
      "/transactions",
      expect.objectContaining({ description: "Padaria", amount: 25, type: "expense" })
    );
  });

  it("não envia o formulário se a descrição estiver vazia", async () => {
    const user = userEvent.setup();
    mockCarregar([]);

    render(<Transacoes />);
    await screen.findByText("Nenhuma transação nesse período.");

    await user.type(screen.getByLabelText("Valor"), "25");
    await user.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it("edita uma transação existente", async () => {
    const user = userEvent.setup();
    mockCarregar([transacaoBase()]);
    const atualizada = transacaoBase({ description: "Supermercado Extra" });
    apiMock.patch.mockResolvedValue({ data: atualizada });

    render(<Transacoes />);
    await screen.findByText("Supermercado");

    await user.click(screen.getByRole("button", { name: "Editar" }));

    const linhaEdicao = screen.getByRole("button", { name: "Salvar" }).closest(".linha-transacao-edicao") as HTMLElement;
    const campoDescricao = within(linhaEdicao).getByLabelText("Descrição");
    await user.clear(campoDescricao);
    await user.type(campoDescricao, "Supermercado Extra");
    await user.click(within(linhaEdicao).getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Supermercado Extra")).toBeInTheDocument();
    expect(apiMock.patch).toHaveBeenCalledWith(
      "/transactions/1",
      expect.objectContaining({ description: "Supermercado Extra" })
    );
  });

  it("exclui uma transação após confirmar", async () => {
    const user = userEvent.setup();
    mockCarregar([transacaoBase()]);
    apiMock.delete.mockResolvedValue({ data: undefined });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<Transacoes />);
    await screen.findByText("Supermercado");

    await user.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(apiMock.delete).toHaveBeenCalledWith("/transactions/1"));
    await waitFor(() => expect(screen.queryByText("Supermercado")).not.toBeInTheDocument());
  });

  it("não exclui a transação se o usuário cancelar a confirmação", async () => {
    const user = userEvent.setup();
    mockCarregar([transacaoBase()]);
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<Transacoes />);
    await screen.findByText("Supermercado");

    await user.click(screen.getByRole("button", { name: "Excluir" }));

    expect(apiMock.delete).not.toHaveBeenCalled();
    expect(screen.getByText("Supermercado")).toBeInTheDocument();
  });

  it("mostra mensagem de erro quando falha ao carregar", async () => {
    apiMock.get.mockRejectedValue({ response: { data: { detail: "Sem conexão" } } });

    render(<Transacoes />);

    expect(await screen.findByText("Sem conexão")).toBeInTheDocument();
  });
});
