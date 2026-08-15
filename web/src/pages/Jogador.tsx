import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api } from "../api";
import Metrica from "../components/Metrica";
import { useDados } from "../useDados";
import { useLimiteDeLinhas } from "../components/LimiteDeLinhas";

function dataBr(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

const POSICOES: Record<string, string> = {
  G: "Goleiro",
  D: "Defensor",
  M: "Meio-campo",
  F: "Atacante",
};

export default function JogadorPage() {
  const { playerId } = useParams();
  const id = Number(playerId);

  const { dados: temporadas, erro } = useDados(() => api.temporadasDoJogador(id), [id]);

  const [selecao, setSelecao] = useState("");
  const chave =
    selecao ||
    (temporadas?.length ? `${temporadas[0].season}-${temporadas[0].league_id}` : "");
  const [season, leagueId] = chave
    ? chave.split("-").map(Number)
    : [undefined, undefined];

  const { dados: jogos } = useDados(
    () =>
      season && leagueId
        ? api.jogosDoJogador(id, season, leagueId)
        : Promise.resolve([]),
    [id, season, leagueId],
  );

  const resumo = temporadas?.find(
    (t) => t.season === season && t.league_id === leagueId,
  );
  const identidade = temporadas?.[0];

  // Antes do early return de erro: hook chamado condicionalmente roda em umas
  // renderizacoes e nao em outras, e o React perde a conta de qual estado
  // pertence a qual hook. O TypeScript nao pega isso — quebra so em execucao,
  // e so quando o jogador nao tem dado.
  const jogoAJogo = useLimiteDeLinhas(jogos, 10);

  if (erro) {
    return (
      <div className="cartao">
        Jogador sem dados extraídos. <Link to="/">Voltar</Link>
      </div>
    );
  }

  const goleiro = resumo?.posicao === "G";

  return (
    <>
      <div className="cartao">
        <h1 style={{ margin: 0, fontSize: "1.6rem" }}>{identidade?.jogador_nome}</h1>
        <div className="discreto">
          {identidade && (
            <>
              <Link to={`/times/${identidade.team_id}`}>{identidade.team_nome}</Link>
              {identidade.posicao ? ` · ${POSICOES[identidade.posicao] ?? identidade.posicao}` : ""}
            </>
          )}
        </div>
      </div>

      <div className="cartao">
        <div className="linha" style={{ marginBottom: "1rem" }}>
          <select value={chave} onChange={(e) => setSelecao(e.target.value)}>
            {temporadas?.map((t) => (
              <option
                key={`${t.season}-${t.league_id}-${t.team_id}`}
                value={`${t.season}-${t.league_id}`}
              >
                {t.season} · {t.league_nome} · {t.team_nome}
              </option>
            ))}
          </select>
        </div>

        {resumo && (
          <div className="metricas">
            <Metrica rotulo="Jogos" valor={resumo.jogos_com_dado} nota="com dado extraído" />
            <Metrica rotulo="Como titular" valor={resumo.jogos_titular} />
            <Metrica rotulo="Minutos" valor={resumo.minutos ?? "—"} />
            <Metrica rotulo="Nota média" valor={resumo.nota_media ?? "—"} />
            <Metrica rotulo="Melhor nota" valor={resumo.melhor_nota ?? "—"} />
            {goleiro ? (
              <>
                <Metrica rotulo="Defesas" valor={resumo.defesas ?? 0} />
                <Metrica rotulo="Gols sofridos" valor={resumo.gols_sofridos ?? 0} />
              </>
            ) : (
              <>
                <Metrica rotulo="Gols" valor={resumo.gols ?? 0} />
                <Metrica rotulo="Assistências" valor={resumo.assistencias ?? 0} />
                <Metrica rotulo="Finalizações" valor={resumo.chutes ?? 0} />
                <Metrica
                  rotulo="Duelos ganhos"
                  valor={`${resumo.duelos_ganhos ?? 0}/${resumo.duelos ?? 0}`}
                />
                <Metrica rotulo="Desarmes" valor={resumo.desarmes ?? 0} />
              </>
            )}
            <Metrica
              rotulo="Cartões"
              valor={`${resumo.amarelos ?? 0}A / ${resumo.vermelhos ?? 0}V`}
            />
          </div>
        )}
      </div>

      <div className="cartao">
        <h2>Jogo a jogo</h2>
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th></th>
                <th>Adversário</th>
                <th className="num">Placar</th>
                <th className="num">Min</th>
                <th className="num">Nota</th>
                <th className="num">G</th>
                <th className="num">A</th>
                <th className="num">Fin.</th>
                <th className="num">Passes</th>
                <th className="num">Des.</th>
                <th className="num">Cartões</th>
              </tr>
            </thead>
            <tbody>
              {jogoAJogo.visiveis.map((j) => (
                <tr key={j.fixture_id}>
                  <td className="discreto">
                    <Link to={`/jogos/${j.fixture_id}`}>{dataBr(j.data)}</Link>
                  </td>
                  <td className="discreto">{j.mando === "casa" ? "🏠" : "✈️"}</td>
                  <td>
                    <Link to={`/times/${j.adversario_id}`}>{j.adversario_nome}</Link>
                  </td>
                  <td className="num">
                    {j.gols_time} x {j.gols_adversario}
                  </td>
                  <td className="num discreto">
                    {j.minutos ?? "—"}
                    {j.entrou_do_banco ? " ↑" : ""}
                  </td>
                  <td className="num">
                    {j.nota !== null ? (
                      <span className={`nota ${classeDaNota(j.nota)}`}>
                        {j.nota.toFixed(1)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="num">{j.gols ?? "—"}</td>
                  <td className="num">{j.assistencias ?? "—"}</td>
                  <td className="num discreto">{j.chutes ?? "—"}</td>
                  <td className="num discreto">{j.passes ?? "—"}</td>
                  <td className="num discreto">{j.desarmes ?? "—"}</td>
                  <td className="num discreto">
                    {(j.amarelos ?? 0) + (j.vermelhos ?? 0) || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {jogoAJogo.controle}
        <p className="discreto" style={{ marginBottom: 0 }}>
          ↑ entrou durante a partida. Só aparecem jogos com estatística já extraída.
        </p>
      </div>
    </>
  );
}

function classeDaNota(nota: number) {
  if (nota >= 7) return "boa";
  if (nota < 6) return "ruim";
  return "media";
}

