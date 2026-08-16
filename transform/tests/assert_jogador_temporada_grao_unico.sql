-- O gold_jogador_temporada tem que ter UMA linha por (jogador, time,
-- competicao, temporada). Mais que isso significa que alguma coluna descritiva
-- vazou para a chave de agrupamento e partiu a temporada do jogador ao meio.
--
-- Ja aconteceu, e passou despercebido por muito tempo. O model usava
-- `group by all`, que inclui todas as colunas nao agregadas — entre elas
-- `jogador_nome`. Como a fonte devolve o mesmo player_id com grafias diferentes
-- entre partidas ("Nathan" e "Nathan Mendes", "Baralhas" e "Gabriel
-- Baralhas"), 36 jogadores viravam duas linhas com os jogos divididos.
--
-- O sintoma era silencioso: nenhum total geral mudava, porque a soma das duas
-- linhas continuava certa. Quebrava so a leitura por jogador — e as taxas por
-- 90 minutos, onde uma das linhas ficava com os minutos e a outra com zero.
--
-- Foi a comparacao entre DuckDB e Postgres que expos isso: com a chave de
-- ordenacao repetida, cada banco devolvia as linhas numa ordem, e o
-- verificar_bancos.py acusou diferenca onde deveria haver identidade.

select
    player_id,
    team_id,
    season,
    league_id,
    count(*) as linhas
from {{ ref('gold_jogador_temporada') }}
group by all
having count(*) > 1
