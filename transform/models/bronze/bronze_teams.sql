-- Elenco de times por competicao e temporada, com o estadio de cada um.
-- O par (league_id, season) vem dos parametros da extracao, nao do payload.

with resposta as (

    select * from {{ source('raw', 'teams') }}

),

itens as (

    select
        _meta.params.league as league_id,
        _meta.params.season as season,
        _meta.extraido_em   as extraido_em,
        unnest(response)    as item
    from resposta

)

select
    league_id,
    season,
    item.team.id        as team_id,
    item.team.name      as team_nome,
    item.team.code      as team_codigo,
    item.team.country   as pais,
    item.team.founded   as fundacao,
    item.team.national  as selecao,
    item.team.logo      as logo_url,
    item.venue.id       as venue_id,
    item.venue.name     as estadio,
    item.venue.city     as cidade,
    item.venue.capacity as capacidade,
    item.venue.surface  as gramado,
    extraido_em
from itens
