-- Guarda as duas decisoes do gold_jogador_temporada que nao sao obvias.
--
-- 1. CONTADOR NUNCA E NULO. A fonte usa nulo onde deveria usar zero, e o
--    coalesce corrige isso. Se alguem remover o coalesce, o zagueiro que nunca
--    marcou volta a ter gols vazio, `gols + assistencias` vira nulo e a coluna
--    participacoes_90 some da tela sem nenhum erro aparecer.
--
-- 2. TAXA POR 90 SO EXISTE COM MINUTO. Ela e nula exatamente quando nao houve
--    minuto em campo — o que acontece com quem foi relacionado e ficou no
--    banco. Nulo em qualquer outra linha significa que o nullif pegou algo que
--    nao devia, e um numero faltando numa tabela de comparacao passa batido.
--
-- Note o que este teste NAO faz: nao verifica o valor da taxa. Ele protege a
-- forma, que e onde o erro seria silencioso.

with base as (

    select * from {{ ref('gold_jogador_temporada') }}

)

select
    player_id,
    team_id,
    season,
    league_id,
    minutos,
    gols,
    assistencias,
    gols_90,
    participacoes_90,
    'contador nulo' as problema
from base
where gols is null
   or assistencias is null
   or chutes is null
   or passes is null
   or desarmes is null
   or duelos is null
   or duelos_ganhos is null
   or amarelos is null
   or vermelhos is null

union all

select
    player_id,
    team_id,
    season,
    league_id,
    minutos,
    gols,
    assistencias,
    gols_90,
    participacoes_90,
    'taxa por 90 incoerente com os minutos' as problema
from base
where (coalesce(minutos, 0) > 0 and gols_90 is null)
   or (coalesce(minutos, 0) = 0 and gols_90 is not null)
