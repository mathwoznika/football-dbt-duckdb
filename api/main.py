"""API do projeto. Le a camada gold e devolve JSON.

Regra da casa: aqui nao se calcula nada. Toda agregacao ja foi feita pelo dbt,
e o endpoint so seleciona, filtra e ordena. Se um endpoint precisar de logica
nova, o lugar dela e num model de gold — assim a regra fica versionada,
testada e reaproveitavel, em vez de escondida dentro de uma rota.

Rodar:  env/bin/uvicorn api.main:app --reload
Docs:   http://127.0.0.1:8000/docs
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from api.db import consultar
from api.schemas import (
    Confronto,
    ConfrontoEliminatorio,
    JogoDaCampanha,
    LinhaClassificacao,
    TemporadaDoTime,
    Time,
)

app = FastAPI(
    title="Futebol Brasileiro",
    description=(
        "Serie A, Serie B, Copa do Brasil e Campeonato Paranaense, "
        "temporadas 2022 a 2024."
    ),
    version="0.2.0",
)

# O navegador bloqueia requisicoes de uma origem para outra, a menos que o
# servidor autorize. Front em :5173 e API em :8000 sao origens diferentes.
# Nao e burocracia: sem isso, qualquer site aberto numa aba poderia consultar
# APIs rodando na sua maquina.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # so o front de desenvolvimento
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------- times


@app.get("/times", response_model=list[Time])
def listar_times(
    busca: str | None = Query(
        default=None,
        description="Filtra pelo nome do clube. Nao diferencia maiuscula.",
        min_length=2,
    ),
    limite: int = Query(default=20, ge=1, le=100),
):
    """Lista clubes, opcionalmente filtrando por nome."""
    return consultar(
        """
        select team_id, team_nome, pais, fundacao, cidade,
               estadio, capacidade, logo_url
        from silver_time
        where ? is null or lower(team_nome) like lower('%' || ? || '%')
        order by team_nome
        limit ?
        """,
        [busca, busca, limite],
    )


@app.get("/times/{team_id}", response_model=Time)
def detalhe_do_time(team_id: int):
    """Dados cadastrais de um clube."""
    linhas = consultar(
        """
        select team_id, team_nome, pais, fundacao, cidade,
               estadio, capacidade, logo_url
        from silver_time
        where team_id = ?
        """,
        [team_id],
    )
    if not linhas:
        raise HTTPException(status_code=404, detail="time nao encontrado")
    # response_model e um objeto, nao lista: devolvemos o primeiro
    return linhas[0]


@app.get("/times/{team_id}/temporadas", response_model=list[TemporadaDoTime])
def temporadas_do_time(team_id: int):
    """Resumo de cada competicao disputada pelo time, por temporada."""
    linhas = consultar(
        """
        select league_id, league_nome, season, jogos, vitorias, empates,
               derrotas, gols_pro, gols_contra, saldo, pontos,
               aproveitamento_pct, maior_invencibilidade, jogos_sem_derrota,
               jogos_sem_vitoria, ultimo_resultado, posicao, resultado_final,
               fase_mais_avancada
        from gold_time_temporada
        where time_id = ?
        order by season desc, jogos desc
        """,
        [team_id],
    )
    if not linhas:
        raise HTTPException(status_code=404, detail="time nao encontrado")
    return linhas


@app.get("/times/{team_id}/campanha", response_model=list[JogoDaCampanha])
def campanha_do_time(
    team_id: int,
    season: int | None = Query(default=None, description="Filtra por temporada"),
    league_id: int | None = Query(default=None, description="Filtra por competicao"),
):
    """Partida a partida, com pontos acumulados e a forma que o time levava."""
    return consultar(
        """
        select fixture_id, jogo_n, data, league_id, league_nome, season, rodada,
               mando, adversario_id, adversario_nome, gols_pro, gols_contra,
               penaltis_pro, penaltis_contra, resultado, pontos,
               pontos_acumulados, saldo_acumulado, pontos_5_anteriores
        from gold_campanha
        where time_id = ?
          and (? is null or season = ?)
          and (? is null or league_id = ?)
        order by data, jogo_n
        """,
        [team_id, season, season, league_id, league_id],
    )


@app.get("/times/{team_id}/confrontos", response_model=list[Confronto])
def confrontos_do_time(
    team_id: int,
    min_jogos: int = Query(
        default=1, ge=1, description="Esconde adversarios com poucos jogos"
    ),
):
    """Retrospecto contra cada adversario ja enfrentado."""
    return consultar(
        """
        select adversario_id, adversario_nome, jogos, vitorias, empates,
               derrotas, gols_pro, gols_contra, saldo, aproveitamento_pct,
               primeiro_confronto, ultimo_confronto
        from gold_confronto_direto
        where time_id = ? and jogos >= ?
        order by jogos desc, aproveitamento_pct desc
        """,
        [team_id, min_jogos],
    )


# ---------------------------------------------------------- competicoes


@app.get(
    "/competicoes/{league_id}/temporadas/{season}/classificacao",
    response_model=list[LinhaClassificacao],
)
def classificacao(league_id: int, season: int):
    """Tabela de pontos corridos da competicao naquela temporada.

    Devolve lista vazia em competicao de mata-mata puro, do mesmo jeito que o
    /chaveamento devolve vazio na Serie A. Nos dois casos "essa competicao nao
    tem isso" e uma resposta valida, nao um erro — e a simetria deixa o cliente
    tratar os dois endpoints igual.
    """
    return consultar(
        """
        select posicao, time_id, time_nome, logo_url, jogos, vitorias, empates,
               derrotas, gols_pro, gols_contra, saldo, pontos,
               aproveitamento_pct, ultimos_5
        from gold_classificacao
        where league_id = ? and season = ?
        order by posicao
        """,
        [league_id, season],
    )


@app.get(
    "/competicoes/{league_id}/temporadas/{season}/chaveamento",
    response_model=list[ConfrontoEliminatorio],
)
def chaveamento(league_id: int, season: int):
    """Confrontos de mata-mata, da fase mais antiga para a final.

    Devolve lista vazia em competicao de pontos corridos puros — que e resposta
    valida, nao erro: a Serie A simplesmente nao tem mata-mata.
    """
    return consultar(
        """
        select fase, fase_nome, ordem_fase, partidas,
               time_a_id, time_a_nome, time_a_logo, gols_a, penaltis_a,
               time_b_id, time_b_nome, time_b_logo, gols_b, penaltis_b,
               ida_data, ida_gols_a, ida_gols_b, ida_penaltis_a, ida_penaltis_b,
               volta_data, volta_gols_a, volta_gols_b, volta_penaltis_a,
               volta_penaltis_b,
               vencedor_id, eliminado_id, data_inicio, data_fim
        from gold_confronto_eliminatorio
        where league_id = ? and season = ?
        order by ordem_fase, time_a_nome
        """,
        [league_id, season],
    )
