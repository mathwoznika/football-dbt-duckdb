-- Como o time se comporta em cada tempo, e o que ele faz com a vantagem.
-- Grao: (time, competicao, temporada).
--
-- Este mart nao depende da onda 3: o placar do intervalo vem no proprio
-- fixture, entao ele cobre os 1.746 jogos da base, nao os ~168 detalhados.
--
-- A coluna mais interessante e pontos_se_acabasse_no_1t. Comparada com os
-- pontos reais, ela responde uma pergunta que a tabela nao responde: o time
-- ganha ou perde campeonato no segundo tempo? A Serie A de 2023 do Coritiba
-- e o exemplo — ele desperdicou 4 vantagens de intervalo e reagiu 1 vez.

with jogos as (

    select * from {{ ref('silver_partida_time') }}
    -- jogo sem placar de intervalo nao entra na conta (sao 2 na base)
    where gols_pro_1t is not null and gols_contra_1t is not null

),

classificado as (

    select
        *,
        -- como estava no intervalo
        case
            when gols_pro_1t > gols_contra_1t then 'vencendo'
            when gols_pro_1t = gols_contra_1t then 'empatando'
            else 'perdendo'
        end as situacao_1t,
        -- pontos que teria levado se o jogo acabasse no intervalo
        case
            when gols_pro_1t > gols_contra_1t then 3
            when gols_pro_1t = gols_contra_1t then 1
            else 0
        end as pontos_1t,
        gols_pro - gols_pro_1t         as gols_pro_2t,
        gols_contra - gols_contra_1t   as gols_contra_2t
    from jogos

)

select
    time_id,
    time_nome,
    league_id,
    league_nome,
    season,
    count(*) as jogos,

    sum(gols_pro_1t)     as gols_1t,
    sum(gols_pro_2t)     as gols_2t,
    sum(gols_contra_1t)  as sofridos_1t,
    sum(gols_contra_2t)  as sofridos_2t,
    sum(gols_pro_1t) - sum(gols_contra_1t) as saldo_1t,
    sum(gols_pro_2t) - sum(gols_contra_2t) as saldo_2t,

    sum(pontos)    as pontos,
    sum(pontos_1t) as pontos_se_acabasse_no_1t,
    sum(pontos) - sum(pontos_1t) as diferenca_de_pontos,

    count(*) filter (where situacao_1t = 'vencendo')   as intervalos_vencendo,
    count(*) filter (where situacao_1t = 'empatando')  as intervalos_empatando,
    count(*) filter (where situacao_1t = 'perdendo')   as intervalos_perdendo,

    -- perdia no intervalo e virou o jogo
    count(*) filter (where situacao_1t = 'perdendo' and resultado = 'V') as viradas,
    -- perdia e pelo menos empatou
    count(*) filter (where situacao_1t = 'perdendo' and resultado = 'E') as reacoes,
    -- vencia no intervalo e nao levou os tres pontos
    count(*) filter (where situacao_1t = 'vencendo' and resultado = 'E') as vantagens_empatadas,
    count(*) filter (where situacao_1t = 'vencendo' and resultado = 'D') as vantagens_perdidas
from classificado
group by all
