-- Artilheiros oficiais de cada competicao e temporada.
-- Grao: (liga, temporada, jogador, ENTRADA de estatistica).
--
-- O array "statistics" costuma ter um elemento, mas jogador que trocou de
-- clube na temporada aparece com dois. Aqui os dois viram linhas — bronze e
-- fiel a fonte e nao escolhe. Quem resolve a duplicidade e o gold_artilheiro,
-- que documenta o motivo.
--
-- Por que este dataset existe: gol tambem esta em fixture_events, mas a onda 3
-- so cobre jogos do Coritiba — gols marcados em Palmeiras x Flamengo nao entram
-- na nossa base. Artilharia da competicao pelos eventos exigiria os 1.746 jogos
-- detalhados, cerca de 7.000 requisicoes. Por este endpoint sao 9.

with resposta as (

    select * from {{ source('raw', 'topscorers') }}

),

jogadores as (

    select
        _meta.params.league as league_id,
        _meta.params.season as season,
        _meta.extraido_em   as extraido_em,
        unnest(response)    as item
    from resposta

),

estatisticas as (

    select
        league_id,
        season,
        extraido_em,
        item.player.id          as player_id,
        item.player.name        as jogador,
        item.player.firstname   as primeiro_nome,
        item.player.lastname    as sobrenome,
        item.player.age         as idade,
        item.player.nationality as nacionalidade,
        item.player.photo       as foto_url,
        unnest(item.statistics) as est
    from jogadores

)

select
    league_id,
    season,
    player_id,
    jogador,
    primeiro_nome,
    sobrenome,
    idade,
    nacionalidade,
    foto_url,

    est.team.id                          as team_id,
    est.team.name                        as team_nome,
    est.team.logo                        as team_logo,

    est.games.appearences                as jogos,
    est.games.lineups                    as jogos_titular,
    est.games.minutes                    as minutos,
    est.games.position                   as posicao,
    try_cast(est.games.rating as double) as nota_media,

    est.goals.total                      as gols,
    est.goals.assists                    as assistencias,
    est.shots.total                      as chutes,
    est.shots."on"                       as chutes_no_gol,
    est.passes.total                     as passes,
    est.passes.key                       as passes_decisivos,
    est.dribbles.attempts                as dribles_tentados,
    est.dribbles.success                 as dribles_certos,
    est.duels.total                      as duelos,
    est.duels.won                        as duelos_ganhos,
    est.fouls.committed                  as faltas_cometidas,
    est.fouls.drawn                      as faltas_sofridas,
    est.cards.yellow                     as amarelos,
    est.cards.red                        as vermelhos,
    est.penalty.scored                   as penaltis_convertidos,
    est.penalty.missed                   as penaltis_perdidos,

    extraido_em
from estatisticas
