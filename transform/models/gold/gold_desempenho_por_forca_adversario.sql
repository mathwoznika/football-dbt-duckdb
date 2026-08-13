-- Como o time se sai contra cada faixa da tabela.
-- Grao: (time, competicao, temporada, faixa do adversario).
--
-- Ao contrario dos outros dois marts novos, este NAO depende da onda 3: sai do
-- placar dos 1.746 jogos, entao vale para os 153 times da base e nao so para o
-- Coritiba. Nenhuma ressalva de amostra.
--
-- A pergunta que ele responde nao esta em lugar nenhum hoje: o time perde
-- pontos contra quem briga em cima, ou tropeca contra quem esta embaixo? Duas
-- campanhas com os mesmos 50 pontos podem ter origens opostas.
--
-- FAIXA POR QUARTIL, nao por regra de competicao. Um `ntile(4)` sobre a
-- classificacao final divide a tabela em quatro partes iguais seja ela de 20
-- times (5 por faixa) ou de 12 (3 por faixa). Rotulo descritivo pela mesma
-- razao ja registrada no contexto: "G4" e "zona de rebaixamento" mudam por
-- competicao e por ano, "1o quarto da tabela" nao muda nunca.
--
-- CIRCULARIDADE, assumida: a posicao final do adversario ja inclui o resultado
-- contra este time. E como a analise e feita no futebol e a alternativa
-- (recalcular a tabela excluindo o confronto) responderia outra pergunta.
--
-- Mesmo recorte de fase do gold_classificacao — so pontos corridos. Ponto de
-- semifinal nao compoe tabela, entao tambem nao entra nesta leitura dela.

with competicoes as (

    select distinct league_id, tipo from {{ ref('bronze_leagues') }}

),

jogos as (

    select jogos.*
    from {{ ref('silver_partida_time') }} as jogos
    join competicoes on competicoes.league_id = jogos.league_id
    where competicoes.tipo = 'League'
      and (jogos.rodada like 'Regular Season%' or jogos.rodada like 'Group Stage%')

),

-- Quartil de cada time na sua competicao-temporada, com dois totais junto:
-- quantos times a competicao tinha e quantos couberam naquela faixa. "1o
-- quarto" so e legivel quando a tela pode dizer que sao 5 times de 20.
--
-- O tamanho da faixa sai daqui, e nao de uma divisao por 4 no front, porque a
-- divisao nem sempre e exata: hoje a base so tem competicoes de 20 e 12 times,
-- mas numa de 18 o ntile produz faixas de 5, 5, 4 e 4 — e o front estaria
-- afirmando um numero errado sem ter como saber.
faixas as (

    select
        *,
        count(*) over (partition by league_id, season, faixa) as times_na_faixa
    from (
        select
            league_id,
            season,
            time_id,
            posicao,
            ntile(4) over (
                partition by league_id, season
                order by posicao
            ) as faixa,
            count(*) over (partition by league_id, season) as times_na_competicao
        from {{ ref('gold_classificacao') }}
    )

)

select
    jogos.time_id,
    jogos.time_nome,
    jogos.league_id,
    jogos.league_nome,
    jogos.season,

    adversario.faixa                as faixa_adversario,
    case adversario.faixa
        when 1 then '1º quarto da tabela'
        when 2 then '2º quarto da tabela'
        when 3 then '3º quarto da tabela'
        when 4 then '4º quarto da tabela'
    end                             as faixa_rotulo,
    adversario.times_na_competicao,
    adversario.times_na_faixa,

    count(*)                                              as jogos,
    sum(case when jogos.resultado = 'V' then 1 else 0 end) as vitorias,
    sum(case when jogos.resultado = 'E' then 1 else 0 end) as empates,
    sum(case when jogos.resultado = 'D' then 1 else 0 end) as derrotas,
    sum(jogos.pontos)                                     as pontos,
    round(100.0 * sum(jogos.pontos) / (count(*) * 3), 1)  as aproveitamento_pct,

    sum(jogos.gols_pro)                                   as gols_pro,
    sum(jogos.gols_contra)                                as gols_contra,
    sum(jogos.saldo)                                      as saldo,

    sum(jogos.pontos) filter (where jogos.mando = 'casa') as pontos_casa,
    count(*)          filter (where jogos.mando = 'casa') as jogos_casa,
    sum(jogos.pontos) filter (where jogos.mando = 'fora') as pontos_fora,
    count(*)          filter (where jogos.mando = 'fora') as jogos_fora,

    -- posicao media de quem ele enfrentou dentro da faixa. Desempata leitura:
    -- 6 jogos contra o 1o quarto nao sao iguais se foram todos contra o 5o
    -- colocado ou todos contra o campeao.
    round(avg(adversario.posicao), 1)                     as posicao_media_adversario

from jogos
join faixas as adversario
  on adversario.league_id = jogos.league_id
 and adversario.season    = jogos.season
 and adversario.time_id   = jogos.adversario_id
group by all
