-- Posicao e pontos de cada time apos cada rodada. E o que alimenta o grafico
-- de linha da temporada — a queda do Coritiba em 2023 vira uma curva.
--
-- So competicoes de pontos corridos: em mata-mata nao existe "posicao apos a
-- rodada". O numero da rodada e extraido do texto ("Regular Season - 15").

with jogos as (

    select * from {{ ref('silver_partida_time') }}
    where rodada like 'Regular Season%'

),

acumulado as (

    select
        fixture_id,
        data_hora_utc,
        league_id,
        league_nome,
        season,
        time_id,
        time_nome,
        resultado,
        pontos,
        cast(regexp_extract(rodada, '([0-9]+)$', 1) as int) as rodada_n,
        sum(pontos)      over w as pontos_acum,
        sum(saldo)       over w as saldo_acum,
        sum(gols_pro)    over w as gols_pro_acum,
        sum(case when resultado = 'V' then 1 else 0 end) over w as vitorias_acum
    from jogos
    window w as (
        partition by time_id, league_id, season
        order by data_hora_utc
    )

)

select
    *,
    -- os criterios de desempate seguem a ordem usada no Brasil:
    -- pontos, vitorias, saldo, gols pro
    row_number() over (
        partition by league_id, season, rodada_n
        order by pontos_acum desc, vitorias_acum desc, saldo_acum desc, gols_pro_acum desc
    ) as posicao
from acumulado
