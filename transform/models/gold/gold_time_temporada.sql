-- Cabecalho da pagina de um time. Grao: (time, competicao, temporada).
--
-- Entram TODAS as competicoes, copa inclusive, porque a pagina do clube mostra
-- a temporada inteira.
--
-- Duas colunas aqui exigem cuidado e ja causaram leitura errada na tela:
--
--   maior_invencibilidade  e a MAIOR sequencia invicta da temporada, um recorde
--                          historico. Nao e "esta invicto ha N jogos".
--   posicao                e a colocacao na tabela de PONTOS CORRIDOS. Num
--                          torneio com mata-mata ela descreve a fase de grupos
--                          e nao a campanha: o Coritiba foi 2o no grupo do
--                          Paranaense 2022 e campeao do torneio.
--
-- Para o estado atual use jogos_sem_derrota / jogos_sem_vitoria.
-- Para a campanha em mata-mata use resultado_final.

with jogos as (

    select * from {{ ref('silver_partida_time') }}

),

-- Gaps and islands para a maior sequencia invicta: a soma acumulada de
-- derrotas so muda quando o time perde, entao funciona como numero de bloco.
blocos as (

    select
        *,
        sum(case when resultado = 'D' then 1 else 0 end) over (
            partition by time_id, league_id, season
            order by data_hora_utc
        ) as bloco
    from jogos

),

invencibilidade as (

    select
        time_id,
        league_id,
        season,
        max(tamanho) as maior_invencibilidade
    from (
        select
            time_id,
            league_id,
            season,
            bloco,
            count(*) filter (where resultado <> 'D') as tamanho
        from blocos
        group by all
    )
    group by all

),

-- Sequencia ATUAL: quantos jogos se passaram desde a ultima derrota e desde a
-- ultima vitoria. E a conta simples de "total de jogos menos a posicao do
-- ultimo jogo daquele tipo" — se nunca perdeu, o coalesce devolve 0 e a
-- sequencia vira o total.
ordenado as (

    select
        *,
        row_number() over (
            partition by time_id, league_id, season
            order by data_hora_utc
        ) as n
    from jogos

),

sequencia_atual as (

    select
        time_id,
        league_id,
        season,
        count(*) - coalesce(max(n) filter (where resultado = 'D'), 0) as jogos_sem_derrota,
        count(*) - coalesce(max(n) filter (where resultado = 'V'), 0) as jogos_sem_vitoria,
        arg_max(resultado, n)                                        as ultimo_resultado
    from ordenado
    group by all

),

-- Campanha no mata-mata: ate que fase o time chegou e o que aconteceu la.
participacoes as (

    select league_id, season, time_a_id as time_id, ordem_fase, fase_nome, vencedor_id
    from {{ ref('gold_confronto_eliminatorio') }}
    union all
    select league_id, season, time_b_id as time_id, ordem_fase, fase_nome, vencedor_id
    from {{ ref('gold_confronto_eliminatorio') }}

),

fase_mais_longe as (

    select league_id, season, time_id, ordem_fase, fase_nome, vencedor_id
    from participacoes
    qualify row_number() over (
        partition by league_id, season, time_id
        order by ordem_fase desc
    ) = 1

),

agregado as (

    select
        time_id,
        time_nome,
        league_id,
        league_nome,
        season,
        count(*)                                             as jogos,
        sum(case when resultado = 'V' then 1 else 0 end)     as vitorias,
        sum(case when resultado = 'E' then 1 else 0 end)     as empates,
        sum(case when resultado = 'D' then 1 else 0 end)     as derrotas,
        sum(gols_pro)                                        as gols_pro,
        sum(gols_contra)                                     as gols_contra,
        sum(saldo)                                           as saldo,
        sum(pontos)                                          as pontos,
        count(*) filter (where mando = 'casa')               as jogos_casa,
        sum(pontos) filter (where mando = 'casa')            as pontos_casa,
        count(*) filter (where mando = 'fora')               as jogos_fora,
        sum(pontos) filter (where mando = 'fora')            as pontos_fora,
        min(data_hora_utc)::date                             as primeiro_jogo,
        max(data_hora_utc)::date                             as ultimo_jogo
    from jogos
    group by all

)

select
    agregado.*,
    round(100.0 * agregado.pontos / (agregado.jogos * 3), 1) as aproveitamento_pct,

    invencibilidade.maior_invencibilidade,
    sequencia_atual.jogos_sem_derrota,
    sequencia_atual.jogos_sem_vitoria,
    sequencia_atual.ultimo_resultado,

    classificacao.posicao,

    -- A resposta honesta para "como foi a campanha". Prefere o mata-mata
    -- quando ele existe, porque e ele que define o torneio.
    case
        when fase_mais_longe.ordem_fase = 7
             and fase_mais_longe.vencedor_id = agregado.time_id then 'Campeão'
        when fase_mais_longe.ordem_fase = 7 then 'Vice-campeão'
        when fase_mais_longe.time_id is not null
             and fase_mais_longe.vencedor_id = agregado.time_id
             then 'Classificado — ' || fase_mais_longe.fase_nome
        when fase_mais_longe.time_id is not null
             then 'Eliminado — ' || fase_mais_longe.fase_nome
        when classificacao.posicao is not null
             then classificacao.posicao || 'º lugar'
    end as resultado_final,

    fase_mais_longe.fase_nome as fase_mais_avancada

from agregado
left join invencibilidade
       on invencibilidade.time_id   = agregado.time_id
      and invencibilidade.league_id = agregado.league_id
      and invencibilidade.season    = agregado.season
left join sequencia_atual
       on sequencia_atual.time_id   = agregado.time_id
      and sequencia_atual.league_id = agregado.league_id
      and sequencia_atual.season    = agregado.season
left join fase_mais_longe
       on fase_mais_longe.time_id   = agregado.time_id
      and fase_mais_longe.league_id = agregado.league_id
      and fase_mais_longe.season    = agregado.season
left join {{ ref('gold_classificacao') }} as classificacao
       on classificacao.time_id   = agregado.time_id
      and classificacao.league_id = agregado.league_id
      and classificacao.season    = agregado.season
