-- Um jogador por linha, com os totais que existem NA NOSSA BASE.
--
-- LEIA ANTES DE USAR: isto nao e estatistica de carreira.
--
-- O endpoint fixture_players devolve os DOIS times de cada partida, e a onda 3
-- so cobre jogos do Coritiba. Logo, jogador de adversario aparece com as 1 ou 2
-- partidas que fez contra o Coxa — o Hulk tem uma. Dos 671 jogadores da base,
-- 317 tem um unico jogo e 292 tem de dois a tres.
--
-- Por isso `jogos_com_dado` nao e um detalhe: e o numero que diz se a media ao
-- lado significa alguma coisa. Toda tela que usar este model precisa mostra-lo
-- e oferecer filtro de amostra minima.
--
-- Para estatistica de temporada de verdade existe o /players?league&season, que
-- devolve todos os jogadores independentemente de adversario. Ele pagina, e
-- custaria ~270 requisicoes para as 9 ligas-temporada.

with por_temporada as (

    select * from {{ ref('gold_jogador_temporada') }}

)

select
    player_id,
    any_value(jogador_nome) as jogador_nome,

    -- O clube onde ele mais jogou dentro da base.
    -- O coalesce e obrigatorio: arg_max ignora linhas com a chave nula, e
    -- jogador que so foi relacionado sem entrar tem minutos nulo em TODAS as
    -- linhas. Sem isso, 217 dos 880 jogadores vinham sem clube — e como o
    -- Pydantic exige o campo, a lista inteira falhava na validacao.
    arg_max(team_id, coalesce(minutos, 0) * 1000 + jogos_com_dado)   as team_id,
    arg_max(team_nome, coalesce(minutos, 0) * 1000 + jogos_com_dado) as team_nome,
    -- quantos clubes diferentes ele veste na base (quase sempre 1)
    count(distinct team_id)     as clubes,
    mode(posicao)               as posicao,

    min(season) as primeira_temporada,
    max(season) as ultima_temporada,
    count(distinct season)      as temporadas,
    count(distinct league_id)   as competicoes,

    sum(jogos_com_dado)     as jogos_com_dado,
    sum(jogos_com_minutos)  as jogos_com_minutos,
    sum(jogos_titular)   as jogos_titular,
    sum(minutos)         as minutos,
    -- ponderada por jogos COM MINUTOS: nota so existe para quem entrou, e
    -- ponderar por relacionamentos inflaria o peso de temporada com muito banco
    round(
        sum(nota_media * jogos_com_minutos) / nullif(sum(jogos_com_minutos), 0), 2
    ) as nota_media,
    max(melhor_nota)     as melhor_nota,
    sum(gols)            as gols,
    sum(assistencias)    as assistencias,
    sum(chutes)          as chutes,
    sum(chutes_no_gol)   as chutes_no_gol,
    sum(desarmes)        as desarmes,
    sum(duelos)          as duelos,
    sum(duelos_ganhos)   as duelos_ganhos,
    sum(amarelos)        as amarelos,
    sum(vermelhos)       as vermelhos,
    sum(defesas)         as defesas,
    sum(gols_sofridos)   as gols_sofridos
from por_temporada
group by player_id
