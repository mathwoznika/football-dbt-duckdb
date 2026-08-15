-- Os fatos que valem uma manchete. Grao: (tipo de destaque).
--
-- Mart editorial, e o unico do projeto com essa natureza: em vez de responder
-- uma pergunta analitica, ele escolhe o que mostrar primeiro para quem chega.
-- A home precisava de futebol na abertura — recordes, goleadas, artilheiros —
-- e nao de metrica de pipeline.
--
-- POR QUE ISTO E UM MODEL E NAO UMA QUERY NA ROTA: cada destaque tem uma regra
-- de desempate e um piso de amostra proprios, e essas decisoes precisam ficar
-- versionadas. "Melhor campanha" e o exemplo — ver o comentario da secao.
--
-- Cada linha carrega os ids necessarios para a tela virar link: fixture_id leva
-- ao jogo, time_id leva ao clube. Um destaque que nao da para clicar e um
-- numero solto.

with partidas as (

    select * from {{ ref('gold_partida') }}

),

-- MAIOR GOLEADA. Desempate por total de gols: 8 a 0 e 8 a 1 tem a mesma
-- diferenca, e o segundo teve mais futebol.
goleada as (

    select
        'maior_goleada'                                    as tipo,
        1                                                  as ordem,
        'Maior goleada'                                    as rotulo,
        gols_casa || ' a ' || gols_fora                    as valor,
        time_casa || ' x ' || time_fora                    as detalhe,
        league_nome, season, fixture_id,
        case when gols_casa > gols_fora then time_casa_id else time_fora_id end as time_id,
        case when gols_casa > gols_fora then time_casa else time_fora end       as time_nome,
        case when gols_casa > gols_fora then time_casa_logo else time_fora_logo end as logo_url
    from partidas
    qualify row_number() over (
        order by abs(gols_casa - gols_fora) desc, gols_casa + gols_fora desc
    ) = 1

),

-- JOGO COM MAIS GOLS. Desempate pelo mais recente, sem criterio melhor.
mais_gols as (

    select
        'jogo_mais_gols'                                   as tipo,
        2                                                  as ordem,
        'Jogo com mais gols'                               as rotulo,
        (gols_casa + gols_fora) || ' gols'                 as valor,
        time_casa || ' ' || gols_casa || ' x ' || gols_fora || ' ' || time_fora as detalhe,
        league_nome, season, fixture_id,
        time_casa_id as time_id, time_casa as time_nome, time_casa_logo as logo_url
    from partidas
    qualify row_number() over (
        order by gols_casa + gols_fora desc, data_hora_utc desc
    ) = 1

),

-- MELHOR CAMPANHA, e aqui a escolha exige cuidado. Aproveitamento puro elegeria
-- o Atletico-PR com 93,9% no Paranaense — 31 pontos em 11 jogos de fase de
-- grupos. Nao e comparavel com uma Serie A de 38 rodadas, e coroar isso como
-- "melhor campanha" seria enganoso.
--
-- O criterio e PONTOS ABSOLUTOS com piso de 30 jogos: mede quem sustentou
-- desempenho por uma temporada inteira, que e o que a expressao significa.
campanha as (

    select
        'melhor_campanha'                                  as tipo,
        3                                                  as ordem,
        'Melhor campanha'                                  as rotulo,
        pontos || ' pontos'                                as valor,
        time_nome || ' — ' || vitorias || 'V ' || empates || 'E ' || derrotas || 'D' as detalhe,
        league_nome, season,
        null::bigint as fixture_id,
        time_id, time_nome,
        logo_url
    from {{ ref('gold_classificacao') }}
    where jogos >= 30
    qualify row_number() over (order by pontos desc, saldo desc) = 1

),

-- ARTILHEIRO ISOLADO: mais gols numa unica competicao-temporada.
artilheiro as (

    select
        'artilheiro'                                       as tipo,
        4                                                  as ordem,
        'Artilheiro isolado'                               as rotulo,
        gols || ' gols'                                    as valor,
        jogador || ' — ' || team_nome                      as detalhe,
        league_nome, season,
        null::bigint as fixture_id,
        team_id as time_id, team_nome as time_nome, team_logo as logo_url
    from {{ ref('gold_artilheiro') }}
    qualify row_number() over (order by gols desc, gols_por_jogo desc) = 1

),

-- MELHOR ATAQUE e MELHOR DEFESA, com o mesmo piso de 30 jogos da campanha.
-- Sem ele, uma fase de grupos curta venceria por acidente de calendario.
ataque as (

    select
        'melhor_ataque'                                    as tipo,
        5                                                  as ordem,
        'Melhor ataque'                                    as rotulo,
        gols_pro || ' gols'                                as valor,
        time_nome || ' — ' || round(1.0 * gols_pro / jogos, 2) || ' por jogo' as detalhe,
        league_nome, season,
        null::bigint as fixture_id,
        time_id, time_nome, logo_url
    from {{ ref('gold_classificacao') }}
    where jogos >= 30
    qualify row_number() over (order by gols_pro desc) = 1

),

defesa as (

    select
        'melhor_defesa'                                    as tipo,
        6                                                  as ordem,
        'Defesa menos vazada'                              as rotulo,
        gols_contra || ' sofridos'                         as valor,
        time_nome || ' em ' || jogos || ' jogos'           as detalhe,
        league_nome, season,
        null::bigint as fixture_id,
        time_id, time_nome, logo_url
    from {{ ref('gold_classificacao') }}
    where jogos >= 30
    qualify row_number() over (order by gols_contra asc) = 1

),

-- MAIOR INVENCIBILIDADE dentro de uma competicao-temporada. E um recorde da
-- temporada, nao uma sequencia que atravessa anos — o mart de origem calcula
-- por (time, competicao, temporada).
invencibilidade as (

    select
        'invencibilidade'                                  as tipo,
        7                                                  as ordem,
        'Maior invencibilidade'                            as rotulo,
        maior_invencibilidade || ' jogos'                   as valor,
        time_nome || ' sem perder'                         as detalhe,
        league_nome, season,
        null::bigint as fixture_id,
        time_id, time_nome,
        null::varchar as logo_url
    from {{ ref('gold_time_temporada') }}
    where jogos >= 30
    qualify row_number() over (order by maior_invencibilidade desc) = 1

)

select * from goleada
union all select * from mais_gols
union all select * from campanha
union all select * from artilheiro
union all select * from ataque
union all select * from defesa
union all select * from invencibilidade
order by ordem
