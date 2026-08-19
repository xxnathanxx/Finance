import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Relatorio from "./Relatorio";
import { api } from "../lib/api";

vi.mock("../lib/api", () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

const apiMock = vi.mocked(api, true);

const resumoMensal = {
  month: "2026-08",
  total_income: 3000,
  total_expense: 400,
  balance: 2600,
  expenses_by_category: [{ category_id: 1, category_name: "Mercado", total: 400 }],
  income_by_category: [{ category_id: 2, category_name: "Salário", total: 3000 }],
};

function mockSettings(monthly_goal: number | null = null) {
  apiMock.get.mockImplementation((url: string) => {
    if (url === "/settings") return Promise.resolve({ data: { monthly_goal } });
    if (url.startsWith("/reports/monthly/")) return Promise.resolve({ data: resumoMensal });
    if (url === "/reports/period") return Promise.resolve({ data: { ...resumoMensal, start_date: "2000-01-01", end_date: "2100-01-01" } });
    return Promise.reject(new Error(`GET não mockado: ${url}`));
  });
}

describe("Relatorio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("carrega o resumo mensal por padrão", async () => {
    mockSettings();

    render(<Relatorio />);

    const cartaoReceita = await screen.findByText("Receita");
    expect(within(cartaoReceita.closest(".cartao-resumo") as HTMLElement).getByText(/3\.000,00/)).toBeInTheDocument();
    expect(apiMock.get).toHaveBeenCalledWith(expect.stringMatching(/^\/reports\/monthly\/\d{4}\/\d{1,2}$/));
  });

  it("troca pra 'Todas' e busca o período completo", async () => {
    const user = userEvent.setup();
    mockSettings();

    render(<Relatorio />);
    await screen.findByText("Receita");

    await user.click(screen.getByRole("button", { name: "Todas" }));

    await waitFor(() =>
      expect(apiMock.get).toHaveBeenCalledWith("/reports/period", {
        params: { start: "2000-01-01", end: "2100-01-01" },
      })
    );
  });

  it("mostra as categorias de despesa por padrão e troca pra receita", async () => {
    const user = userEvent.setup();
    mockSettings();

    render(<Relatorio />);
    await screen.findByText("Mercado");
    expect(screen.queryByText("Salário")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Receitas" }));

    expect(await screen.findByText("Salário")).toBeInTheDocument();
    expect(screen.queryByText("Mercado")).not.toBeInTheDocument();
  });

  it("alterna entre gráfico de pizza e barras", async () => {
    const user = userEvent.setup();
    mockSettings();

    render(<Relatorio />);
    await screen.findByText("Mercado");

    expect(document.querySelector(".grafico-pizza-container")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Barras" }));

    expect(document.querySelector(".grafico-barras")).toBeInTheDocument();
    expect(document.querySelector(".grafico-pizza-container")).not.toBeInTheDocument();
  });

  it("limpa o resumo da tela quando a busca falha", async () => {
    apiMock.get.mockImplementation((url: string) => {
      if (url === "/settings") return Promise.resolve({ data: { monthly_goal: null } });
      return Promise.reject({ response: { data: { detail: "Falha ao carregar" } } });
    });

    render(<Relatorio />);

    expect(await screen.findByText("Falha ao carregar")).toBeInTheDocument();
    expect(screen.queryByText("Receita")).not.toBeInTheDocument();
  });

  it("define uma meta mensal nova", async () => {
    const user = userEvent.setup();
    mockSettings(null);
    apiMock.put.mockResolvedValue({ data: { monthly_goal: 1000 } });

    render(<Relatorio />);
    await screen.findByText("Receita");

    await user.click(screen.getByText("Definir meta"));
    await user.type(screen.getByRole("spinbutton"), "1000");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(apiMock.put).toHaveBeenCalledWith("/settings", { monthly_goal: 1000 })
    );
  });
});
