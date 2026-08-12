import { Link } from "react-router-dom";

import type { LinhaClassificacao } from "../api";

/**
 * Tabela de classificacao no formato que se espera de uma tabela de futebol:
 * Pts, PJ, VIT, E, DER, GM, GC, SG e as ultimas 5 partidas.
 *
 * `destaque` e o time que esta sendo visto — a linha dele ganha fundo, para
 * responder "onde eu estou" sem o usuario procurar.
 *
 * A string `ultimos_5` vem do dbt em ordem cronologica, entao basta percorrer
 * na ordem: o resultado mais recente cai naturalmente na direita.
 */
export default function Classificacao({
  linhas,
  destaque,
}: {
  linhas: LinhaClassificacao[];
  destaque: number;
}) {
  return (
    <div className="tabela-wrap">
      <table className="tabela-compacta">
        <thead>
          <tr>
            <th className="num">#</th>
            <th colSpan={2}>Clube</th>
            <th className="num">Pts</th>
            <th className="num">PJ</th>
            <th className="num">VIT</th>
            <th className="num">E</th>
            <th className="num">DER</th>
            <th className="num">GM</th>
            <th className="num">GC</th>
            <th className="num">SG</th>
            <th>Últimas 5</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.time_id} className={l.time_id === destaque ? "destacada" : ""}>
              <td className="num discreto">{l.posicao}</td>
              <td style={{ paddingRight: 0, width: 22 }}>
                {l.logo_url && <img src={l.logo_url} alt="" width={18} height={18} />}
              </td>
              <td>
                <Link to={`/times/${l.time_id}`}>{l.time_nome}</Link>
              </td>
              <td className="num">
                <strong>{l.pontos}</strong>
              </td>
              <td className="num discreto">{l.jogos}</td>
              <td className="num">{l.vitorias}</td>
              <td className="num">{l.empates}</td>
              <td className="num">{l.derrotas}</td>
              <td className="num discreto">{l.gols_pro}</td>
              <td className="num discreto">{l.gols_contra}</td>
              <td className="num">{l.saldo > 0 ? `+${l.saldo}` : l.saldo}</td>
              <td>
                <Ultimas5 sequencia={l.ultimos_5} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Os 5 ultimos resultados como bolinhas, mais recente a direita. */
function Ultimas5({ sequencia }: { sequencia: string | null }) {
  if (!sequencia) return <span className="discreto">—</span>;
  return (
    <span className="ultimas5">
      {/* split("") separa a string em caracteres; o indice serve de key porque
          posicao na sequencia e o que identifica cada resultado aqui */}
      {sequencia.split("").map((r, i) => (
        <span key={i} className={`pill-mini ${r}`} title={rotulo(r)}>
          {r}
        </span>
      ))}
    </span>
  );
}

function rotulo(r: string) {
  if (r === "V") return "vitória";
  if (r === "E") return "empate";
  return "derrota";
}
