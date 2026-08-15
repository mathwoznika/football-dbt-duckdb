import { Link } from "react-router-dom";

import { api } from "../api";
import { useDados } from "../useDados";

function n(valor: number | null | undefined) {
  return valor?.toLocaleString("pt-BR") ?? "—";
}

/**
 * Porta de entrada.
 *
 * A PRIMEIRA VERSAO DESTA TELA ABRIA FALANDO DE PIPELINE — cota de API, ondas
 * de extracao, percentual de cobertura. Quem abre um app de futebol quer ver
 * futebol; como o dado chegou ali e problema de quem o construiu. A ressalva de
 * cobertura continua existindo, mas foi para onde ela muda uma decisao: ao lado
 * do numero que ela afeta, dentro das analises, e como um selo discreto nas
 * competicoes que ja tem detalhe.
 *
 * A ordem reflete o que interessa a quem chega: primeiro o que aconteceu
 * (recordes e campeoes), depois por onde navegar. Numero de partidas e de
 * clubes aparece, mas como escala do acervo — nao como metrica de engenharia.
 *
 * Escala prevista: quando a base cobrir todos os clubes, nada aqui muda de
 * estrutura. Os destaques saem de um mart que ja varre a base inteira, e as
 * competicoes vem de uma lista — as duas seçoes crescem sozinhas.
 */
export default function Inicio() {
  const { dados: resumo } = useDados(() => api.resumo(), []);
  const { dados: destaques } = useDados(() => api.destaques(), []);
  const { dados: competicoes } = useDados(() => api.competicoes(), []);

  const temporadaRecente = competicoes?.[0]?.season;

  return (
    <>
      {/* ------------------------------------------------------- abertura */}
      <section className="capa">
        <h1>
          O futebol brasileiro, <em>jogo a jogo</em>
        </h1>
        <p className="capa-linha">
          Série A, Série B, Copa do Brasil e Paranaense entre{" "}
          {resumo?.primeira_temporada ?? "—"} e {resumo?.ultima_temporada ?? "—"}:
          campanhas, confrontos, escalações e a história de cada partida.
        </p>
        <div className="capa-escala discreto">
          {n(resumo?.jogos)} partidas · {n(resumo?.gols)} gols ·{" "}
          {n(resumo?.times)} clubes · {n(resumo?.jogadores)} jogadores
        </div>
      </section>

      {/* ------------------------------------------------------ destaques */}
      <section>
        <h2 className="secao-titulo">Recordes do período</h2>
        <div className="destaques">
          {destaques?.map((d) => {
            const conteudo = (
              <>
                <div className="destaque-rotulo">{d.rotulo}</div>
                <div className="destaque-valor">{d.valor}</div>
                <div className="destaque-detalhe">
                  {d.logo_url && (
                    <img src={d.logo_url} alt="" width={18} height={18} />
                  )}
                  <span>{d.detalhe}</span>
                </div>
                <div className="destaque-onde discreto">
                  {d.league_nome} · {d.season}
                </div>
              </>
            );

            // Goleada e jogo com mais gols levam a partida; recorde de time leva
            // ao clube. Destaque que nao leva a lugar nenhum e numero solto.
            const destino = d.fixture_id
              ? `/jogos/${d.fixture_id}`
              : d.time_id
                ? `/times/${d.time_id}`
                : null;

            return destino ? (
              <Link key={d.tipo} to={destino} className="destaque">
                {conteudo}
              </Link>
            ) : (
              <div key={d.tipo} className="destaque">
                {conteudo}
              </div>
            );
          })}
        </div>
      </section>

      {/* ----------------------------------------------------- campeões */}
      <section>
        <h2 className="secao-titulo">Campeões</h2>
        <div className="campeoes">
          {competicoes?.map((c) => (
            <Link
              key={`${c.league_id}-${c.season}`}
              to={`/competicoes/${c.league_id}/${c.season}`}
              className="campeao-card"
            >
              <div className="campeao-escudo">
                {c.campeao_logo ? (
                  <img src={c.campeao_logo} alt="" />
                ) : (
                  <div className="campeao-vazio" />
                )}
              </div>

              <div className="campeao-corpo">
                <div className="campeao-nome">{c.campeao ?? "—"}</div>
                <div className="campeao-torneio">
                  {c.league_nome} <span className="discreto">{c.season}</span>
                </div>
                {c.artilheiro && (
                  <div className="campeao-artilheiro discreto">
                    Artilheiro: {c.artilheiro} · {c.artilheiro_gols} gols
                  </div>
                )}

                {/* O selo aparece só quando existe algo a mais para ver — como
                    destaque do que há, e não como desculpa pelo que falta.
                    Fica NO FLUXO do card, e não posicionado por cima: sobre um
                    nome longo como "Atletico Paranaense" ele cobria o texto. */}
                {c.jogos_com_evento > 0 && (
                  <span
                    className="selo"
                    title={`${c.jogos_com_evento} partidas com escalação, estatística e lance a lance`}
                  >
                    análise detalhada
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------- navegação */}
      <section>
        <h2 className="secao-titulo">Explore</h2>
        <div className="atalhos">
          <Link to="/competicoes" className="atalho">
            <strong>Competições</strong>
            <span className="discreto">
              Classificação rodada a rodada, chaveamento das copas e a evolução
              de cada campanha na tabela
              {temporadaRecente ? ` — até ${temporadaRecente}` : ""}
            </span>
          </Link>

          <Link to="/times" className="atalho">
            <strong>Clubes</strong>
            <span className="discreto">
              Campanha jogo a jogo, retrospecto contra cada adversário, elenco e
              transferências
            </span>
          </Link>

          <Link to="/jogadores" className="atalho">
            <strong>Jogadores</strong>
            <span className="discreto">
              Gols, assistências, notas e produção por 90 minutos, com filtro de
              amostra mínima
            </span>
          </Link>
        </div>
      </section>
    </>
  );
}
