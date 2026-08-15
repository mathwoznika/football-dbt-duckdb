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
    CartaoNoPeriodo,
    Confronto,
    Competicao,
    ConfrontoEliminatorio,
    DesempenhoPorForcaAdversario,
    DesempenhoPorTempo,
    Destaque,
    Disciplina,
    EstatisticaDaPartida,
    EstatisticaDaTemporada,
    EventoDaPartida,
    FormacaoDoTime,
    GolsPorPeriodo,
    ImpactoDoBanco,
    JogadorEscalado,
    JogadorNaBase,
    JogadorNaTemporada,
    JogoDaCampanha,
    LinhaClassificacao,
    OrigemDosGols,
    Partida,
    PontoDaEvolucao,
    ResumoDaBase,
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


@app.get(
    "/times/{team_id}/estatisticas-temporada",
    response_model=list[EstatisticaDaTemporada],
)
def estatisticas_da_temporada(
    team_id: int,
    min_jogos: int = Query(
        default=1,
        ge=1,
        description="Amostra minima. Fora do Coritiba quase todo time aparece "
        "com um jogo so, porque o endpoint da API devolve os dois lados de cada "
        "partida extraida.",
    ),
):
    """Perfil estatistico do time por competicao e temporada.

    Cobertura PARCIAL: le a onda 3, que ainda esta em andamento. Cada linha traz
    jogos_com_estatistica e cobertura_pct para a tela nunca mostrar uma media
    sem dizer de quantos jogos ela saiu.

    O Campeonato Paranaense nao aparece: a API nao tem estatistica para essa
    competicao, e os arquivos ja extraidos vieram vazios.
    """
    return consultar(
        """
        select league_id, league_nome, season, jogos_com_estatistica,
               jogos_na_competicao, cobertura_pct, pontos, gols_pro, gols_contra,
               pontos_por_jogo, posse_media_pct, passes_por_jogo,
               precisao_passe_media_pct, chutes_por_jogo, chutes_no_gol_por_jogo,
               chutes_na_area_por_jogo, escanteios_por_jogo,
               impedimentos_por_jogo, pontaria_pct, conversao_pct, chutes_por_gol,
               chutes_sofridos_por_jogo, chutes_no_gol_sofridos_por_jogo,
               chutes_na_area_sofridos_por_jogo, escanteios_sofridos_por_jogo,
               defesas_goleiro_por_jogo, pontaria_adversario_pct,
               conversao_sofrida_pct, faltas_por_jogo, faltas_sofridas_por_jogo,
               amarelos_por_jogo, amarelos, vermelhos,
               primeiro_jogo, ultimo_jogo
        from gold_time_estatistica_temporada
        where time_id = ? and jogos_com_estatistica >= ?
        order by season desc, jogos_com_estatistica desc
        """,
        [team_id, min_jogos],
    )


@app.get("/times/{team_id}/cartoes-por-periodo", response_model=list[CartaoNoPeriodo])
def cartoes_por_periodo(
    team_id: int,
    season: int | None = Query(default=None),
    league_id: int | None = Query(default=None),
):
    """Em que faixa de 15 minutos o time toma e provoca cartao.

    Mesmo eixo do /gols-por-periodo, para as duas leituras serem comparaveis.
    Cobertura parcial: vem dos lances por partida.
    """
    return consultar(
        """
        select faixa, ordem_faixa, tomados, amarelos, vermelhos, provocados,
               jogos_com_evento
        from gold_cartao_momento
        where time_id = ?
          and (? is null or season = ?)
          and (? is null or league_id = ?)
        order by ordem_faixa
        """,
        [team_id, season, season, league_id, league_id],
    )


@app.get("/times/{team_id}/disciplina", response_model=list[Disciplina])
def disciplina(team_id: int):
    """Cartoes por temporada e quanto a expulsao custa em gol sofrido.

    A taxa com um a menos e normalizada por minuto em desvantagem, para poder
    ser comparada com o ritmo normal do time. Leia jogos_com_expulsao antes: a
    amostra por temporada costuma ser de meia duzia de jogos.
    """
    return consultar(
        """
        select league_id, league_nome, season, jogos_com_evento,
               amarelos, vermelhos, cartoes_por_jogo,
               minuto_medio_primeiro_cartao, cartoes_apos_75,
               cartoes_do_adversario, jogos_com_expulsao,
               gols_sofridos_apos_expulsao, minutos_com_um_a_menos,
               gols_sofridos_por_90_com_um_a_menos, gols_sofridos_por_90_normal
        from gold_disciplina
        where time_id = ?
        order by season desc, jogos_com_evento desc
        """,
        [team_id],
    )


