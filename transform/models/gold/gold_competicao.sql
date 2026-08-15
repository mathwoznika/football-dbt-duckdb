-- Retrato de uma competicao-temporada. Grao: (competicao, temporada).
--
-- Nasceu para tirar calculo de dentro da rota /competicoes, que montava este
-- mesmo resultado num CTE de trinta linhas dentro do endpoint. A regra da casa
-- e que a API so seleciona, filtra e ordena — logica nova vira model, onde fica
-- versionada e testada. O endpoint agora e um `select *`.
--
-- Serve a duas telas de uma vez: o indice de competicoes e a home, que precisa
-- dizer o que existe na base antes de o visitante clicar em qualquer coisa.
--
-- O CAMPEAO SAI DE DOIS LUGARES conforme o formato, e a ordem importa: em
-- torneio com mata-mata e quem venceu a final; em pontos corridos puro e o
-- primeiro colocado. O coalesce prefere a final porque quando ela existe e ela
-- que define o torneio — o Coritiba terminou a fase de grupos do Paranaense
-- 2022 em segundo e foi campeao.
--
-- COBERTURA DA ONDA 3 sai junto de proposito. E a unica tela onde da para ver,
-- de relance, que a Serie A 2022 esta completa e a Serie B 2024 nao — e sem
-- isso o visitante compara duas competicoes achando que a base e igual nas duas.

with jogos as (

    select
        league_id,
        league_nome,
        season,
        count(distinct fixture_id)   as jogos,
        count(distinct time_id)      as times,
        sum(gols_pro)                as gols,
        min(data_hora_utc)::date     as primeiro_jogo,
        max(data_hora_utc)::date     as ultimo_jogo
    from {{ ref('silver_partida_time') }}
    group by all

),

competicoes as (

    select distinct league_id, tipo from {{ ref('bronze_leagues') }}

),

final as (

    select league_id, season, vencedor_id
    from {{ ref('gold_confronto_eliminatorio') }}
    where ordem_fase = 7

),

lider as (

    select league_id, season, time_id
    from {{ ref('gold_classificacao') }}
    where posicao = 1

),

artilheiro as (

    select league_id, season, jogador, gols
    from {{ ref('gold_artilheiro') }}
    where posicao_artilharia = 1

),

-- Quantos jogos da competicao ja tem lance e estatistica extraidos. Conta
-- partidas distintas, nao linhas: o silver tem duas por jogo.
cobertura as (

    select
        partidas.league_id,
        partidas.season,
        count(distinct partidas.fixture_id) filter (
            where evento.fixture_id is not null
        ) as jogos_com_evento,
        count(distinct partidas.fixture_id) filter (
            where estatistica.fixture_id is not null
        ) as jogos_com_estatistica
    from {{ ref('silver_partida_time') }} as partidas
    left join (select distinct fixture_id from {{ ref('gold_partida_evento') }}) as evento
           on evento.fixture_id = partidas.fixture_id
    left join (select distinct fixture_id from {{ ref('gold_partida_estatistica') }}) as estatistica
           on estatistica.fixture_id = partidas.fixture_id
    group by all

)

select
    jogos.league_id,
    jogos.league_nome,
    jogos.season,
    competicoes.tipo,

    jogos.times,
    jogos.jogos,
    jogos.gols,
    round(1.0 * jogos.gols / nullif(jogos.jogos, 0), 2) as gols_por_jogo,
    jogos.primeiro_jogo,
    jogos.ultimo_jogo,

    coalesce(final.vencedor_id, lider.time_id) as campeao_id,
    campeao.team_nome                          as campeao,
    campeao.logo_url                           as campeao_logo,

    artilheiro.jogador as artilheiro,
    artilheiro.gols    as artilheiro_gols,

    final.vencedor_id is not null as tem_chaveamento,
    lider.time_id is not null     as tem_classificacao,

    coalesce(cobertura.jogos_com_evento, 0)      as jogos_com_evento,
    coalesce(cobertura.jogos_com_estatistica, 0) as jogos_com_estatistica,
    round(100.0 * coalesce(cobertura.jogos_com_evento, 0)
          / nullif(jogos.jogos, 0), 1)           as cobertura_evento_pct

from jogos
left join competicoes on competicoes.league_id = jogos.league_id
left join final
       on final.league_id = jogos.league_id and final.season = jogos.season
left join lider
       on lider.league_id = jogos.league_id and lider.season = jogos.season
left join artilheiro
       on artilheiro.league_id = jogos.league_id and artilheiro.season = jogos.season
left join cobertura
       on cobertura.league_id = jogos.league_id and cobertura.season = jogos.season
left join {{ ref('silver_time') }} as campeao
       on campeao.team_id = coalesce(final.vencedor_id, lider.time_id)
