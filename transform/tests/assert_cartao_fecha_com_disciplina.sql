-- Os dois marts de cartao contam a mesma coisa por caminhos diferentes: o
-- gold_cartao_momento distribui por faixa de 15 minutos, o gold_disciplina
-- soma por temporada. Se a soma das faixas nao bater com o total, um dos dois
-- esta perdendo ou duplicando lance — tipicamente por join que multiplica.
--
-- O teste tambem confere a cobertura, e essa parte tem historia: o
-- jogos_com_evento nasceu contado DENTRO do grupo de faixa, o que respondia
-- "em quantos jogos houve cartao nesta faixa" em vez de "quantos jogos tem
-- lance extraido". A tela lia a primeira faixa e anunciava 13 de 38 numa
-- temporada 38 de 38. Numero coerente demais para chamar atencao sozinho, e
-- por isso ele agora tem que bater entre os dois marts.

with por_faixa as (

    select
        time_id,
        league_id,
        season,
        sum(tomados)              as cartoes,
        max(jogos_com_evento)     as jogos_com_evento
    from {{ ref('gold_cartao_momento') }}
    group by all

)

select
    por_faixa.time_id,
    por_faixa.league_id,
    por_faixa.season,
    por_faixa.cartoes           as cartoes_por_faixa,
    disciplina.amarelos + disciplina.vermelhos as cartoes_no_total,
    por_faixa.jogos_com_evento  as cobertura_faixa,
    disciplina.jogos_com_evento as cobertura_total
from por_faixa
join {{ ref('gold_disciplina') }} as disciplina
  on disciplina.time_id   = por_faixa.time_id
 and disciplina.league_id = por_faixa.league_id
 and disciplina.season    = por_faixa.season
where por_faixa.cartoes <> disciplina.amarelos + disciplina.vermelhos
   or por_faixa.jogos_com_evento <> disciplina.jogos_com_evento
