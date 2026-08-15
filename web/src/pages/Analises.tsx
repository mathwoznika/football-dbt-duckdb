import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { api } from "../api";
import type { DesempenhoPorForcaAdversario, EstatisticaDaTemporada } from "../api";
import Metrica from "../components/Metrica";
import { Glossario, Termo } from "../components/Termo";
import { useLimiteDeLinhas } from "../components/LimiteDeLinhas";
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

/**
 * As abas da página.
 *
 * POR QUE ABAS. A página chegou a onze seções empilhadas — quem queria ver
 * arbitragem passava por sete tabelas antes. Empilhar tudo trata todas as
 * análises como igualmente urgentes, e nenhuma leitura é assim: quem investiga
 * disciplina não quer formação no caminho.
 *
 * O agrupamento é por PERGUNTA, não por origem do dado. "Disciplina" junta
 * cartões, expulsões e arbitragem porque as três respondem à mesma dúvida,
 * ainda que venham de marts diferentes.
 *
 * A aba fica na URL (?aba=), então a leitura é compartilhável por link e o
 * botão voltar do navegador anda entre abas em vez de sair da página.
 */
const ABAS = [
  { id: "jogo", rotulo: "O jogo" },
  { id: "ataque", rotulo: "Ataque e defesa" },
  { id: "disciplina", rotulo: "Disciplina" },
  { id: "elenco", rotulo: "Elenco e comissão" },
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

  // Reaproveita o seletor de temporada de "Momento dos gols": os dois graficos
  // usam o mesmo eixo de 15 minutos e a comparacao so vale na mesma competicao.
  const { dados: cartoes } = useDados(
    () =>
      season && leagueId
        ? api.cartoesPorPeriodo(teamId, season, leagueId)
        : Promise.resolve([]),
    [teamId, season, leagueId],
  );
  const { dados: disciplina } = useDados(() => api.disciplina(teamId), [teamId]);

  const maxCartoes = Math.max(
    1,
    ...(cartoes ?? []).flatMap((c) => [c.tomados, c.provocados]),
  );

  const { dados: origem } = useDados(() => api.origemDosGols(teamId), [teamId]);
  const { dados: banco } = useDados(() => api.banco(teamId), [teamId]);

  // A nota de rodape sobre assistencia so faz sentido se alguma competicao da
  // lista realmente nao registrar o dado.
  const faltaAssistencia = (origem ?? []).some((o) => !o.assistencia_registrada);

  // escala das barras do gráfico de períodos
  const maxGols = Math.max(
    1,
    ...(periodos ?? []).flatMap((p) => [p.marcados, p.sofridos]),
  );

  // A aba vive na URL: leitura compartilhavel por link e o botao voltar anda
  // entre abas em vez de sair da pagina. Aba desconhecida cai na primeira, para
  // um link antigo ou mal digitado nunca render tela em branco.
  const [params, setParams] = useSearchParams();
  const pedida = params.get("aba");
  const aba = ABAS.some((a) => a.id === pedida) ? pedida! : ABAS[0].id;
  const setAba = (id: string) => setParams({ aba: id }, { replace: true });

  const formacoesLimitadas = useLimiteDeLinhas(formacoes, 10);
  const arbitrosLimitados = useLimiteDeLinhas(arbitros, 10);

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

      <div className="abas" role="tablist">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={aba === a.id}
            className={`aba ${aba === a.id ? "ativa" : ""}`}
            onClick={() => setAba(a.id)}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {aba === "jogo" && (
        <>
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
                  <th className="num"><Termo k="pontos_se_1t" /></th>
                  <th className="num">Dif.</th>
                  <th className="num">Saldo 1º</th>
                  <th className="num">Saldo 2º</th>
                  <th className="num"><Termo k="viradas" /></th>
                  <th className="num"><Termo k="reacoes" /></th>
                  <th className="num"><Termo k="vantagens_empatadas" /></th>
                  <th className="num"><Termo k="vantagens_perdidas" /></th>
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
          <Glossario termos={["pontos_se_1t", "viradas", "reacoes", "vantagens_empatadas", "vantagens_perdidas"]} />
        </div>
        </>
      )}

      {aba === "jogo" && (
        <>
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
        </>
      )}

      {aba === "disciplina" && (
        <>
        {/* ------------------------------------ momento do cartão */}
        <div className="cartao">
          <h2>Quando o cartão sai</h2>
          <p className="discreto">
            Faixas de 15 minutos, o mesmo eixo de <strong>Momento dos gols</strong>{" "}
            — as duas leituras foram feitas para serem comparadas.
          </p>

          {/* Seletor proprio, ligado ao mesmo estado do grafico de gols. As duas
              seções vivem em abas diferentes agora, e uma aba que depende de um
              controle invisivel noutra tela nao se sustenta. Como o estado e
              compartilhado, mudar aqui muda la e vice-versa. */}
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
            {cartoes?.[0] && (
              <span className="discreto">
                {cartoes[0].jogos_com_evento} jogos com lances extraídos
              </span>
            )}
          </div>

          {(cartoes?.length ?? 0) === 0 ? (
            <p className="discreto" style={{ marginBottom: 0 }}>
              Sem lances extraídos para esta competição ainda.
            </p>
          ) : (
            <>
              <div className="periodos">
                {cartoes?.map((c) => (
                  <div className="periodo" key={c.faixa}>
                    <div className="periodo-barras">
                      <div
                        className="barra sofridos"
                        style={{ height: `${(c.tomados / maxCartoes) * 100}%` }}
                        title={`${c.tomados} tomados (${c.amarelos} amarelos, ${c.vermelhos} vermelhos)`}
                      />
                      <div
                        className="barra marcados"
                        style={{ height: `${(c.provocados / maxCartoes) * 100}%` }}
                        title={`${c.provocados} provocados`}
                      />
                    </div>
                    <div className="periodo-rotulo">{c.faixa}</div>
                    <div className="periodo-numeros">
                      <span className="sofridos">{c.tomados}</span>
                      {" · "}
                      <span className="marcados">{c.provocados}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="discreto" style={{ marginBottom: 0 }}>
                <span className="legenda sofridos" /> tomados pelo time{" "}
                <span className="legenda marcados" /> tomados pelo adversário no
                mesmo jogo — o contraste importa, porque jogo truncado castiga os
                dois lados. Passe o mouse na barra para ver a divisão entre
                amarelos e vermelhos.
              </p>
            </>
          )}
        </div>
        </>
      )}

      {aba === "disciplina" && (
        <>
        {/* --------------------------- disciplina e custo da expulsão */}
        <div className="cartao">
          <h2>O que a expulsão custa</h2>
          <p className="discreto">
            Contar gols sofridos depois de uma vermelha não diz nada sozinho: uma
            expulsão aos 30 custa o triplo de uma aos 80. A coluna{" "}
            <strong>com um a menos</strong> divide pelos minutos realmente jogados
            em desvantagem, e só faz sentido lida contra o ritmo normal do time,
            na coluna ao lado.
          </p>

          <div className="aviso">
            <strong>Amostra pequena — leia a coluna J⁻ antes da taxa.</strong> O
            Coritiba tem 21 expulsões em 19 jogos somando todas as competições, o
            que por temporada vira meia dúzia. Na Série B de 2024 a taxa sai de{" "}
            <strong>2 gols em 56 minutos</strong>: o número é aritmeticamente
            correto e não sustenta conclusão nenhuma.
          </div>

          {(disciplina?.length ?? 0) === 0 ? (
            <p className="discreto" style={{ marginBottom: 0 }}>
              Nenhum lance extraído para este time ainda.
            </p>
          ) : (
            <>
              <div className="tabela-wrap" style={{ marginTop: "1rem" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Temporada</th>
                      <th>Competição</th>
                      <th className="num"><Termo k="jogos_analisados" /></th>
                      <th className="num">Amarelos</th>
                      <th className="num">Vermelhos</th>
                      <th className="num">Cartões/jogo</th>
                      <th className="num">Adversário</th>
                      <th className="num">1º cartão</th>
                      <th className="num">Após 75'</th>
                      <th className="num"><Termo k="jogos_com_expulsao" /></th>
                      <th className="num">Min. com um a menos</th>
                      <th className="num"><Termo k="sofridos_um_a_menos" /></th>
                      <th className="num"><Termo k="ritmo_normal" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {disciplina?.map((d) => (
                      <tr key={`${d.season}-${d.league_id}`}>
                        <td>{d.season}</td>
                        <td className="discreto">{d.league_nome}</td>
                        <td className="num discreto">{d.jogos_com_evento}</td>
                        <td className="num">{d.amarelos}</td>
                        <td className="num">
                          <strong>{d.vermelhos}</strong>
                        </td>
                        <td className="num">{d.cartoes_por_jogo ?? "—"}</td>
                        <td className="num discreto">{d.cartoes_do_adversario}</td>
                        <td className="num discreto">
                          {d.minuto_medio_primeiro_cartao !== null
                            ? `${d.minuto_medio_primeiro_cartao}'`
                            : "—"}
                        </td>
                        <td className="num discreto">{d.cartoes_apos_75}</td>
                        <td className="num">{d.jogos_com_expulsao}</td>
                        <td className="num discreto">
                          {d.minutos_com_um_a_menos || "—"}
                        </td>
                        <td className="num">
                          {/* Sem pelo menos 3 jogos com expulsão o número não
                              recebe cor: colorir sugeriria um padrão que a
                              amostra não sustenta. */}
                          <span
                            className={`nota ${
                              d.jogos_com_expulsao < 3
                                ? ""
                                : (d.gols_sofridos_por_90_com_um_a_menos ?? 0) >
                                    (d.gols_sofridos_por_90_normal ?? 0)
                                  ? "ruim"
                                  : "boa"
                            }`}
                          >
                            {d.gols_sofridos_por_90_com_um_a_menos ?? "—"}
                          </span>
                        </td>
                        <td className="num discreto">
                          {d.gols_sofridos_por_90_normal ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="discreto" style={{ marginBottom: 0 }}>
                * jogos com lances extraídos. <strong>J⁻</strong> é em quantos
                deles o time ficou com um a menos. Os minutos em desvantagem são
                contados como 90 menos o minuto da vermelha, sem acréscimo — então
                a taxa sai levemente superestimada. A coluna só ganha cor a partir
                de três jogos com expulsão.
              </p>
            </>
          )}
          <Glossario termos={["jogos_analisados", "jogos_com_expulsao", "sofridos_um_a_menos", "ritmo_normal"]} />
        </div>
        </>
      )}

      {aba === "ataque" && (
        <>
        {/* -------------------------------------- de onde vem o gol */}
        <div className="cartao">
          <h2>De onde vem o gol</h2>
          <p className="discreto">
            A tabela não responde isso. Dois times com os mesmos 40 gols podem ter
            chegado lá de formas opostas — um com dez pênaltis, outro com dois —, e
            a diferença importa porque pênalti não se repete na mesma proporção no
            ano seguinte.
          </p>

          {(origem?.length ?? 0) === 0 ? (
            <p className="discreto" style={{ marginBottom: 0 }}>
              Nenhum lance extraído para este time ainda.
            </p>
          ) : (
            <>
              <div className="tabela-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Temporada</th>
                      <th>Competição</th>
                      <th className="num"><Termo k="jogos_analisados" /></th>
                      <th className="num">Gols</th>
                      <th className="num">Normais</th>
                      <th className="num">Pênaltis</th>
                      <th className="num"><Termo k="gol_contra_a_favor" /></th>
                      <th className="num"><Termo k="assistidos" /></th>
                      <th className="num">Sofridos</th>
                      <th className="num">Sofr. pênalti</th>
                    </tr>
                  </thead>
                  <tbody>
                    {origem?.map((o) => (
                      <tr key={`${o.season}-${o.league_id}`}>
                        <td>{o.season}</td>
                        <td className="discreto">{o.league_nome}</td>
                        <td className="num discreto">{o.jogos_com_evento}</td>
                        <td className="num">
                          <strong>{o.gols}</strong>
                        </td>
                        <td className="num discreto">{o.gols_normais}</td>
                        <td className="num">
                          {o.gols_penalti}
                          {o.penalti_pct !== null && (
                            <span className="discreto"> ({o.penalti_pct}%)</span>
                          )}
                        </td>
                        <td className="num discreto">{o.gols_contra_a_favor}</td>
                        <td className="num">
                          {/* Nulo aqui NAO e zero: a competicao nao registra o
                              dado. Mostrar 0 afirmaria que ninguem assistiu. */}
                          {o.assistencia_registrada ? (
                            <>
                              {o.gols_com_assistencia}
                              {o.assistidos_pct !== null && (
                                <span className="discreto">
                                  {" "}
                                  ({o.assistidos_pct}%)
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="discreto" title="A fonte não registra assistência nesta competição">
                              não registrado
                            </span>
                          )}
                        </td>
                        <td className="num">{o.sofridos}</td>
                        <td className="num discreto">
                          {o.sofridos_penalti}
                          {o.sofridos_penalti_pct !== null && (
                            <span> ({o.sofridos_penalti_pct}%)</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="discreto" style={{ marginBottom: 0 }}>
                * jogos com lances extraídos, não a competição inteira — a onda 3
                ainda está em andamento. <strong>Contra</strong> são gols contra
                marcados por jogador adversário, que a fonte credita ao time
                beneficiado, como no placar.
                {faltaAssistencia && (
                  <>
                    {" "}
                    Onde aparece <strong>não registrado</strong>, a fonte não
                    guarda passe decisivo naquela competição — mostrar zero
                    afirmaria que nenhum gol teve assistência, o que o dado não
                    sustenta.
                  </>
                )}
              </p>
            </>
          )}
          <Glossario termos={["jogos_analisados", "gol_contra_a_favor", "assistidos"]} />
        </div>
        </>
      )}

      {aba === "ataque" && (
        <>
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
          <Glossario termos={["jogos_analisados", "posse", "precisao_passe", "pontaria", "conversao", "chutes_por_gol"]} />
        </div>
        </>
      )}

      {aba === "jogo" && (
        <>
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
                        <th><Termo k="faixa_tabela" /></th>
                        <th className="num">J</th>
                        <th className="num">V</th>
                        <th className="num">E</th>
                        <th className="num">D</th>
                        <th className="num">Pts</th>
                        <th className="num">Gols</th>
                        <th className="num"><Termo k="aproveitamento" /></th>
                        <th style={{ width: "22%" }}></th>
                        <th className="num"><Termo k="posicao_media_adversario" /></th>
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
          <Glossario termos={["faixa_tabela", "posicao_media_adversario", "aproveitamento"]} />
        </div>
        </>
      )}

      {aba === "elenco" && (
        <>
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
                      <th className="num"><Termo k="aproveitamento" /></th>
                      <th className="num">Gols/j</th>
                      <th className="num">Sofridos/j</th>
                      <th className="num">Sem sofrer</th>
                      <th>Técnico</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formacoesLimitadas.visiveis.map((f) => (
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
              {formacoesLimitadas.controle}
              <p className="discreto" style={{ marginBottom: 0 }}>
                Leia a coluna <strong>J</strong> antes do aproveitamento: 100% com
                uma partida é uma partida, não uma tendência — por isso o
                percentual só ganha cor a partir de três jogos.
              </p>
            </>
          )}
          <Glossario termos={["jogos_analisados", "aproveitamento"]} />
        </div>
        </>
      )}

      {aba === "elenco" && (
        <>
        {/* -------------------------------------- o banco e as trocas */}
        <div className="cartao">
          <h2>O banco e as trocas</h2>
          <p className="discreto">
            Duas perguntas que só existem porque o lance de substituição guarda o{" "}
            <strong>minuto</strong>: quanto do ataque sai de quem entrou, e a que
            altura o técnico mexe. A primeira troca descreve a intenção melhor que
            a média de todas, que mistura ajuste tático com queima de tempo aos 88.
          </p>

          {(banco?.length ?? 0) === 0 ? (
            <p className="discreto" style={{ marginBottom: 0 }}>
              Nenhum lance extraído para este time ainda.
            </p>
          ) : (
            <>
              <div className="tabela-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Temporada</th>
                      <th>Competição</th>
                      <th className="num"><Termo k="jogos_analisados" /></th>
                      <th className="num">Gols de titular</th>
                      <th className="num"><Termo k="gols_do_banco" /></th>
                      <th className="num">% do banco</th>
                      <th className="num">Assist. do banco</th>
                      <th className="num">Trocas/jogo</th>
                      <th className="num"><Termo k="primeira_troca" /></th>
                      <th className="num">Trocas no 1º T</th>
                      <th className="num"><Termo k="autor_nao_identificado" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {banco?.map((b) => (
                      <tr key={`${b.season}-${b.league_id}`}>
                        <td>{b.season}</td>
                        <td className="discreto">{b.league_nome}</td>
                        <td className="num discreto">{b.jogos_com_evento}</td>
                        <td className="num">{b.gols_de_titular}</td>
                        <td className="num">
                          <strong>{b.gols_de_reserva}</strong>
                        </td>
                        <td className="num">
                          <span
                            className={`nota ${(b.gols_do_banco_pct ?? 0) >= 25 ? "boa" : ""}`}
                          >
                            {b.gols_do_banco_pct !== null
                              ? `${b.gols_do_banco_pct}%`
                              : "—"}
                          </span>
                        </td>
                        <td className="num discreto">
                          {b.assistencias_de_reserva ?? "n/r"}
                        </td>
                        <td className="num discreto">
                          {b.substituicoes_por_jogo ?? "—"}
                        </td>
                        <td className="num">
                          {b.minuto_medio_primeira_troca !== null
                            ? `${b.minuto_medio_primeira_troca}'`
                            : "—"}
                        </td>
                        <td className="num discreto">{b.jogos_com_troca_no_1t}</td>
                        <td className="num discreto">{b.gols_sem_escalacao}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="discreto" style={{ marginBottom: 0 }}>
                * jogos com lances extraídos. <strong>Autor n/d</strong> são gols
                em partida que tem lance e não tem escalação, então o autor não
                casa com ninguém — a coluna fica visível para que titular mais
                banco sempre feche com o total, em vez de a conta sumir.{" "}
                <strong>n/r</strong> em assistência é competição que a fonte não
                registra.
              </p>
            </>
          )}
          <Glossario termos={["jogos_analisados", "gols_do_banco", "primeira_troca", "autor_nao_identificado"]} />
        </div>
        </>
      )}

      {aba === "disciplina" && (
        <>
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
                  <th className="num"><Termo k="aproveitamento" /></th>
                  <th className="num"><Termo k="vs_media" /></th>
                  <th className="num">Faltas pró</th>
                  <th className="num">Faltas contra</th>
                  <th className="num">Amarelos pró</th>
                  <th className="num">Amarelos contra</th>
                  <th className="num"><Termo k="jogos_analisados" /></th>
                </tr>
              </thead>
              <tbody>
                {arbitrosLimitados.visiveis.map((a) => (
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
          {arbitrosLimitados.controle}
          <p className="discreto" style={{ marginBottom: 0 }}>
            * faltas e cartões vêm da onda 3 e cobrem só parte dos jogos — a coluna
            diz quantos. Aproveitamento e resultado cobrem todos.
          </p>
          <Glossario termos={["jogos_analisados", "aproveitamento", "vs_media"]} />
        </div>
        </>
      )}

      {aba === "elenco" && (
        <>
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
                  <th className="num"><Termo k="aproveitamento" /></th>
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
      )}

    </>
  );
}
