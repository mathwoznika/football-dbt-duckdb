"""Formato das respostas da API.

Cada classe aqui e um contrato: descreve o que sai de um endpoint. O FastAPI
usa isso para tres coisas ao mesmo tempo — documentar, validar a saida e
descartar campo que nao foi declarado.

Sao os modelos do Pydantic, a mesma biblioteca que o dbt-core usa por dentro.
"""

from datetime import date

from pydantic import BaseModel, Field


class Time(BaseModel):
    """Identificacao de um clube."""

    team_id: int
    team_nome: str
    pais: str | None = None
    fundacao: int | None = None
    cidade: str | None = None
    estadio: str | None = None
    capacidade: int | None = None
    logo_url: str | None = None


class TemporadaDoTime(BaseModel):
    """Desempenho de um time numa competicao, numa temporada."""

    league_id: int
    league_nome: str = Field(description="Nome da competicao")
    season: int = Field(description="Ano da temporada")
    jogos: int
    vitorias: int
    empates: int
    derrotas: int
    gols_pro: int
    gols_contra: int
    saldo: int
    pontos: int
    aproveitamento_pct: float = Field(description="Percentual dos pontos possiveis")

    maior_invencibilidade: int = Field(
        description="MAIOR sequencia sem derrota da temporada. E um recorde, "
        "nao o estado atual."
    )
    jogos_sem_derrota: int = Field(description="Jogos desde a ultima derrota")
    jogos_sem_vitoria: int = Field(description="Jogos desde a ultima vitoria")
    ultimo_resultado: str | None = Field(default=None, description="V, E ou D")

    posicao: int | None = Field(
        default=None,
        description="Colocacao na tabela de pontos corridos. Em torneio com "
        "mata-mata descreve a fase de grupos, nao a campanha.",
    )
    resultado_final: str | None = Field(
        default=None,
        description="Como a campanha terminou: Campeao, Vice-campeao, "
        "Eliminado — <fase>, ou Nº lugar.",
    )
    fase_mais_avancada: str | None = Field(
        default=None, description="Fase mais longe alcancada no mata-mata"
    )


class JogoDaCampanha(BaseModel):
    """Uma partida dentro da campanha de um time."""

    fixture_id: int
    jogo_n: int = Field(description="Numero do jogo do time na competicao")
    data: date
    league_id: int
    league_nome: str
    season: int
    rodada: str | None = None
    mando: str = Field(description="casa ou fora")
    adversario_id: int
    adversario_nome: str
    gols_pro: int
    gols_contra: int
    penaltis_pro: int | None = None
    penaltis_contra: int | None = None
    resultado: str = Field(description="V, E ou D")
    pontos: int
    pontos_acumulados: int
    saldo_acumulado: int
    pontos_5_anteriores: int | None = Field(
        default=None, description="Forma que o time levava para este jogo"
    )


class Confronto(BaseModel):
    """Retrospecto acumulado contra um adversario."""

    adversario_id: int
    adversario_nome: str
    jogos: int
    vitorias: int
    empates: int
    derrotas: int
    gols_pro: int
    gols_contra: int
    saldo: int
    aproveitamento_pct: float
    primeiro_confronto: date
    ultimo_confronto: date


class ConfrontoEliminatorio(BaseModel):
    """Um confronto de mata-mata, com as duas pernas somadas."""

    fase: str
    fase_nome: str = Field(description="Nome da fase em portugues")
    ordem_fase: int = Field(description="1=primeira fase ... 7=final")
    partidas: int = Field(description="1 para jogo unico, 2 para ida e volta")

    time_a_id: int
    time_a_nome: str | None = None
    time_a_logo: str | None = None
    gols_a: int

    time_b_id: int
    time_b_nome: str | None = None
    time_b_logo: str | None = None
    gols_b: int

    penaltis_a: int | None = None
    penaltis_b: int | None = None

    # Placar de cada perna. O agregado esconde a historia — um 3x3 no total pode
    # ter sido 2x1 na ida e 1x2 na volta, e e isso que a tela quer mostrar.
    ida_data: date | None = None
    ida_gols_a: int | None = None
    ida_gols_b: int | None = None
    ida_penaltis_a: int | None = None
    ida_penaltis_b: int | None = None
    volta_data: date | None = None
    volta_gols_a: int | None = None
    volta_gols_b: int | None = None
    volta_penaltis_a: int | None = None
    volta_penaltis_b: int | None = None

    vencedor_id: int | None = None
    eliminado_id: int | None = None
    data_inicio: date
    data_fim: date


