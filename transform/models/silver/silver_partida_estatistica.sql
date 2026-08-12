-- Resultado + estatistica coletiva, no mesmo grao do silver_partida_time:
-- (jogo, time).
--
-- A estatistica entra duas vezes: a do proprio time e a do adversario, na
-- mesma linha, seguindo o padrao "pro / contra". Assim "finalizacoes sofridas"
-- vira uma coluna em vez de um join na hora da consulta — mesma logica que
-- justificou o formato longo la no silver_partida_time.
--
-- LEFT JOIN de proposito: a onda 3 ainda esta em andamento, entao a maioria
-- dos jogos ainda nao tem estatistica. As colunas vem nulas hoje e se
-- preenchem sozinhas conforme os arquivos chegam em data/raw.

with partidas as (

    select * from {{ ref('silver_partida_time') }}

),

estatisticas as (

    select * from {{ ref('bronze_fixture_statistics') }}

)

select
    partidas.fixture_id,
    partidas.data_hora_utc,
    partidas.season,
    partidas.league_id,
    partidas.league_nome,
    partidas.rodada,
    partidas.time_id,
    partidas.time_nome,
    partidas.adversario_id,
    partidas.adversario_nome,
    partidas.mando,
    partidas.gols_pro,
    partidas.gols_contra,
    partidas.resultado,
    partidas.pontos,

    eu.chutes_total        as chutes_pro,
    eu.chutes_no_gol       as chutes_no_gol_pro,
    eu.chutes_dentro_area  as chutes_dentro_area_pro,
    eu.posse_pct           as posse_pro,
    eu.escanteios          as escanteios_pro,
    eu.faltas              as faltas_pro,
    eu.impedimentos        as impedimentos_pro,
    eu.cartoes_amarelos    as amarelos_pro,
    eu.cartoes_vermelhos   as vermelhos_pro,
    eu.passes_total        as passes_pro,
    eu.precisao_passe_pct  as precisao_passe_pro,
    eu.defesas_goleiro     as defesas_pro,

    adversario.chutes_total       as chutes_contra,
    adversario.chutes_no_gol      as chutes_no_gol_contra,
    adversario.chutes_dentro_area as chutes_dentro_area_contra,
    adversario.posse_pct          as posse_contra,
    adversario.escanteios         as escanteios_contra,
    adversario.faltas             as faltas_contra,
    adversario.impedimentos       as impedimentos_contra,
    adversario.cartoes_amarelos   as amarelos_contra,
    adversario.cartoes_vermelhos  as vermelhos_contra,
    adversario.passes_total       as passes_contra,
    adversario.precisao_passe_pct as precisao_passe_contra,

    -- indicador util: o jogo ja tem estatistica extraida?
    eu.fixture_id is not null as tem_estatistica

from partidas
left join estatisticas as eu
       on eu.fixture_id = partidas.fixture_id
      and eu.team_id    = partidas.time_id
left join estatisticas as adversario
       on adversario.fixture_id = partidas.fixture_id
      and adversario.team_id    = partidas.adversario_id
