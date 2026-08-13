-- Pagina de elenco: desempenho de cada jogador por competicao e temporada.
--
-- Depende da onda 3 (fixture_players), que ainda esta em andamento — hoje
-- cobre so parte dos jogos e vai se completando sozinho. Use jogos_com_dado
-- para saber quanto da amostra ja existe antes de tirar conclusao.
--
-- POR QUE EXISTEM AS COLUNAS _90. Os totais respondem "quem produziu mais na
-- temporada", que e uma pergunta sobre oportunidade tanto quanto sobre
-- desempenho: quem jogou 3.201 minutos desarma mais que quem jogou 452 sem ser
-- melhor nisso. As colunas por 90 minutos colocam os dois na mesma escala e
-- respondem a outra pergunta — "quem produz mais quando esta em campo".
--
-- As duas leituras convivem, e nenhuma substitui a outra. A tela alterna entre
-- elas em vez de escolher uma.
--
-- ARMADILHA DO PER-90, e ela e severa: quem entrou 12 minutos e fez um gol
-- aparece com 7,5 gols por 90. A taxa e matematicamente correta e
-- completamente inutil. O corte de minutos NAO e feito aqui de proposito —
-- filtrar e trabalho de quem consulta, a mesma regra que fez o gold_campanha
-- nao filtrar clube. Quem consome precisa exigir um piso; a API ja entra com
-- um por padrao.

with atuacoes as (

    select * from {{ ref('bronze_fixture_players') }}

),

-- o payload por jogador so traz o id da liga; o nome vem do catalogo
competicoes as (

    select distinct league_id, league_nome from {{ ref('bronze_leagues') }}

),

agregado as (

select
    player_id,
    jogador_nome,
    team_id,
    team_nome,
    season,
    league_id,
    any_value(league_nome) as league_nome,

    -- CUIDADO com a diferenca: o endpoint lista todo mundo que foi
    -- relacionado, inclusive quem ficou no banco sem entrar. Sao 902 das 2.923
    -- linhas da base. jogos_com_dado conta relacionamentos; jogos_com_minutos
    -- conta quem de fato pisou em campo.
    count(*)                                                as jogos_com_dado,
    count(*) filter (where minutos is not null)             as jogos_com_minutos,
    sum(case when entrou_do_banco then 0 else 1 end)        as jogos_titular,
    sum(minutos)                                            as minutos,
    round(avg(nota), 2)                                     as nota_media,
    max(nota)                                               as melhor_nota,

    -- NULO NA FONTE SIGNIFICA ZERO, e o coalesce e o que torna estas colunas
    -- comparaveis. A API nunca escreve 0 num contador: em 2.021 atuacoes com
    -- minutos, `gols = 0` aparece zero vez, contra 1.859 nulos e 162 positivos.
    -- O mesmo payload traz `conceded: 0` explicito para o goleiro, ou seja, ela
    -- sabe emitir zero quando quer dizer zero — em contador ela usa nulo.
    --
    -- A prova de que nao e bloco faltando: entre quem atuou 60+ minutos,
    -- `passes` e nulo em 0% dos casos. Se a API estivesse simplesmente omitindo
    -- estatistica daquele jogador, passe cairia junto. Ele nunca cai, entao o
    -- nulo em gols (89,8%), chutes (52,7%) e desarmes (34,9%) e "nao aconteceu".
    --
    -- Sem isto, `sum` de tudo-nulo devolve nulo e o zagueiro que nunca marcou
    -- aparece com gols vazio em vez de zero — e qualquer soma que o envolva,
    -- como participacoes por 90, desaparece junto.
    --
    -- Exceção conhecida: duelos e nulo em 5,5% de quem jogou 60+ minutos, e ai
    -- e mesmo "nao registrado" — quem ficou uma hora em campo disputou bola.
    -- Sao poucos e o efeito e subestimar, nunca inventar.
    coalesce(sum(gols), 0)                                  as gols,
    coalesce(sum(assistencias), 0)                          as assistencias,
    coalesce(sum(chutes), 0)                                as chutes,
    coalesce(sum(chutes_no_gol), 0)                         as chutes_no_gol,
    coalesce(sum(passes), 0)                                as passes,
    coalesce(sum(passes_decisivos), 0)                      as passes_decisivos,
    coalesce(sum(desarmes), 0)                              as desarmes,
    coalesce(sum(interceptacoes), 0)                        as interceptacoes,
    coalesce(sum(duelos), 0)                                as duelos,
    coalesce(sum(duelos_ganhos), 0)                         as duelos_ganhos,
    coalesce(sum(dribles_tentados), 0)                      as dribles_tentados,
    coalesce(sum(dribles_certos), 0)                        as dribles_certos,
    coalesce(sum(faltas_cometidas), 0)                      as faltas_cometidas,
    coalesce(sum(faltas_sofridas), 0)                       as faltas_sofridas,
    coalesce(sum(amarelos), 0)                              as amarelos,
    coalesce(sum(vermelhos), 0)                             as vermelhos,

    -- goleiro: as duas colunas so fazem sentido para quem defende
    sum(defesas)                                            as defesas,
    sum(gols_sofridos)                                      as gols_sofridos,

    -- posicao mais frequente do jogador na temporada
    mode(posicao)                                           as posicao
from atuacoes
left join competicoes using (league_id)
group by all

)

