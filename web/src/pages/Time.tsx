import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api } from "../api";
import CaminhoNoTorneio from "../components/CaminhoNoTorneio";
import Chaveamento from "../components/Chaveamento";
import Artilheiros from "../components/Artilheiros";
import Classificacao from "../components/Classificacao";
import Metrica from "../components/Metrica";
import { useDados } from "../useDados";

/** Formata "2023-12-07" como "07/12/2023" sem depender de biblioteca. */
function dataBr(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function TimePage() {
  // useParams le o trecho variavel da URL. Vem sempre como texto.
  const { id } = useParams();
  const teamId = Number(id);

  const { dados: time, erro: erroTime } = useDados(() => api.time(teamId), [teamId]);
  const { dados: temporadas } = useDados(() => api.temporadas(teamId), [teamId]);
  const { dados: confrontos } = useDados(() => api.confrontos(teamId, 3), [teamId]);

  // A competicao selecionada, guardada como texto "season-league" porque um
  // <select> so trabalha com string.
  const [selecao, setSelecao] = useState("");

  // Em vez de um useEffect para escolher o padrao quando os dados chegam, a
  // selecao efetiva e DERIVADA: se o usuario nao escolheu nada, usa a primeira
  // competicao da lista. Menos estado, menos chance de dessincronizar.
  const chave =
    selecao ||
    (temporadas?.length ? `${temporadas[0].season}-${temporadas[0].league_id}` : "");
  const [season, leagueId] = chave
    ? chave.split("-").map(Number)
    : [undefined, undefined];

  const pronto = Boolean(season && leagueId);

  const { dados: campanha } = useDados(
    () => (pronto ? api.campanha(teamId, season, leagueId) : Promise.resolve([])),
    [teamId, season, leagueId],
  );
  const { dados: tabela } = useDados(
    () => (pronto ? api.classificacao(leagueId!, season!) : Promise.resolve([])),
    [season, leagueId],
  );
  const { dados: chaveamento } = useDados(
    () => (pronto ? api.chaveamento(leagueId!, season!) : Promise.resolve([])),
    [season, leagueId],
  );
  const { dados: artilharia } = useDados(
    () => (pronto ? api.artilheiros(leagueId!, season!, 10) : Promise.resolve([])),
    [season, leagueId],
  );
  const { dados: transferencias } = useDados(
    () => api.transferencias(teamId, 2020),
    [teamId],
  );
  // Duas leituras do elenco. `porNoventa` alterna entre os totais (quem
  // produziu na temporada) e as taxas por 90 minutos (quem produz em campo).
  // O piso de minutos so existe por causa da segunda: sem ele, quem entrou 12
  // minutos e marcou lidera a tabela com 7,5 gols por 90.
  const [porNoventa, setPorNoventa] = useState(false);
  const [minMinutos, setMinMinutos] = useState(0);
  const [grupo, setGrupo] = useState("");

  const { dados: elenco } = useDados(
    () =>
      pronto
        ? api.elenco(teamId, season, leagueId, minMinutos, grupo || undefined)
        : Promise.resolve([]),
    [teamId, season, leagueId, minMinutos, grupo],
  );

  const resumo = temporadas?.find(
    (t) => t.season === season && t.league_id === leagueId,
  );

  // Os 5 ultimos jogos em ordem CRONOLOGICA — o mais recente fica a direita.
  // Sem reverse de proposito: e a mesma convencao da coluna "Ultimas 5" da
  // classificacao, e duas convencoes diferentes na mesma tela confundiriam.
  const forma = campanha?.slice(-5) ?? [];

  // A competicao dita o layout: pontos corridos ganham a tabela ao lado da
  // campanha; mata-mata ganha o chaveamento. Uma competicao pode ter os dois
  // (o Paranaense tem fase de grupos e depois mata-mata).
  const temTabela = (tabela?.length ?? 0) > 0;
  const temChave = (chaveamento?.length ?? 0) > 0;

  if (erroTime) {
    return (
      <div className="cartao">
        Time não encontrado. <Link to="/">Voltar</Link>
      </div>
    );
  }

  const tabelaCampanha = (
    <div className="cartao">
      <h2>Campanha jogo a jogo</h2>
      <div className="tabela-wrap">
        <table>
          <thead>
            <tr>
              <th className="num">#</th>
              <th>Data</th>
              <th>Rodada</th>
              <th></th>
              <th>Adversário</th>
              <th className="num">Placar</th>
              <th></th>
              <th className="num">Pts</th>
              <th className="num">Forma*</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {campanha?.map((j) => (
              <tr key={j.fixture_id}>
                <td className="num discreto">{j.jogo_n}</td>
                <td className="discreto">{dataBr(j.data)}</td>
                <td className="discreto">{j.rodada ?? "—"}</td>
                <td className="discreto">{j.mando === "casa" ? "🏠" : "✈️"}</td>
                <td>
                  <Link to={`/times/${j.adversario_id}`}>{j.adversario_nome}</Link>
                </td>
                <td className="num">
                  {j.gols_pro} x {j.gols_contra}
                  {/* redundante com o chaveamento de proposito: um 1x1 que
                      virou classificacao precisa mostrar por que */}
                  {j.penaltis_pro !== null && j.penaltis_contra !== null && (
                    <span className="discreto">
                      {" "}
                      ({j.penaltis_pro}-{j.penaltis_contra} pên)
                    </span>
                  )}
                </td>
                <td>
                  <span className={`pill ${j.resultado}`}>{j.resultado}</span>
                </td>
                <td className="num">{j.pontos_acumulados}</td>
                <td className="num discreto">{j.pontos_5_anteriores ?? "—"}</td>
                <td>
                  <Link className="botao" to={`/jogos/${j.fixture_id}`}>
                    Estatísticas
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="discreto" style={{ marginBottom: 0 }}>
        * pontos conquistados nos 5 jogos <em>anteriores</em> — é a forma que o time
        levava para a partida, sem incluir o resultado dela.
      </p>
    </div>
  );

  return (
    <>
      {/* ------------------------------------------------ cabecalho */}
      <div className="cartao">
        <div className="linha">
          {time?.logo_url && <img className="escudo" src={time.logo_url} alt="" />}
          <div>
            <h1 style={{ margin: 0, fontSize: "1.6rem" }}>{time?.team_nome}</h1>
            <div className="discreto">
              {[time?.cidade, time?.estadio].filter(Boolean).join(" · ")}
              {time?.capacidade
                ? ` · ${time.capacidade.toLocaleString("pt-BR")} lugares`
                : ""}
              {time?.fundacao ? ` · fundado em ${time.fundacao}` : ""}
            </div>
          </div>
          <div className="linha" style={{ marginLeft: "auto", gap: "0.5rem" }}>
            {season && leagueId && (
              <Link className="botao" to={`/competicoes/${leagueId}/${season}`}>
                Ver competição
              </Link>
            )}
            <Link className="botao" to={`/times/${teamId}/analises`}>
              Análises →
            </Link>
          </div>
        </div>
      </div>

      {/* ------------------------------------------- seletor + metricas */}
      <div className="cartao">
        <div className="linha" style={{ marginBottom: "1rem" }}>
          <select value={chave} onChange={(e) => setSelecao(e.target.value)}>
            {temporadas?.map((t) => (
              <option
                key={`${t.season}-${t.league_id}`}
                value={`${t.season}-${t.league_id}`}
              >
                {t.season} · {t.league_nome}
              </option>
            ))}
          </select>

          {/* o desfecho da campanha: em copa e o que realmente importa */}
          {resumo?.resultado_final && (
            <span className="faixa">{resumo.resultado_final}</span>
          )}

          {/* faixa de forma: os 5 ultimos resultados, mais recente a direita */}
          <div className="linha" style={{ gap: "0.25rem" }}>
            {forma.map((j) => (
              <span
                key={j.fixture_id}
                className={`pill ${j.resultado}`}
                title={`${dataBr(j.data)} — ${j.adversario_nome} ${j.gols_pro}x${j.gols_contra}`}
              >
                {j.resultado}
              </span>
            ))}
          </div>
        </div>

        {resumo && (
          <div className="metricas">
            {resumo.posicao !== null && (
              <Metrica
                rotulo="Pos. na tabela"
                valor={`${resumo.posicao}º`}
                nota={temChave ? "fase de grupos" : undefined}
              />
            )}
            <Metrica rotulo="Pontos" valor={resumo.pontos} />
            <Metrica rotulo="Jogos" valor={resumo.jogos} />
            <Metrica
              rotulo="V / E / D"
              valor={`${resumo.vitorias}/${resumo.empates}/${resumo.derrotas}`}
            />
            <Metrica
              rotulo="Saldo"
              valor={resumo.saldo > 0 ? `+${resumo.saldo}` : resumo.saldo}
            />
            <Metrica rotulo="Aproveitamento" valor={`${resumo.aproveitamento_pct}%`} />
            <Metrica
              rotulo="Sem perder"
              valor={resumo.jogos_sem_derrota}
              nota="ao fim da campanha"
            />
            <Metrica
              rotulo="Sem vencer"
              valor={resumo.jogos_sem_vitoria}
              nota="ao fim da campanha"
            />
            <Metrica
              rotulo="Recorde invicto"
              valor={resumo.maior_invencibilidade}
              nota="maior sequência"
            />
          </div>
        )}
      </div>

      {/* --------------------------------- caminho do time no torneio */}
      {temChave && (
        <div className="cartao">
          <h2>Caminho no torneio</h2>
          <CaminhoNoTorneio confrontos={chaveamento!} timeId={teamId} />
          <p className="discreto" style={{ marginBottom: 0 }}>
            Placar agregado das duas partidas quando o confronto é de ida e volta.
            Pênaltis entre parênteses.
          </p>
        </div>
      )}

      {/* ------------------------------------ todos os confrontos */}
      {temChave && (
        <details className="cartao">
          <summary>
            <span className="titulo-summary">Todos os confrontos do torneio</span>{" "}
            <span className="discreto">({chaveamento!.length})</span>
          </summary>
          <div style={{ marginTop: "1rem" }}>
            <Chaveamento confrontos={chaveamento!} destaque={teamId} />
          </div>
        </details>
      )}

      {/* -------------------------------- campanha + classificacao */}
      {temTabela ? (
        <div className="duas-colunas">
          {tabelaCampanha}
          <div className="cartao coluna-lateral">
            <h2>Classificação</h2>
            <Classificacao linhas={tabela!} destaque={teamId} />
            <p className="discreto" style={{ marginBottom: 0 }}>
              {temChave
                ? "Tabela da fase de grupos."
                : "P = pontos, J = jogos, SG = saldo de gols."}
            </p>

            {(artilharia?.length ?? 0) > 0 && (
              <>
                <h2 style={{ marginTop: "1.4rem" }}>Artilharia</h2>
                <Artilheiros lista={artilharia!} />
              </>
            )}
          </div>
        </div>
      ) : (
        tabelaCampanha
      )}

      {/* -------------------------------------------------- elenco */}
      <div className="cartao">
        <h2>Elenco na competição</h2>
        <p className="discreto">
          <strong>Totais</strong> respondem quem produziu mais na temporada — o
          que depende tanto de oportunidade quanto de desempenho.{" "}
          <strong>Por 90 min</strong> coloca todo mundo na mesma escala e
          responde quem produz mais quando está em campo. As duas leituras
          valem, e nenhuma substitui a outra.
        </p>

        <div className="linha" style={{ margin: "1rem 0", flexWrap: "wrap" }}>
          <label className="discreto">
            Leitura{" "}
            <select
              value={porNoventa ? "90" : "total"}
              onChange={(e) => {
                const noventa = e.target.value === "90";
                setPorNoventa(noventa);
                // Ao entrar na leitura por 90 o piso sobe sozinho: a taxa sem
                // amostra e a forma mais facil de ler errado esta tela.
                if (noventa && minMinutos < 450) setMinMinutos(450);
              }}
            >
              <option value="total">Totais</option>
              <option value="90">Por 90 min</option>
            </select>
          </label>

          <label className="discreto">
            Mínimo de minutos{" "}
            <select
              value={minMinutos}
              onChange={(e) => setMinMinutos(Number(e.target.value))}
            >
              <option value={0}>todos</option>
              <option value={270}>270 (3 jogos)</option>
              <option value={450}>450 (5 jogos)</option>
              <option value={900}>900 (10 jogos)</option>
            </select>
          </label>

          <label className="discreto">
            Posição{" "}
            <select value={grupo} onChange={(e) => setGrupo(e.target.value)}>
              <option value="">todas</option>
              <option value="Goleiro">Goleiro</option>
              <option value="Defesa">Defesa</option>
              <option value="Meio">Meio</option>
              <option value="Ataque">Ataque</option>
            </select>
          </label>

          <span className="discreto">{elenco?.length ?? 0} jogadores</span>
        </div>

        {porNoventa && minMinutos < 270 && (
          <div className="aviso">
            <strong>Sem piso de minutos, a taxa por 90 engana.</strong> Quem
            entrou 12 minutos e marcou aparece com 7,5 gols por 90 — o número
            está certo e não significa nada. Suba o mínimo de minutos para
            comparar.
          </div>
        )}

        {elenco && elenco.length > 0 ? (
          <>
            <div className="tabela-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Jogador</th>
                    <th>Pos</th>
                    <th className="num">J</th>
                    <th className="num">Tit.</th>
                    <th className="num">Min</th>
                    <th className="num">Nota</th>
                    {porNoventa ? (
                      <>
                        <th className="num">G+A/90</th>
                        <th className="num">G/90</th>
                        <th className="num">Fin./90</th>
                        <th className="num">Des./90</th>
                        <th className="num">Int./90</th>
                        <th className="num">Duelos ganhos</th>
                        <th className="num">Dribles certos</th>
                        <th className="num">Mira</th>
                      </>
                    ) : (
                      <>
                        <th className="num">G</th>
                        <th className="num">A</th>
                        <th className="num">Fin.</th>
                        <th className="num">Des.</th>
                        <th className="num">Duelos</th>
                        <th className="num">Cartões</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {elenco.map((j) => (
                    <tr key={j.player_id}>
                      <td>
                        <Link to={`/jogadores/${j.player_id}`}>
                          <strong>{j.jogador_nome}</strong>
                        </Link>
                      </td>
                      <td className="discreto">{j.grupo_posicao ?? j.posicao ?? "—"}</td>
                      <td className="num">{j.jogos_com_dado}</td>
                      <td className="num discreto">{j.jogos_titular}</td>
                      <td className="num discreto">{j.minutos ?? "—"}</td>
                      <td className="num">
                        {j.nota_media !== null ? (
                          <span className={`nota ${classeDaNota(j.nota_media)}`}>
                            {j.nota_media.toFixed(2)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      {porNoventa ? (
                        <>
                          <td className="num">
                            <strong>{j.participacoes_90 ?? "—"}</strong>
                          </td>
                          <td className="num">{j.gols_90 ?? "—"}</td>
                          <td className="num discreto">{j.chutes_90 ?? "—"}</td>
                          <td className="num discreto">{j.desarmes_90 ?? "—"}</td>
                          <td className="num discreto">
                            {j.interceptacoes_90 ?? "—"}
                          </td>
                          <td className="num">
                            {j.duelos_ganhos_pct !== null
                              ? `${j.duelos_ganhos_pct}%`
                              : "—"}
                          </td>
                          <td className="num discreto">
                            {j.dribles_certos_pct !== null
                              ? `${j.dribles_certos_pct}%`
                              : "—"}
                          </td>
                          <td className="num discreto">
                            {j.pontaria_pct !== null ? `${j.pontaria_pct}%` : "—"}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="num">{j.gols ?? "—"}</td>
                          <td className="num">{j.assistencias ?? "—"}</td>
                          <td className="num discreto">{j.chutes ?? "—"}</td>
                          <td className="num discreto">{j.desarmes ?? "—"}</td>
                          <td className="num discreto">
                            {j.duelos_ganhos ?? 0}/{j.duelos ?? 0}
                          </td>
                          <td className="num discreto">
                            {(j.amarelos ?? 0) + (j.vermelhos ?? 0) || "—"}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="discreto" style={{ marginBottom: 0 }}>
              Só jogos com estatística já extraída. Clique no nome para o perfil
              completo.
            </p>
          </>
        ) : (
          <p className="discreto" style={{ marginBottom: 0 }}>
            Estatística de jogador ainda não extraída para esta competição.
          </p>
        )}
      </div>

      {/* ------------------------------------------ transferencias */}
      {(transferencias?.length ?? 0) > 0 && (
        <details className="cartao">
          <summary>
            <span className="titulo-summary">Transferências</span>{" "}
            <span className="discreto">({transferencias!.length})</span>
          </summary>
          <p className="discreto">
            Atenção à janela: as transferências vão até <strong>2026</strong>,
            enquanto os jogos param em 2024 por limitação do plano da API. É o
            único dado do projeto que alcança o presente.
          </p>
          <div className="tabela-wrap">
            <table className="tabela-compacta">
              <thead>
                <tr>
                  <th>Data</th>
                  <th></th>
                  <th>Jogador</th>
                  <th>De</th>
                  <th>Para</th>
                  <th>Tipo</th>
                  <th className="num">Valor</th>
                </tr>
              </thead>
              <tbody>
                {transferencias?.map((t) => (
                  <tr key={`${t.player_id}-${t.data}-${t.team_destino_id}`}>
                    <td className="discreto">{dataBr(t.data)}</td>
                    <td>{t.sentido === "chegou" ? "↓" : "↑"}</td>
                    <td>
                      <Link to={`/jogadores/${t.player_id}`}>{t.jogador}</Link>
                    </td>
                    <td className="discreto">{t.team_origem ?? "—"}</td>
                    <td className="discreto">{t.team_destino ?? "—"}</td>
                    <td className="discreto">{t.tipo}</td>
                    <td className="num">
                      {t.valor_eur
                        ? `€ ${(t.valor_eur / 1_000_000).toFixed(1)}M`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* ----------------------------------------------- confrontos */}
      <details className="cartao">
        <summary>
          <span className="titulo-summary">Retrospecto por adversário</span>{" "}
          <span className="discreto">({confrontos?.length ?? 0})</span>
        </summary>
        <p className="discreto">Adversários com 3 jogos ou mais, somando tudo.</p>
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th>Adversário</th>
                <th className="num">J</th>
                <th className="num">V</th>
                <th className="num">E</th>
                <th className="num">D</th>
                <th className="num">Gols</th>
                <th className="num">Saldo</th>
                <th className="num">Aprov.</th>
              </tr>
            </thead>
            <tbody>
              {confrontos?.map((c) => (
                <tr key={c.adversario_id}>
                  <td>
                    <Link to={`/times/${c.adversario_id}`}>{c.adversario_nome}</Link>
                  </td>
                  <td className="num">{c.jogos}</td>
                  <td className="num">{c.vitorias}</td>
                  <td className="num">{c.empates}</td>
                  <td className="num">{c.derrotas}</td>
                  <td className="num discreto">
                    {c.gols_pro}:{c.gols_contra}
                  </td>
                  <td className="num">{c.saldo > 0 ? `+${c.saldo}` : c.saldo}</td>
                  <td className="num">{c.aproveitamento_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

/** Nota vira cor: acima de 7 e boa, abaixo de 6 e ruim. */
function classeDaNota(nota: number) {
  if (nota >= 7) return "boa";
  if (nota < 6) return "ruim";
  return "media";
}

