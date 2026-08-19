import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Categories from "./Categories";
import { api } from "../lib/api";

vi.mock("../lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

const apiMock = vi.mocked(api, true);

const categoriaAtiva = { id: 1, name: "Mercado", is_active: true };
const categoriaOculta = { id: 2, name: "Antiga", is_active: false };

describe("Categories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("carrega e mostra só as categorias ativas por padrão", async () => {
    apiMock.get.mockResolvedValue({ data: [categoriaAtiva] });

    render(<Categories />);

    expect(await screen.findByText("Mercado")).toBeInTheDocument();
    expect(apiMock.get).toHaveBeenCalledWith("/categories");
  });

  it("marcar 'Mostrar ocultas' busca todas e mostra a categoria oculta", async () => {
    const user = userEvent.setup();
    apiMock.get.mockResolvedValueOnce({ data: [categoriaAtiva] });
    apiMock.get.mockResolvedValueOnce({ data: [categoriaAtiva, categoriaOculta] });

    render(<Categories />);
    await screen.findByText("Mercado");

    await user.click(screen.getByLabelText(/Mostrar ocultas/));

    expect(await screen.findByText("Antiga")).toBeInTheDocument();
    expect(apiMock.get).toHaveBeenLastCalledWith("/categories?active_only=false");
  });

  it("cria uma nova categoria", async () => {
    const user = userEvent.setup();
    apiMock.get.mockResolvedValue({ data: [] });
    apiMock.post.mockResolvedValue({ data: { id: 3, name: "Lazer", is_active: true } });

    render(<Categories />);
    await screen.findByText("Nenhuma categoria ativa. Marque “Mostrar ocultas” para ver as ocultas.");

    await user.type(screen.getByPlaceholderText("Nova categoria (ex: Mercado)"), "Lazer");
    await user.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(await screen.findByText("Lazer")).toBeInTheDocument();
    expect(apiMock.post).toHaveBeenCalledWith(
      "/categories",
      { name: "Lazer" },
      expect.objectContaining({ headers: expect.objectContaining({ "Content-Type": "application/json" }) })
    );
  });

  it("oculta uma categoria após confirmar", async () => {
    const user = userEvent.setup();
    apiMock.get.mockResolvedValue({ data: [categoriaAtiva] });
    apiMock.patch.mockResolvedValue({ data: { ...categoriaAtiva, is_active: false } });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<Categories />);
    await screen.findByText("Mercado");

    await user.click(screen.getByRole("button", { name: "Ocultar" }));

    await waitFor(() => expect(apiMock.patch).toHaveBeenCalledWith("/categories/1/hide", null));
    // já não é mais exibida (showHidden continua falso)
    expect(screen.queryByText("Mercado")).not.toBeInTheDocument();
  });

  it("edita o nome de uma categoria", async () => {
    const user = userEvent.setup();
    apiMock.get.mockResolvedValue({ data: [categoriaAtiva] });
    apiMock.patch.mockResolvedValue({ data: { ...categoriaAtiva, name: "Mercado e Feira" } });

    render(<Categories />);
    await screen.findByText("Mercado");

    await user.click(screen.getByRole("button", { name: "Editar" }));
    const campo = screen.getByDisplayValue("Mercado");
    await user.clear(campo);
    await user.type(campo, "Mercado e Feira");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Mercado e Feira")).toBeInTheDocument();
    expect(apiMock.patch).toHaveBeenCalledWith(
      "/categories/1",
      { name: "Mercado e Feira" },
      expect.objectContaining({ headers: expect.objectContaining({ "Content-Type": "application/json" }) })
    );
  });
});
