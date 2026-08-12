-- Chaveamento do mata-mata. Grao: um CONFRONTO (nao uma partida).
--
-- Por que este model existe: a classificacao por pontos nao descreve um
-- torneio eliminatorio. O Coritiba terminou a fase de grupos do Paranaense
-- 2022 em segundo e foi campeao — as duas coisas sao verdade, e so a segunda
-- responde "como foi a campanha".
--
-- Um confronto pode ter uma ou duas partidas: na Copa do Brasil as primeiras
-- fases sao de jogo unico e as finais de ida e volta; no Paranaense todas as
-- fases sao de ida e volta. O agrupamento abaixo aguenta os dois.
--
-- Para juntar as duas pernas do mesmo confronto usamos um PAR CANONICO:
-- least/greatest dos ids de time. Assim "Coritiba x Maringa" e
-- "Maringa x Coritiba" caem na mesma chave, independente de quem foi mandante.

with partidas as (

    select * from {{ ref('bronze_fixtures_liga') }}
    where status in ('FT', 'AET', 'PEN')
      and rodada not like 'Regular Season%'
      and rodada not like 'Group Stage%'

),

normalizado as (

    select
        league_id,
        league_nome,
        season,
        rodada as fase,
        least(time_casa_id, time_fora_id)    as time_a_id,
        greatest(time_casa_id, time_fora_id) as time_b_id,
        -- reorienta o placar para o par canonico
        case when time_casa_id < time_fora_id then gols_casa else gols_fora end as gols_a,
        case when time_casa_id < time_fora_id then gols_fora else gols_casa end as gols_b,
        case when time_casa_id < time_fora_id then penaltis_casa else penaltis_fora end as pen_a,
        case when time_casa_id < time_fora_id then penaltis_fora else penaltis_casa end as pen_b,
        data_hora_utc
    from partidas

),

-- numera as partidas do confronto em ordem de data: 1 = ida, 2 = volta
com_perna as (

    select
        *,
        row_number() over (
            partition by league_id, season, fase, time_a_id, time_b_id
            order by data_hora_utc
        ) as perna
    from normalizado

),

agregado as (

    select
        league_id,
        league_nome,
        season,
        fase,
        time_a_id,
        time_b_id,
        count(*)                 as partidas,
        sum(gols_a)              as gols_a,
        sum(gols_b)              as gols_b,
        -- o penalti acontece na ultima partida do confronto; max ignora os nulos
        max(pen_a)               as penaltis_a,
        max(pen_b)               as penaltis_b,

        -- Placar de cada perna. O agregado esconde a historia: um 3x3 no total
        -- pode ter sido 1x2 fora e 2x1 em casa, e quem le a tela quer ver isso.
        -- O filter funciona porque existe no maximo uma linha por perna.
        max(gols_a) filter (where perna = 1)         as ida_gols_a,
        max(gols_b) filter (where perna = 1)         as ida_gols_b,
        max(pen_a)  filter (where perna = 1)         as ida_penaltis_a,
        max(pen_b)  filter (where perna = 1)         as ida_penaltis_b,
        max(data_hora_utc) filter (where perna = 1)::date as ida_data,

        max(gols_a) filter (where perna = 2)         as volta_gols_a,
        max(gols_b) filter (where perna = 2)         as volta_gols_b,
        max(pen_a)  filter (where perna = 2)         as volta_penaltis_a,
        max(pen_b)  filter (where perna = 2)         as volta_penaltis_b,
        max(data_hora_utc) filter (where perna = 2)::date as volta_data,

        min(data_hora_utc)::date as data_inicio,
        max(data_hora_utc)::date as data_fim
    from com_perna
    group by all

),

com_vencedor as (

    select
        *,
        -- ordem da fase, para desenhar o chaveamento e saber ate onde o time foi
        case fase
            when '1st Round'      then 1
            when '2nd Round'      then 2
            when '3rd Round'      then 3
            when 'Round of 16'    then 4
            when 'Quarter-finals' then 5
            when 'Semi-finals'    then 6
            when 'Final'          then 7
        end as ordem_fase,
        case fase
            when '1st Round'      then 'Primeira fase'
            when '2nd Round'      then 'Segunda fase'
            when '3rd Round'      then 'Terceira fase'
            when 'Round of 16'    then 'Oitavas de final'
            when 'Quarter-finals' then 'Quartas de final'
            when 'Semi-finals'    then 'Semifinal'
            when 'Final'          then 'Final'
            else fase
        end as fase_nome,
        -- Quem passou: agregado dos gols e, se empatou, os penaltis.
        -- Fica nulo quando o agregado empata e nao houve disputa registrada —
        -- caso em que a regra de desempate (gol fora, melhor campanha) nao esta
        -- no dado e nao vamos inventar.
        case
            when gols_a > gols_b then time_a_id
            when gols_b > gols_a then time_b_id
            when penaltis_a > penaltis_b then time_a_id
            when penaltis_b > penaltis_a then time_b_id
        end as vencedor_id
    from agregado

),

-- Quais times estiveram em cada fase. Serve para o desempate abaixo.
presenca as (

    select league_id, season, ordem_fase, time_a_id as time_id from com_vencedor
    union all
    select league_id, season, ordem_fase, time_b_id as time_id from com_vencedor

),

resolvido as (

    select
        com_vencedor.*,
        coalesce(
            com_vencedor.vencedor_id,
            -- Quando o agregado empata e nao ha penalti registrado, quem passou
            -- e quem aparece numa fase POSTERIOR. Isso resolve qualquer regra de
            -- desempate — gol fora de casa, melhor campanha, sorteio — sem que a
            -- gente precise modelar nenhuma delas. O proprio calendario conta.
            (
                select presenca.time_id
                from presenca
                where presenca.league_id  = com_vencedor.league_id
                  and presenca.season     = com_vencedor.season
                  and presenca.ordem_fase > com_vencedor.ordem_fase
                  and presenca.time_id in (com_vencedor.time_a_id, com_vencedor.time_b_id)
                limit 1
            )
        ) as vencedor_final
    from com_vencedor

)

select
    resolvido.league_id,
    resolvido.league_nome,
    resolvido.season,
    resolvido.fase,
    resolvido.fase_nome,
    resolvido.ordem_fase,
    resolvido.partidas,
    resolvido.time_a_id,
    time_a.team_nome as time_a_nome,
    time_a.logo_url  as time_a_logo,
    resolvido.gols_a,
    resolvido.penaltis_a,
    resolvido.time_b_id,
    time_b.team_nome as time_b_nome,
    time_b.logo_url  as time_b_logo,
    resolvido.gols_b,
    resolvido.penaltis_b,

    resolvido.ida_data,
    resolvido.ida_gols_a,
    resolvido.ida_gols_b,
    resolvido.ida_penaltis_a,
    resolvido.ida_penaltis_b,
    resolvido.volta_data,
    resolvido.volta_gols_a,
    resolvido.volta_gols_b,
    resolvido.volta_penaltis_a,
    resolvido.volta_penaltis_b,
    resolvido.vencedor_final as vencedor_id,
    case
        when resolvido.vencedor_final = resolvido.time_a_id then resolvido.time_b_id
        when resolvido.vencedor_final = resolvido.time_b_id then resolvido.time_a_id
    end as eliminado_id,
    resolvido.data_inicio,
    resolvido.data_fim
from resolvido
left join {{ ref('silver_time') }} as time_a on time_a.team_id = resolvido.time_a_id
left join {{ ref('silver_time') }} as time_b on time_b.team_id = resolvido.time_b_id
