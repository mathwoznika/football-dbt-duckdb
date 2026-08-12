-- Dimensao de times. Uma linha por clube.
--
-- O bronze_teams repete o mesmo time em cada liga e temporada em que ele
-- apareceu (o Coritiba aparece 9 vezes). Aqui fica so o registro mais recente,
-- porque nome, estadio e capacidade mudam com o tempo e a gente quer o atual.
--
-- O qualify e um where que roda DEPOIS da window function — sem ele seria
-- preciso uma subquery so para filtrar o row_number.

with times as (

    select * from {{ ref('bronze_teams') }}

)

select
    team_id,
    team_nome,
    team_codigo,
    pais,
    fundacao,
    selecao,
    logo_url,
    venue_id,
    estadio,
    cidade,
    capacidade,
    gramado,
    season as season_do_registro
from times
qualify row_number() over (partition by team_id order by season desc) = 1
