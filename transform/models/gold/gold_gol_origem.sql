-- De onde vem o gol, e de onde vem o gol sofrido.
-- Grao: (time, competicao, temporada).
--
-- O gold_partida_evento tinha 1.542 lances lidos so na linha do tempo de uma
-- partida por vez. Aqui eles viram serie: quanto do ataque sai de penalti,
-- quanto e construido com assistencia, e o mesmo do lado que sofre.
--
-- A TABELA NAO RESPONDE ISSO. Dois times com 40 gols podem ter chegado la de
-- formas opostas — um com 10 penaltis, outro com 2 —, e a diferenca importa
-- porque penalti nao se repete na mesma proporcao no ano seguinte.
--
-- ATRIBUICAO DO GOL CONTRA, verificada e nao suposta: a API atribui o evento
-- ao time que se BENEFICIA, mas guarda no campo `jogador` o autor, que e do
-- outro time. Murillo, do Corinthians, aparece sob "Coritiba". A consequencia
-- pratica: somar gols por TIME e seguro — bate com o placar em 168 de 168
-- times-jogo conferidos — e somar por JOGADOR exige excluir 'Own Goal', senao
-- o autor recebe credito por um gol do adversario.
--
-- COBERTURA: so entram jogos com evento extraido, que sao os da onda 3. Um
-- jogo sem evento nao vira "zero gol", ele fica de fora — por isso o
-- jogos_com_evento sai no mart, e nao um total qualquer de partidas.
--
-- ASSISTENCIA NAO E REGISTRADA EM TODA COMPETICAO, e isso quase virou um numero
-- falso na tela. A fonte marca assistencia em 71% dos gols da Serie A 2022 e
-- 60% da de 2023, e em ZERO na Copa do Brasil e no Paranaense — em todos os
-- gols, de todos os times. Nao e um ataque que nunca teve passe decisivo: e a
-- competicao que nao tem o dado.
--
-- Por isso `assistencia_registrada` diz se aquela competicao-temporada tem o
-- dado, e as colunas de assistencia vem NULAS quando ela nao tem. Zero ali
-- seria indistinguivel de "ninguem assistiu", que e uma afirmacao que o dado
-- nao sustenta. Onde a competicao registra, zero e zero de verdade.

with com_evento as (

    select distinct fixture_id from {{ ref('gold_partida_evento') }}

),

jogos as (

    select jogos.*
    from {{ ref('silver_partida_time') }} as jogos
    join com_evento using (fixture_id)

),

-- Quebra de cada gol por (jogo, time beneficiado). Um 0 a 0 simplesmente nao
-- aparece aqui, e o coalesce la embaixo o traduz para zero — o que e correto,
-- porque sabemos que o jogo teve lances extraidos.
gols as (

    select
        fixture_id,
        team_id,
        count(*)                                              as gols,
        count(*) filter (where detalhe = 'Normal Goal')       as normais,
        count(*) filter (where detalhe = 'Penalty')           as penaltis,
        count(*) filter (where detalhe = 'Own Goal')          as contra,
        count(*) filter (where papel_relacionado = 'assistencia') as com_assistencia
    from {{ ref('gold_partida_evento') }}
    where tipo = 'Goal'
    group by all

),

-- A competicao-temporada registra assistencia? Basta uma no periodo inteiro
-- para o dado existir; nenhuma em dezenas de gols significa que a fonte nao
-- cobre aquela competicao.
cobertura_assistencia as (

    select
        league_id,
        season,
        count(*) filter (where papel_relacionado = 'assistencia') > 0
            as assistencia_registrada
    from {{ ref('gold_partida_evento') }}
    where tipo = 'Goal'
    group by all

)

select
    jogos.time_id,
    jogos.time_nome,
    jogos.league_id,
    jogos.league_nome,
    jogos.season,

    count(*) as jogos_com_evento,

    -- marcados
    sum(coalesce(pro.gols, 0))            as gols,
    sum(coalesce(pro.normais, 0))         as gols_normais,
    sum(coalesce(pro.penaltis, 0))        as gols_penalti,
    sum(coalesce(pro.contra, 0))          as gols_contra_a_favor,

    any_value(cobertura_assistencia.assistencia_registrada) as assistencia_registrada,
    case when any_value(cobertura_assistencia.assistencia_registrada)
         then sum(coalesce(pro.com_assistencia, 0)) end     as gols_com_assistencia,
    case when any_value(cobertura_assistencia.assistencia_registrada)
         then sum(coalesce(pro.gols, 0)) - sum(coalesce(pro.com_assistencia, 0))
         end                                                as gols_sem_assistencia,

    -- sofridos: e a mesma quebra, olhada da linha do adversario
    sum(coalesce(contra.gols, 0))         as sofridos,
    sum(coalesce(contra.normais, 0))      as sofridos_normais,
    sum(coalesce(contra.penaltis, 0))     as sofridos_penalti,
    sum(coalesce(contra.contra, 0))       as sofridos_contra_a_favor,

    -- Percentuais sobre o total da temporada, nao media de razao por jogo.
    -- Nulos quando o time nao marcou nada na amostra, que e a resposta honesta.
    round(100.0 * sum(coalesce(pro.penaltis, 0))
          / nullif(sum(coalesce(pro.gols, 0)), 0), 1)          as penalti_pct,
    case when any_value(cobertura_assistencia.assistencia_registrada)
         then round(100.0 * sum(coalesce(pro.com_assistencia, 0))
                    / nullif(sum(coalesce(pro.gols, 0)), 0), 1)
         end                                                   as assistidos_pct,
    round(100.0 * sum(coalesce(contra.penaltis, 0))
          / nullif(sum(coalesce(contra.gols, 0)), 0), 1)       as sofridos_penalti_pct

from jogos
left join gols as pro
       on pro.fixture_id = jogos.fixture_id
      and pro.team_id    = jogos.time_id
left join gols as contra
       on contra.fixture_id = jogos.fixture_id
      and contra.team_id    = jogos.adversario_id
left join cobertura_assistencia
       on cobertura_assistencia.league_id = jogos.league_id
      and cobertura_assistencia.season    = jogos.season
group by all
