-- Classificacao oficial da API. Precisa de dois unnest porque "standings" e
-- uma lista de listas: a API preve competicoes com fase de grupos, entao o
-- nivel de fora e o grupo e o de dentro sao os times.
-- Copa do Brasil nao tem tabela e devolve vazio — some sozinho no unnest.

with resposta as (

    select * from {{ source('raw', 'standings') }}

),

ligas as (

    select
        _meta.params.league as league_id,
        _meta.params.season as season,
        _meta.extraido_em   as extraido_em,
        unnest(response)    as item
    from resposta

),

grupos as (

    select
        league_id,
        season,
        extraido_em,
        unnest(item.league.standings) as grupo
    from ligas

),

posicoes as (

    select
        league_id,
        season,
        extraido_em,
        unnest(grupo) as linha
    from grupos

)

select
    league_id,
    season,
    linha."group"              as grupo,
    linha.rank                 as posicao,
    linha.team.id              as team_id,
    linha.team.name            as team_nome,
    linha.points               as pontos,
    linha.goalsDiff            as saldo,
    linha.form                 as forma,
    linha.status               as situacao,
    linha.description          as descricao,
    linha."all".played         as jogos,
    linha."all".win            as vitorias,
    linha."all".draw           as empates,
    linha."all".lose           as derrotas,
    linha."all".goals."for"    as gols_pro,
    linha."all".goals.against  as gols_contra,
    linha.home.played          as jogos_casa,
    linha.home.win             as vitorias_casa,
    linha.home.draw            as empates_casa,
    linha.home.lose            as derrotas_casa,
    linha.away.played          as jogos_fora,
    linha.away.win             as vitorias_fora,
    linha.away.draw            as empates_fora,
    linha.away.lose            as derrotas_fora,
    extraido_em
from posicoes
