-- Estatistica individual por jogador em cada jogo. Grao: (jogo, time, jogador).
-- E o dataset mais profundo da base — e o mais valioso para ML, porque tem a
-- nota do jogador e o detalhe da atuacao dele.
--
-- Sao tres unnest: times -> jogadores -> statistics. O ultimo array sempre tem
-- um elemento so nesse endpoint, mas a API o entrega como lista mesmo assim.
--
-- "on" e palavra reservada em SQL, por isso shots."on" vai entre aspas.

with resposta as (

    select * from {{ source('raw', 'fixture_players') }}

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

jogadores as (

    select
        fixture_id,
        season,
        league,
        extraido_em,
        item.team.id   as team_id,
        item.team.name as team_nome,
        unnest(item.players) as jogador
    from times

),

atuacoes as (

    select
        fixture_id,
        season,
        league,
        extraido_em,
        team_id,
        team_nome,
        jogador.player.id   as player_id,
        jogador.player.name as jogador_nome,
        unnest(jogador.statistics) as est
    from jogadores

)

select
    fixture_id,
    season::int  as season,
    league::int  as league_id,
    team_id,
    team_nome,
    player_id,
    jogador_nome,

    est.games.minutes                       as minutos,
    est.games.number                        as camisa,
    est.games.position                      as posicao,
    try_cast(est.games.rating as double)    as nota,
    est.games.captain                       as capitao,
    est.games.substitute                    as entrou_do_banco,

    est.shots.total                         as chutes,
    est.shots."on"                          as chutes_no_gol,
    est.goals.total                         as gols,
    est.goals.conceded                      as gols_sofridos,
    est.goals.assists                       as assistencias,
    est.goals.saves                         as defesas,
    est.passes.total                        as passes,
    est.passes.key                          as passes_decisivos,
    est.passes.accuracy                     as precisao_passe,
    est.tackles.total                       as desarmes,
    est.tackles.blocks                      as bloqueios,
    est.tackles.interceptions               as interceptacoes,
    est.duels.total                         as duelos,
    est.duels.won                           as duelos_ganhos,
    est.dribbles.attempts                   as dribles_tentados,
    est.dribbles.success                    as dribles_certos,
    est.dribbles.past                       as dribles_sofridos,
    est.fouls.drawn                         as faltas_sofridas,
    est.fouls.committed                     as faltas_cometidas,
    est.cards.yellow                        as amarelos,
    est.cards.red                           as vermelhos,
    est.offsides                            as impedimentos,
    est.penalty.won                         as penaltis_ganhos,
    est.penalty.commited                    as penaltis_cometidos,
    est.penalty.scored                      as penaltis_convertidos,
    est.penalty.missed                      as penaltis_perdidos,
    est.penalty.saved                       as penaltis_defendidos,

    extraido_em
from atuacoes
