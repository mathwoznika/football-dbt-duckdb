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
    Artilheiro,
    ArbitroDoTime,
    AtuacaoDoJogador,
    Confronto,
    Competicao,
    ConfrontoEliminatorio,
    DesempenhoPorTempo,
    EstatisticaDaPartida,
    EventoDaPartida,
    GolsPorPeriodo,
    JogadorEscalado,
    JogadorNaBase,
    JogadorNaTemporada,
    JogoDaCampanha,
    LinhaClassificacao,
    Partida,
    PontoDaEvolucao,
    TecnicoDoTime,
    TemporadaDoTime,
    Time,
    Transferencia,
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


# ------------------------------------------------------------- analises


@app.get("/times/{team_id}/desempenho-por-tempo", response_model=list[DesempenhoPorTempo])
def desempenho_por_tempo(team_id: int):
    """Primeiro contra segundo tempo, e o que o time fez com a vantagem.

    Cobre todos os jogos da base: o placar do intervalo vem no proprio fixture
    e nao depende da extracao por partida.
    """
    return consultar(
        """
        select league_id, league_nome, season, jogos, gols_1t, gols_2t,
               sofridos_1t, sofridos_2t, saldo_1t, saldo_2t, pontos,
               pontos_se_acabasse_no_1t, diferenca_de_pontos,
               intervalos_vencendo, intervalos_empatando, intervalos_perdendo,
               viradas, reacoes, vantagens_empatadas, vantagens_perdidas
        from gold_desempenho_por_tempo
        where time_id = ?
        order by season desc, jogos desc
        """,
        [team_id],
    )


@app.get("/times/{team_id}/gols-por-periodo", response_model=list[GolsPorPeriodo])
def gols_por_periodo(
    team_id: int,
    season: int | None = Query(default=None),
    league_id: int | None = Query(default=None),
):
    """Em que faixa de 15 minutos o time marca e sofre. Cobertura parcial."""
    return consultar(
        """
        select faixa, ordem_faixa, marcados, sofridos, jogos_com_evento
        from gold_gols_por_periodo
        where time_id = ?
          and (? is null or season = ?)
          and (? is null or league_id = ?)
        order by ordem_faixa
        """,
        [team_id, season, season, league_id, league_id],
    )


@app.get("/times/{team_id}/tecnicos", response_model=list[TecnicoDoTime])
def tecnicos_do_time(team_id: int):
    """Aproveitamento sob cada tecnico. Cobre so jogos com escalacao extraida."""
    return consultar(
        """
        select coach_id, tecnico, season, league_id, league_nome, jogos,
               vitorias, empates, derrotas, gols_pro, gols_contra, pontos,
               aproveitamento_pct, primeiro_jogo, ultimo_jogo
        from gold_tecnico_desempenho
        where time_id = ?
        order by season desc, jogos desc
        """,
        [team_id],
    )


@app.get("/times/{team_id}/arbitragem", response_model=list[ArbitroDoTime])
def arbitragem(
    team_id: int,
    min_jogos: int = Query(
        default=3,
        ge=1,
        description="Amostra minima. Mesmo no maximo (9 jogos) o numero e ruidoso.",
    ),
):
    """Retrospecto do time sob cada arbitro, com o baseline do time ao lado.

    O baseline nao e decoracao: com 5 a 9 jogos por arbitro, o aproveitamento
    isolado nao diz nada. Comparado com a media do proprio time, pelo menos
    vira uma frase honesta — e ainda assim e ruido, nao padrao.
    """
    return consultar(
        """
        select arbitro, jogos, vitorias, empates, derrotas, gols_pro,
               gols_contra, pontos, aproveitamento_pct, aproveitamento_geral_pct,
               diferenca_aproveitamento, jogos_com_estatistica, faltas_pro,
               faltas_contra, amarelos_pro, amarelos_contra, vermelhos_pro,
               vermelhos_contra, amarelos_por_jogo, amarelos_por_jogo_geral,
               diferenca_amarelos, primeiro_jogo, ultimo_jogo
        from gold_arbitragem
        where time_id = ? and jogos >= ?
        order by jogos desc, aproveitamento_pct desc
        """,
        [team_id, min_jogos],
    )


# ---------------------------------------------------------------- jogos


@app.get("/jogos/{fixture_id}", response_model=Partida)
def partida(fixture_id: int):
    """Cabecalho de um jogo: placar, competicao, estadio e arbitro."""
    linhas = consultar(
        """
        select fixture_id, data, season, league_id, league_nome, rodada, status,
               estadio, arbitro,
               time_casa_id, time_casa, time_casa_logo, gols_casa, gols_casa_1t,
               penaltis_casa,
               time_fora_id, time_fora, time_fora_logo, gols_fora, gols_fora_1t,
               penaltis_fora
        from gold_partida
        where fixture_id = ?
        """,
        [fixture_id],
    )
    if not linhas:
        raise HTTPException(status_code=404, detail="jogo nao encontrado")
    return linhas[0]


