-- Os dois marts de evento contam os mesmos gols por caminhos diferentes: o
-- gold_gol_origem quebra por COMO o gol saiu, o gold_banco_impacto por QUEM o
-- fez. Se os dois nao fecharem, um dos dois esta perdendo ou duplicando lance.
--
-- A conta: todo gol do time tem autor titular, autor que entrou do banco, ou
-- autor nao identificado — menos os gols contra, que sao de jogador adversario
-- e por isso ficam fora da leitura por autor.
--
-- Esta invariante nao e teorica: foi ela que pegou o bug real. A primeira
-- versao usava `entrou_do_banco` do fixture_players, que esta 0% preenchida no
-- Paranaense, e jogava os 28 gols do estadual para "sem escalacao". A soma
-- continuava fechando com o total — o erro so aparecia na distribuicao. Por
-- isso o teste confere tambem que gols_sem_escalacao nao domina a amostra:
-- perder autor em mais da metade dos gols significa fonte errada, nao dado
-- faltando.

with juntos as (

    select
        origem.time_id,
        origem.time_nome,
        origem.league_id,
        origem.season,
        origem.gols,
        origem.gols_contra_a_favor,
        banco.gols_de_titular,
        banco.gols_de_reserva,
        banco.gols_sem_escalacao
    from {{ ref('gold_gol_origem') }} as origem
    join {{ ref('gold_banco_impacto') }} as banco
      on banco.time_id   = origem.time_id
     and banco.league_id = origem.league_id
     and banco.season    = origem.season

)

select
    *,
    'soma por autor nao fecha com o total de gols' as problema
from juntos
where gols_de_titular + gols_de_reserva + gols_sem_escalacao
      <> gols - gols_contra_a_favor

union all

select
    *,
    'autor desconhecido na maioria dos gols' as problema
from juntos
where gols - gols_contra_a_favor >= 4
  and gols_sem_escalacao > (gols - gols_contra_a_favor) / 2