class Partida(BaseModel):
    """Cabecalho de um jogo, com os dois lados."""

    fixture_id: int
    data: date
    season: int
    league_id: int
    league_nome: str
    rodada: str | None = None
    status: str
    estadio: str | None = None
    arbitro: str | None = None

    time_casa_id: int
    time_casa: str
    time_casa_logo: str | None = None
    gols_casa: int | None = None
    gols_casa_1t: int | None = None
    penaltis_casa: int | None = None

    time_fora_id: int
    time_fora: str
    time_fora_logo: str | None = None
    gols_fora: int | None = None
    gols_fora_1t: int | None = None
    penaltis_fora: int | None = None


class JogadorEscalado(BaseModel):
    """Um jogador na escalacao, com posicao no campo e a atuacao dele."""

    team_id: int
    team_nome: str
    formacao: str | None = None
    tecnico: str | None = None

    player_id: int
    jogador: str
    camisa: int | None = None
    posicao: str | None = Field(default=None, description="G, D, M ou F")
    titular: bool

    # Posicao no campo, vinda do "grid" da API. Só titular tem.
    linha: int | None = Field(
        default=None, description="1 e o goleiro, crescendo em direcao ao ataque"
    )
    coluna: int | None = Field(default=None, description="Posicao dentro da linha")
    jogadores_na_linha: int | None = None
    linhas_no_time: int | None = None

    minutos: int | None = None
    nota: float | None = None
    gols: int | None = None
    assistencias: int | None = None
    chutes: int | None = None
    chutes_no_gol: int | None = None
    passes: int | None = None
    desarmes: int | None = None
    duelos: int | None = None
    duelos_ganhos: int | None = None
    amarelos: int | None = None
    vermelhos: int | None = None
    entrou_do_banco: bool | None = None
    saiu_no_minuto: int | None = Field(
        default=None, description="Minuto em que foi substituido"
    )
    entrou_no_minuto: int | None = Field(
        default=None, description="Minuto em que entrou em campo"
    )


class EstatisticaDaPartida(BaseModel):
    """Estatistica coletiva de um dos lados de um jogo."""

    team_id: int
    team_nome: str
    logo_url: str | None = None
    e_do_mandante: bool
    posse_pct: int | None = None
    chutes_total: int | None = None
    chutes_no_gol: int | None = None
    chutes_fora: int | None = None
    chutes_bloqueados: int | None = None
    chutes_dentro_area: int | None = None
    escanteios: int | None = None
    impedimentos: int | None = None
    faltas: int | None = None
    cartoes_amarelos: int | None = None
    cartoes_vermelhos: int | None = None
    defesas_goleiro: int | None = None
    passes_total: int | None = None
    passes_certos: int | None = None
    precisao_passe_pct: int | None = None


class EventoDaPartida(BaseModel):
    """Um lance da linha do tempo."""

    minuto: int
    acrescimo: int | None = None
    tipo: str
    rotulo: str = Field(description="Nome do lance em portugues, pronto para a tela")
    detalhe: str | None = None
    team_id: int
    team_nome: str
    e_do_mandante: bool | None = None
    jogador_id: int | None = None
    jogador: str | None = None
    relacionado_id: int | None = None
    relacionado: str | None = None
    papel_relacionado: str | None = Field(
        default=None,
        description="O que o segundo jogador representa: 'entrou' numa "
        "substituicao, 'assistencia' num gol.",
    )


