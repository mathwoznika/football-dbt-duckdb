-- O que o banco produz, e quando o tecnico mexe.
-- Grao: (time, competicao, temporada).
--
-- Duas perguntas que nenhuma tela do projeto responde hoje, e que so existem
-- porque o evento de substituicao guarda o MINUTO: quanto do ataque sai de quem
-- entrou, e a que altura do jogo as trocas acontecem. Na base, 37 dos 228 gols
-- com autor identificado — 16% — vieram do banco.
--
-- CONVENCAO INVERTIDA DA SUBSTITUICAO, ja resolvida no gold_partida_evento: no
-- evento `subst` o campo `jogador` e quem SAI e o `relacionado` e quem ENTRA.
-- Aqui isso ja chega traduzido em papel_relacionado = 'entrou'.
--
-- POR QUE 'Own Goal' FICA DE FORA da conta por jogador: a API atribui o evento
-- ao time beneficiado mas guarda o autor, que e do outro time. Juntar autor com
-- escalacao devolveria a linha do time errado. Como time, o gol contra continua
-- valendo — ele so nao entra na leitura de titular x reserva.
--
-- OS DOIS GOLS SEM ESCALACAO sao reais e ficam visiveis em gols_sem_escalacao:
-- ha um jogo com evento extraido e sem lineup, entao o autor nao casa com
-- ninguem. Escondê-los faria titular mais reserva nao fechar com o total, e a
-- tela mentiria por omissao.
--
-- ASSISTENCIA SO EXISTE EM PARTE DAS COMPETICOES: a fonte registra na Serie A
-- e nao registra na Copa do Brasil nem no Paranaense, em nenhum gol de nenhum
-- time. `assistencias_de_reserva` vem nula onde nao ha o dado, em vez de zero —
-- zero seria indistinguivel de "o banco nunca deu passe decisivo". Ver o
-- gold_gol_origem, que carrega a mesma flag.

with com_evento as (

    select distinct fixture_id from {{ ref('gold_partida_evento') }}

),

jogos as (

    select jogos.*
    from {{ ref('silver_partida_time') }} as jogos
    join com_evento using (fixture_id)

),

eventos as (

    select * from {{ ref('gold_partida_evento') }}

),

-- POR QUE `titular` E NAO `entrou_do_banco`, que tem o nome mais obvio: as
-- duas colunas do gold_escalacao respondem quase a mesma coisa, mas vem de
-- fontes diferentes. `entrou_do_banco` sai do fixture_players e esta 0%
-- preenchida no Paranaense e 50% na Copa do Brasil; `titular` sai do proprio
-- lineup e esta 100% preenchida em todas as ligas.
--
-- Usar a primeira jogava 28 dos 28 gols do estadual para "sem escalacao", como
-- se o lineup nao existisse — e ele existe. Para quem MARCOU, `titular = false`
-- significa que ele estava entre os reservas e portanto entrou: a inferencia e
-- segura justamente porque o gol prova que ele pisou em campo.
--
-- A regra geral que fica: entre duas colunas que respondem o mesmo, prefira a
-- que vem da fonte mais proxima do fato.
escalados as (

    select fixture_id, player_id, not titular as entrou_do_banco
    from {{ ref('gold_escalacao') }}

),

-- Gols com autor identificavel, marcados de quem entrou do banco.
gols as (

    select
        eventos.fixture_id,
        eventos.team_id,
        escalados.entrou_do_banco
    from eventos
    left join escalados
           on escalados.fixture_id = eventos.fixture_id
          and escalados.player_id  = eventos.jogador_id
    where eventos.tipo = 'Goal'
      and eventos.detalhe <> 'Own Goal'

),

gols_por_jogo as (

    select
        fixture_id,
        team_id,
        count(*) filter (where entrou_do_banco)             as de_reserva,
        count(*) filter (where entrou_do_banco is false)    as de_titular,
        count(*) filter (where entrou_do_banco is null)     as sem_escalacao
    from gols
    group by all

),

-- Assistencia de quem entrou: o passe decisivo mora no `relacionado`.
assistencias as (

    select
        eventos.fixture_id,
        eventos.team_id,
        count(*) filter (where escalados.entrou_do_banco) as de_reserva
    from eventos
    left join escalados
           on escalados.fixture_id = eventos.fixture_id
          and escalados.player_id  = eventos.relacionado_id
    where eventos.tipo = 'Goal'
      and eventos.papel_relacionado = 'assistencia'
    group by all

),

cobertura_assistencia as (

    select
        league_id,
        season,
        count(*) filter (where papel_relacionado = 'assistencia') > 0
            as assistencia_registrada
    from eventos
    where tipo = 'Goal'
    group by all

),

-- Substituicoes: quantas, e em que minuto. A primeira de cada jogo sai numa
-- coluna propria porque e ela que descreve o tecnico — a media de todas mistura
-- a troca tatica do intervalo com a queima de tempo aos 88.
trocas as (

    select
        fixture_id,
        team_id,
        count(*)   as substituicoes,
        avg(minuto) as minuto_medio,
        min(minuto) as minuto_da_primeira
    from eventos
    where tipo = 'subst' and papel_relacionado = 'entrou'
    group by all

)

select
    jogos.time_id,
    jogos.time_nome,
    jogos.league_id,
    jogos.league_nome,
    jogos.season,

    count(*) as jogos_com_evento,

    sum(coalesce(gols_por_jogo.de_titular, 0))     as gols_de_titular,
    sum(coalesce(gols_por_jogo.de_reserva, 0))     as gols_de_reserva,
    sum(coalesce(gols_por_jogo.sem_escalacao, 0))  as gols_sem_escalacao,
    case when any_value(cobertura_assistencia.assistencia_registrada)
         then sum(coalesce(assistencias.de_reserva, 0)) end
        as assistencias_de_reserva,

    round(100.0 * sum(coalesce(gols_por_jogo.de_reserva, 0))
          / nullif(sum(coalesce(gols_por_jogo.de_titular, 0))
                 + sum(coalesce(gols_por_jogo.de_reserva, 0)), 0), 1)
        as gols_do_banco_pct,

    sum(coalesce(trocas.substituicoes, 0))                       as substituicoes,
    round(avg(trocas.substituicoes), 2)                          as substituicoes_por_jogo,
    round(avg(trocas.minuto_medio), 1)                           as minuto_medio_substituicao,
    round(avg(trocas.minuto_da_primeira), 1)                     as minuto_medio_primeira_troca,
    count(*) filter (where trocas.minuto_da_primeira <= 45)      as jogos_com_troca_no_1t

from jogos
left join gols_por_jogo
       on gols_por_jogo.fixture_id = jogos.fixture_id
      and gols_por_jogo.team_id    = jogos.time_id
left join assistencias
       on assistencias.fixture_id = jogos.fixture_id
      and assistencias.team_id    = jogos.time_id
left join trocas
       on trocas.fixture_id = jogos.fixture_id
      and trocas.team_id    = jogos.time_id
left join cobertura_assistencia
       on cobertura_assistencia.league_id = jogos.league_id
      and cobertura_assistencia.season    = jogos.season
group by all
