-- Atuacao de um jogador em cada partida, com o contexto do jogo junto.
-- Grao: (jogo, jogador).
--
-- O bronze_fixture_players tem a atuacao mas nao sabe contra quem foi, nem o
-- placar. Aqui entra o cabecalho da partida ao lado, para a pagina do jogador
-- mostrar "7.8 contra o Palmeiras, vitoria por 2x1" numa linha so.

with atuacoes as (

    select * from {{ ref('bronze_fixture_players') }}

),

partidas as (

    select * from {{ ref('gold_partida') }}

)

select
    atuacoes.fixture_id,
    atuacoes.player_id,
    atuacoes.jogador_nome,
    atuacoes.team_id,
    atuacoes.team_nome,

    partidas.data,
    partidas.season,
    partidas.league_id,
    partidas.league_nome,
    partidas.rodada,

    -- quem era o adversario e como terminou, do ponto de vista do time dele
    case when partidas.time_casa_id = atuacoes.team_id
         then partidas.time_fora_id else partidas.time_casa_id end as adversario_id,
    case when partidas.time_casa_id = atuacoes.team_id
         then partidas.time_fora else partidas.time_casa end       as adversario_nome,
    case when partidas.time_casa_id = atuacoes.team_id
         then 'casa' else 'fora' end                               as mando,
    case when partidas.time_casa_id = atuacoes.team_id
         then partidas.gols_casa else partidas.gols_fora end       as gols_time,
    case when partidas.time_casa_id = atuacoes.team_id
         then partidas.gols_fora else partidas.gols_casa end       as gols_adversario,

    atuacoes.minutos,
    atuacoes.posicao,
    atuacoes.nota,
    atuacoes.entrou_do_banco,
    atuacoes.gols,
    atuacoes.assistencias,
    atuacoes.chutes,
    atuacoes.chutes_no_gol,
    atuacoes.passes,
    atuacoes.passes_decisivos,
    atuacoes.precisao_passe,
    atuacoes.desarmes,
    atuacoes.interceptacoes,
    atuacoes.duelos,
    atuacoes.duelos_ganhos,
    atuacoes.dribles_tentados,
    atuacoes.dribles_certos,
    atuacoes.faltas_cometidas,
    atuacoes.faltas_sofridas,
    atuacoes.amarelos,
    atuacoes.vermelhos,
    atuacoes.defesas,
    atuacoes.gols_sofridos
from atuacoes
join partidas on partidas.fixture_id = atuacoes.fixture_id
