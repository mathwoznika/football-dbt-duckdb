-- Em que momento do jogo o time toma e provoca cartao.
-- Grao: (time, competicao, temporada, faixa de 15 minutos).
--
-- Espelha o gold_gols_por_periodo de proposito, ate nos nomes das faixas: as
-- duas telas ficam lado a lado e comparar "quando marco" com "quando me
-- indisciplino" so funciona se o eixo for o mesmo.
--
-- O DADO TEM SINAL FORTE. Na base inteira, a ultima faixa concentra 206 dos
-- 684 amarelos e 13 dos 29 vermelhos, contra 45 amarelos nos primeiros quinze
-- minutos. Cartao nao se distribui pelo jogo: ele se acumula no fim.
--
-- "Provocados" sao os cartoes que o ADVERSARIO tomou naquela partida. Nao e o
-- mesmo que provocacao no sentido literal — e o contexto que falta para ler o
-- proprio numero, porque um jogo truncado castiga os dois lados.
--
-- COBERTURA PARCIAL: vem dos eventos, que so existem para os jogos alcancados
-- pela onda 3. jogos_com_evento diz sobre quantas partidas a conta foi feita.

with eventos as (

    select * from {{ ref('gold_partida_evento') }}
    where tipo = 'Card'

),

partidas as (

    select * from {{ ref('silver_partida_time') }}

),

-- Um cartao vira duas linhas: "tomado" para quem levou, "provocado" para o
-- outro lado da mesma partida.
atribuido as (

    select
        partidas.time_id,
        partidas.time_nome,
        partidas.league_id,
        partidas.league_nome,
        partidas.season,
        eventos.fixture_id,
        eventos.minuto,
        eventos.detalhe,
        eventos.team_id = partidas.time_id as foi_tomado
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

),

-- Cobertura de VERDADE: partidas do time que tem lance extraido, sem olhar
-- faixa. Precisa ser calculada separado — contar fixture dentro do grupo
-- responderia "em quantos jogos houve cartao NESTA faixa", que e outra
-- pergunta e da um numero menor.
cobertura as (

    select
        partidas.time_id,
        partidas.league_id,
        partidas.season,
        count(distinct partidas.fixture_id) as jogos_com_evento
    from partidas
    join (select distinct fixture_id from {{ ref('gold_partida_evento') }}) as com_lance
      on com_lance.fixture_id = partidas.fixture_id
    group by all

)

select
    com_faixa.time_id,
    com_faixa.time_nome,
    com_faixa.league_id,
    com_faixa.league_nome,
    com_faixa.season,
    com_faixa.faixa,
    com_faixa.ordem_faixa,

    count(*) filter (where foi_tomado)                             as tomados,
    count(*) filter (where foi_tomado and detalhe = 'Yellow Card') as amarelos,
    count(*) filter (where foi_tomado and detalhe = 'Red Card')    as vermelhos,
    count(*) filter (where not foi_tomado)                         as provocados,

    any_value(cobertura.jogos_com_evento)                          as jogos_com_evento
from com_faixa
join cobertura
  on cobertura.time_id   = com_faixa.time_id
 and cobertura.league_id = com_faixa.league_id
 and cobertura.season    = com_faixa.season
group by all
