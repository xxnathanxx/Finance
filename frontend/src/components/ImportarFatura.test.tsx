import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ImportarFatura from "./ImportarFatura";
import { api } from "../lib/api";

vi.mock("../lib/api", () => ({
  api: {
    post: vi.fn(),
  },
}));

const apiMock = vi.mocked(api, true);

const categorias = [
  { id: 1, name: "Mercado", is_active: true },
  { id: 2, name: "Salário", is_active: true },
];

function arquivoCsv(nome = "fatura.csv"): File {
  return new File(["Data;Descrição;Valor\n01/08/2026;Teste;10,00\n"], nome, { type: "text/csv" });
}

describe("ImportarFatura", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("desabilita 'Analisar arquivo' até escolher um arquivo", () => {
    render(<ImportarFatura categorias={categorias} aoFechar={vi.fn()} aoConcluir={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Analisar arquivo" })).toBeDisabled();
  });

  it("analisa o arquivo e mostra a tabela de revisão", async () => {
    const user = userEvent.setup();
    apiMock.post.mockResolvedValue({
      data: {
        nome_arquivo: "fatura.csv",
        itens: [
          {
            descricao: "IFOOD SAO PAULO",
            valor: 45.9,
            data: "2026-08-01",
            tipo: "expense",
            category_id: 1,
            category_name: "Mercado",
            duplicada: false,
            incluir: true,
          },
        ],
        avisos: [],
      },
    });

    render(<ImportarFatura categorias={categorias} aoFechar={vi.fn()} aoConcluir={vi.fn()} />);

    await user.upload(screen.getByLabelText("Arquivo (CSV, Excel ou PDF)"), arquivoCsv());
    await user.click(screen.getByRole("button", { name: "Analisar arquivo" }));

    expect(await screen.findByDisplayValue("IFOOD SAO PAULO")).toBeInTheDocument();
    expect(apiMock.post).toHaveBeenCalledWith("/import/preview", expect.any(FormData));

    const [, formData] = apiMock.post.mock.calls[0];
    expect((formData as FormData).get("file")).toBeInstanceOf(File);
  });

  it("não mostra o campo de senha antes de precisar", async () => {
    const user = userEvent.setup();
    render(<ImportarFatura categorias={categorias} aoFechar={vi.fn()} aoConcluir={vi.fn()} />);

    await user.upload(screen.getByLabelText("Arquivo (CSV, Excel ou PDF)"), new File(["x"], "f.pdf", { type: "application/pdf" }));

    expect(screen.queryByText("Senha do PDF")).not.toBeInTheDocument();
  });

  it("mostra o campo de senha só depois de um erro de senha", async () => {
    const user = userEvent.setup();
    apiMock.post.mockRejectedValue({ response: { data: { detail: "Esse PDF é protegido por senha." } } });

    render(<ImportarFatura categorias={categorias} aoFechar={vi.fn()} aoConcluir={vi.fn()} />);

    await user.upload(
      screen.getByLabelText("Arquivo (CSV, Excel ou PDF)"),
      new File(["x"], "f.pdf", { type: "application/pdf" })
    );
    expect(screen.queryByText("Senha do PDF")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Analisar arquivo" }));

    expect(await screen.findByText("Senha do PDF")).toBeInTheDocument();
  });

  it("confirma a importação com os itens selecionados e avisa o período importado", async () => {
    const user = userEvent.setup();
    apiMock.post.mockResolvedValueOnce({
      data: {
        nome_arquivo: "fatura.csv",
        itens: [
          {
            descricao: "IFOOD SAO PAULO",
            valor: 45.9,
            data: "2026-08-01",
            tipo: "expense",
            category_id: 1,
            category_name: "Mercado",
            duplicada: false,
            incluir: true,
          },
          {
            descricao: "SALARIO",
            valor: 3000,
            data: "2026-08-05",
            tipo: "income",
            category_id: 2,
            category_name: "Salário",
            duplicada: false,
            incluir: true,
          },
        ],
        avisos: [],
      },
    });
    apiMock.post.mockResolvedValueOnce({ data: { criadas: 2 } });
    const aoConcluir = vi.fn();

    render(<ImportarFatura categorias={categorias} aoFechar={vi.fn()} aoConcluir={aoConcluir} />);

    await user.upload(screen.getByLabelText("Arquivo (CSV, Excel ou PDF)"), arquivoCsv());
    await user.click(screen.getByRole("button", { name: "Analisar arquivo" }));
    await screen.findByDisplayValue("IFOOD SAO PAULO");

    await user.click(screen.getByRole("button", { name: "Confirmar importação (2)" }));

    await waitFor(() => expect(aoConcluir).toHaveBeenCalledWith({ inicio: "2026-08-01", fim: "2026-08-05" }));
    expect(apiMock.post).toHaveBeenLastCalledWith(
      "/import/confirm",
      expect.objectContaining({
        itens: [
          expect.objectContaining({ descricao: "IFOOD SAO PAULO", category_id: 1 }),
          expect.objectContaining({ descricao: "SALARIO", category_id: 2 }),
        ],
      })
    );
  });

  it("desmarcar um item exclui ele da confirmação", async () => {
    const user = userEvent.setup();
    apiMock.post.mockResolvedValueOnce({
      data: {
        nome_arquivo: "fatura.csv",
        itens: [
          {
            descricao: "IFOOD SAO PAULO",
            valor: 45.9,
            data: "2026-08-01",
            tipo: "expense",
            category_id: 1,
            category_name: "Mercado",
            duplicada: false,
            incluir: true,
          },
        ],
        avisos: [],
      },
    });

    render(<ImportarFatura categorias={categorias} aoFechar={vi.fn()} aoConcluir={vi.fn()} />);

    await user.upload(screen.getByLabelText("Arquivo (CSV, Excel ou PDF)"), arquivoCsv());
    await user.click(screen.getByRole("button", { name: "Analisar arquivo" }));
    await screen.findByDisplayValue("IFOOD SAO PAULO");

    await user.click(screen.getByRole("checkbox"));

    expect(screen.getByRole("button", { name: "Confirmar importação (0)" })).toBeDisabled();
  });

  it("esconde duplicadas por padrão e mostra ao clicar em 'mostrar'", async () => {
    const user = userEvent.setup();
    apiMock.post.mockResolvedValue({
      data: {
        nome_arquivo: "fatura.csv",
        itens: [
          {
            descricao: "JA IMPORTADA",
            valor: 10,
            data: "2026-08-01",
            tipo: "expense",
            category_id: null,
            category_name: null,
            duplicada: true,
            incluir: false,
          },
        ],
        avisos: [],
      },
    });

    render(<ImportarFatura categorias={categorias} aoFechar={vi.fn()} aoConcluir={vi.fn()} />);

    await user.upload(screen.getByLabelText("Arquivo (CSV, Excel ou PDF)"), arquivoCsv());
    await user.click(screen.getByRole("button", { name: "Analisar arquivo" }));

    expect(await screen.findByText("Todas as transações desse arquivo já foram importadas antes.")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("JA IMPORTADA")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /mostrar/ }));

    expect(await screen.findByDisplayValue("JA IMPORTADA")).toBeInTheDocument();
    expect(screen.getByText("possível duplicata")).toBeInTheDocument();
  });

  it("fecha o modal ao clicar em Fechar", async () => {
    const user = userEvent.setup();
    const aoFechar = vi.fn();

    render(<ImportarFatura categorias={categorias} aoFechar={aoFechar} aoConcluir={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Fechar" }));

    expect(aoFechar).toHaveBeenCalled();
  });
});
