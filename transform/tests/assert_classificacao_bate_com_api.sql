-- A classificacao que calculamos a partir dos resultados tem que bater com a
-- que a API entrega pronta. Sao dois caminhos independentes chegando ao mesmo
-- numero, entao divergir significa que algum deles quebrou.
--
-- Foi este teste, rodado a mao, que revelou que a API conta so a fase de
-- grupos do estadual enquanto nos contavamos o mata-mata junto.
--
-- Um teste singular no dbt e uma consulta que DEVE retornar zero linhas.
-- Cada linha devolvida e uma violacao.

select
    classificacao.league_id,
    classificacao.season,
    classificacao.time_nome,
    classificacao.pontos as nossos_pontos,
    oficial.pontos       as pontos_da_api
from {{ ref('gold_classificacao') }} as classificacao
join {{ ref('bronze_standings') }} as oficial
  on oficial.league_id = classificacao.league_id
 and oficial.season    = classificacao.season
 and oficial.team_id   = classificacao.time_id
where classificacao.pontos <> oficial.pontos
