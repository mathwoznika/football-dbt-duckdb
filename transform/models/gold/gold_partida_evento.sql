-- Linha do tempo de uma partida. Grao: um evento.
--
-- O trabalho deste model e desambiguar os dois campos de jogador que a API
-- manda, porque o significado deles MUDA conforme o tipo do evento:
--
--   Goal   -> player = quem marcou,   assist = quem deu o passe
--   Card   -> player = quem levou,    assist = vazio
--   subst  -> player = quem SAIU,     assist = quem ENTROU
--
-- A convencao da substituicao e o contrario do que o nome sugere. Verificado
-- nas 580 substituicoes da base: em 580 delas o "assist" era reserva na
-- escalacao, e em 577 o "player" era titular (as 3 restantes sao reservas que
-- entraram e depois sairam).
--
-- Deixar isso para o front seria pedir que ele soubesse dessa peculiaridade.
-- Aqui as colunas saem com nome neutro e uma terceira diz o papel.

with eventos as (

    select * from {{ ref('bronze_fixture_events') }}

),

partidas as (

    select fixture_id, time_casa_id from {{ ref('gold_partida') }}

)

select
    eventos.fixture_id,
    eventos.season,
    eventos.league_id,
    eventos.minuto,
    eventos.acrescimo,
    eventos.tipo,
    eventos.detalhe,
    eventos.team_id,
    eventos.team_nome,
    partidas.time_casa_id = eventos.team_id as e_do_mandante,

    eventos.player_id    as jogador_id,
    eventos.jogador,
    eventos.assistente_id as relacionado_id,
    eventos.assistente    as relacionado,

    -- o que o segundo jogador representa neste evento
    case
        when eventos.tipo = 'subst' then 'entrou'
        when eventos.tipo = 'Goal' and eventos.assistente is not null then 'assistencia'
    end as papel_relacionado,

    -- rotulo pronto, para a tela nao precisar traduzir tipo em portugues
    case
        when eventos.tipo = 'Goal'  and eventos.detalhe ilike '%own goal%' then 'Gol contra'
        when eventos.tipo = 'Goal'  and eventos.detalhe ilike '%penalty%'  then 'Gol de pênalti'
        when eventos.tipo = 'Goal'  then 'Gol'
        when eventos.tipo = 'Card'  and eventos.detalhe ilike '%yellow%'   then 'Cartão amarelo'
        when eventos.tipo = 'Card'  and eventos.detalhe ilike '%red%'      then 'Cartão vermelho'
        when eventos.tipo = 'subst' then 'Substituição'
        when eventos.tipo = 'Var'   then 'VAR'
        else eventos.tipo
    end as rotulo,

    eventos.comentario
from eventos
left join partidas on partidas.fixture_id = eventos.fixture_id
