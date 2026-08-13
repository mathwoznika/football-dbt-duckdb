import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api } from "../api";
import type { DesempenhoPorForcaAdversario, EstatisticaDaTemporada } from "../api";
import Metrica from "../components/Metrica";
import { useDados } from "../useDados";

function dataBr(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/**
 * Pares pró/contra do perfil estatístico, na ordem em que aparecem.
 *
 * A barra divide o total entre os dois lados, igual à da tela de jogo: ela
 * mostra a *proporção* entre produzir e sofrer, não a grandeza absoluta.
 * Escalar pelo maior faria a barra do maior encostar sempre no fim.
 */
const COMPARACOES: {
  rotulo: string;
  pro: keyof EstatisticaDaTemporada;
  contra: keyof EstatisticaDaTemporada;
  pct?: boolean;
}[] = [
  { rotulo: "Finalizações por jogo", pro: "chutes_por_jogo", contra: "chutes_sofridos_por_jogo" },
  { rotulo: "No gol por jogo", pro: "chutes_no_gol_por_jogo", contra: "chutes_no_gol_sofridos_por_jogo" },
  { rotulo: "Dentro da área por jogo", pro: "chutes_na_area_por_jogo", contra: "chutes_na_area_sofridos_por_jogo" },
  { rotulo: "Escanteios por jogo", pro: "escanteios_por_jogo", contra: "escanteios_sofridos_por_jogo" },
  { rotulo: "Faltas por jogo", pro: "faltas_por_jogo", contra: "faltas_sofridas_por_jogo" },
  { rotulo: "Pontaria", pro: "pontaria_pct", contra: "pontaria_adversario_pct", pct: true },
  { rotulo: "Conversão", pro: "conversao_pct", contra: "conversao_sofrida_pct", pct: true },
];

/** Agrupa as faixas por competição-temporada, preservando a ordem da API. */
function porCompeticao(linhas: DesempenhoPorForcaAdversario[]) {
  const grupos = new Map<string, DesempenhoPorForcaAdversario[]>();
  linhas.forEach((linha) => {
    const chave = `${linha.season}-${linha.league_id}`;
    const atual = grupos.get(chave) ?? [];
    atual.push(linha);
    grupos.set(chave, atual);
  });
  return [...grupos.entries()];
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

  // Perfil estatístico: seletor próprio, montado a partir das linhas que o
  // endpoint devolveu. Não dá para reaproveitar o seletor de cima porque a
  // estatística não existe para toda competição — o Paranaense nunca aparece.
  const { dados: estatisticas } = useDados(
    () => api.estatisticasDaTemporada(teamId),
    [teamId],
  );
  const [selEstat, setSelEstat] = useState("");
  const chaveEstat =
    selEstat ||
    (estatisticas?.length
      ? `${estatisticas[0].season}-${estatisticas[0].league_id}`
      : "");
  const perfil = estatisticas?.find(
    (e) => `${e.season}-${e.league_id}` === chaveEstat,
  );

  const [minJogosFormacao, setMinJogosFormacao] = useState(1);
  const { dados: formacoes } = useDados(
    () => api.formacoes(teamId, undefined, minJogosFormacao),
    [teamId, minJogosFormacao],
  );

  const { dados: forca } = useDados(() => api.forcaAdversario(teamId), [teamId]);

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
              Onde os pontos são ganhos e perdidos: ao longo do jogo, contra
              quem, e com qual desenho
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

      {/* ------------------------------------ perfil estatístico */}
      <div className="cartao">
        <h2>Perfil estatístico</h2>
        <p className="discreto">
          O que o time produziu e o que produziram contra ele, por jogo. Vem da
          extração por partida, então a cobertura é parcial — cada número diz de
          quantos jogos saiu.
        </p>

        {(estatisticas?.length ?? 0) === 0 ? (
          <p className="discreto" style={{ marginBottom: 0 }}>
            Nenhuma partida deste time teve estatística extraída ainda.
          </p>
        ) : (
          <>
            <div className="linha" style={{ marginBottom: "1rem" }}>
              <select
                value={chaveEstat}
                onChange={(e) => setSelEstat(e.target.value)}
              >
                {estatisticas?.map((e) => (
                  <option
                    key={`${e.season}-${e.league_id}`}
                    value={`${e.season}-${e.league_id}`}
                  >
                    {e.season} · {e.league_nome}
                  </option>
                ))}
              </select>
              {perfil && (
                <span className="discreto">
                  {perfil.jogos_com_estatistica} de {perfil.jogos_na_competicao}{" "}
                  jogos com estatística ({perfil.cobertura_pct}%)
                </span>
              )}
            </div>

            {perfil && (
              <>
                <div className="metricas" style={{ marginBottom: "1.4rem" }}>
                  <Metrica
                    rotulo="Posse"
                    valor={perfil.posse_media_pct ? `${perfil.posse_media_pct}%` : "—"}
                    nota="média por jogo"
                  />
                  <Metrica
                    rotulo="Precisão de passe"
                    valor={
                      perfil.precisao_passe_media_pct
                        ? `${perfil.precisao_passe_media_pct}%`
                        : "—"
                    }
                  />
                  <Metrica
                    rotulo="Passes"
                    valor={perfil.passes_por_jogo ?? "—"}
                    nota="por jogo"
                  />
                  <Metrica
                    rotulo="Chutes por gol"
                    valor={perfil.chutes_por_gol ?? "—"}
                    nota={perfil.chutes_por_gol === null ? "não marcou" : undefined}
                  />
                  <Metrica
                    rotulo="Defesas do goleiro"
                    valor={perfil.defesas_goleiro_por_jogo ?? "—"}
                    nota="por jogo"
                  />
                  <Metrica
                    rotulo="Amarelos"
                    valor={perfil.amarelos_por_jogo ?? "—"}
                    nota="por jogo"
                  />
                </div>

                <div className="estatisticas">
                  {COMPARACOES.map(({ rotulo, pro, contra, pct }) => {
                    const a = (perfil[pro] as number | null) ?? 0;
                    const b = (perfil[contra] as number | null) ?? 0;
                    if (a === 0 && b === 0) return null;
                    const total = a + b || 1;
                    return (
                      <div className="estat-linha" key={rotulo}>
                        <span className="estat-valor">
                          {a}
                          {pct ? "%" : ""}
                        </span>
                        <div className="estat-meio">
                          <span className="estat-rotulo">{rotulo}</span>
                          <div className="estat-barra">
                            <div
                              className="lado-casa"
                              style={{ width: `${(a / total) * 100}%` }}
                            />
                            <div
                              className="lado-fora"
                              style={{ width: `${(b / total) * 100}%` }}
                            />
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
                <p className="discreto" style={{ marginBottom: 0 }}>
                  À esquerda o que o time fez, à direita o que fizeram contra
                  ele. <strong>Pontaria</strong> é chute no gol sobre chute
                  total; <strong>conversão</strong> é gol sobre chute no gol —
                  as duas somam a temporada inteira antes de dividir, então um
                  jogo de 2 chutes não pesa igual a um de 20.
                </p>
              </>
            )}
          </>
        )}
      </div>

      {/* ------------------------------- contra cada faixa da tabela */}
      <div className="cartao">
        <h2>Contra cada faixa da tabela</h2>
        <p className="discreto">
          Duas campanhas com os mesmos pontos podem ter origens opostas: ganhar
          de quem está embaixo não é o mesmo que pontuar contra quem briga em
          cima. Diferente das outras análises desta página,{" "}
          <strong>esta cobre todos os jogos</strong> — sai do placar, não da
          extração por partida. Só a fase de pontos corridos entra, então copa
          não aparece.
        </p>

        {(forca?.length ?? 0) === 0 ? (
          <p className="discreto" style={{ marginBottom: 0 }}>
            Sem competição de pontos corridos na base para este time.
          </p>
        ) : (
          porCompeticao(forca ?? []).map(([chaveGrupo, faixas]) => (
            <div key={chaveGrupo} style={{ marginBottom: "1.4rem" }}>
              <h3 style={{ margin: "0 0 0.6rem", fontSize: "0.95rem" }}>
                {faixas[0].season} · {faixas[0].league_nome}{" "}
                <span className="discreto" style={{ fontWeight: 400 }}>
                  — {faixas[0].times_na_competicao} times na tabela
                </span>
              </h3>
              <div className="tabela-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Faixa do adversário</th>
                      <th className="num">J</th>
                      <th className="num">V</th>
                      <th className="num">E</th>
                      <th className="num">D</th>
                      <th className="num">Pts</th>
                      <th className="num">Gols</th>
                      <th className="num">Aprov.</th>
                      <th style={{ width: "22%" }}></th>
                      <th className="num">Pos. média</th>
                    </tr>
                  </thead>
                  <tbody>
                    {faixas.map((f) => (
                      <tr key={f.faixa_adversario}>
                        <td>
                          {f.faixa_rotulo}{" "}
                          <span className="discreto">
                            ({f.times_na_faixa} times)
                          </span>
                        </td>
                        <td className="num discreto">{f.jogos}</td>
                        <td className="num">{f.vitorias}</td>
                        <td className="num">{f.empates}</td>
                        <td className="num">{f.derrotas}</td>
                        <td className="num">
                          <strong>{f.pontos}</strong>
                        </td>
                        <td className="num discreto">
                          {f.gols_pro}:{f.gols_contra}
                        </td>
                        <td className="num">
                          <span
                            className={`nota ${f.aproveitamento_pct >= 50 ? "boa" : f.aproveitamento_pct < 33 ? "ruim" : ""}`}
                          >
                            {f.aproveitamento_pct}%
                          </span>
                        </td>
                        <td>
                          <div className="estat-barra">
                            <div
                              className="lado-casa"
                              style={{ width: `${f.aproveitamento_pct}%` }}
                            />
                          </div>
                        </td>
                        <td className="num discreto">
                          {f.posicao_media_adversario}º
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
        <p className="discreto" style={{ marginBottom: 0 }}>
          As faixas são quartis da classificação final, e não "G4" ou "zona de
          rebaixamento": quem classifica e quem cai muda por competição e por
          ano. <strong>Pos. média</strong> desempata a leitura — enfrentar o
          1º quarto não é a mesma coisa se foi o campeão ou o quinto colocado.
        </p>
      </div>

      {/* ---------------------------------------------- formações */}
      <div className="cartao">
        <h2>Formações</h2>
        <p className="discreto">
          Com qual desenho o time entrou e o que colheu com cada um. Vem da
          escalação, então cobre só os jogos já extraídos.
        </p>

        <div className="linha" style={{ margin: "1rem 0" }}>
          <label className="discreto">
            Mínimo de jogos{" "}
            <select
              value={minJogosFormacao}
              onChange={(e) => setMinJogosFormacao(Number(e.target.value))}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
            </select>
          </label>
          <span className="discreto">
            {formacoes?.length ?? 0} formações
          </span>
        </div>

        {(formacoes?.length ?? 0) === 0 ? (
          <p className="discreto" style={{ marginBottom: 0 }}>
            Nenhuma formação com esse mínimo de jogos.
          </p>
        ) : (
          <>
            <div className="tabela-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Formação</th>
                    <th>Temporada</th>
                    <th>Competição</th>
                    <th className="num">J</th>
                    <th className="num">V</th>
                    <th className="num">E</th>
                    <th className="num">D</th>
                    <th className="num">Aprov.</th>
                    <th className="num">Gols/j</th>
                    <th className="num">Sofridos/j</th>
                    <th className="num">Sem sofrer</th>
                    <th>Técnico</th>
                  </tr>
                </thead>
                <tbody>
                  {formacoes?.map((f) => (
                    <tr key={`${f.season}-${f.league_id}-${f.formacao}`}>
                      <td>
                        <span className="faixa">{f.formacao}</span>
                      </td>
                      <td className="discreto">{f.season}</td>
                      <td className="discreto">{f.league_nome}</td>
                      <td className="num">
                        <strong>{f.jogos}</strong>
                      </td>
                      <td className="num">{f.vitorias}</td>
                      <td className="num">{f.empates}</td>
                      <td className="num">{f.derrotas}</td>
                      <td className="num">
                        {/* com 1 ou 2 jogos o percentual nao significa nada,
                            entao ele perde a cor que sugere julgamento */}
                        <span
                          className={`nota ${f.jogos < 3 ? "" : f.aproveitamento_pct >= 50 ? "boa" : f.aproveitamento_pct < 33 ? "ruim" : ""}`}
                        >
                          {f.aproveitamento_pct}%
                        </span>
                      </td>
                      <td className="num discreto">{f.gols_por_jogo}</td>
                      <td className="num discreto">{f.gols_sofridos_por_jogo}</td>
                      <td className="num">{f.jogos_sem_sofrer_gol}</td>
                      <td className="discreto">{f.tecnicos ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="discreto" style={{ marginBottom: 0 }}>
              Leia a coluna <strong>J</strong> antes do aproveitamento: 100% com
              uma partida é uma partida, não uma tendência — por isso o
              percentual só ganha cor a partir de três jogos.
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
