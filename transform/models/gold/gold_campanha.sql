-- Campanha jogo a jogo, com acumulados e forma. Grao: (jogo, time).
--
-- Substitui o antigo gold_coritiba_campanha, que filtrava o clube dentro do
-- model. A API precisa de /times/{id}/campanha para qualquer time, e um mart
-- que ja nasce filtrado nao serve dois clubes.
--
-- A licao vale mais que o caso: o consumidor e quem revela o formato certo do
-- mart. Regra que fica — o gold pode AGREGAR de um jeito especifico, mas
-- filtrar por entidade e trabalho de quem consulta, com um where.

with base as (

    select * from {{ ref('silver_partida_time') }}

)

select
    fixture_id,
    time_id,
    time_nome,
    data_hora_utc::date as data,
    season,
    league_id,
    league_nome,
    rodada,
    mando,
    adversario_id,
    adversario_nome,
    gols_pro,
    gols_contra,
    -- placar de penaltis, quando a partida foi decidida neles. Redundante com
    -- o chaveamento de proposito: na tabela jogo a jogo, um 1x1 que virou
    -- classificacao precisa mostrar por que.
    penaltis_pro,
    penaltis_contra,
    resultado,
    pontos,

    row_number() over w as jogo_n,
    sum(pontos)  over w as pontos_acumulados,
    sum(saldo)   over w as saldo_acumulado,

    -- forma que o time LEVAVA para este jogo: os 5 anteriores, sem incluir o
    -- atual. O "1 preceding" e o que garante isso.
    sum(pontos) over w5 as pontos_5_anteriores,
    count(*)    over w5 as jogos_na_janela

from base
window
    w as (
        partition by time_id, league_id, season
        order by data_hora_utc
    ),
    w5 as (
        partition by time_id, league_id, season
        order by data_hora_utc
        rows between 5 preceding and 1 preceding
    )
