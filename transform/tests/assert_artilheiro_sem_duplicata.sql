-- Cada jogador pode aparecer uma unica vez por competicao e temporada.
--
-- Este teste existe por causa de um comportamento da fonte: jogador que trocou
-- de clube vem com duas entradas no array "statistics", e a API repete o mesmo
-- bloco de numeros sob os dois times. Sem a consolidacao do gold_artilheiro, o
-- Tiquinho Soares apareceria duas vezes na artilharia de 2023 — e somar daria
-- 34 gols a quem fez 17.
--
-- E o tipo de erro que nao quebra nada: produziria um artilheiro inventado no
-- topo da lista e ninguem perceberia.

select
    league_id,
    season,
    player_id,
    count(*) as linhas
from {{ ref('gold_artilheiro') }}
group by league_id, season, player_id
having count(*) > 1
