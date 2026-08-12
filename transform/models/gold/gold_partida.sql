-- Cabecalho de uma partida. Grao: um JOGO (nao um time por jogo).
--
-- E o unico mart no grao de partida — todos os outros olham do ponto de vista
-- de um time. A pagina de um jogo precisa dos dois lados ao mesmo tempo, e
-- montar isso a partir do silver exigiria juntar as duas linhas de volta.

with jogos as (

    select * from {{ ref('bronze_fixtures_liga') }}

),

times as (

    select team_id, team_nome, logo_url from {{ ref('silver_time') }}

)

select
    jogos.fixture_id,
    jogos.data_hora_utc,
    jogos.data_hora_utc::date as data,
    jogos.season,
    jogos.league_id,
    jogos.league_nome,
    jogos.rodada,
    jogos.status,
    jogos.estadio,
    jogos.arbitro,

    jogos.time_casa_id,
    coalesce(casa.team_nome, jogos.time_casa) as time_casa,
    casa.logo_url                             as time_casa_logo,
    jogos.gols_casa,
    jogos.gols_casa_1t,
    jogos.penaltis_casa,

    jogos.time_fora_id,
    coalesce(fora.team_nome, jogos.time_fora) as time_fora,
    fora.logo_url                             as time_fora_logo,
    jogos.gols_fora,
    jogos.gols_fora_1t,
    jogos.penaltis_fora

from jogos
left join times as casa on casa.team_id = jogos.time_casa_id
left join times as fora on fora.team_id = jogos.time_fora_id
