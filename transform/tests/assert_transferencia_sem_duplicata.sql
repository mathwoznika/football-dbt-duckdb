-- Cada movimentacao aparece uma unica vez.
--
-- A fonte repete: o mesmo jogador com o mesmo destino em dias consecutivos,
-- porque a API reprocessa e regrava. Sao 55 linhas de 1.020, e sem a
-- consolidacao do gold_transferencia a mesma contratacao contaria duas vezes
-- em qualquer agregacao por janela de transferencia.

select
    player_id,
    team_origem_id,
    team_destino_id,
    count(*) as linhas
from {{ ref('gold_transferencia') }}
group by player_id, team_origem_id, team_destino_id
having count(*) > 1