@app.get("/jogos/{fixture_id}/escalacoes", response_model=list[JogadorEscalado])
def escalacoes(fixture_id: int):
    """Escalacao dos dois times, com posicao no campo e atuacao de cada um.

    Devolve lista vazia quando a escalacao ainda nao foi extraida — a onda 3
    esta em andamento e cobre parte dos jogos.
    """
    return consultar(
        """
        select team_id, team_nome, formacao, tecnico,
               player_id, jogador, camisa, posicao, titular,
               linha, coluna, jogadores_na_linha, linhas_no_time,
               minutos, nota, gols, assistencias, chutes, chutes_no_gol,
               passes, desarmes, duelos, duelos_ganhos, amarelos, vermelhos,
               entrou_do_banco, saiu_no_minuto, entrou_no_minuto
        from gold_escalacao
        where fixture_id = ?
        order by team_id, titular desc, linha, coluna, camisa
        """,
        [fixture_id],
    )


@app.get("/jogos/{fixture_id}/estatisticas", response_model=list[EstatisticaDaPartida])
def estatisticas_da_partida(fixture_id: int):
    """Estatistica coletiva dos dois lados. Vazio se a onda 3 nao cobriu."""
    return consultar(
        """
        select team_id, team_nome, logo_url, e_do_mandante, posse_pct,
               chutes_total, chutes_no_gol, chutes_fora, chutes_bloqueados,
               chutes_dentro_area, escanteios, impedimentos, faltas,
               cartoes_amarelos, cartoes_vermelhos, defesas_goleiro,
               passes_total, passes_certos, precisao_passe_pct
        from gold_partida_estatistica
        where fixture_id = ?
        order by e_do_mandante desc
        """,
        [fixture_id],
    )


@app.get("/jogos/{fixture_id}/eventos", response_model=list[EventoDaPartida])
def eventos_da_partida(fixture_id: int):
    """Linha do tempo do jogo, do primeiro lance ao ultimo."""
    return consultar(
        """
        select minuto, acrescimo, tipo, rotulo, detalhe, team_id, team_nome,
               e_do_mandante, jogador_id, jogador, relacionado_id, relacionado,
               papel_relacionado
        from gold_partida_evento
        where fixture_id = ?
        order by minuto, coalesce(acrescimo, 0)
        """,
        [fixture_id],
    )


# ------------------------------------------------------------ jogadores


@app.get("/jogadores", response_model=list[JogadorNaBase])
def listar_jogadores(
    busca: str | None = Query(default=None, min_length=2),
    min_jogos: int = Query(
        default=5,
        ge=1,
        description="Amostra minima. O padrao e 5 porque a base tem centenas "
        "de jogadores de adversarios com uma unica partida.",
    ),
    limite: int = Query(default=50, ge=1, le=200),
):
    """Jogadores presentes na base, com os totais que existem aqui.

    NAO e estatistica de carreira: a onda 3 cobre so jogos do Coritiba e o
    endpoint da API devolve os dois times, entao jogador de adversario aparece
    com 1 ou 2 partidas.
    """
    return consultar(
        """
        select player_id, jogador_nome, team_id, team_nome, clubes, posicao,
               primeira_temporada, ultima_temporada, temporadas, competicoes,
               jogos_com_dado, jogos_com_minutos, jogos_titular, minutos,
               nota_media, melhor_nota,
               gols, assistencias, chutes, desarmes, duelos, duelos_ganhos,
               amarelos, vermelhos, defesas, gols_sofridos
        from gold_jogador
        where jogos_com_dado >= ?
          and (? is null or lower(jogador_nome) like lower('%' || ? || '%'))
        order by minutos desc nulls last
        limit ?
        """,
        [min_jogos, busca, busca, limite],
    )


@app.get("/times/{team_id}/elenco", response_model=list[JogadorNaTemporada])
def elenco(
    team_id: int,
    season: int | None = Query(default=None),
    league_id: int | None = Query(default=None),
):
    """Desempenho de cada jogador do elenco, por competicao e temporada."""
    return consultar(
        """
        select player_id, jogador_nome, team_id, team_nome, season, league_id,
               league_nome, posicao, jogos_com_dado, jogos_com_minutos,
               jogos_titular, minutos, nota_media,
               melhor_nota, gols, assistencias, chutes, chutes_no_gol, passes,
               desarmes, duelos, duelos_ganhos, dribles_tentados,
               dribles_certos, faltas_cometidas, amarelos, vermelhos,
               defesas, gols_sofridos
        from gold_jogador_temporada
        where team_id = ?
          and (? is null or season = ?)
          and (? is null or league_id = ?)
        order by minutos desc nulls last
        """,
        [team_id, season, season, league_id, league_id],
    )


@app.get("/jogadores/{player_id}/temporadas", response_model=list[JogadorNaTemporada])
def temporadas_do_jogador(player_id: int):
    """Uma linha por competicao e temporada em que o jogador atuou."""
    linhas = consultar(
        """
        select player_id, jogador_nome, team_id, team_nome, season, league_id,
               league_nome, posicao, jogos_com_dado, jogos_com_minutos,
               jogos_titular, minutos, nota_media,
               melhor_nota, gols, assistencias, chutes, chutes_no_gol, passes,
               desarmes, duelos, duelos_ganhos, dribles_tentados,
               dribles_certos, faltas_cometidas, amarelos, vermelhos,
               defesas, gols_sofridos
        from gold_jogador_temporada
        where player_id = ?
        order by season desc, minutos desc nulls last
        """,
        [player_id],
    )
    if not linhas:
        raise HTTPException(status_code=404, detail="jogador nao encontrado")
    return linhas


