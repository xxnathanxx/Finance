import { useCallback, useEffect, useRef, useState } from "react";

type Resultado<T> = {
  dados: T;
  setDados: React.Dispatch<React.SetStateAction<T>>;
  carregando: boolean;
  erro: string | null;
  setErro: React.Dispatch<React.SetStateAction<string | null>>;
  recarregar: () => Promise<void>;
};

type Opcoes = {
  /** Se true, volta pro valor inicial quando a busca falha (em vez de manter os dados antigos na tela). */
  limparAoErrar?: boolean;
};

/**
 * Encapsula o padrão repetido em várias telas: buscar dados da API ao
 * montar (ou quando `deps` mudar), com loading/erro/recarregar prontos.
 * `buscar` é reexecutado a cada chamada de `recarregar()` sem precisar
 * recriar a função a cada render (usa um ref internamente).
 */
export function useCarregar<T>(
  inicial: T,
  buscar: () => Promise<T>,
  deps: unknown[] = [],
  opcoes: Opcoes = {}
): Resultado<T> {
  const [dados, setDados] = useState<T>(inicial);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const buscarRef = useRef(buscar);
  buscarRef.current = buscar;
  const limparAoErrar = opcoes.limparAoErrar ?? false;

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    try {
      const resultado = await buscarRef.current();
      setDados(resultado);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Falha ao carregar dados";
      setErro(msg);
      if (limparAoErrar) setDados(inicial);
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limparAoErrar]);

  useEffect(() => {
    recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { dados, setDados, carregando, erro, setErro, recarregar };
}
