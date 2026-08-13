-- Em que momento do jogo o time marca e sofre.
-- Grao: (time, competicao, temporada, faixa de 15 minutos).
--
-- COBERTURA PARCIAL, e isso muda como a tela deve apresentar: vem dos eventos,
-- que so existem para os jogos ja alcancados pela onda 3. Diferente do
-- gold_desempenho_por_tempo, que cobre os 1.746 jogos porque o placar do
-- intervalo esta no proprio fixture.
--
-- A coluna jogos_com_evento diz sobre quantas partidas a distribuicao foi
-- calculada — sem ela, comparar duas temporadas com coberturas diferentes
-- levaria a conclusao errada.

with eventos as (

    select * from {{ ref('gold_partida_evento') }}
    where tipo = 'Goal'

),

-- de qual jogo veio cada evento, para saber a que time atribuir
partidas as (

    select * from {{ ref('silver_partida_time') }}

),

-- um gol vira duas linhas: "a favor" para quem marcou, "contra" para o outro
atribuido as (

    select
        partidas.time_id,
        partidas.time_nome,
        partidas.league_id,
        partidas.league_nome,
        partidas.season,
        eventos.fixture_id,
        eventos.minuto,
        eventos.team_id = partidas.time_id as foi_a_favor
    from eventos
    join partidas on partidas.fixture_id = eventos.fixture_id

),

com_faixa as (

    select
        *,
        case
            when minuto <= 15 then '00-15'
            when minuto <= 30 then '16-30'
            when minuto <= 45 then '31-45'
            when minuto <= 60 then '46-60'
            when minuto <= 75 then '61-75'
            else '76-90'
        end as faixa,
        -- ordem numerica, para o front nao precisar ordenar texto
        case
            when minuto <= 15 then 1
            when minuto <= 30 then 2
            when minuto <= 45 then 3
            when minuto <= 60 then 4
            when minuto <= 75 then 5
            else 6
        end as ordem_faixa
    from atribuido

)

select
    time_id,
    time_nome,
    league_id,
    league_nome,
    season,
    faixa,
    ordem_faixa,
    count(*) filter (where foi_a_favor)     as marcados,
    count(*) filter (where not foi_a_favor) as sofridos,
    count(distinct fixture_id)              as jogos_com_evento
from com_faixa
group by all
