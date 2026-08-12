-- Tabela de features para modelo de previsao. Grao: (jogo, time).
--
-- REGRA QUE GOVERNA ESTE MODEL: toda coluna de feature so pode conter
-- informacao disponivel ANTES da bola rolar. As janelas terminam em
-- "1 preceding" justamente por isso — se terminassem em "current row", a
-- feature carregaria o resultado que ela deveria prever. Isso e data leakage,
-- e produz um modelo com acuracia otima no treino e inutil na vida real.
--
-- As colunas de alvo ficam no fim, agrupadas e sinalizadas. Elas sao o que se
-- quer prever; nunca entram como entrada do modelo.
--
-- O time e o adversario aparecem na mesma linha: as features do adversario vem
-- de um self-join do proprio model, aproveitando que o silver tem uma linha
-- por time por jogo. E o pagamento do formato longo escolhido la atras.

with base as (

    select * from {{ ref('silver_partida_time') }}

),

com_janela as (

    select
        *,
        row_number()     over w                as jogo_n,
        sum(pontos)      over w_ate_anterior   as pontos_antes,
        sum(saldo)       over w_ate_anterior   as saldo_antes,
        sum(pontos)      over w5               as pts_5,
        sum(gols_pro)    over w5               as gols_pro_5,
        sum(gols_contra) over w5               as gols_contra_5,
        count(*)         over w5               as jogos_na_janela,
        date_diff('day', lag(data_hora_utc) over w, data_hora_utc) as dias_descanso
    from base
    window
        -- ordem cronologica do time dentro da competicao
        w as (
            partition by time_id, league_id, season
            order by data_hora_utc
        ),
        -- tudo que ele acumulou ATE o jogo anterior
        w_ate_anterior as (
            partition by time_id, league_id, season
            order by data_hora_utc
            rows between unbounded preceding and 1 preceding
        ),
        -- os 5 jogos anteriores, sem incluir o atual
        w5 as (
            partition by time_id, league_id, season
            order by data_hora_utc
            rows between 5 preceding and 1 preceding
        )

)

select
    -- ---------- chaves ----------
    eu.fixture_id,
    eu.data_hora_utc::date as data,
    eu.season,
    eu.league_id,
    eu.league_nome,
    eu.rodada,
    eu.time_id,
    eu.time_nome,
    eu.adversario_id,
    eu.adversario_nome,

    -- ---------- features do time ----------
    eu.mando,
    eu.jogo_n,
    eu.dias_descanso,
    eu.pontos_antes,
    eu.saldo_antes,
    eu.pts_5,
    eu.gols_pro_5,
    eu.gols_contra_5,
    eu.jogos_na_janela,

    -- ---------- features do adversario ----------
    adversario.jogo_n        as adv_jogo_n,
    adversario.dias_descanso as adv_dias_descanso,
    adversario.pontos_antes  as adv_pontos_antes,
    adversario.saldo_antes   as adv_saldo_antes,
    adversario.pts_5         as adv_pts_5,
    adversario.gols_pro_5    as adv_gols_pro_5,
    adversario.gols_contra_5 as adv_gols_contra_5,

    -- ---------- diferenciais ----------
    -- modelos de arvore costumam achar sozinhos, mas dar pronto ajuda os
    -- lineares e torna a feature interpretavel
    eu.pontos_antes - adversario.pontos_antes as dif_pontos_antes,
    eu.saldo_antes  - adversario.saldo_antes  as dif_saldo_antes,
    eu.pts_5        - adversario.pts_5        as dif_forma_5,

    -- ---------- ALVO: nao usar como entrada do modelo ----------
    eu.gols_pro   as alvo_gols_pro,
    eu.gols_contra as alvo_gols_contra,
    eu.resultado  as alvo_resultado,
    eu.pontos     as alvo_pontos

from com_janela as eu
join com_janela as adversario
  on adversario.fixture_id = eu.fixture_id
 and adversario.time_id    = eu.adversario_id