class JogadorNaTemporada(BaseModel):
    """Desempenho de um jogador numa competicao e temporada."""

    player_id: int
    jogador_nome: str
    team_id: int
    team_nome: str
    season: int
    league_id: int
    league_nome: str | None = None
    posicao: str | None = None
    jogos_com_dado: int
    jogos_com_minutos: int | None = None
    jogos_titular: int
    minutos: int | None = None
    nota_media: float | None = None
    melhor_nota: float | None = None
    gols: int | None = None
    assistencias: int | None = None
    chutes: int | None = None
    chutes_no_gol: int | None = None
    passes: int | None = None
    desarmes: int | None = None
    duelos: int | None = None
    duelos_ganhos: int | None = None
    dribles_tentados: int | None = None
    dribles_certos: int | None = None
    faltas_cometidas: int | None = None
    amarelos: int | None = None
    vermelhos: int | None = None
    defesas: int | None = None
    gols_sofridos: int | None = None

    grupo_posicao: str | None = Field(
        default=None, description="Goleiro, Defesa, Meio ou Ataque"
    )
    minutos_por_jogo: float | None = None

    # Producao por 90 minutos: responde "quem produz quando esta em campo",
    # enquanto os totais acima respondem "quem produziu na temporada". As duas
    # leituras convivem e nenhuma substitui a outra.
    #
    # CUIDADO: quem entrou 12 minutos e marcou aparece com 7,5 gols por 90. A
    # taxa e correta e inutil — sempre filtre por minutos antes de comparar. O
    # endpoint de elenco ja entra com um piso por padrao.
    gols_90: float | None = None
    assistencias_90: float | None = None
    participacoes_90: float | None = Field(
        default=None, description="Gols mais assistencias por 90 minutos"
    )
    chutes_90: float | None = None
    passes_90: float | None = None
    passes_decisivos_90: float | None = None
    desarmes_90: float | None = None
    interceptacoes_90: float | None = None
    duelos_ganhos_90: float | None = None
    dribles_certos_90: float | None = None
    faltas_cometidas_90: float | None = None
    # so faz sentido para goleiro; vem nulo para o resto do elenco
    defesas_90: float | None = None

    # Aproveitamentos: o denominador e a propria tentativa, entao independem de
    # minuto e toleram amostra menor que as taxas por 90.
    duelos_ganhos_pct: float | None = None
    dribles_certos_pct: float | None = None
    pontaria_pct: float | None = None


class AtuacaoDoJogador(BaseModel):
    """Como um jogador foi numa partida especifica."""

    fixture_id: int
    data: date
    season: int
    league_id: int
    league_nome: str
    team_id: int
    team_nome: str
    adversario_id: int
    adversario_nome: str
    mando: str
    gols_time: int | None = None
    gols_adversario: int | None = None
    minutos: int | None = None
    posicao: str | None = None
    nota: float | None = None
    entrou_do_banco: bool | None = None
    gols: int | None = None
    assistencias: int | None = None
    chutes: int | None = None
    chutes_no_gol: int | None = None
    passes: int | None = None
    desarmes: int | None = None
    duelos: int | None = None
    duelos_ganhos: int | None = None
    amarelos: int | None = None
    vermelhos: int | None = None


class Artilheiro(BaseModel):
    """Uma linha da artilharia de uma competicao."""

    posicao_artilharia: int
    player_id: int
    jogador: str
    foto_url: str | None = None
    idade: int | None = None
    nacionalidade: str | None = None
    posicao: str | None = None
    team_id: int
    team_nome: str
    team_logo: str | None = None
    jogos: int | None = None
    minutos: int | None = None
    gols: int
    assistencias: int | None = None
    gols_por_jogo: float | None = None
    nota_media: float | None = None
    teve_mais_de_um_clube: bool = Field(
        default=False,
        description="A fonte repete o bloco de numeros para quem trocou de "
        "clube; nesses casos usamos o maximo, nao a soma.",
    )


class JogadorNaBase(BaseModel):
    """Totais de um jogador NA NOSSA BASE — nao e estatistica de carreira.

    A onda 3 cobre so jogos do Coritiba e o endpoint devolve os dois times,
    entao jogador de adversario aparece com 1 ou 2 partidas. Use
    jogos_com_dado para saber se a media ao lado significa alguma coisa.
    """

    player_id: int
    jogador_nome: str
    team_id: int | None = None
    team_nome: str | None = None
    clubes: int
    posicao: str | None = None
    primeira_temporada: int
    ultima_temporada: int
    temporadas: int
    competicoes: int
    jogos_com_dado: int = Field(
        description="Vezes que foi relacionado, inclusive sem entrar em campo"
    )
    jogos_com_minutos: int = Field(description="Partidas em que de fato jogou")
    jogos_titular: int | None = None
    minutos: int | None = None
    nota_media: float | None = None
    melhor_nota: float | None = None
    gols: int | None = None
    assistencias: int | None = None
    chutes: int | None = None
    desarmes: int | None = None
    duelos: int | None = None
    duelos_ganhos: int | None = None
    amarelos: int | None = None
    vermelhos: int | None = None
    defesas: int | None = None
    gols_sofridos: int | None = None


