-- Retrospecto de um time sob cada arbitro.
-- Grao: (time, arbitro).
--
-- LEIA A RESSALVA ANTES DE TIRAR CONCLUSAO. Para o Coritiba, apenas 5 arbitros
-- apitaram 7 jogos ou mais; 24 apitaram um unico jogo. Diferenca de
-- aproveitamento com essa amostra e ruido, nao padrao. E conteudo de torcedor,
-- nao analise — e a tela precisa dizer isso.
--
-- Por isso cada linha carrega o BASELINE do proprio time ao lado: aproveitamento
-- e cartoes por jogo na competicao inteira. Sem o contraponto, "40% de
-- aproveitamento com o arbitro X" nao significa nada; comparado com os 33% que
-- o time faz no geral, pelo menos vira uma frase honesta.
--
-- Cobertura: o arbitro vem no proprio fixture, entao jogos, resultado e pontos
-- cobrem TODA a base. Faltas e cartoes vem da onda 3 e cobrem so parte — a
-- coluna jogos_com_estatistica diz quantos.

with partidas as (

    select
        partida.*,
        calendario.arbitro
    from {{ ref('silver_partida_estatistica') }} as partida
    join {{ ref('bronze_fixtures_liga') }} as calendario
      using (fixture_id)
    where calendario.arbitro is not null

),

-- media do proprio time, para servir de contraponto a cada arbitro
baseline as (

    select
        time_id,
        count(*)                                       as jogos_totais,
        round(100.0 * sum(pontos) / (count(*) * 3), 1) as aproveitamento_geral_pct,
        round(avg(amarelos_pro), 2)                    as amarelos_por_jogo_geral,
        round(avg(faltas_pro), 1)                      as faltas_por_jogo_geral
    from partidas
    group by all

),

por_arbitro as (

    select
        time_id,
        time_nome,
        arbitro,

        count(*)                                          as jogos,
        sum(case when resultado = 'V' then 1 else 0 end)   as vitorias,
        sum(case when resultado = 'E' then 1 else 0 end)   as empates,
        sum(case when resultado = 'D' then 1 else 0 end)   as derrotas,
        sum(gols_pro)                                     as gols_pro,
        sum(gols_contra)                                  as gols_contra,
        sum(pontos)                                       as pontos,
        round(100.0 * sum(pontos) / (count(*) * 3), 1)    as aproveitamento_pct,

        -- estas dependem da onda 3 e cobrem so parte dos jogos
        count(*) filter (where tem_estatistica)           as jogos_com_estatistica,
        sum(faltas_pro)                                   as faltas_pro,
        sum(faltas_contra)                                as faltas_contra,
        sum(amarelos_pro)                                 as amarelos_pro,
        sum(amarelos_contra)                              as amarelos_contra,
        sum(vermelhos_pro)                                as vermelhos_pro,
        sum(vermelhos_contra)                             as vermelhos_contra,
        round(avg(amarelos_pro), 2)                       as amarelos_por_jogo,
        round(avg(faltas_pro), 1)                         as faltas_por_jogo,

        min(data_hora_utc)::date                          as primeiro_jogo,
        max(data_hora_utc)::date                          as ultimo_jogo
    from partidas
    group by all

)

select
    por_arbitro.*,
    baseline.aproveitamento_geral_pct,
    baseline.amarelos_por_jogo_geral,
    baseline.faltas_por_jogo_geral,
    -- o numero que interessa: quanto foge da media do proprio time
    round(por_arbitro.aproveitamento_pct - baseline.aproveitamento_geral_pct, 1)
        as diferenca_aproveitamento,
    round(por_arbitro.amarelos_por_jogo - baseline.amarelos_por_jogo_geral, 2)
        as diferenca_amarelos
from por_arbitro
left join baseline using (time_id)
