-- Estatistica coletiva por time em cada jogo. Grao: (jogo, time).
--
-- Este e o unico model de bronze que faz PIVOT. A API devolve as estatisticas
-- como pares chave-valor — [{type: "Total Shots", value: 17}, ...] — o que e
-- comodo para quem escreve a API e ruim para analise. Aqui viram colunas.
--
-- O campo "value" e de tipo misto: numero na maioria, texto com % em posse e
-- precisao de passe, e null quando nao houve. Por isso try_cast em tudo.

with resposta as (

    select * from {{ source('raw', 'fixture_statistics') }}

),

times as (

    select
        _meta.params.fixture as fixture_id,
        season,
        league,
        _meta.extraido_em    as extraido_em,
        unnest(response)     as item
    from resposta

),

estatisticas as (

    select
        fixture_id,
        season,
        league,
        extraido_em,
        item.team.id   as team_id,
        item.team.name as team_nome,
        unnest(item.statistics) as est
    from times

)

select
    fixture_id,
    season::int as season,
    league::int as league_id,
    team_id,
    team_nome,

    max(case when est.type = 'Shots on Goal'    then try_cast(est.value::varchar as int) end) as chutes_no_gol,
    max(case when est.type = 'Shots off Goal'   then try_cast(est.value::varchar as int) end) as chutes_fora,
    max(case when est.type = 'Total Shots'      then try_cast(est.value::varchar as int) end) as chutes_total,
    max(case when est.type = 'Blocked Shots'    then try_cast(est.value::varchar as int) end) as chutes_bloqueados,
    max(case when est.type = 'Shots insidebox'  then try_cast(est.value::varchar as int) end) as chutes_dentro_area,
    max(case when est.type = 'Shots outsidebox' then try_cast(est.value::varchar as int) end) as chutes_fora_area,
    max(case when est.type = 'Fouls'            then try_cast(est.value::varchar as int) end) as faltas,
    max(case when est.type = 'Corner Kicks'     then try_cast(est.value::varchar as int) end) as escanteios,
    max(case when est.type = 'Offsides'         then try_cast(est.value::varchar as int) end) as impedimentos,
    max(case when est.type = 'Yellow Cards'     then try_cast(est.value::varchar as int) end) as cartoes_amarelos,
    max(case when est.type = 'Red Cards'        then try_cast(est.value::varchar as int) end) as cartoes_vermelhos,
    max(case when est.type = 'Goalkeeper Saves' then try_cast(est.value::varchar as int) end) as defesas_goleiro,
    max(case when est.type = 'Total passes'     then try_cast(est.value::varchar as int) end) as passes_total,
    max(case when est.type = 'Passes accurate'  then try_cast(est.value::varchar as int) end) as passes_certos,

    -- estes dois chegam como texto no formato "52%"
    max(case when est.type = 'Ball Possession'
             then try_cast(replace(est.value::varchar, '%', '') as int) end) as posse_pct,
    max(case when est.type = 'Passes %'
             then try_cast(replace(est.value::varchar, '%', '') as int) end) as precisao_passe_pct,

    max(extraido_em) as extraido_em
from estatisticas
group by fixture_id, season, league, team_id, team_nome
