-- Escalacao posicionada, pronta para desenhar num campo.
-- Grao: (jogo, time, jogador).
--
-- A API entrega a posicao do titular no campo em `grid`, no formato
-- "linha:coluna" — 1:1 e o goleiro, 2:1 a 2:4 a linha de defesa, e assim por
-- diante ate o ataque. Aqui esses dois numeros viram colunas inteiras, junto
-- com quantos jogadores existem na mesma linha.
--
-- Por que `jogadores_na_linha` sai daqui e nao do front: centralizar uma linha
-- de 4 zagueiros e uma de 1 atacante depende dessa contagem, e e uma pergunta
-- sobre o dado, nao sobre o desenho. O front so posiciona.
--
-- As estatisticas do jogador naquela partida entram junto, entao o campinho
-- pode mostrar a nota de cada um sem uma segunda consulta.

with escalados as (

    select * from {{ ref('bronze_fixture_lineups') }}

),

atuacoes as (

    select * from {{ ref('bronze_fixture_players') }}

),

-- Quem saiu e quem entrou, e em que minuto. Sai dos eventos porque a
-- escalacao sozinha nao conta isso: ela diz quem era titular e quem era
-- reserva, nao o que aconteceu durante o jogo.
--
-- Reaproveita a convencao ja resolvida no gold_partida_evento: em substituicao
-- o `jogador` e quem SAI e o `relacionado` e quem ENTRA — o inverso do que os
-- nomes da API sugerem.
substituicoes as (

    select
        fixture_id,
        jogador_id as player_id,
        min(minuto) as saiu_no_minuto,
        null::int   as entrou_no_minuto
    from {{ ref('gold_partida_evento') }}
    where tipo = 'subst' and jogador_id is not null
    group by all

    union all

    select
        fixture_id,
        relacionado_id as player_id,
        null::int      as saiu_no_minuto,
        min(minuto)    as entrou_no_minuto
    from {{ ref('gold_partida_evento') }}
    where tipo = 'subst' and relacionado_id is not null
    group by all

),

movimentacao as (

    select
        fixture_id,
        player_id,
        max(saiu_no_minuto)   as saiu_no_minuto,
        max(entrou_no_minuto) as entrou_no_minuto
    from substituicoes
    group by all

),

posicionados as (

    select
        escalados.fixture_id,
        escalados.season,
        escalados.league_id,
        escalados.team_id,
        escalados.team_nome,
        escalados.formacao,
        escalados.coach_id,
        escalados.tecnico,
        escalados.titular,
        escalados.player_id,
        escalados.jogador,
        escalados.camisa,
        escalados.posicao,
        -- reserva nao tem grid: a API so posiciona quem comecou jogando
        try_cast(split_part(escalados.posicao_campo, ':', 1) as int) as linha,
        try_cast(split_part(escalados.posicao_campo, ':', 2) as int) as coluna
    from escalados

)

select
    posicionados.*,
    -- quantos dividem a mesma linha, para o front centralizar
    count(*) filter (where posicionados.linha is not null) over (
        partition by posicionados.fixture_id, posicionados.team_id, posicionados.linha
    ) as jogadores_na_linha,
    max(posicionados.linha) over (
        partition by posicionados.fixture_id, posicionados.team_id
    ) as linhas_no_time,

    atuacoes.minutos,
    atuacoes.nota,
    atuacoes.gols,
    atuacoes.assistencias,
    atuacoes.chutes,
    atuacoes.chutes_no_gol,
    atuacoes.passes,
    atuacoes.precisao_passe,
    atuacoes.desarmes,
    atuacoes.duelos,
    atuacoes.duelos_ganhos,
    atuacoes.amarelos,
    atuacoes.vermelhos,
    atuacoes.entrou_do_banco,

    movimentacao.saiu_no_minuto,
    movimentacao.entrou_no_minuto

from posicionados
left join atuacoes
       on atuacoes.fixture_id = posicionados.fixture_id
      and atuacoes.player_id  = posicionados.player_id
left join movimentacao
       on movimentacao.fixture_id = posicionados.fixture_id
      and movimentacao.player_id  = posicionados.player_id