@app.get("/times/{team_id}/origem-dos-gols", response_model=list[OrigemDosGols])
def origem_dos_gols(team_id: int):
    """De onde vem o gol marcado e o sofrido: normal, penalti, contra, assistido.

    Cobertura parcial — le os lances por partida, da onda 3. Cada linha traz
    jogos_com_evento para a tela dizer sobre quantos jogos a conta foi feita.

    Leia `assistencia_registrada` antes das colunas de assistencia: a fonte nao
    registra passe decisivo na Copa do Brasil nem no Paranaense, e nesses casos
    os campos vem nulos em vez de zero.
    """
    return consultar(
        """
        select league_id, league_nome, season, jogos_com_evento,
               gols, gols_normais, gols_penalti, gols_contra_a_favor,
               assistencia_registrada, gols_com_assistencia, gols_sem_assistencia,
               sofridos, sofridos_normais, sofridos_penalti,
               sofridos_contra_a_favor,
               penalti_pct, assistidos_pct, sofridos_penalti_pct
        from gold_gol_origem
        where time_id = ?
        order by season desc, jogos_com_evento desc
        """,
        [team_id],
    )


@app.get("/times/{team_id}/banco", response_model=list[ImpactoDoBanco])
def impacto_do_banco(team_id: int):
    """Quanto do ataque sai do banco, e a que altura o tecnico mexe.

    Cobertura parcial, pelo mesmo motivo da origem dos gols.
    """
    return consultar(
        """
        select league_id, league_nome, season, jogos_com_evento,
               gols_de_titular, gols_de_reserva, gols_sem_escalacao,
               gols_do_banco_pct, assistencias_de_reserva,
               substituicoes, substituicoes_por_jogo, minuto_medio_substituicao,
               minuto_medio_primeira_troca, jogos_com_troca_no_1t
        from gold_banco_impacto
        where time_id = ?
        order by season desc, jogos_com_evento desc
        """,
        [team_id],
    )


@app.get("/times/{team_id}/formacoes", response_model=list[FormacaoDoTime])
def formacoes_do_time(
    team_id: int,
    season: int | None = Query(default=None, description="Filtra por temporada"),
    min_jogos: int = Query(
        default=1, ge=1, description="Esconde formacoes com poucos jogos"
    ),
):
    """Com qual desenho tatico o time entrou, quantas vezes e o que colheu.

    Vem da escalacao, entao cobre so os jogos ja alcancados pela onda 3. Leia
    `jogos` antes do aproveitamento: 100% com uma partida nao e tendencia.
    """
    return consultar(
        """
        select league_id, league_nome, season, formacao, jogos, vitorias,
               empates, derrotas, pontos, aproveitamento_pct, gols_pro,
               gols_contra, saldo, gols_por_jogo, gols_sofridos_por_jogo,
               jogos_sem_sofrer_gol, jogos_casa, jogos_fora, tecnicos,
               primeiro_jogo, ultimo_jogo
        from gold_formacao_desempenho
        where time_id = ?
          and (? is null or season = ?)
          and jogos >= ?
        order by season desc, jogos desc, aproveitamento_pct desc
        """,
        [team_id, season, season, min_jogos],
    )


