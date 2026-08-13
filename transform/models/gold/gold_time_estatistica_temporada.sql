-- Perfil estatistico coletivo do time. Grao: (time, competicao, temporada).
--
-- Este e o primeiro mart a AGREGAR o silver_partida_estatistica. Ate aqui as
-- colunas da onda 3 so apareciam na tela de um jogo por vez: dado que custou 4
-- requisicoes por partida e nunca virou serie temporal.
--
-- COBERTURA E O CUIDADO PRINCIPAL DESTE MODEL. A onda 3 cobre so os jogos do
-- Coritiba, mas o fixture_statistics devolve os DOIS times de cada partida.
-- Entao o Coritiba tem dezenas de jogos aqui e cada adversario tem um ou dois.
-- E o mesmo ruido ja documentado para jogadores: ler isso como "o perfil do
-- Palmeiras em 2022" seria enganoso, porque e o perfil dele num jogo so.
--
-- Por isso jogos_na_competicao e cobertura_pct saem do mart, e nao do front:
-- quem consome precisa poder exigir amostra minima com um where, e a tela
-- precisa poder dizer de quantos jogos o numero saiu.
--
-- Duas ausencias que sao da fonte, nao daqui: o Paranaense (liga 606) nao tem
-- estatistica na API — os 17 arquivos extraidos voltaram vazios — e por isso
-- ele nao aparece neste mart. A Copa do Brasil aparece pela metade.

with partidas as (

    select * from {{ ref('silver_partida_estatistica') }}

),

-- Denominador honesto: TODOS os jogos da competicao, com estatistica ou sem.
-- E o que permite a tela mostrar "12 de 38 jogos" em vez de fingir cobertura.
totais as (

    select
        time_id,
        league_id,
        season,
        count(*) as jogos_na_competicao
    from partidas
    group by all

),

com_dado as (

    select * from partidas where tem_estatistica

),

agregado as (

    select
        time_id,
        time_nome,
        league_id,
        league_nome,
        season,
        count(*)                                as jogos_com_estatistica,
        min(data_hora_utc)::date                as primeiro_jogo,
        max(data_hora_utc)::date                as ultimo_jogo,

        -- resultado dentro da amostra que tem estatistica. Repetido de
        -- proposito: sem ele nao da para cruzar "posse alta" com "ponto
        -- ganho" sem uma segunda consulta.
        sum(pontos)                             as pontos,
        sum(gols_pro)                           as gols_pro,
        sum(gols_contra)                        as gols_contra,

        -- com a bola
        round(avg(posse_pro), 1)                as posse_media_pct,
        round(avg(passes_pro), 1)               as passes_por_jogo,
        round(avg(precisao_passe_pro), 1)       as precisao_passe_media_pct,

        -- producao ofensiva
        round(avg(chutes_pro), 2)               as chutes_por_jogo,
        round(avg(chutes_no_gol_pro), 2)        as chutes_no_gol_por_jogo,
        round(avg(chutes_dentro_area_pro), 2)   as chutes_na_area_por_jogo,
        round(avg(escanteios_pro), 2)           as escanteios_por_jogo,
        round(avg(impedimentos_pro), 2)         as impedimentos_por_jogo,

        -- o que o adversario produziu contra ele. O silver ja traz "contra" na
        -- mesma linha, entao o lado defensivo nao custa join nenhum.
        round(avg(chutes_contra), 2)            as chutes_sofridos_por_jogo,
        round(avg(chutes_no_gol_contra), 2)     as chutes_no_gol_sofridos_por_jogo,
        round(avg(chutes_dentro_area_contra), 2) as chutes_na_area_sofridos_por_jogo,
        round(avg(escanteios_contra), 2)        as escanteios_sofridos_por_jogo,
        round(avg(defesas_pro), 2)              as defesas_goleiro_por_jogo,

        -- disciplina
        round(avg(faltas_pro), 2)               as faltas_por_jogo,
        round(avg(faltas_contra), 2)            as faltas_sofridas_por_jogo,
        round(avg(amarelos_pro), 2)             as amarelos_por_jogo,
        sum(amarelos_pro)                       as amarelos,
        sum(vermelhos_pro)                      as vermelhos,

        -- numeradores e denominadores das taxas derivadas abaixo
        sum(chutes_pro)                         as _chutes,
        sum(chutes_no_gol_pro)                  as _chutes_no_gol,
        sum(chutes_contra)                      as _chutes_sofridos,
        sum(chutes_no_gol_contra)               as _chutes_no_gol_sofridos
    from com_dado
    group by all

)

select
    agregado.* exclude (_chutes, _chutes_no_gol, _chutes_sofridos, _chutes_no_gol_sofridos),

    totais.jogos_na_competicao,
    round(100.0 * agregado.jogos_com_estatistica / totais.jogos_na_competicao, 1)
        as cobertura_pct,

    -- Taxas sobre o TOTAL, nunca media de razao por jogo: um jogo de 2 chutes
    -- pesaria igual a um de 20 e a pontaria sairia errada.
    round(100.0 * agregado._chutes_no_gol / nullif(agregado._chutes, 0), 1)
        as pontaria_pct,
    round(100.0 * agregado.gols_pro / nullif(agregado._chutes_no_gol, 0), 1)
        as conversao_pct,
    round(100.0 * agregado._chutes_no_gol_sofridos / nullif(agregado._chutes_sofridos, 0), 1)
        as pontaria_adversario_pct,
    round(100.0 * agregado.gols_contra / nullif(agregado._chutes_no_gol_sofridos, 0), 1)
        as conversao_sofrida_pct,

    -- Quantos chutes o time precisou dar para fazer um gol. Nulo quando nao
    -- fez gol nenhum na amostra, que e a resposta honesta para uma divisao
    -- por zero.
    round(agregado._chutes / nullif(agregado.gols_pro, 0), 1)
        as chutes_por_gol,

    round(agregado.pontos / agregado.jogos_com_estatistica, 2) as pontos_por_jogo

from agregado
join totais
  on totais.time_id   = agregado.time_id
 and totais.league_id = agregado.league_id
 and totais.season    = agregado.season