class DesempenhoPorTempo(BaseModel):
    """Como o time se comporta em cada tempo, e o que faz com a vantagem."""

    league_id: int
    league_nome: str
    season: int
    jogos: int
    gols_1t: int
    gols_2t: int
    sofridos_1t: int
    sofridos_2t: int
    saldo_1t: int
    saldo_2t: int
    pontos: int
    pontos_se_acabasse_no_1t: int = Field(
        description="Pontos que teria somado se todo jogo acabasse no intervalo"
    )
    diferenca_de_pontos: int = Field(
        description="Negativo significa que o time perde pontos no segundo tempo"
    )
    intervalos_vencendo: int
    intervalos_empatando: int
    intervalos_perdendo: int
    viradas: int = Field(description="Perdia no intervalo e venceu")
    reacoes: int = Field(description="Perdia no intervalo e empatou")
    vantagens_empatadas: int = Field(description="Vencia no intervalo e empatou")
    vantagens_perdidas: int = Field(description="Vencia no intervalo e perdeu")


class GolsPorPeriodo(BaseModel):
    """Distribuicao dos gols por faixa de 15 minutos.

    Cobertura PARCIAL: vem dos eventos, que so existem para os jogos ja
    alcancados pela onda 3. jogos_com_evento diz sobre quantas partidas a
    distribuicao foi calculada.
    """

    faixa: str
    ordem_faixa: int
    marcados: int
    sofridos: int
    jogos_com_evento: int


class TecnicoDoTime(BaseModel):
    """Aproveitamento sob um tecnico, derivado da escalacao de cada jogo."""

    coach_id: int
    tecnico: str
    season: int
    league_id: int
    league_nome: str
    jogos: int
    vitorias: int
    empates: int
    derrotas: int
    gols_pro: int
    gols_contra: int
    pontos: int
    aproveitamento_pct: float
    primeiro_jogo: date
    ultimo_jogo: date


class ArbitroDoTime(BaseModel):
    """Retrospecto do time sob um arbitro.

    ATENCAO A AMOSTRA: raramente passa de 9 jogos por arbitro. Diferenca de
    aproveitamento nesse volume e ruido, nao padrao. Por isso cada linha traz o
    baseline do proprio time ao lado — sem o contraponto, o numero isolado nao
    significa nada.

    Jogos e resultado cobrem toda a base (o arbitro vem no fixture). Faltas e
    cartoes vem da onda 3 e cobrem so jogos_com_estatistica partidas.
    """

    arbitro: str
    jogos: int
    vitorias: int
    empates: int
    derrotas: int
    gols_pro: int
    gols_contra: int
    pontos: int
    aproveitamento_pct: float
    aproveitamento_geral_pct: float = Field(
        description="Aproveitamento do time em TODOS os jogos, para comparar"
    )
    diferenca_aproveitamento: float = Field(
        description="Quanto foge da media do proprio time"
    )
    jogos_com_estatistica: int = Field(
        description="Sobre quantos jogos as faltas e cartoes foram somados"
    )
    faltas_pro: int | None = None
    faltas_contra: int | None = None
    amarelos_pro: int | None = None
    amarelos_contra: int | None = None
    vermelhos_pro: int | None = None
    vermelhos_contra: int | None = None
    amarelos_por_jogo: float | None = None
    amarelos_por_jogo_geral: float | None = None
    diferenca_amarelos: float | None = None
    primeiro_jogo: date
    ultimo_jogo: date


