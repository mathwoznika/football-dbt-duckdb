import { useState, type ReactNode } from "react";

const OPCOES = [10, 25, 50];

/**
 * Mostra as primeiras N linhas de uma tabela, com controle de quantas.
 *
 * POR QUE LIMITE E NAO BARRA DE ROLAGEM INTERNA. As duas resolvem o mesmo
 * sintoma — tabela de sessenta linhas empurrando o resto da pagina para longe —
 * mas a rolagem aninhada tem tres defeitos praticos: captura a roda do mouse
 * quando o cursor passa por cima, e a pagina para de rolar sem motivo aparente;
 * esconde o tamanho real do conteudo, entao ninguem sabe se sao 20 ou 500
 * linhas; e no celular disputa o gesto com a rolagem da pagina.
 *
 * O limite nao tem nenhum desses problemas: a altura da pagina fica previsivel,
 * o total aparece escrito, e quem quer tudo pede tudo. O custo e um clique a
 * mais para quem ia ler a tabela inteira — que e a minoria.
 *
 * O CONTROLE SO APARECE se houver mais linhas que o limite inicial. Numa tabela
 * de oito linhas ele seria ruido puro.
 */
export function useLimiteDeLinhas<T>(
  linhas: T[] | null | undefined,
  inicial = 10,
): { visiveis: T[]; controle: ReactNode; total: number } {
  const [limite, setLimite] = useState<number>(inicial);
  const todas = linhas ?? [];
  const visiveis = limite === 0 ? todas : todas.slice(0, limite);

  const controle =
    todas.length > inicial ? (
      <div className="limite-linhas">
        <span className="discreto">
          Mostrando {visiveis.length} de {todas.length}
        </span>
        <label className="discreto">
          Linhas{" "}
          <select
            value={limite}
            onChange={(e) => setLimite(Number(e.target.value))}
          >
            {OPCOES.filter((o) => o < todas.length).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
            <option value={0}>todas ({todas.length})</option>
          </select>
        </label>
      </div>
    ) : null;

  return { visiveis, controle, total: todas.length };
}
