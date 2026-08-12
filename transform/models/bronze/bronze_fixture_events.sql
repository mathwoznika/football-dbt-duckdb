-- Eventos de jogo: gols, cartoes, substituicoes, VAR. Uma linha por evento.
--
-- Atencao ao fixture_id: o payload deste endpoint NAO traz o id da partida,
-- so a lista de eventos. Ele vem de _meta.params, que o api.py gravou.
-- season e league vem do caminho do arquivo, via hive_partitioning.

with resposta as (

    select * from {{ source('raw', 'fixture_events') }}

),

eventos as (

    select
        _meta.params.fixture as fixture_id,
        season,
        league,
        _meta.extraido_em    as extraido_em,
        unnest(response)     as evento
    from resposta

)

select
    fixture_id,
    season::int            as season,
    league::int            as league_id,
    evento."time".elapsed  as minuto,
    evento."time".extra    as acrescimo,
    evento.team.id         as team_id,
    evento.team.name       as team_nome,
    evento.player.id       as player_id,
    evento.player.name     as jogador,
    evento.assist.id       as assistente_id,
    evento.assist.name     as assistente,
    evento.type            as tipo,
    evento.detail          as detalhe,
    evento.comments        as comentario,
    extraido_em
from eventos
