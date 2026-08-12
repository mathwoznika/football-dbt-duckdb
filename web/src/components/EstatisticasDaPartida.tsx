import type { EstatisticaDaPartida } from "../api";

/** Métricas exibidas, na ordem. `pct` muda a formatação para porcentagem. */
const METRICAS: { campo: keyof EstatisticaDaPartida; rotulo: string; pct?: boolean }[] = [
  { campo: "posse_pct", rotulo: "Posse de bola", pct: true },
  { campo: "chutes_total", rotulo: "Finalizações" },
  { campo: "chutes_no_gol", rotulo: "No gol" },
  { campo: "chutes_dentro_area", rotulo: "Dentro da área" },
  { campo: "chutes_bloqueados", rotulo: "Bloqueadas" },
  { campo: "escanteios", rotulo: "Escanteios" },
  { campo: "defesas_goleiro", rotulo: "Defesas do goleiro" },
  { campo: "passes_total", rotulo: "Passes" },
  { campo: "passes_certos", rotulo: "Passes certos" },
  { campo: "precisao_passe_pct", rotulo: "Precisão de passe", pct: true },
  { campo: "faltas", rotulo: "Faltas" },
  { campo: "impedimentos", rotulo: "Impedimentos" },
  { campo: "cartoes_amarelos", rotulo: "Cartões amarelos" },
  { campo: "cartoes_vermelhos", rotulo: "Cartões vermelhos" },
];

/**
 * Comparação dos dois lados, com barra proporcional.
 *
 * A barra usa a soma dos dois como total, então ela mostra a *divisão* daquela
 * métrica entre os times — 17 finalizações contra 7 vira 71% da barra. Escalar
 * pelo máximo absoluto faria a barra do maior encostar sempre no fim e diria
 * menos.
 *
 * Métrica em que os dois estão zerados some da lista: linha com duas barras
 * vazias é ruído.
 */
export default function EstatisticasDaPartida({
  lados,
}: {
  lados: EstatisticaDaPartida[];
}) {
  const casa = lados.find((l) => l.e_do_mandante);
  const fora = lados.find((l) => !l.e_do_mandante);
  if (!casa || !fora) return null;

  return (
    <div className="estatisticas">
      {METRICAS.map(({ campo, rotulo, pct }) => {
        const a = (casa[campo] as number | null) ?? 0;
        const b = (fora[campo] as number | null) ?? 0;
        if (a === 0 && b === 0) return null;

        const total = a + b || 1;
        return (
          <div className="estat-linha" key={campo}>
            <span className="estat-valor">
              {a}
              {pct ? "%" : ""}
            </span>
            <div className="estat-meio">
              <span className="estat-rotulo">{rotulo}</span>
              <div className="estat-barra">
                <div className="lado-casa" style={{ width: `${(a / total) * 100}%` }} />
                <div className="lado-fora" style={{ width: `${(b / total) * 100}%` }} />
              </div>
            </div>
            <span className="estat-valor">
              {b}
              {pct ? "%" : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
