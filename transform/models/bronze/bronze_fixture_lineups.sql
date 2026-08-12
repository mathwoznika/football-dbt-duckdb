-- Escalacoes. Grao: (jogo, time, jogador).
--
-- A API separa titulares e reservas em dois arrays distintos, com a mesma
-- estrutura interna. Em vez de duas tabelas, empilhamos os dois e marcamos
-- a diferenca numa coluna "titular" — assim contar quem comecou jogando e
-- um where, nao um union na hora da consulta.
--
-- formacao e tecnico repetem em todas as linhas do mesmo time no mesmo jogo:
-- eles sao do grao (jogo, time), nao do jogador. Desnormalizacao consciente.

with resposta as (

    select * from {{ source('raw', 'fixture_lineups') }}

),

times as (

    select
        _meta.params.fixture as fixture_id,
        season,
        league,
        _meta.extraido_em    as extraido_em,
        unnest(response)     as item
    from resposta

),

titulares as (

    select
        fixture_id,
        season,
        league,
        extraido_em,
        item.team.id           as team_id,
        item.team.name         as team_nome,
        item.formation         as formacao,
        item.coach.id          as coach_id,
        item.coach.name        as tecnico,
        true                   as titular,
        unnest(item.startXI)   as escalado
    from times

),

reservas as (

    select
        fixture_id,
        season,
        league,
        extraido_em,
        item.team.id             as team_id,
        item.team.name           as team_nome,
        item.formation           as formacao,
        item.coach.id            as coach_id,
        item.coach.name          as tecnico,
        false                    as titular,
        unnest(item.substitutes) as escalado
    from times

),

-- Os campos sao achatados ANTES do union all, e nao depois.
-- Motivo: "grid" vem sempre nulo nos reservas e preenchido nos titulares
-- (formato "1:1", linha:coluna no campo). O DuckDB infere tipos diferentes
-- nos dois arrays, e empilhar os structs faria ele tentar converter "1:1"
-- para JSON. Achatando antes, o union e sobre colunas escalares com cast
-- explicito, e o problema deixa de existir.

titulares_plano as (

    select
        fixture_id,
        season,
        league,
        extraido_em,
        team_id,
        team_nome,
        formacao,
        coach_id,
        tecnico,
        titular,
        escalado.player.id          as player_id,
        escalado.player.name        as jogador,
        escalado.player.number      as camisa,
        escalado.player.pos         as posicao,
        escalado.player.grid::varchar as posicao_campo
    from titulares

),

reservas_plano as (

    select
        fixture_id,
        season,
        league,
        extraido_em,
        team_id,
        team_nome,
        formacao,
        coach_id,
        tecnico,
        titular,
        escalado.player.id          as player_id,
        escalado.player.name        as jogador,
        escalado.player.number      as camisa,
        escalado.player.pos         as posicao,
        escalado.player.grid::varchar as posicao_campo
    from reservas

),

empilhado as (

    select * from titulares_plano
    union all
    select * from reservas_plano

)

select
    fixture_id,
    season::int as season,
    league::int as league_id,
    team_id,
    team_nome,
    formacao,
    coach_id,
    tecnico,
    titular,
    player_id,
    jogador,
    camisa,
    posicao,
    posicao_campo,
    extraido_em
from empilhado
