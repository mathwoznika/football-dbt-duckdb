-- Transferencias. Uma linha por movimentacao.
-- "in" e "out" sao palavras reservadas em SQL, por isso vao entre aspas.

with resposta as (

    select * from {{ source('raw', 'transfers') }}

),

jogadores as (

    select
        _meta.params.team as team_id_consultado,
        _meta.extraido_em as extraido_em,
        unnest(response)  as item
    from resposta

),

movimentos as (

    select
        item.player.id   as player_id,
        item.player.name as jogador,
        team_id_consultado,
        extraido_em,
        unnest(item.transfers) as movimento
    from jogadores

)

select
    player_id,
    jogador,
    try_cast(movimento.date as date) as data,
    movimento.type                   as tipo,
    movimento.teams."in".id          as team_destino_id,
    movimento.teams."in".name        as team_destino,
    movimento.teams."out".id         as team_origem_id,
    movimento.teams."out".name       as team_origem,
    team_id_consultado,
    extraido_em
from movimentos
