import type { ConfrontoEliminatorio } from "./api";

/**
 * Descreve as pernas de um confronto em texto: "ida 2×1 · volta 1×2 (4×5 pên)".
 *
 * O `ladoA` diz de qual perspectiva escrever. Isso existe porque o caminho do
 * time sempre mostra ele primeiro, independente de ter sido time A ou B no
 * dado — sem esse parametro, metade dos placares sairia invertida.
 *
 * Em jogo unico devolve so o rotulo, porque o placar ja aparece grande logo
 * acima e repetir seria ruido.
 */
export function descreverPernas(
  c: ConfrontoEliminatorio,
  ladoA: boolean,
): string {
  if (c.partidas === 1) return "jogo único";

  const partes: string[] = [];

  const perna = (
    rotulo: string,
    golsA: number | null,
    golsB: number | null,
    penA: number | null,
    penB: number | null,
  ) => {
    if (golsA === null || golsB === null) return;
    const meus = ladoA ? golsA : golsB;
    const deles = ladoA ? golsB : golsA;
    const meusPen = ladoA ? penA : penB;
    const delesPen = ladoA ? penB : penA;
    const penaltis =
      meusPen !== null && delesPen !== null
        ? ` (${meusPen}×${delesPen} pên)`
        : "";
    partes.push(`${rotulo} ${meus}×${deles}${penaltis}`);
  };

  perna("ida", c.ida_gols_a, c.ida_gols_b, c.ida_penaltis_a, c.ida_penaltis_b);
  perna(
    "volta",
    c.volta_gols_a,
    c.volta_gols_b,
    c.volta_penaltis_a,
    c.volta_penaltis_b,
  );

  return partes.join(" · ");
}
