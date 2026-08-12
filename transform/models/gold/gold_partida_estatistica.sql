-- Estatistica coletiva de uma partida, um lado por linha.
-- Grao: (jogo, time).
--
-- Diferente do silver_partida_estatistica, que traz "pro/contra" na
-- perspectiva de um time, aqui os dois lados sao simetricos. A pagina de um
-- jogo compara os dois de igual para igual, e inverter um deles atrapalharia.

with estatisticas as (

    select * from {{ ref('bronze_fixture_statistics') }}

),

partidas as (

    select fixture_id, time_casa_id from {{ ref('gold_partida') }}

),

times as (

    select team_id, logo_url from {{ ref('silver_time') }}

)

select
    estatisticas.fixture_id,
    estatisticas.season,
    estatisticas.league_id,
    estatisticas.team_id,
    estatisticas.team_nome,
    times.logo_url,
    partidas.time_casa_id = estatisticas.team_id as e_do_mandante,

    estatisticas.posse_pct,
    estatisticas.chutes_total,
    estatisticas.chutes_no_gol,
    estatisticas.chutes_fora,
    estatisticas.chutes_bloqueados,
    estatisticas.chutes_dentro_area,
    estatisticas.chutes_fora_area,
    estatisticas.escanteios,
    estatisticas.impedimentos,
    estatisticas.faltas,
    estatisticas.cartoes_amarelos,
    estatisticas.cartoes_vermelhos,
    estatisticas.defesas_goleiro,
    estatisticas.passes_total,
    estatisticas.passes_certos,
    estatisticas.precisao_passe_pct
from estatisticas
left join partidas on partidas.fixture_id = estatisticas.fixture_id
left join times    on times.team_id       = estatisticas.team_id
