import { describe, expect, it } from "vitest";
import { formatarMoeda, mesAtualComoValorDeInput } from "./formatacao";

// toLocaleString com style "currency" usa espaço não separável entre
// "R$" e o número, não um espaço comum - normalizamos com \s antes de
// comparar em vez de depender do caractere exato.
function normalizarEspacos(texto: string): string {
  return texto.replace(/\s+/g, "_");
}

describe("formatarMoeda", () => {
  it("formata valores positivos em real brasileiro", () => {
    expect(normalizarEspacos(formatarMoeda(1234.5))).toBe("R$_1.234,50");
  });

  it("formata valores negativos", () => {
    expect(normalizarEspacos(formatarMoeda(-50))).toBe("-R$_50,00");
  });

  it("formata zero", () => {
    expect(normalizarEspacos(formatarMoeda(0))).toBe("R$_0,00");
  });
});

describe("mesAtualComoValorDeInput", () => {
  it("retorna no formato AAAA-MM", () => {
    expect(mesAtualComoValorDeInput()).toMatch(/^\d{4}-\d{2}$/);
  });
});
