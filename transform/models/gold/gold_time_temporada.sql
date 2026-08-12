-- Cabecalho da pagina de um time. Grao: (time, competicao, temporada).
--
-- Diferente do gold_classificacao, aqui entram TODAS as competicoes, copa
-- inclusive — porque a pagina do clube mostra a temporada inteira:
-- "Serie A: 16o, 42 pts | Copa do Brasil: 4 jogos | Paranaense: 37 pts".
-- A coluna posicao so vem preenchida onde faz sentido (pontos corridos).

with jogos as (

    select * from {{ ref('silver_partida_time') }}

),

-- Gaps and islands para a maior sequencia invicta: a soma acumulada de
-- derrotas so muda quando o time perde, entao ela funciona como um numero de
-- bloco. Dentro de cada bloco, contar os jogos sem derrota da o tamanho da
-- invencibilidade.
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
    classificacao.posicao
from agregado
left join invencibilidade
       on invencibilidade.time_id   = agregado.time_id
      and invencibilidade.league_id = agregado.league_id
      and invencibilidade.season    = agregado.season
left join {{ ref('gold_classificacao') }} as classificacao
       on classificacao.time_id   = agregado.time_id
      and classificacao.league_id = agregado.league_id
      and classificacao.season    = agregado.season