class Competicao(BaseModel):
    """Uma competicao numa temporada, para o indice e para a home.

    `cobertura_evento_pct` e a fracao dos jogos que ja tem lance a lance
    extraido. Sem ela, duas competicoes parecem igualmente detalhadas na tela
    quando uma tem 100% e a outra 0%.
    """

    league_id: int
    league_nome: str
    season: int
    tipo: str | None = None
    times: int
    jogos: int
    gols: int
    gols_por_jogo: float | None = None
    primeiro_jogo: date | None = None
    ultimo_jogo: date | None = None
    campeao_id: int | None = None
    campeao: str | None = None
    campeao_logo: str | None = None
    artilheiro: str | None = None
    artilheiro_gols: int | None = None
    tem_chaveamento: bool
    tem_classificacao: bool
    jogos_com_evento: int
    jogos_com_estatistica: int
    cobertura_evento_pct: float | None = None


class Destaque(BaseModel):
    """Um fato que vale manchete: recorde, goleada, artilheiro.

    Mart editorial — escolhe o que mostrar primeiro para quem chega. Os ids vem
    junto para a tela virar link: destaque que nao da para clicar e numero solto.
    """

    tipo: str
    ordem: int
    rotulo: str
    valor: str
    detalhe: str
    league_nome: str
    season: int
    fixture_id: int | None = None
    time_id: int | None = None
    time_nome: str | None = None
    logo_url: str | None = None


class ResumoDaBase(BaseModel):
    """O tamanho da base inteira, para a home.

    As duas ultimas colunas existem porque o projeto tem duas profundidades bem
    diferentes: largura (placar de todos os jogos) e profundidade (lance a
    lance, so onde a extracao por partida chegou). Mostrar 1.746 jogos sem dizer
    que 132 tem lance levaria o visitante a confiar demais em metade das telas.
    """

    jogos: int
    times: int
    competicoes: int
    competicoes_temporada: int
    primeira_temporada: int
    ultima_temporada: int
    gols: int
    gols_por_jogo: float | None = None
    jogadores: int
    lances: int
    jogos_com_evento: int
    jogos_com_estatistica: int


class PontoDaEvolucao(BaseModel):
    """Posicao e pontos de um time apos uma rodada."""

    rodada_n: int
    time_id: int
    time_nome: str
    posicao: int
    pontos_acum: int


class Transferencia(BaseModel):
    """Uma movimentacao de jogador.

    A janela deste dado e DIFERENTE do resto do projeto: vai ate 2026, enquanto
    os jogos param em 2024 por limitacao do plano. E o unico dado daqui que
    alcanca o presente.
    """

    player_id: int
    jogador: str
    data: date
    tipo: str
    valor_eur: float | None = None
    sentido: str | None = Field(default=None, description="chegou ou saiu")
    team_origem_id: int | None = None
    team_origem: str | None = None
    team_destino_id: int | None = None
    team_destino: str | None = None


class LinhaClassificacao(BaseModel):
    """Uma linha da tabela de classificacao."""

    posicao: int
    time_id: int
    time_nome: str
    logo_url: str | None = None
    jogos: int
    vitorias: int
    empates: int
    derrotas: int
    gols_pro: int
    gols_contra: int
    saldo: int
    pontos: int
    aproveitamento_pct: float
    ultimos_5: str | None = Field(
        default=None,
        description="Resultados dos 5 ultimos jogos em ordem cronologica: o "
        "primeiro caractere e o mais antigo, o ultimo e o jogo mais recente.",
    )


