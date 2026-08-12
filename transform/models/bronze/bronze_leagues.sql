-- Catalogo de competicoes. O grao e (liga, temporada), porque o array
-- "seasons" traz o historico inteiro de cada liga.
-- As colunas de cobertura dizem quais endpoints tem dado naquela temporada —
-- e o que usamos para saber que estatistica so existe de 2015 em diante.

with resposta as (

    select * from {{ source('raw', 'leagues') }}

),

ligas as (

    select
        _meta.extraido_em as extraido_em,
        unnest(response)  as item
    from resposta

),

temporadas as (

    select
        item.league.id       as league_id,
        item.league.name     as league_nome,
        item.league.type     as tipo,
        item.country.name    as pais,
        extraido_em,
        unnest(item.seasons) as temporada
    from ligas

)

select
    league_id,
    league_nome,
    tipo,
    pais,
    temporada.year                                  as season,
    try_cast(temporada.start as date)               as inicio,
    try_cast(temporada."end" as date)               as fim,
    temporada.current                               as atual,
    temporada.coverage.fixtures.events              as cobre_eventos,
    temporada.coverage.fixtures.lineups             as cobre_escalacao,
    temporada.coverage.fixtures.statistics_fixtures as cobre_stats_jogo,
    temporada.coverage.fixtures.statistics_players  as cobre_stats_jogador,
    temporada.coverage.standings                    as cobre_classificacao,
    temporada.coverage.players                      as cobre_jogadores,
    temporada.coverage.injuries                     as cobre_lesoes,
    temporada.coverage.odds                         as cobre_odds,
    extraido_em
from temporadas
