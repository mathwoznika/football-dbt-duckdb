import { Link } from "react-router-dom";

import type { ConfrontoEliminatorio } from "../api";
import { descreverPernas } from "../confronto";

/**
 * Todos os confrontos do torneio: uma coluna por fase, da mais antiga para a
 * final.
 *
 * O `ordem_fase` que o dbt calculou e o que permite ordenar as colunas sem o
 * front conhecer nome de fase nenhum — se amanha aparecer uma competicao com
 * fase preliminar, ela se encaixa sozinha no lugar certo.
 */
export default function Chaveamento({
  confrontos,
  destaque,
}: {
  confrontos: ConfrontoEliminatorio[];
  destaque: number;
}) {
  // Fases distintas, na ordem. O Map descarta repetidos mantendo a primeira
  // ocorrencia de cada ordem_fase.
  const fases = [...new Map(confrontos.map((c) => [c.ordem_fase, c.fase_nome]))].sort(
    (a, b) => a[0] - b[0],
  );

  return (
    <div className="chave">
      {fases.map(([ordem, nome]) => (
        <div className="chave-fase" key={ordem}>
          <h3>{nome}</h3>
          {confrontos
            .filter((c) => c.ordem_fase === ordem)
            .map((c) => (
              <Confronto
                key={`${c.time_a_id}-${c.time_b_id}`}
                c={c}
                destaque={destaque}
              />
            ))}
        </div>
      ))}
    </div>
  );
}

function Confronto({
  c,
  destaque,
}: {
  c: ConfrontoEliminatorio;
  destaque: number;
}) {
  const envolvido = c.time_a_id === destaque || c.time_b_id === destaque;

  return (
    <div className={`confronto${envolvido ? " envolvido" : ""}`}>
      <Lado
        id={c.time_a_id}
        nome={c.time_a_nome}
        logo={c.time_a_logo}
        gols={c.gols_a}
        penaltis={c.penaltis_a}
        passou={c.vencedor_id === c.time_a_id}
      />
      <Lado
        id={c.time_b_id}
        nome={c.time_b_nome}
        logo={c.time_b_logo}
        gols={c.gols_b}
        penaltis={c.penaltis_b}
        passou={c.vencedor_id === c.time_b_id}
      />
      {/* ladoA = true: a lista completa mostra sempre na orientacao do dado */}
      <div className="confronto-nota">{descreverPernas(c, true)}</div>
    </div>
  );
}

function Lado({
  id,
  nome,
  logo,
  gols,
  penaltis,
  passou,
}: {
  id: number;
  nome: string | null;
  logo: string | null;
  gols: number;
  penaltis: number | null;
  passou: boolean;
}) {
  return (
    <div className={`confronto-time ${passou ? "passou" : "perdeu"}`}>
      <span className="confronto-clube">
        {logo && <img src={logo} alt="" width={16} height={16} />}
        <Link to={`/times/${id}`}>{nome ?? `#${id}`}</Link>
      </span>
      <span className="gols">
        {gols}
        {penaltis !== null && <span className="discreto"> ({penaltis})</span>}
      </span>
    </div>
  );
}
