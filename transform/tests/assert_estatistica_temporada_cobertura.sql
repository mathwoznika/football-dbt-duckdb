-- A cobertura e o que separa uma leitura honesta de uma inventada neste mart:
-- enquanto a onda 3 nao fecha, quase todo adversario tem um jogo so. Se
-- jogos_com_estatistica passar de jogos_na_competicao, o numerador vazou de
-- algum join e a tela passaria a mostrar "cobertura de 140%" — ou pior, uma
-- media diluida por linhas repetidas, que nao chama atencao nenhuma.

select
    time_id,
    league_id,
    season,
    jogos_com_estatistica,
    jogos_na_competicao,
    cobertura_pct
from {{ ref('gold_time_estatistica_temporada') }}
where jogos_com_estatistica > jogos_na_competicao
   or jogos_com_estatistica < 1
   or cobertura_pct > 100