class EstatisticaDaTemporada(BaseModel):
    """Perfil estatistico coletivo de um time numa competicao e temporada.

    COBERTURA PARCIAL, e o campo que diz isso e obrigatorio de ler. A onda 3 so
    alcancou parte dos jogos, e como o endpoint da API-Football devolve os dois
    times de cada partida, um adversario do Coritiba pode aparecer aqui com uma
    partida so. `jogos_com_estatistica` e `cobertura_pct` existem para a tela
    poder dizer de quantos jogos o numero saiu — e para quem consome poder
    exigir amostra minima.

    As taxas (pontaria, conversao) sao calculadas sobre os totais da temporada,
    nao como media das razoes de cada jogo.
    """

    league_id: int
    league_nome: str
    season: int
    jogos_com_estatistica: int
    jogos_na_competicao: int = Field(
        description="Jogos disputados na competicao, com estatistica ou sem"
    )
    cobertura_pct: float

    pontos: int
    gols_pro: int
    gols_contra: int
    pontos_por_jogo: float | None = None

    # com a bola
    posse_media_pct: float | None = None
    passes_por_jogo: float | None = None
    precisao_passe_media_pct: float | None = None

    # producao ofensiva
    chutes_por_jogo: float | None = None
    chutes_no_gol_por_jogo: float | None = None
    chutes_na_area_por_jogo: float | None = None
    escanteios_por_jogo: float | None = None
    impedimentos_por_jogo: float | None = None
    pontaria_pct: float | None = Field(
        default=None, description="Chutes no gol sobre chutes totais"
    )
    conversao_pct: float | None = Field(
        default=None, description="Gols sobre chutes no gol"
    )
    chutes_por_gol: float | None = Field(
        default=None, description="Nulo quando o time nao marcou na amostra"
    )

    # o que o adversario produziu
    chutes_sofridos_por_jogo: float | None = None
    chutes_no_gol_sofridos_por_jogo: float | None = None
    chutes_na_area_sofridos_por_jogo: float | None = None
    escanteios_sofridos_por_jogo: float | None = None
    defesas_goleiro_por_jogo: float | None = None
    pontaria_adversario_pct: float | None = None
    conversao_sofrida_pct: float | None = None

    # disciplina
    faltas_por_jogo: float | None = None
    faltas_sofridas_por_jogo: float | None = None
    amarelos_por_jogo: float | None = None
    amarelos: int | None = None
    vermelhos: int | None = None

    primeiro_jogo: date
    ultimo_jogo: date


class FormacaoDoTime(BaseModel):
    """Aproveitamento do time com cada desenho tatico.

    AMOSTRA: depende da escalacao, logo da onda 3. Uma formacao com `jogos` = 1
    e uma partida, nao uma tendencia — a tela precisa mostrar `jogos` ao lado de
    qualquer aproveitamento daqui.
    """

    league_id: int
    league_nome: str
    season: int
    formacao: str
    jogos: int
    vitorias: int
    empates: int
    derrotas: int
    pontos: int
    aproveitamento_pct: float
    gols_pro: int
    gols_contra: int
    saldo: int
    gols_por_jogo: float
    gols_sofridos_por_jogo: float
    jogos_sem_sofrer_gol: int
    jogos_casa: int
    jogos_fora: int
    tecnicos: str | None = Field(
        default=None, description="Quem escalou assim, separado por virgula"
    )
    primeiro_jogo: date
    ultimo_jogo: date


class DesempenhoPorForcaAdversario(BaseModel):
    """Aproveitamento do time contra cada quarto da tabela.

    NAO depende da onda 3: sai do placar de todos os jogos, entao vale para
    qualquer time da base sem ressalva de amostra.

    A faixa e um quartil da classificacao final, o que funciona igual numa
    competicao de 20 times e numa de 12 — por isso `times_na_competicao` vem
    junto, para a tela poder dizer quantos clubes cabem em cada quarto. So a
    fase de pontos corridos entra na conta.
    """

    league_id: int
    league_nome: str
    season: int
    faixa_adversario: int = Field(description="1 a 4, do topo para o fim da tabela")
    faixa_rotulo: str
    times_na_competicao: int
    times_na_faixa: int = Field(
        description="Quantos clubes couberam nesta faixa. Vem do model e nao de "
        "uma divisao por 4, porque numa competicao de 18 times o quartil produz "
        "faixas de tamanhos diferentes."
    )
    jogos: int
    vitorias: int
    empates: int
    derrotas: int
    pontos: int
    aproveitamento_pct: float
    gols_pro: int
    gols_contra: int
    saldo: int
    jogos_casa: int
    pontos_casa: int | None = None
    jogos_fora: int
    pontos_fora: int | None = None
    posicao_media_adversario: float = Field(
        description="Posicao media de quem ele enfrentou dentro da faixa"
    )


