import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api } from "../api";
import CaminhoNoTorneio from "../components/CaminhoNoTorneio";
import Chaveamento from "../components/Chaveamento";
import Artilheiros from "../components/Artilheiros";
import Classificacao from "../components/Classificacao";
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
  const { dados: elenco } = useDados(
    () => (pronto ? api.elenco(teamId, season, leagueId) : Promise.resolve([])),
    [teamId, season, leagueId],
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
          <Link className="botao" to={`/times/${teamId}/analises`} style={{ marginLeft: "auto" }}>
            Análises →
          </Link>
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
                    <th className="num">G</th>
                    <th className="num">A</th>
                    <th className="num">Fin.</th>
                    <th className="num">Des.</th>
                    <th className="num">Duelos</th>
                    <th className="num">Cartões</th>
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
                      <td className="discreto">{j.posicao ?? "—"}</td>
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

/** Cartao de metrica. A `nota` existe para desfazer ambiguidade de rotulo. */
function Metrica({
  rotulo,
  valor,
  nota,
}: {
  rotulo: string;
  valor: string | number;
  nota?: string;
}) {
  return (
    <div className="metrica">
      <div className="rotulo">{rotulo}</div>
      <div className="valor">{valor}</div>
      {nota && (
        <div className="rotulo" style={{ textTransform: "none", letterSpacing: 0 }}>
          {nota}
        </div>
      )}
    </div>
  );
}
