-- Desempenho por tecnico. Grao: (tecnico, time, competicao, temporada).
--
-- A fonte e a ESCALACAO, nao o cadastro de tecnicos. O bronze_coachs traz a
-- carreira declarada, mas com datas so no dia 01, muitos "fim" nulos mesmo
-- para passagens encerradas e periodos sem ninguem — juntar jogo com aquilo
-- por intervalo de data daria resultado errado.
-- O fixture_lineups diz quem estava no banco NAQUELE jogo. E verdade de campo.
--
-- Tambem depende da onda 3: cobre apenas os jogos com escalacao ja extraida.

with escalacoes as (

    -- uma linha por (jogo, time): o lineup repete o tecnico em cada jogador
    select distinct
        fixture_id,
        team_id,
        coach_id,
        tecnico
    from {{ ref('bronze_fixture_lineups') }}

),

jogos as (

    select * from {{ ref('silver_partida_time') }}

)

select
    escalacoes.coach_id,
    escalacoes.tecnico,
    jogos.time_id,
    jogos.time_nome,
    jogos.season,
    jogos.league_id,
    jogos.league_nome,

    count(*)                                              as jogos,
    sum(case when jogos.resultado = 'V' then 1 else 0 end) as vitorias,
    sum(case when jogos.resultado = 'E' then 1 else 0 end) as empates,
    sum(case when jogos.resultado = 'D' then 1 else 0 end) as derrotas,
    sum(jogos.gols_pro)                                   as gols_pro,
    sum(jogos.gols_contra)                                as gols_contra,
    sum(jogos.pontos)                                     as pontos,
    round(100.0 * sum(jogos.pontos) / (count(*) * 3), 1)  as aproveitamento_pct,
    min(jogos.data_hora_utc)::date                        as primeiro_jogo,
    max(jogos.data_hora_utc)::date                        as ultimo_jogo
from jogos
join escalacoes
  on escalacoes.fixture_id = jogos.fixture_id
 and escalacoes.team_id    = jogos.time_id
group by all
