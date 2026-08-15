-- Uma linha so: o tamanho da base inteira.
--
-- Mart de uma linha e incomum, e o motivo dele existir e uma regra do projeto:
-- nem a API nem a tela calculam. A home precisa dizer "1.746 jogos, 153 times,
-- 4.103 gols" antes de o visitante clicar em qualquer coisa, e esses numeros
-- tem que sair do dbt como qualquer outro — versionados e testados, nao somados
-- no navegador.
--
-- COBERTURA JUNTO DOS TOTAIS, e nao numa tela escondida. O projeto tem duas
-- profundidades muito diferentes: largura (placar de todos os 1.746 jogos) e
-- profundidade (lance a lance, so onde a onda 3 chegou). Um visitante que ve
-- "1.746 jogos" e assume que todos tem escalacao e estatistica vai tirar
-- conclusao errada de metade das telas. Por isso jogos_com_evento e
-- jogos_com_estatistica sobem para o mesmo lugar que o total.

with partidas as (

    select * from {{ ref('silver_partida_time') }}

),

com_evento as (

    select distinct fixture_id from {{ ref('gold_partida_evento') }}

),

com_estatistica as (

    select distinct fixture_id from {{ ref('gold_partida_estatistica') }}

)

select
    count(distinct partidas.fixture_id)                     as jogos,
    count(distinct partidas.time_id)                        as times,
    count(distinct (partidas.league_id, partidas.season))    as competicoes_temporada,
    count(distinct partidas.league_id)                      as competicoes,
    min(partidas.season)                                    as primeira_temporada,
    max(partidas.season)                                    as ultima_temporada,
    sum(partidas.gols_pro)                                  as gols,
    round(1.0 * sum(partidas.gols_pro)
          / nullif(count(distinct partidas.fixture_id), 0), 2) as gols_por_jogo,

    (select count(*) from {{ ref('gold_jogador') }})        as jogadores,
    (select count(*) from {{ ref('gold_partida_evento') }}) as lances,

    count(distinct partidas.fixture_id) filter (
        where partidas.fixture_id in (select fixture_id from com_evento)
    ) as jogos_com_evento,
    count(distinct partidas.fixture_id) filter (
        where partidas.fixture_id in (select fixture_id from com_estatistica)
    ) as jogos_com_estatistica

from partidas
