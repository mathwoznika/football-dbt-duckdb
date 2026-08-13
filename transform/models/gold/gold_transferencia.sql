-- Movimentacoes de jogadores. Grao: uma transferencia.
--
-- DUAS PARTICULARIDADES DA FONTE, ambas tratadas aqui.
--
-- 1. Ela duplica. O mesmo jogador aparece em dias consecutivos com o mesmo
--    destino — Willian Oliveira em 30/07 e 29/07 de 2026, B. Ocampo em 02/07 e
--    01/07. Sao 55 linhas de 1.020. Ficamos com a data mais ANTIGA, que e
--    quando a transferencia de fato ocorreu; as repeticoes seguintes sao
--    reprocessamento da API.
--
-- 2. O campo `type` mistura duas coisas. Ele guarda a modalidade ("Loan",
--    "Free", "Transfer") E o valor ("€ 1.5M", "€ 500K") no mesmo lugar. Aqui
--    viram duas colunas: `tipo` normalizado em portugues e `valor_eur` como
--    numero.
--
-- JANELA DIFERENTE DO RESTO DO PROJETO: as transferencias vao ate 2026,
-- enquanto os jogos param em 2024 por limitacao do plano Free. E o unico dado
-- daqui que alcanca o presente — a tela precisa dizer isso, senao o usuario
-- estranha ver movimentacao de 2026 num app cujos jogos terminam em 2024.

with movimentacoes as (

    select * from {{ ref('bronze_transfers') }}

),

-- Uma linha por (jogador, origem, destino), com a data mais antiga.
deduplicado as (

    select
        player_id,
        team_origem_id,
        team_destino_id,
        min(data)               as data,
        any_value(jogador)      as jogador,
        any_value(team_origem)  as team_origem,
        any_value(team_destino) as team_destino,
        any_value(team_id_consultado) as team_id_consultado,
        -- entre as repeticoes, a que traz valor e mais informativa que a que
        -- so diz "N/A"; max coloca as que comecam com € na frente
        max(tipo)               as tipo_bruto,
        count(*)                as registros_na_fonte
    from movimentacoes
    group by all

)

select
    player_id,
    jogador,
    data,
    team_origem_id,
    team_origem,
    team_destino_id,
    team_destino,
    team_id_consultado,

    -- modalidade em portugues; quando o campo trazia valor, e transferencia paga
    case
        when tipo_bruto like '€%'                             then 'Transferência'
        when tipo_bruto ilike 'loan'                          then 'Empréstimo'
        when tipo_bruto ilike '%back from loan%'
          or tipo_bruto ilike '%return from loan%'            then 'Retorno de empréstimo'
        when tipo_bruto ilike 'free%'                         then 'Livre'
        when tipo_bruto ilike 'transfer'                      then 'Transferência'
        else 'Não informado'
    end as tipo,

    -- "€ 1.5M" vira 1500000, "€ 362.9K" vira 362900
    case
        when tipo_bruto like '€%M' then
            try_cast(replace(replace(tipo_bruto, '€', ''), 'M', '') as double) * 1000000
        when tipo_bruto like '€%K' then
            try_cast(replace(replace(tipo_bruto, '€', ''), 'K', '') as double) * 1000
        when tipo_bruto like '€%' then
            try_cast(replace(tipo_bruto, '€', '') as double)
    end as valor_eur,

    -- do ponto de vista do time consultado
    case
        when team_destino_id = team_id_consultado then 'chegou'
        when team_origem_id  = team_id_consultado then 'saiu'
    end as sentido,

    tipo_bruto,
    registros_na_fonte
from deduplicado
