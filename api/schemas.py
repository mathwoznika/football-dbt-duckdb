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
