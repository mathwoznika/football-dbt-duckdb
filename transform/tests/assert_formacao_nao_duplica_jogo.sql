-- O gold_escalacao tem grao de JOGADOR: onze titulares mais reservas carregam
-- a mesma formacao. O gold_formacao_desempenho depende de um `distinct` para
-- voltar ao grao de partida antes de agregar — sem ele, cada jogo entraria uma
-- dezena de vezes e todo aproveitamento continuaria parecendo plausivel.
--
-- Este teste compara o total de jogos somado no mart com a contagem real de
-- partidas com escalacao. Ele tambem pega o caso raro de um mesmo time
-- aparecer com duas formacoes no mesmo jogo, que duplicaria a partida.

with do_mart as (

    select
        time_id,
        league_id,
        season,
        sum(jogos) as jogos
    from {{ ref('gold_formacao_desempenho') }}
    group by all

),

esperado as (

    select
        escalacoes.team_id as time_id,
        jogos.league_id,
        jogos.season,
        count(distinct escalacoes.fixture_id) as jogos
    from {{ ref('gold_escalacao') }} as escalacoes
    join {{ ref('silver_partida_time') }} as jogos
      on jogos.fixture_id = escalacoes.fixture_id
     and jogos.time_id    = escalacoes.team_id
    where escalacoes.formacao is not null
    group by all

)

select
    do_mart.time_id,
    do_mart.league_id,
    do_mart.season,
    do_mart.jogos  as jogos_no_mart,
    esperado.jogos as jogos_reais
from do_mart
join esperado
  on esperado.time_id   = do_mart.time_id
 and esperado.league_id = do_mart.league_id
 and esperado.season    = do_mart.season
where do_mart.jogos <> esperado.jogos
