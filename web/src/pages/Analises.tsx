import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api } from "../api";
import { useDados } from "../useDados";

function dataBr(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function Analises() {
  const { id } = useParams();
  const teamId = Number(id);

  const { dados: time } = useDados(() => api.time(teamId), [teamId]);
  const { dados: porTempo } = useDados(
    () => api.desempenhoPorTempo(teamId),
    [teamId],
  );
  const { dados: tecnicos } = useDados(() => api.tecnicos(teamId), [teamId]);

  const [minJogosArbitro, setMinJogosArbitro] = useState(4);
  const { dados: arbitros } = useDados(
    () => api.arbitragem(teamId, minJogosArbitro),
    [teamId, minJogosArbitro],
  );

  const [selecao, setSelecao] = useState("");
  const chave =
    selecao ||
    (porTempo?.length ? `${porTempo[0].season}-${porTempo[0].league_id}` : "");
  const [season, leagueId] = chave
    ? chave.split("-").map(Number)
    : [undefined, undefined];

  const { dados: periodos } = useDados(
    () =>
      season && leagueId
        ? api.golsPorPeriodo(teamId, season, leagueId)
        : Promise.resolve([]),
    [teamId, season, leagueId],
  );

  const tempo = porTempo?.find(
    (t) => t.season === season && t.league_id === leagueId,
  );

  // escala das barras do gráfico de períodos
  const maxGols = Math.max(
    1,
    ...(periodos ?? []).flatMap((p) => [p.marcados, p.sofridos]),
  );

  return (
    <>
      <div className="cartao">
        <div className="linha">
          {time?.logo_url && <img className="escudo" src={time.logo_url} alt="" />}
          <div>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>
              Análises · <Link to={`/times/${teamId}`}>{time?.team_nome}</Link>
            </h1>
            <div className="discreto">
              Onde os pontos são ganhos e perdidos ao longo do jogo
            </div>
          </div>
        </div>
      </div>

      {/* --------------------------------- primeiro x segundo tempo */}
      <div className="cartao">
        <h2>Primeiro contra segundo tempo</h2>
        <p className="discreto">
          A coluna <strong>Se acabasse no 1º</strong> soma os pontos que o time
          teria feito se todo jogo terminasse no intervalo. A diferença para os
          pontos reais mostra o que acontece depois dele — e cobre{" "}
          <strong>todos os jogos da base</strong>, porque o placar do intervalo
          vem no próprio calendário e não depende da extração por partida.
        </p>
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th>Temporada</th>
                <th>Competição</th>
                <th className="num">J</th>
                <th className="num">Pontos</th>
                <th className="num">Se acabasse no 1º</th>
                <th className="num">Dif.</th>
                <th className="num">Saldo 1º</th>
                <th className="num">Saldo 2º</th>
                <th className="num">Viradas</th>
                <th className="num">Reações</th>
                <th className="num">Vant. empatadas</th>
                <th className="num">Vant. perdidas</th>
              </tr>
            </thead>
            <tbody>
              {porTempo?.map((t) => (
                <tr key={`${t.season}-${t.league_id}`}>
                  <td>{t.season}</td>
                  <td>{t.league_nome}</td>
                  <td className="num discreto">{t.jogos}</td>
                  <td className="num">
                    <strong>{t.pontos}</strong>
                  </td>
                  <td className="num discreto">{t.pontos_se_acabasse_no_1t}</td>
                  <td className="num">
                    <span
                      className={`nota ${t.diferenca_de_pontos < 0 ? "ruim" : t.diferenca_de_pontos > 0 ? "boa" : ""}`}
                    >
                      {t.diferenca_de_pontos > 0 ? "+" : ""}
                      {t.diferenca_de_pontos}
                    </span>
                  </td>
                  <td className="num discreto">
                    {t.saldo_1t > 0 ? "+" : ""}
                    {t.saldo_1t}
                  </td>
                  <td className="num discreto">
                    {t.saldo_2t > 0 ? "+" : ""}
                    {t.saldo_2t}
                  </td>
                  <td className="num">{t.viradas}</td>
                  <td className="num discreto">{t.reacoes}</td>
                  <td className="num discreto">{t.vantagens_empatadas}</td>
                  <td className="num">{t.vantagens_perdidas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --------------------------------------- momento dos gols */}
      <div className="cartao">
        <h2>Momento dos gols</h2>
        <div className="linha" style={{ marginBottom: "1rem" }}>
          <select value={chave} onChange={(e) => setSelecao(e.target.value)}>
            {porTempo?.map((t) => (
              <option
                key={`${t.season}-${t.league_id}`}
                value={`${t.season}-${t.league_id}`}
              >
                {t.season} · {t.league_nome}
              </option>
            ))}
          </select>
          {tempo && (
            <span className="discreto">
              {periodos?.[0]?.jogos_com_evento ?? 0} de {tempo.jogos} jogos com
              lances extraídos
            </span>
          )}
        </div>

        {(periodos?.length ?? 0) === 0 ? (
          <p className="discreto" style={{ marginBottom: 0 }}>
            Sem lances extraídos para esta competição ainda — a onda 3 está em
            andamento.
          </p>
        ) : (
          <>
            <div className="periodos">
              {periodos?.map((p) => (
                <div className="periodo" key={p.faixa}>
                  <div className="periodo-barras">
                    <div
                      className="barra marcados"
                      style={{ height: `${(p.marcados / maxGols) * 100}%` }}
                      title={`${p.marcados} marcados`}
                    />
                    <div
                      className="barra sofridos"
                      style={{ height: `${(p.sofridos / maxGols) * 100}%` }}
                      title={`${p.sofridos} sofridos`}
                    />
                  </div>
                  <div className="periodo-rotulo">{p.faixa}</div>
                  <div className="periodo-numeros">
                    <span className="marcados">{p.marcados}</span>
                    {" · "}
                    <span className="sofridos">{p.sofridos}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="discreto" style={{ marginBottom: 0 }}>
              <span className="legenda marcados" /> marcados{" "}
              <span className="legenda sofridos" /> sofridos. Cobertura parcial:
              só os jogos já alcançados pela onda 3.
            </p>
          </>
        )}
      </div>

      {/* --------------------------------------------- arbitragem */}
      <div className="cartao">
        <h2>Retrospecto por árbitro</h2>

        <div className="aviso">
          <strong>Isto é ruído, não padrão.</strong> Nenhum árbitro apitou mais de
          9 jogos do time. Com essa amostra, ganhar 4 de 5 com um árbitro é tão
          esperado quanto perder 4 de 5 — não indica tendência de arbitragem.
          A coluna <strong>vs. média</strong> existe justamente para lembrar disso:
          ela compara com o aproveitamento do próprio time, e ainda assim o
          contraste some com mais jogos.
        </div>

        <div className="linha" style={{ margin: "1rem 0" }}>
          <label className="discreto">
            Mínimo de jogos{" "}
            <select
              value={minJogosArbitro}
              onChange={(e) => setMinJogosArbitro(Number(e.target.value))}
            >
              <option value={1}>1</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
              <option value={6}>6</option>
            </select>
          </label>
          <span className="discreto">{arbitros?.length ?? 0} árbitros</span>
        </div>

        <div className="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th>Árbitro</th>
                <th className="num">J</th>
                <th className="num">V</th>
                <th className="num">E</th>
                <th className="num">D</th>
                <th className="num">Aprov.</th>
                <th className="num">vs. média</th>
                <th className="num">Faltas pró</th>
                <th className="num">Faltas contra</th>
                <th className="num">Amarelos pró</th>
                <th className="num">Amarelos contra</th>
                <th className="num">Amostra*</th>
              </tr>
            </thead>
            <tbody>
              {arbitros?.map((a) => (
                <tr key={a.arbitro}>
                  <td>{a.arbitro}</td>
                  <td className="num">{a.jogos}</td>
                  <td className="num">{a.vitorias}</td>
                  <td className="num">{a.empates}</td>
                  <td className="num">{a.derrotas}</td>
                  <td className="num">{a.aproveitamento_pct}%</td>
                  <td className="num">
                    <span
                      className={`nota ${a.diferenca_aproveitamento > 0 ? "boa" : a.diferenca_aproveitamento < 0 ? "ruim" : ""}`}
                    >
                      {a.diferenca_aproveitamento > 0 ? "+" : ""}
                      {a.diferenca_aproveitamento}
                    </span>
                  </td>
                  <td className="num discreto">{a.faltas_pro ?? "—"}</td>
                  <td className="num discreto">{a.faltas_contra ?? "—"}</td>
                  <td className="num">{a.amarelos_pro ?? "—"}</td>
                  <td className="num">{a.amarelos_contra ?? "—"}</td>
                  <td className="num discreto">{a.jogos_com_estatistica}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="discreto" style={{ marginBottom: 0 }}>
          * faltas e cartões vêm da onda 3 e cobrem só parte dos jogos — a coluna
          diz quantos. Aproveitamento e resultado cobrem todos.
        </p>
      </div>

      {/* --------------------------------------------- técnicos */}
      <div className="cartao">
        <h2>Aproveitamento por técnico</h2>
        <p className="discreto">
          Derivado da escalação de cada jogo, não do cadastro de carreira — o
          cadastro da API tem datas pouco confiáveis. Cobre só as partidas com
          escalação já extraída.
        </p>
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th>Técnico</th>
                <th>Temporada</th>
                <th>Competição</th>
                <th className="num">J</th>
                <th className="num">V</th>
                <th className="num">E</th>
                <th className="num">D</th>
                <th className="num">Gols</th>
                <th className="num">Aprov.</th>
                <th>Período</th>
              </tr>
            </thead>
            <tbody>
              {tecnicos?.map((t) => (
                <tr key={`${t.coach_id}-${t.season}-${t.league_id}`}>
                  <td>
                    <strong>{t.tecnico}</strong>
                  </td>
                  <td className="discreto">{t.season}</td>
                  <td className="discreto">{t.league_nome}</td>
                  <td className="num">{t.jogos}</td>
                  <td className="num">{t.vitorias}</td>
                  <td className="num">{t.empates}</td>
                  <td className="num">{t.derrotas}</td>
                  <td className="num discreto">
                    {t.gols_pro}:{t.gols_contra}
                  </td>
                  <td className="num">
                    <span className={`nota ${t.aproveitamento_pct >= 50 ? "boa" : t.aproveitamento_pct < 33 ? "ruim" : ""}`}>
                      {t.aproveitamento_pct}%
                    </span>
                  </td>
                  <td className="discreto">
                    {dataBr(t.primeiro_jogo)} – {dataBr(t.ultimo_jogo)}
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
