-- A campanha do Coritiba, jogo a jogo, com acumulados e forma.
--
-- Este e o primeiro model do projeto que filtra um clube — e o gold e o lugar
-- certo para isso. O silver segue universal, entao quando a base crescer para
-- o futebol brasileiro inteiro nada abaixo daqui precisa mudar: nascem novos
-- marts ao lado deste.
--
-- O clube esta como variavel para nao ficar cravado no SQL: sobrescreva com
--   dbt run --vars '{time_id: 128}'
-- para gerar a mesma campanha de outro time.

with base as (

    select * from {{ ref('silver_partida_time') }}
    where time_id = {{ var('time_id', 147) }}

)

select
    fixture_id,
    data_hora_utc::date as data,
    season,
    league_id,
    league_nome,
    rodada,
    mando,
    adversario_nome,
    gols_pro,
    gols_contra,
    resultado,
    pontos,

    row_number() over (partition by league_id, season order by data_hora_utc) as jogo_n,
    sum(pontos)  over (partition by league_id, season order by data_hora_utc) as pontos_acumulados,
    sum(saldo)   over (partition by league_id, season order by data_hora_utc) as saldo_acumulado,

    -- Forma que o time LEVAVA para este jogo: os 5 anteriores, sem incluir o
    -- atual. O "1 preceding" no fim da janela e o que garante isso — se fosse
    -- "current row", a feature conteria o resultado que ela deveria prever.
    -- Em ML isso se chama data leakage, e e o erro mais comum em series
    -- temporais. Vale fixar o padrao desde ja.
    sum(pontos) over (
        partition by league_id, season order by data_hora_utc
        rows between 5 preceding and 1 preceding
    ) as pontos_5_anteriores,

    -- quantos jogos a janela realmente pegou (no inicio da temporada e < 5),
    -- para nao confundir "pouca forma" com "pouco historico"
    count(*) over (
        partition by league_id, season order by data_hora_utc
        rows between 5 preceding and 1 preceding
    ) as jogos_na_janela

from base
