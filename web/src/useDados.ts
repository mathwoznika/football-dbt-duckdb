import { useEffect, useState } from "react";

/**
 * Hook para carregar dados da API.
 *
 * Toda tela precisa da mesma trinca: o dado, o estado de carregando e o erro.
 * Escrever isso com useState/useEffect em cada componente seria repetir o mesmo
 * bloco cinco vezes — um hook customizado e como o React deixa a gente extrair
 * logica reutilizavel. A regra da linguagem: se o nome comeca com "use", pode
 * chamar outros hooks dentro.
 *
 * O detalhe que evita um bug real: a variavel `ativo`. Se o usuario sair da
 * tela antes da resposta chegar, o componente ja nao existe mais e atualizar o
 * estado dele seria erro. A funcao devolvida no fim do useEffect roda na saida
 * e marca `ativo = false`, fazendo a resposta atrasada ser ignorada.
 */
export function useDados<T>(carregar: () => Promise<T>, deps: unknown[]) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);

    carregar()
      .then((resultado) => {
        if (!ativo) return;
        setDados(resultado);
        setErro(null);
      })
      .catch((e: unknown) => {
        if (!ativo) return;
        setErro(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { dados, erro, carregando };
}
