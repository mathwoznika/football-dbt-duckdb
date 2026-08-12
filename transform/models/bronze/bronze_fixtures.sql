with resposta as (

    select * from {{ source('raw', 'fixtures') }}

),

jogos as (

    -- cada arquivo e uma resposta da API com varios jogos dentro;
    -- o unnest transforma cada item do array em uma linha
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
    extraido_em
from jogos