-- Calendario completo das competicoes que o Coritiba disputou.
-- Mesmo schema do bronze_fixtures, porem com TODOS os times: e daqui que sai
-- o contexto dos adversarios entre si.

with resposta as (

    select * from {{ source('raw', 'fixtures_liga') }}

),

jogos as (

    select
        _meta.extraido_em as extraido_em,
        unnest(response)  as jogo
    from resposta

)

select
    jogo.fixture.id           as fixture_id,
    jogo.fixture.date         as data_hora_utc,
    jogo.league.id            as league_id,
    jogo.league.season        as season,
    jogo.league.name          as league_nome,
    jogo.league.round         as rodada,
    jogo.fixture.status.short as status,
    jogo.fixture.venue.name   as estadio,
    jogo.fixture.referee      as arbitro,
    jogo.teams.home.id        as time_casa_id,
    jogo.teams.home.name      as time_casa,
    jogo.teams.away.id        as time_fora_id,
    jogo.teams.away.name      as time_fora,
    jogo.goals.home           as gols_casa,
    jogo.goals.away           as gols_fora,
    jogo.score.halftime.home  as gols_casa_1t,
    jogo.score.halftime.away  as gols_fora_1t,
    extraido_em
from jogos
