-- O silver_partida_time tem que ter exatamente duas linhas por partida: uma
-- para cada time. Menos que isso significa que um lado se perdeu num join;
-- mais que isso significa duplicacao — foi o risco concreto de alimentar o
-- silver com fixtures e fixtures_liga ao mesmo tempo, ja que um e subconjunto
-- do outro. Este teste tranca essa porta.

select
    fixture_id,
    count(*) as linhas
from {{ ref('silver_partida_time') }}
group by fixture_id
having count(*) <> 2