select
    agregado.*,

    -- A API entrega a posicao como letra. O nome por extenso sai daqui e nao
    -- da tela, porque agrupar e comparar por posicao e pergunta sobre o dado:
    -- comparar desarme de zagueiro com desarme de atacante nao diz nada.
    case agregado.posicao
        when 'G' then 'Goleiro'
        when 'D' then 'Defesa'
        when 'M' then 'Meio'
        when 'F' then 'Ataque'
    end as grupo_posicao,

    round(agregado.minutos / nullif(agregado.jogos_com_minutos, 0), 1)
        as minutos_por_jogo,

    -- Producao por 90 minutos. O nullif protege de divisao por zero: quem foi
    -- relacionado e nunca entrou tem minutos zerado ou nulo, e ai a taxa e
    -- nula — que e a resposta honesta, nao zero.
    round(agregado.gols             / nullif(agregado.minutos, 0) * 90, 2) as gols_90,
    round(agregado.assistencias     / nullif(agregado.minutos, 0) * 90, 2) as assistencias_90,
    round((agregado.gols + agregado.assistencias)
                                    / nullif(agregado.minutos, 0) * 90, 2) as participacoes_90,
    round(agregado.chutes           / nullif(agregado.minutos, 0) * 90, 2) as chutes_90,
    round(agregado.passes           / nullif(agregado.minutos, 0) * 90, 2) as passes_90,
    round(agregado.passes_decisivos / nullif(agregado.minutos, 0) * 90, 2) as passes_decisivos_90,
    round(agregado.desarmes         / nullif(agregado.minutos, 0) * 90, 2) as desarmes_90,
    round(agregado.interceptacoes   / nullif(agregado.minutos, 0) * 90, 2) as interceptacoes_90,
    round(agregado.duelos_ganhos    / nullif(agregado.minutos, 0) * 90, 2) as duelos_ganhos_90,
    round(agregado.dribles_certos   / nullif(agregado.minutos, 0) * 90, 2) as dribles_certos_90,
    round(agregado.faltas_cometidas / nullif(agregado.minutos, 0) * 90, 2) as faltas_cometidas_90,
    round(agregado.defesas          / nullif(agregado.minutos, 0) * 90, 2) as defesas_90,

    -- Aproveitamentos: aqui o denominador e a propria tentativa, entao a taxa
    -- independe de minuto e nao precisa de piso de amostra tao alto.
    round(100.0 * agregado.duelos_ganhos  / nullif(agregado.duelos, 0), 1)
        as duelos_ganhos_pct,
    round(100.0 * agregado.dribles_certos / nullif(agregado.dribles_tentados, 0), 1)
        as dribles_certos_pct,
    round(100.0 * agregado.chutes_no_gol  / nullif(agregado.chutes, 0), 1)
        as pontaria_pct

from agregado
