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
    -- placar da prorrogacao e dos penaltis. Vem nulo na esmagadora maioria dos
    -- jogos, mas sem eles nao da para saber quem passou num confronto empatado
    -- de mata-mata — e foi por isso que precisei voltar aqui.
    try_cast(jogo.score.extratime.home as int) as gols_casa_prorrogacao,
    try_cast(jogo.score.extratime.away as int) as gols_fora_prorrogacao,
    try_cast(jogo.score.penalty.home as int)   as penaltis_casa,
    try_cast(jogo.score.penalty.away as int)   as penaltis_fora,
    extraido_em
from jogos
