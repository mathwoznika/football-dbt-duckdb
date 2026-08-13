import { Link } from "react-router-dom";

import { api } from "../api";
import { useDados } from "../useDados";

/** Índice das competições-temporada presentes na base. */
export default function Competicoes() {
  const { dados: competicoes, carregando } = useDados(() => api.competicoes(), []);

  return (
    <div className="cartao">
      <h2>Competições</h2>
      <p className="discreto">
        {carregando
          ? "carregando..."
          : `${competicoes?.length ?? 0} competições-temporada na base. A janela do plano Free vai de 2022 a 2024.`}
      </p>
      <div className="tabela-wrap">
        <table>
          <thead>
            <tr>
              <th>Competição</th>
              <th className="num">Temporada</th>
              <th className="num">Times</th>
              <th className="num">Partidas</th>
              <th>Campeão</th>
              <th>Formato</th>
            </tr>
          </thead>
          <tbody>
            {competicoes?.map((c) => (
              <tr key={`${c.league_id}-${c.season}`}>
                <td>
                  <Link to={`/competicoes/${c.league_id}/${c.season}`}>
                    <strong>{c.league_nome}</strong>
                  </Link>
                </td>
                <td className="num">{c.season}</td>
                <td className="num discreto">{c.times}</td>
                <td className="num discreto">{c.jogos}</td>
                <td>
                  {c.campeao_id ? (
                    <Link to={`/times/${c.campeao_id}`}>{c.campeao}</Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="discreto">
                  {[
                    c.tem_classificacao ? "pontos corridos" : null,
                    c.tem_chaveamento ? "mata-mata" : null,
                  ]
                    .filter(Boolean)
                    .join(" + ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
