-- Guarda contra data leakage na tabela de features.
--
-- No primeiro jogo de um time numa competicao nao existe historico anterior,
-- entao as features de janela TEM que estar vazias. Se alguem trocar o
-- "1 preceding" por "current row" numa janela, o proprio resultado do jogo
-- passa a vazar para dentro da feature e este teste acusa na hora.
--
-- E o tipo de bug que nao quebra nada, nao gera erro, e so aparece quando o
-- modelo tem acuracia boa demais no treino e falha na producao.

select
    fixture_id,
    time_id,
    jogo_n,
    pontos_antes,
    pts_5,
    jogos_na_janela
from {{ ref('gold_features_partida') }}
where jogo_n = 1
  and (
        pontos_antes is not null
     or pts_5 is not null
     or jogos_na_janela <> 0
  )
