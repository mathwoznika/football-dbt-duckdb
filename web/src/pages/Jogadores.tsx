import { useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api";
import { useDados } from "../useDados";

const POSICOES: Record<string, string> = {
  G: "Goleiro",
  D: "Defensor",
  M: "Meio-campo",
  F: "Atacante",
};

/**
 * Lista de jogadores presentes na base, com busca e filtro de amostra.
 *
 * O filtro de jogos mínimos não é conveniência, é correção: o endpoint
 * fixture_players devolve os DOIS times de cada partida e a onda 3 só cobre
 * jogos do Coritiba, então centenas de jogadores de adversários aparecem com
 * uma única partida. Sem o filtro, o topo da lista por nota média fica ocupado
 * por quem jogou 90 minutos na vida.
 *
 * Por isso `jogos_com_dado` é coluna de destaque e não detalhe escondido.
 */
export default function Jogadores() {
  const [busca, setBusca] = useState("");
  const [minJogos, setMinJogos] = useState(5);

  const {
    dados: jogadores,
    carregando,
  } = useDados(() => api.jogadores(busca, minJogos), [busca, minJogos]);

  return (
    <>
      <div className="cartao">
        <div className="linha">
          <input
            placeholder="Buscar jogador..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ minWidth: 240 }}
          />
          <label className="discreto">
            Mínimo de jogos{" "}
            <select
              value={minJogos}
              onChange={(e) => setMinJogos(Number(e.target.value))}
            >
              <option value={1}>1</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </label>
          <span className="discreto">
            {carregando ? "buscando..." : `${jogadores?.length ?? 0} jogadores`}
          </span>
        </div>

        <p className="discreto" style={{ marginBottom: 0, marginTop: "0.8rem" }}>
          A base cobre <strong>partidas do Coritiba</strong>, e a API devolve os
          dois times de cada jogo — então adversários aparecem com as poucas
          partidas que fizeram contra o Coxa. Estes <em>não são</em> números de
          carreira. Baixe o mínimo para 1 e veja o efeito: o topo por nota se
          enche de quem jogou uma vez.
        </p>
        <p className="discreto" style={{ marginBottom: 0 }}>
          <strong>Jogou</strong> são partidas com minutos em campo;{" "}
          <strong>Relac.</strong> conta também os jogos em que ficou no banco sem
          entrar — 902 das 2.923 linhas da base são desse tipo.
        </p>
      </div>

      <div className="cartao">
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th>Jogador</th>
                <th>Clube</th>
                <th>Posição</th>
                <th className="num">Jogou</th>
                <th className="num">Relac.</th>
                <th className="num">Titular</th>
                <th className="num">Min</th>
                <th className="num">Nota</th>
                <th className="num">Melhor</th>
                <th className="num">G</th>
                <th className="num">A</th>
                <th className="num">Temporadas</th>
              </tr>
            </thead>
            <tbody>
              {jogadores?.map((j) => (
                <tr key={j.player_id}>
                  <td>
                    <Link to={`/jogadores/${j.player_id}`}>
                      <strong>{j.jogador_nome}</strong>
                    </Link>
                  </td>
                  <td className="discreto">
                    {j.team_id ? (
                      <Link to={`/times/${j.team_id}`}>{j.team_nome}</Link>
                    ) : (
                      "—"
                    )}
                    {j.clubes > 1 && (
                      <span className="discreto"> +{j.clubes - 1}</span>
                    )}
                  </td>
                  <td className="discreto">
                    {j.posicao ? (POSICOES[j.posicao] ?? j.posicao) : "—"}
                  </td>
                  <td className="num">
                    <strong>{j.jogos_com_minutos}</strong>
                  </td>
                  <td className="num discreto" title="Vezes que foi relacionado, inclusive sem entrar">
                    {j.jogos_com_dado}
                  </td>
                  <td className="num discreto">{j.jogos_titular ?? "—"}</td>
                  <td className="num discreto">
                    {j.minutos?.toLocaleString("pt-BR") ?? "—"}
                  </td>
                  <td className="num">
                    {j.nota_media !== null ? (
                      <span className={`nota ${classeDaNota(j.nota_media)}`}>
                        {j.nota_media.toFixed(2)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="num discreto">
                    {j.melhor_nota?.toFixed(1) ?? "—"}
                  </td>
                  <td className="num">{j.gols ?? "—"}</td>
                  <td className="num">{j.assistencias ?? "—"}</td>
                  <td className="num discreto">
                    {j.primeira_temporada === j.ultima_temporada
                      ? j.primeira_temporada
                      : `${j.primeira_temporada}–${j.ultima_temporada}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function classeDaNota(nota: number) {
  if (nota >= 7) return "boa";
  if (nota < 6) return "ruim";
  return "media";
}
