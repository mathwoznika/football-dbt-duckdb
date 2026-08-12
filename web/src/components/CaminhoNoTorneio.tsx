import { Link } from "react-router-dom";

import type { ConfrontoEliminatorio } from "../api";
import { descreverPernas } from "../confronto";

/**
 * O caminho de UM time pelo mata-mata: uma corrente de confrontos ligados por
 * setas, da fase mais antiga ate onde ele chegou.
 *
 * Por que nao um bracket simetrico completo: a Copa do Brasil tem 40 confrontos
 * so na primeira fase, o que daria 80 times de altura. O caminho do time e
 * curto por natureza (no maximo 7 passos) e responde a pergunta que interessa
 * na pagina de um clube — "como foi a campanha dele".
 *
 * A lista completa por fase continua existindo abaixo, para navegar o torneio.
 */
export default function CaminhoNoTorneio({
  confrontos,
  timeId,
}: {
  confrontos: ConfrontoEliminatorio[];
  timeId: number;
}) {
  const caminho = confrontos
    .filter((c) => c.time_a_id === timeId || c.time_b_id === timeId)
    .sort((a, b) => a.ordem_fase - b.ordem_fase);

  if (!caminho.length) return null;

  const ultimo = caminho[caminho.length - 1];
  const passouNoUltimo = ultimo.vencedor_id === timeId;
  const foiFinal = ultimo.ordem_fase === 7;

  const desfecho = foiFinal
    ? passouNoUltimo
      ? { texto: "Campeão", tom: "campeao" }
      : { texto: "Vice-campeão", tom: "vice" }
    : passouNoUltimo
      ? { texto: "Classificado", tom: "vice" }
      : { texto: "Eliminado", tom: "eliminado" };

  return (
    <div className="caminho">
      {caminho.map((c, i) => {
        // reorienta o confronto para o time visto aparecer sempre em cima
        const euSouA = c.time_a_id === timeId;
        const meusGols = euSouA ? c.gols_a : c.gols_b;
        const golsDele = euSouA ? c.gols_b : c.gols_a;
        const meusPen = euSouA ? c.penaltis_a : c.penaltis_b;
        const penDele = euSouA ? c.penaltis_b : c.penaltis_a;
        const advId = euSouA ? c.time_b_id : c.time_a_id;
        const advNome = euSouA ? c.time_b_nome : c.time_a_nome;
        const passou = c.vencedor_id === timeId;

        return (
          <div className="caminho-item" key={c.fase}>
            <div className={`caminho-passo ${passou ? "passou" : "caiu"}`}>
              <div className="caminho-fase">{c.fase_nome}</div>

              <div className="caminho-linha">
                <span>
                  {meusGols}
                  {meusPen !== null && <span className="discreto"> ({meusPen})</span>}
                </span>
                <span className="discreto">×</span>
                <span>
                  {golsDele}
                  {penDele !== null && <span className="discreto"> ({penDele})</span>}
                </span>
              </div>

              <div className="caminho-adv">
                <Link to={`/times/${advId}`}>{advNome ?? `#${advId}`}</Link>
              </div>

              {/* o placar grande e o agregado; aqui vem cada perna */}
              <div className="caminho-nota">{descreverPernas(c, euSouA)}</div>
            </div>

            {/* a seta liga este passo ao proximo; o ultimo passo recebe o desfecho */}
            {i < caminho.length - 1 ? (
              <div className="caminho-seta" aria-hidden="true" />
            ) : (
              <div className={`caminho-desfecho ${desfecho.tom}`}>
                {desfecho.tom === "campeao" && <span className="trofeu">🏆</span>}
                {desfecho.texto}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
