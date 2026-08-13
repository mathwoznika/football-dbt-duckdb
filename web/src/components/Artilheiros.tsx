import { Link } from "react-router-dom";

import type { Artilheiro } from "../api";

/**
 * Artilharia da competição.
 *
 * Vem do endpoint /players/topscorers da API-Football, e não dos eventos que
 * extraímos: a onda 3 só cobre jogos do Coritiba, então gol marcado em
 * Palmeiras × Flamengo não existe na nossa base. Aqui os números são oficiais
 * da competição inteira.
 */
export default function Artilheiros({ lista }: { lista: Artilheiro[] }) {
  if (!lista.length) {
    return (
      <p className="discreto" style={{ marginBottom: 0 }}>
        Artilharia não disponível para esta competição.
      </p>
    );
  }

  return (
    <div className="tabela-wrap">
      <table className="tabela-compacta">
        <thead>
          <tr>
            <th className="num">#</th>
            <th colSpan={2}>Jogador</th>
            <th className="num">G</th>
            <th className="num">J</th>
            <th className="num">G/J</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((a) => (
            <tr key={a.player_id}>
              <td className="num discreto">{a.posicao_artilharia}</td>
              <td style={{ paddingRight: 0, width: 22 }}>
                {a.team_logo && (
                  <img
                    src={a.team_logo}
                    alt=""
                    width={18}
                    height={18}
                    title={a.team_nome}
                  />
                )}
              </td>
              <td>
                <Link to={`/jogadores/${a.player_id}`}>{a.jogador}</Link>
                {/* marca os casos em que a fonte repetia os numeros */}
                {a.teve_mais_de_um_clube && (
                  <span
                    className="discreto"
                    title="Trocou de clube na temporada. A fonte repete os números nos dois times, então usamos o máximo e não a soma."
                  >
                    {" "}
                    ⇄
                  </span>
                )}
              </td>
              <td className="num">
                <strong>{a.gols}</strong>
              </td>
              <td className="num discreto">{a.jogos ?? "—"}</td>
              <td className="num discreto">{a.gols_por_jogo ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
