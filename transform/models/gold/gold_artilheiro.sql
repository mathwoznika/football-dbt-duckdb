-- Artilharia de cada competicao e temporada.
-- Grao: (liga, temporada, jogador) — uma linha por artilheiro.
--
-- AQUI SE RESOLVE UMA DUPLICIDADE DA FONTE, e vale entender antes de mexer.
--
-- Jogador que trocou de clube na temporada vem com duas entradas no array
-- "statistics", e a API REPETE o mesmo bloco de numeros sob os dois times. O
-- Tiquinho Soares em 2023 aparece como Botafogo 33 jogos / 17 gols e Santos
-- 32 jogos / 17 gols — ele nao jogou no Santos naquele ano, e 33 + 32 = 65
-- partidas seria impossivel num campeonato de 38 rodadas.
--
-- Somar daria 34 gols a ele. A propria ranking da API o lista com 17, o que
-- confirma que o total verdadeiro e o MAXIMO das entradas, nao a soma.
--
-- Entao: pegamos a entrada com mais partidas (a que representa o clube onde
-- ele de fato jogou) e o maior numero de gols. Sao 4 jogadores em 176 nesta
-- base, mas o erro seria invisivel — apareceria como um artilheiro inventado
-- no topo da lista.

with entradas as (

    select * from {{ ref('bronze_topscorers') }}

),

competicoes as (

    select distinct league_id, league_nome from {{ ref('bronze_leagues') }}

),

consolidado as (

    select
        league_id,
        season,
        player_id,
        any_value(jogador)       as jogador,
        any_value(idade)         as idade,
        any_value(nacionalidade) as nacionalidade,
        any_value(foto_url)      as foto_url,

        -- o clube onde ele mais atuou naquela temporada
        arg_max(team_id, jogos)   as team_id,
        arg_max(team_nome, jogos) as team_nome,
        arg_max(team_logo, jogos) as team_logo,

        -- max e nao sum: ver a explicacao no topo do arquivo
        max(gols)             as gols,
        max(assistencias)     as assistencias,
        max(jogos)            as jogos,
        max(jogos_titular)    as jogos_titular,
        max(minutos)          as minutos,
        max(nota_media)       as nota_media,
        max(chutes)           as chutes,
        max(chutes_no_gol)    as chutes_no_gol,
        max(amarelos)         as amarelos,
        max(vermelhos)        as vermelhos,
        max(penaltis_convertidos) as penaltis_convertidos,
        any_value(posicao)    as posicao,
        count(*) > 1          as teve_mais_de_um_clube
    from entradas
    group by all

)

select
    consolidado.*,
    competicoes.league_nome,
    -- gols por jogo, para separar quem fez muito de quem jogou muito
    case
        when consolidado.jogos > 0
        then round(consolidado.gols * 1.0 / consolidado.jogos, 2)
    end as gols_por_jogo,
    row_number() over (
        partition by consolidado.league_id, consolidado.season
        order by consolidado.gols desc, consolidado.minutos asc nulls last
    ) as posicao_artilharia
from consolidado
left join competicoes on competicoes.league_id = consolidado.league_id