@app.get(
    "/times/{team_id}/forca-adversario",
    response_model=list[DesempenhoPorForcaAdversario],
)
def forca_do_adversario(team_id: int):
    """Aproveitamento contra cada quarto da tabela.

    Ao contrario das outras analises que dependem de dado por jogo, esta cobre
    a base inteira: sai do placar, nao da onda 3. So a fase de pontos corridos
    entra, o mesmo recorte da classificacao — logo copa nao aparece aqui.
    """
    return consultar(
        """
        select league_id, league_nome, season, faixa_adversario, faixa_rotulo,
               times_na_competicao, times_na_faixa,
               jogos, vitorias, empates, derrotas, pontos,
               aproveitamento_pct, gols_pro, gols_contra, saldo, jogos_casa,
               pontos_casa, jogos_fora, pontos_fora, posicao_media_adversario
        from gold_desempenho_por_forca_adversario
        where time_id = ?
        order by season desc, league_id, faixa_adversario
        """,
        [team_id],
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
    min_minutos: int = Query(
        default=0,
        ge=0,
        description="Piso de minutos. Obrigatorio para comparar as colunas _90: "
        "quem entrou 12 minutos e marcou aparece com 7,5 gols por 90.",
    ),
    grupo_posicao: str | None = Query(
        default=None, description="Goleiro, Defesa, Meio ou Ataque"
    ),
):
    """Desempenho de cada jogador do elenco, por competicao e temporada.

    Traz as duas leituras lado a lado: os totais respondem quem produziu mais na
    temporada, e as colunas _90 respondem quem produz mais quando esta em campo.
    Comparar totais entre quem jogou 3.200 minutos e quem jogou 450 mede
    oportunidade, nao desempenho.

    O padrao de min_minutos e 0 para nao mudar o comportamento de quem so quer a
    lista do elenco. Quem for ordenar por coluna _90 precisa subir esse piso.
    """
    return consultar(
        """
        select player_id, jogador_nome, team_id, team_nome, season, league_id,
               league_nome, posicao, grupo_posicao, jogos_com_dado,
               jogos_com_minutos, jogos_titular, minutos, minutos_por_jogo,
               nota_media, melhor_nota, gols, assistencias, chutes,
               chutes_no_gol, passes, desarmes, duelos, duelos_ganhos,
               dribles_tentados, dribles_certos, faltas_cometidas, amarelos,
               vermelhos, defesas, gols_sofridos,
               gols_90, assistencias_90, participacoes_90, chutes_90, passes_90,
               passes_decisivos_90, desarmes_90, interceptacoes_90,
               duelos_ganhos_90, dribles_certos_90, faltas_cometidas_90,
               defesas_90, duelos_ganhos_pct, dribles_certos_pct, pontaria_pct
        from gold_jogador_temporada
        where team_id = ?
          and (? is null or season = ?)
          and (? is null or league_id = ?)
          and coalesce(minutos, 0) >= ?
          and (? is null or grupo_posicao = ?)
        order by minutos desc nulls last
        """,
        [
            team_id,
            season,
            season,
            league_id,
            league_id,
            min_minutos,
            grupo_posicao,
            grupo_posicao,
        ],
    )


@app.get("/jogadores/{player_id}/temporadas", response_model=list[JogadorNaTemporada])
def temporadas_do_jogador(player_id: int):
    """Uma linha por competicao e temporada em que o jogador atuou."""
    linhas = consultar(
        """
        select player_id, jogador_nome, team_id, team_nome, season, league_id,
               league_nome, posicao, grupo_posicao, jogos_com_dado,
               jogos_com_minutos, jogos_titular, minutos, minutos_por_jogo,
               nota_media, melhor_nota, gols, assistencias, chutes,
               chutes_no_gol, passes, desarmes, duelos, duelos_ganhos,
               dribles_tentados, dribles_certos, faltas_cometidas, amarelos,
               vermelhos, defesas, gols_sofridos,
               gols_90, assistencias_90, participacoes_90, chutes_90, passes_90,
               passes_decisivos_90, desarmes_90, interceptacoes_90,
               duelos_ganhos_90, dribles_certos_90, faltas_cometidas_90,
               defesas_90, duelos_ganhos_pct, dribles_certos_pct, pontaria_pct
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


@app.get("/destaques", response_model=list[Destaque])
def destaques():
    """Recordes e fatos da base, na ordem em que devem aparecer na home."""
    return consultar(
        """
        select tipo, ordem, rotulo, valor, detalhe, league_nome, season,
               fixture_id, time_id, time_nome, logo_url
        from gold_destaque
        order by ordem
        """
    )


@app.get("/resumo", response_model=ResumoDaBase)
def resumo_da_base():
    """O tamanho da base inteira. Alimenta a home.

    Le um mart de uma linha so — a soma acontece no dbt, nao aqui e nem na tela.
    """
    linhas = consultar("select * from gold_base_resumo")
    return linhas[0]


@app.get("/competicoes", response_model=list[Competicao])
def listar_competicoes():
    """Indice das competicoes-temporada presentes na base.

    Este endpoint ja montou um CTE de trinta linhas aqui dentro. A logica virou
    o gold_competicao, e o que sobrou e o que uma rota deve ser: selecionar e
    ordenar.
    """
    return consultar(
        """
        select league_id, league_nome, season, tipo, times, jogos, gols,
               gols_por_jogo, primeiro_jogo, ultimo_jogo,
               campeao_id, campeao, campeao_logo, artilheiro, artilheiro_gols,
               tem_chaveamento, tem_classificacao,
               jogos_com_evento, jogos_com_estatistica, cobertura_evento_pct
        from gold_competicao
        order by season desc, jogos desc
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
