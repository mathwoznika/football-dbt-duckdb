-- Desempenho por formacao tatica.
-- Grao: (time, competicao, temporada, formacao).
--
-- A coluna `formacao` ja existia no gold_escalacao desde que o campinho foi
-- desenhado, mas so era lida um jogo por vez. Aqui ela vira serie: com qual
-- desenho o time entrou, quantas vezes, e o que colheu com cada um.
--
-- O grao da escalacao e (jogo, time, JOGADOR) — 11 titulares mais reservas
-- repetem a mesma formacao. O `distinct` antes do join e o que impede o mart
-- de contar cada partida onze vezes.
--
-- AMOSTRA. Vale a mesma ressalva do gold_time_estatistica_temporada: o lineup
-- so foi extraido para jogos do Coritiba, e o endpoint devolve os dois times.
-- O adversario aparece aqui com um jogo, e "4-3-3: 100% de aproveitamento" com
-- jogos = 1 nao e tendencia, e uma partida. A coluna `jogos` esta no mart
-- justamente para a tela poder exigir amostra minima.
--
-- Sem filtro de fase, ao contrario do gold_classificacao: a pergunta aqui e
-- sobre a escolha do tecnico, e ela vale tanto no returno quanto numa final.

with escalacoes as (

    -- uma linha por (jogo, time): o desenho com que aquele time entrou
    select distinct
        fixture_id,
        team_id,
        team_nome,
        formacao,
        tecnico
    from {{ ref('gold_escalacao') }}
    where formacao is not null

),

jogos as (

    select * from {{ ref('silver_partida_time') }}

)

select
    escalacoes.team_id   as time_id,
    escalacoes.team_nome as time_nome,
    jogos.league_id,
    jogos.league_nome,
    jogos.season,
    escalacoes.formacao,

    count(*)                                           as jogos,
    sum(case when jogos.resultado = 'V' then 1 else 0 end) as vitorias,
    sum(case when jogos.resultado = 'E' then 1 else 0 end) as empates,
    sum(case when jogos.resultado = 'D' then 1 else 0 end) as derrotas,
    sum(jogos.pontos)                                  as pontos,
    round(100.0 * sum(jogos.pontos) / (count(*) * 3), 1) as aproveitamento_pct,

    sum(jogos.gols_pro)                                as gols_pro,
    sum(jogos.gols_contra)                             as gols_contra,
    sum(jogos.saldo)                                   as saldo,
    round(avg(jogos.gols_pro), 2)                      as gols_por_jogo,
    round(avg(jogos.gols_contra), 2)                   as gols_sofridos_por_jogo,
    count(*) filter (where jogos.gols_contra = 0)      as jogos_sem_sofrer_gol,

    count(*) filter (where jogos.mando = 'casa')       as jogos_casa,
    count(*) filter (where jogos.mando = 'fora')       as jogos_fora,

    -- quem escalou assim. Sao poucos por temporada, entao a lista cabe na
    -- celula e evita um join do lado de quem consulta.
    string_agg(distinct escalacoes.tecnico, ', ')      as tecnicos,

    min(jogos.data_hora_utc)::date                     as primeiro_jogo,
    max(jogos.data_hora_utc)::date                     as ultimo_jogo

from escalacoes
join jogos
  on jogos.fixture_id = escalacoes.fixture_id
 and jogos.time_id    = escalacoes.team_id
group by all
