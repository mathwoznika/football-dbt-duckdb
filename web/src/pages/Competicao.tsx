import { Link, useParams } from "react-router-dom";

import { api } from "../api";
import Artilheiros from "../components/Artilheiros";
import Chaveamento from "../components/Chaveamento";
import Classificacao from "../components/Classificacao";
import EvolucaoClassificacao from "../components/EvolucaoClassificacao";
import { useDados } from "../useDados";

/**
 * Página de uma competição numa temporada.
 *
 * Quase tudo aqui é composição: Classificacao, Artilheiros e Chaveamento já
 * existiam para a página do time e recebem os dados por prop, sem saber onde
 * estão. Só o gráfico de evolução é novo.
 *
 * O `destaque` recebe 0 porque aqui não há time focado — nenhuma linha da
 * tabela fica realçada, e é isso que se quer numa visão de competição.
 */
export default function CompeticaoPage() {
  const { leagueId, season } = useParams();
  const liga = Number(leagueId);
  const ano = Number(season);

  const { dados: tabela } = useDados(() => api.classificacao(liga, ano), [liga, ano]);
  const { dados: artilharia } = useDados(
    () => api.artilheiros(liga, ano, 15),
    [liga, ano],
  );
  const { dados: chaveamento } = useDados(() => api.chaveamento(liga, ano), [liga, ano]);
  const { dados: evolucaoPontos } = useDados(() => api.evolucao(liga, ano), [liga, ano]);
  const { dados: competicoes } = useDados(() => api.competicoes(), []);

  const info = competicoes?.find((c) => c.league_id === liga && c.season === ano);

  const temTabela = (tabela?.length ?? 0) > 0;
  const temChave = (chaveamento?.length ?? 0) > 0;
  const temEvolucao = (evolucaoPontos?.length ?? 0) > 0;

  return (
    <>
      <div className="cartao">
        <div className="linha">
          <div>
            <h1 style={{ margin: 0, fontSize: "1.6rem" }}>
              {info?.league_nome ?? "Competição"}{" "}
              <span className="discreto">{ano}</span>
            </h1>
            <div className="discreto">
              {info
                ? `${info.times} times · ${info.jogos} partidas no total`
                : "carregando..."}
            </div>
          </div>
          {info?.campeao && (
            <span className="faixa" style={{ marginLeft: "auto" }}>
              🏆 {info.campeao}
            </span>
          )}
        </div>
      </div>

      {temEvolucao && (
        <div className="cartao">
          <h2>Evolução na tabela</h2>
          <EvolucaoClassificacao pontos={evolucaoPontos!} />
        </div>
      )}

      {temChave && (
        <div className="cartao">
          <h2>Chaveamento</h2>
          <Chaveamento confrontos={chaveamento!} destaque={0} />
        </div>
      )}

      <div className="duas-colunas">
        {temTabela ? (
          <div className="cartao">
            <h2>Classificação</h2>
            <Classificacao linhas={tabela!} destaque={0} />
          </div>
        ) : (
          <div className="cartao">
            <h2>Classificação</h2>
            <p className="discreto" style={{ marginBottom: 0 }}>
              Competição de mata-mata puro — não tem tabela de pontos corridos.
            </p>
          </div>
        )}

        <div className="cartao coluna-lateral">
          <h2>Artilharia</h2>
          <Artilheiros lista={artilharia ?? []} />
        </div>
      </div>

      <p className="discreto">
        <Link to="/competicoes">← todas as competições</Link>
      </p>
    </>
  );
}
