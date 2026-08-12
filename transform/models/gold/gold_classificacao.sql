-- Classificacao calculada a partir dos resultados. Universal: todos os times,
-- todas as competicoes de pontos corridos, todas as temporadas.
--
-- Por que recalcular, se a API ja entrega o standings pronto? Duas razoes:
-- 1) assim a tabela existe para qualquer corte que a gente queira depois
--    (uma janela de rodadas, so os jogos em casa, so o segundo turno);
-- 2) comparar o nosso numero com o oficial valida o pipeline inteiro de ponta
--    a ponta. Com o filtro de fase abaixo, os pontos batem 100%.

with jogos as (

    select * from {{ ref('silver_partida_time') }}

),

competicoes as (

    select distinct league_id, tipo from {{ ref('bronze_leagues') }}

),

-- Só a fase de pontos corridos entra na conta. Estadual e copa tem mata-mata,
-- e ponto de quartas, semi ou final nao compoe tabela de classificacao.
-- Foi exatamente essa diferenca que apareceu quando comparamos com o
-- standings oficial: a API contava 11 jogos do Paranaense e nos, 17.
elegiveis as (

    select jogos.*
    from jogos
    join competicoes on competicoes.league_id = jogos.league_id
    where competicoes.tipo = 'League'
      and (jogos.rodada like 'Regular Season%' or jogos.rodada like 'Group Stage%')

),

agregado as (

    select
        league_id,
        league_nome,
        season,
        time_id,
        time_nome,
        count(*)                                             as jogos,
        sum(case when resultado = 'V' then 1 else 0 end)     as vitorias,
        sum(case when resultado = 'E' then 1 else 0 end)     as empates,
        sum(case when resultado = 'D' then 1 else 0 end)     as derrotas,
        sum(gols_pro)                                        as gols_pro,
        sum(gols_contra)                                     as gols_contra,
        sum(saldo)                                           as saldo,
        sum(pontos)                                          as pontos,
        sum(case when mando = 'casa' then pontos else 0 end) as pontos_casa,
        sum(case when mando = 'fora' then pontos else 0 end) as pontos_fora
    from elegiveis
    group by all

)

select
    *,
    round(100.0 * pontos / (jogos * 3), 1) as aproveitamento_pct,
    row_number() over (
        partition by league_id, season
        order by pontos desc, vitorias desc, saldo desc, gols_pro desc
    ) as posicao
from agregado
