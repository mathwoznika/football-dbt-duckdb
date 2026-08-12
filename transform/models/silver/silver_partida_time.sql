-- Fato de partida na PERSPECTIVA DE CADA TIME. Grao: (jogo, time).
--
-- O bronze tem o formato da API: uma linha por jogo, com colunas "casa" e
-- "fora". Isso obriga toda consulta sobre um time a testar os dois lados.
-- Aqui a mesma partida vira duas linhas, uma por time, e as colunas passam a
-- ser "a favor / contra". O case que voce escreveria em toda query mora aqui,
-- escrito uma vez so.
--
-- O model e UNIVERSAL de proposito: todos os times, nenhum filtro de clube.
-- O recorte do Coritiba pertence ao gold. Assim, quando a base crescer para o
-- futebol brasileiro inteiro, esta camada nao muda uma linha.
--
-- A fonte e o fixtures_liga (1.746 jogos) e nao o fixtures (168): o segundo e
-- subconjunto exato do primeiro, entao usar os dois duplicaria os jogos do
-- Coritiba e dobraria os pontos dele — sem nenhum erro aparecer.

with jogos as (

    select * from {{ ref('bronze_fixtures_liga') }}
    -- jogo sem bola rolada tem gols nulos e nao e resultado
    where status in ('FT', 'AET', 'PEN')

),

visao_casa as (

    select
        fixture_id,
        data_hora_utc,
        league_id,
        league_nome,
        season,
        rodada,
        estadio,
        'casa'       as mando,
        time_casa_id as time_id,
        time_casa    as time_nome,
        time_fora_id as adversario_id,
        time_fora    as adversario_nome,
        gols_casa    as gols_pro,
        gols_fora    as gols_contra,
        gols_casa_1t as gols_pro_1t,
        gols_fora_1t as gols_contra_1t
    from jogos

),

visao_fora as (

    select
        fixture_id,
        data_hora_utc,
        league_id,
        league_nome,
        season,
        rodada,
        estadio,
        'fora'       as mando,
        time_fora_id as time_id,
        time_fora    as time_nome,
        time_casa_id as adversario_id,
        time_casa    as adversario_nome,
        gols_fora    as gols_pro,
        gols_casa    as gols_contra,
        gols_fora_1t as gols_pro_1t,
        gols_casa_1t as gols_contra_1t
    from jogos

),

empilhado as (

    select * from visao_casa
    union all
    select * from visao_fora

)

select
    *,
    gols_pro - gols_contra as saldo,
    case
        when gols_pro > gols_contra then 'V'
        when gols_pro = gols_contra then 'E'
        else 'D'
    end as resultado,
    case
        when gols_pro > gols_contra then 3
        when gols_pro = gols_contra then 1
        else 0
    end as pontos
from empilhado
