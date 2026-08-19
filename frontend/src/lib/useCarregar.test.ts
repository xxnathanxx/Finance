import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCarregar } from "./useCarregar";

describe("useCarregar", () => {
  it("busca os dados ao montar e atualiza carregando/dados", async () => {
    const buscar = vi.fn().mockResolvedValue(["a", "b"]);
    const { result } = renderHook(() => useCarregar<string[]>([], buscar));

    expect(result.current.carregando).toBe(true);

    await waitFor(() => expect(result.current.carregando).toBe(false));

    expect(result.current.dados).toEqual(["a", "b"]);
    expect(result.current.erro).toBeNull();
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it("guarda a mensagem de erro quando a busca falha", async () => {
    const buscar = vi.fn().mockRejectedValue({ response: { data: { detail: "Falha no servidor" } } });
    const { result } = renderHook(() => useCarregar<string[]>([], buscar));

    await waitFor(() => expect(result.current.carregando).toBe(false));

    expect(result.current.erro).toBe("Falha no servidor");
    expect(result.current.dados).toEqual([]);
  });

  it("recarregar() busca de novo e limpa o erro anterior", async () => {
    const buscar = vi.fn().mockResolvedValueOnce(["x"]).mockResolvedValueOnce(["y"]);
    const { result } = renderHook(() => useCarregar<string[]>([], buscar));

    await waitFor(() => expect(result.current.dados).toEqual(["x"]));

    await act(async () => {
      await result.current.recarregar();
    });

    expect(result.current.dados).toEqual(["y"]);
    expect(buscar).toHaveBeenCalledTimes(2);
  });

  it("busca de novo quando uma dependência muda", async () => {
    const buscar = vi.fn().mockResolvedValue(["ok"]);
    const { rerender } = renderHook(({ dep }) => useCarregar<string[]>([], buscar, [dep]), {
      initialProps: { dep: 1 },
    });

    await waitFor(() => expect(buscar).toHaveBeenCalledTimes(1));

    rerender({ dep: 2 });

    await waitFor(() => expect(buscar).toHaveBeenCalledTimes(2));
  });

  it("com limparAoErrar, volta pro valor inicial quando a busca falha", async () => {
    const buscar = vi.fn().mockResolvedValueOnce(["a"]).mockRejectedValueOnce(new Error("falhou"));
    const { result } = renderHook(() => useCarregar<string[]>([], buscar, [], { limparAoErrar: true }));

    await waitFor(() => expect(result.current.dados).toEqual(["a"]));

    await act(async () => {
      await result.current.recarregar();
    });

    expect(result.current.dados).toEqual([]);
    expect(result.current.erro).toBe("falhou");
  });

  it("setDados permite atualização otimista sem esperar recarregar", async () => {
    const buscar = vi.fn().mockResolvedValue(["a"]);
    const { result } = renderHook(() => useCarregar<string[]>([], buscar));

    await waitFor(() => expect(result.current.dados).toEqual(["a"]));

    act(() => {
      result.current.setDados((prev) => [...prev, "b"]);
    });

    expect(result.current.dados).toEqual(["a", "b"]);
  });
});