@app.get("/jogadores/{player_id}/jogos", response_model=list[AtuacaoDoJogador])
def jogos_do_jogador(
    player_id: int,
    season: int | None = Query(default=None),
    league_id: int | None = Query(default=None),
):
    """Atuacao partida a partida, com o contexto do jogo."""
    return consultar(
        """
        select fixture_id, data, season, league_id, league_nome, team_id,
               team_nome, adversario_id, adversario_nome, mando, gols_time,
               gols_adversario, minutos, posicao, nota, entrou_do_banco, gols,
               assistencias, chutes, chutes_no_gol, passes, desarmes, duelos,
               duelos_ganhos, amarelos, vermelhos
        from gold_jogador_partida
        where player_id = ?
          and (? is null or season = ?)
          and (? is null or league_id = ?)
        order by data
        """,
        [player_id, season, season, league_id, league_id],
    )


@app.get(
    "/competicoes/{league_id}/temporadas/{season}/artilheiros",
    response_model=list[Artilheiro],
)
def artilheiros(league_id: int, season: int, limite: int = Query(default=10, ge=1, le=50)):
    """Artilharia oficial da competicao, vinda do endpoint de topscorers."""
    return consultar(
        """
        select posicao_artilharia, player_id, jogador, foto_url, idade,
               nacionalidade, posicao, team_id, team_nome, team_logo, jogos,
               minutos, gols, assistencias, gols_por_jogo, nota_media,
               teve_mais_de_um_clube
        from gold_artilheiro
        where league_id = ? and season = ?
        order by posicao_artilharia
        limit ?
        """,
        [league_id, season, limite],
    )


@app.get("/times/{team_id}/transferencias", response_model=list[Transferencia])
def transferencias(
    team_id: int,
    desde: int | None = Query(default=None, description="Ano minimo"),
    limite: int = Query(default=60, ge=1, le=500),
):
    """Movimentacoes de entrada e saida do clube.

    So existe para os times consultados na extracao (hoje apenas o Coritiba) —
    devolve lista vazia para os demais, e a tela some em vez de mostrar tabela
    vazia.
    """
    return consultar(
        """
        select player_id, jogador, data, tipo, valor_eur, sentido,
               team_origem_id, team_origem, team_destino_id, team_destino
        from gold_transferencia
        where team_id_consultado = ?
          and (? is null or year(data) >= ?)
        order by data desc
        limit ?
        """,
        [team_id, desde, desde, limite],
    )


# ---------------------------------------------------------- competicoes


@app.get("/competicoes", response_model=list[Competicao])
def listar_competicoes():
    """Indice das competicoes-temporada presentes na base."""
    return consultar(
        """
        with jogos as (
            select league_id, league_nome, season,
                   count(distinct fixture_id) as jogos,
                   count(distinct time_id)    as times
            from silver_partida_time
            group by all
        ),
        -- o campeao sai de lugares diferentes conforme o formato:
        -- em mata-mata e quem venceu a final; em pontos corridos e o 1o
        final as (
            select league_id, season, vencedor_id
            from gold_confronto_eliminatorio
            where ordem_fase = 7
        ),
        lider as (
            select league_id, season, time_id
            from gold_classificacao
            where posicao = 1
        )
        select jogos.league_id, jogos.league_nome, jogos.season,
               jogos.times, jogos.jogos,
               coalesce(final.vencedor_id, lider.time_id) as campeao_id,
               time_campeao.team_nome as campeao,
               final.vencedor_id is not null as tem_chaveamento,
               exists (
                   select 1 from gold_classificacao c
                   where c.league_id = jogos.league_id and c.season = jogos.season
               ) as tem_classificacao
        from jogos
        left join final
               on final.league_id = jogos.league_id and final.season = jogos.season
        left join lider
               on lider.league_id = jogos.league_id and lider.season = jogos.season
        left join silver_time as time_campeao
               on time_campeao.team_id = coalesce(final.vencedor_id, lider.time_id)
        order by jogos.season desc, jogos.jogos desc
        """
    )


@app.get(
    "/competicoes/{league_id}/temporadas/{season}/evolucao",
    response_model=list[PontoDaEvolucao],
)
def evolucao(league_id: int, season: int):
    """Posicao e pontos de cada time apos cada rodada.

    Vazio em competicao sem pontos corridos — nao existe "posicao apos a
    rodada" em mata-mata.
    """
    return consultar(
        """
        select rodada_n, time_id, time_nome, posicao, pontos_acum
        from gold_evolucao_classificacao
        where league_id = ? and season = ?
        order by time_id, rodada_n
        """,
        [league_id, season],
    )


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
