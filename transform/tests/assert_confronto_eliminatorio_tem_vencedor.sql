-- Todo confronto de mata-mata tem que ter um vencedor identificado. Alguem
-- passou de fase, sempre.
--
-- Sao tres mecanismos em cascata: agregado de gols, depois penaltis, depois
-- presenca numa fase posterior. Se este teste falhar, e porque apareceu um
-- formato de competicao que nenhum dos tres cobre — vale investigar antes de
-- confiar no chaveamento na tela.

select
    league_nome,
    season,
    fase_nome,
    time_a_nome,
    gols_a,
    gols_b,
    time_b_nome
from {{ ref('gold_confronto_eliminatorio') }}
where vencedor_id is null
