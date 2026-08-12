-- Retrospecto entre dois times. Grao: (time, adversario).
--
-- Alimenta a pagina de confronto ("Coritiba x Santos: 12 jogos, 4 vitorias").
-- Como o silver tem uma linha por time por jogo, cada confronto aparece nos
-- dois sentidos — a linha do Coritiba contra o Santos e a do Santos contra o
-- Coritiba sao espelhadas. Isso e proposital: a API consulta sempre pelo lado
-- de quem esta na tela, com um where simples.

with jogos as (

    select * from {{ ref('silver_partida_time') }}

)

select
    time_id,
    time_nome,
    adversario_id,
    adversario_nome,
    count(*)                                              as jogos,
    sum(case when resultado = 'V' then 1 else 0 end)      as vitorias,
    sum(case when resultado = 'E' then 1 else 0 end)      as empates,
    sum(case when resultado = 'D' then 1 else 0 end)      as derrotas,
    sum(gols_pro)                                         as gols_pro,
    sum(gols_contra)                                      as gols_contra,
    sum(saldo)                                            as saldo,
    count(*) filter (where mando = 'casa')                as jogos_casa,
    sum(case when resultado = 'V' and mando = 'casa' then 1 else 0 end) as vitorias_casa,
    count(*) filter (where mando = 'fora')                as jogos_fora,
    sum(case when resultado = 'V' and mando = 'fora' then 1 else 0 end) as vitorias_fora,
    round(100.0 * sum(pontos) / (count(*) * 3), 1)        as aproveitamento_pct,
    min(data_hora_utc)::date                              as primeiro_confronto,
    max(data_hora_utc)::date                              as ultimo_confronto
from jogos
group by all