class CartaoNoPeriodo(BaseModel):
    """Cartoes tomados e provocados numa faixa de 15 minutos.

    Cobertura PARCIAL: vem dos lances por partida. `jogos_com_evento` e a
    cobertura real da competicao — partidas com lance extraido, e nao partidas
    que tiveram cartao nesta faixa.
    """

    faixa: str
    ordem_faixa: int
    tomados: int
    amarelos: int
    vermelhos: int
    provocados: int = Field(
        description="Cartoes que o adversario tomou nas mesmas partidas"
    )
    jogos_com_evento: int


class Disciplina(BaseModel):
    """Disciplina do time e o custo da expulsao, por competicao e temporada.

    AMOSTRA PEQUENA nas colunas de expulsao. Leia `jogos_com_expulsao` e
    `minutos_com_um_a_menos` antes da taxa: ela pode sair de dois jogos.

    A taxa com um a menos usa minutos reais em desvantagem (90 menos o minuto
    da vermelha, sem acrescimo), e existe para ser comparada com
    `gols_sofridos_por_90_normal` — sozinha ela nao diz se e muito ou pouco.
    """

    league_id: int
    league_nome: str
    season: int
    jogos_com_evento: int

    amarelos: int
    vermelhos: int
    cartoes_por_jogo: float | None = None
    minuto_medio_primeiro_cartao: float | None = None
    cartoes_apos_75: int
    cartoes_do_adversario: int

    jogos_com_expulsao: int
    gols_sofridos_apos_expulsao: int
    minutos_com_um_a_menos: int | None = None
    gols_sofridos_por_90_com_um_a_menos: float | None = Field(
        default=None, description="Nulo quando o time nao teve expulsao na amostra"
    )
    gols_sofridos_por_90_normal: float | None = None


class OrigemDosGols(BaseModel):
    """De onde vem o gol marcado e o sofrido, numa competicao e temporada.

    Cobertura PARCIAL: sai dos lances por partida, que so existem para os jogos
    ja alcancados pela onda 3. `jogos_com_evento` diz sobre quantas partidas a
    conta foi feita.

    Gol contra e atribuido ao time que se beneficia, seguindo a fonte — o que
    torna a soma por time igual ao placar. Ele so nao entra na leitura por
    autor, porque o jogador e do time adversario.
    """

    league_id: int
    league_nome: str
    season: int
    jogos_com_evento: int

    gols: int
    gols_normais: int
    gols_penalti: int
    gols_contra_a_favor: int = Field(
        description="Gols contra marcados por jogador adversario"
    )

    assistencia_registrada: bool = Field(
        description="Se a competicao registra assistencia. Quando falso, as "
        "colunas de assistencia vem nulas — a fonte nao cobre a competicao, e "
        "zero seria indistinguivel de 'ninguem assistiu'."
    )
    gols_com_assistencia: int | None = None
    gols_sem_assistencia: int | None = None

    sofridos: int
    sofridos_normais: int
    sofridos_penalti: int
    sofridos_contra_a_favor: int

    penalti_pct: float | None = None
    assistidos_pct: float | None = None
    sofridos_penalti_pct: float | None = None


class ImpactoDoBanco(BaseModel):
    """O que o banco produz e a que altura o tecnico mexe.

    Cobertura PARCIAL, pelo mesmo motivo da origem dos gols.

    `gols_sem_escalacao` fica exposto de proposito: sao gols em partida com
    lance extraido e sem escalacao, entao o autor nao casa com ninguem. Sem essa
    coluna, titular mais reserva nao fecharia com o total de gols.
    """

    league_id: int
    league_nome: str
    season: int
    jogos_com_evento: int

    gols_de_titular: int
    gols_de_reserva: int = Field(
        description="Gols de quem estava entre os reservas e entrou no jogo"
    )
    gols_sem_escalacao: int
    gols_do_banco_pct: float | None = None
    assistencias_de_reserva: int | None = Field(
        default=None, description="Nulo onde a competicao nao registra assistencia"
    )

    substituicoes: int
    substituicoes_por_jogo: float | None = None
    minuto_medio_substituicao: float | None = None
    minuto_medio_primeira_troca: float | None = Field(
        default=None,
        description="A primeira troca descreve o tecnico melhor que a media de "
        "todas, que mistura ajuste tatico com queima de tempo aos 88.",
    )
    jogos_com_troca_no_1t: int
