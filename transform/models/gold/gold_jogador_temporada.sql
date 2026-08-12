-- Pagina de elenco: desempenho de cada jogador por competicao e temporada.
--
-- Depende da onda 3 (fixture_players), que ainda esta em andamento — hoje
-- cobre so parte dos jogos e vai se completando sozinho. Use jogos_com_dado
-- para saber quanto da amostra ja existe antes de tirar conclusao.

with atuacoes as (

    select * from {{ ref('bronze_fixture_players') }}

)

select
    player_id,
    jogador_nome,
    team_id,
    team_nome,
    season,
    league_id,

    count(*)                                                as jogos_com_dado,
    sum(case when entrou_do_banco then 0 else 1 end)        as jogos_titular,
    sum(minutos)                                            as minutos,
    round(avg(nota), 2)                                     as nota_media,
    max(nota)                                               as melhor_nota,

    sum(gols)                                               as gols,
    sum(assistencias)                                       as assistencias,
    sum(chutes)                                             as chutes,
    sum(chutes_no_gol)                                      as chutes_no_gol,
    sum(passes)                                             as passes,
    sum(passes_decisivos)                                   as passes_decisivos,
    sum(desarmes)                                           as desarmes,
    sum(interceptacoes)                                     as interceptacoes,
    sum(duelos)                                             as duelos,
    sum(duelos_ganhos)                                      as duelos_ganhos,
    sum(dribles_tentados)                                   as dribles_tentados,
    sum(dribles_certos)                                     as dribles_certos,
    sum(faltas_cometidas)                                   as faltas_cometidas,
    sum(faltas_sofridas)                                    as faltas_sofridas,
    sum(amarelos)                                           as amarelos,
    sum(vermelhos)                                          as vermelhos,

    -- goleiro: as duas colunas so fazem sentido para quem defende
    sum(defesas)                                            as defesas,
    sum(gols_sofridos)                                      as gols_sofridos,

    -- posicao mais frequente do jogador na temporada
    mode(posicao)                                           as posicao
from atuacoes
group by all
