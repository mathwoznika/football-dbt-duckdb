-- Disciplina do time e o que a expulsao custa.
-- Grao: (time, competicao, temporada).
--
-- O gold_cartao_momento responde QUANDO o cartao sai. Este responde quanto ele
-- pesa, e a coluna que justifica o model e `gols_sofridos_por_90_com_um_a_menos`.
--
-- POR QUE NORMALIZAR POR MINUTO, e nao contar gols sofridos apos a expulsao: a
-- contagem crua nao e comparavel com nada. Levar 10 gols depois de 21
-- expulsoes nao diz se e muito — depende de quanto tempo o time passou em
-- desvantagem, e uma expulsao aos 30 custa o triplo de uma aos 80. Dividindo
-- pelos minutos jogados com um a menos, o numero passa a ser lido contra o
-- proprio ritmo normal do time, que sai em `gols_sofridos_por_90_normal`.
--
-- APROXIMACAO ASSUMIDA: os minutos em desvantagem sao contados como 90 menos o
-- minuto da expulsao, ignorando acrescimo. Erra para menos, entao a taxa com um
-- a menos sai levemente superestimada — o vies e conhecido e conservador na
-- direcao errada, o que exige a ressalva na tela.
--
-- AMOSTRA PEQUENA, e a tela precisa dizer. O Coritiba tem 21 expulsoes em 19
-- jogos somando todas as competicoes; por temporada isso vira meia duzia.
-- `jogos_com_expulsao` esta no mart para que ninguem leia a taxa sem ver de
-- quantos jogos ela saiu.
--
-- COBERTURA PARCIAL: eventos, logo onda 3.

with partidas as (

    select * from {{ ref('silver_partida_time') }}

),

eventos as (

    select * from {{ ref('gold_partida_evento') }}

),

com_lance as (

    select distinct fixture_id from {{ ref('gold_partida_evento') }}

),

-- So partidas que tem lance extraido. Um jogo sem evento nao e "jogo sem
-- cartao"; ele simplesmente nao entra.
jogos as (

    select partidas.*
    from partidas
    join com_lance using (fixture_id)

),

cartoes as (

    select
        fixture_id,
        team_id,
        count(*) filter (where detalhe = 'Yellow Card') as amarelos,
        count(*) filter (where detalhe = 'Red Card')    as vermelhos,
        min(minuto)                                     as primeiro_cartao,
        count(*) filter (where minuto > 75)             as no_ultimo_quarto
    from eventos
    where tipo = 'Card'
    group by all

),

-- Momento em que o time ficou com um a menos. So a PRIMEIRA expulsao conta:
-- se levou duas, o periodo de desvantagem ja tinha comecado na primeira.
expulsoes as (

    select
        fixture_id,
        team_id,
        min(minuto) as minuto_expulsao
    from eventos
    where detalhe = 'Red Card'
    group by all

),

-- Gols sofridos depois da expulsao: gol do adversario com minuto maior que o
-- da vermelha, na mesma partida.
sofridos_depois as (

    select
        expulsoes.fixture_id,
        expulsoes.team_id,
        count(gols.minuto) as gols_sofridos_depois
    from expulsoes
    left join eventos as gols
           on gols.fixture_id = expulsoes.fixture_id
          and gols.tipo       = 'Goal'
          and gols.minuto     > expulsoes.minuto_expulsao
          and gols.team_id   <> expulsoes.team_id
    group by all

)

select
    jogos.time_id,
    jogos.time_nome,
    jogos.league_id,
    jogos.league_nome,
    jogos.season,

    count(*)                                        as jogos_com_evento,

    sum(coalesce(cartoes.amarelos, 0))              as amarelos,
    sum(coalesce(cartoes.vermelhos, 0))             as vermelhos,
    round(avg(coalesce(cartoes.amarelos, 0)
            + coalesce(cartoes.vermelhos, 0)), 2)   as cartoes_por_jogo,
    round(avg(cartoes.primeiro_cartao), 1)          as minuto_medio_primeiro_cartao,
    sum(coalesce(cartoes.no_ultimo_quarto, 0))      as cartoes_apos_75,

    -- o que o adversario levou nos mesmos jogos, para dar contraste
    sum(coalesce(adversario.amarelos, 0)
      + coalesce(adversario.vermelhos, 0))          as cartoes_do_adversario,

    -- expulsao e seu custo
    count(*) filter (where expulsoes.minuto_expulsao is not null)
                                                    as jogos_com_expulsao,
    sum(coalesce(sofridos_depois.gols_sofridos_depois, 0))
                                                    as gols_sofridos_apos_expulsao,
    sum(greatest(90 - expulsoes.minuto_expulsao, 0))
                                                    as minutos_com_um_a_menos,

    round(
        90.0 * sum(coalesce(sofridos_depois.gols_sofridos_depois, 0))
        / nullif(sum(greatest(90 - expulsoes.minuto_expulsao, 0)), 0), 2
    )                                               as gols_sofridos_por_90_com_um_a_menos,

    -- O ritmo normal, para a taxa acima ter contra o que ser lida. Usa todos
    -- os jogos com evento, inclusive os que tiveram expulsao — a alternativa
    -- (excluir) deixaria a base ainda menor sem mudar a ordem de grandeza.
    round(1.0 * sum(jogos.gols_contra) / count(*), 2)
                                                    as gols_sofridos_por_90_normal

from jogos
left join cartoes
       on cartoes.fixture_id = jogos.fixture_id
      and cartoes.team_id    = jogos.time_id
left join cartoes as adversario
       on adversario.fixture_id = jogos.fixture_id
      and adversario.team_id    = jogos.adversario_id
left join expulsoes
       on expulsoes.fixture_id = jogos.fixture_id
      and expulsoes.team_id    = jogos.time_id
left join sofridos_depois
       on sofridos_depois.fixture_id = jogos.fixture_id
      and sofridos_depois.team_id    = jogos.time_id
group by all
