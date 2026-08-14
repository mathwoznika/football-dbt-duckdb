"""O que extrair da API-Football. Este e o arquivo que voce edita.

    python extrair.py

Rodar varias vezes e seguro: o que ja esta em data/raw e pulado sem gastar
requisicao. Como a cota do Free e de 100 por dia e o escopo passa de 700
chamadas, a rotina normal e rodar todo dia ate as pendencias zerarem.

O escopo se monta em ondas porque um dado depende do outro: so da para pedir a
escalacao de um jogo depois de saber que o jogo existe. As ondas 2 e 3 saem da
leitura de data/raw, entao descobrir o que falta nao custa nenhuma requisicao.

Sao extraidos dois calendarios diferentes, e a distincao importa:

  fixtures       jogos do clube semente. E daqui que sai a onda 3, cara.
  fixtures_liga  jogos de todas as competicoes que ele disputou. Sai barato
                 (um request por liga/temporada) e serve para calcular forma e
                 sequencia dos adversarios entre si.

O ESCOPO E DECLARATIVO, e essa e a unica coisa que muda quando o plano mudar.
Hoje a semente e um clube porque a cota Free nao comporta mais que isso; no
plano pago a semente passa a ser uma lista de competicoes e o resto do arquivo
continua igual. Ver o bloco ESCOPO logo abaixo.
"""

import collections
import json
from typing import NamedTuple

import apifootball


class Tarefa(NamedTuple):
    """Uma requisicao a fazer, e onde a resposta dela mora em data/raw.

    E NamedTuple e nao dataclass de proposito: o codigo antigo desempacotava
    isto como tupla de 4 e varios diagnosticos indexam por posicao. Assim os
    campos ganham nome sem quebrar nada que ja existia.
    """

    dataset: str
    endpoint: str
    params: dict
    caminho: str
    paginado: bool = False


# ------------------------------------------------------------------- plano

# Trocar para "pago" quando a assinatura subir. Muda tres coisas de uma vez: a
# janela de temporadas, o teto por execucao e o ritmo das chamadas.
PLANO = "free"

PLANOS = {
    "free": {
        "temporadas": [2022, 2023, 2024],  # o que o Free libera; 2025 da erro
        "orcamento": 95,                   # teto por execucao, com folga sobre 100
        "por_minuto": 10,
    },
    "pago": {
        # O Pro libera de 2015 em diante, que e quando a API passa a ter
        # estatistica completa. Estenda a lista conforme for assinando.
        "temporadas": list(range(2015, 2025)),
        "orcamento": 7000,
        # CONFIRA ESTE NUMERO no painel da API antes de subir o plano: se ficar
        # alto demais o 429 por minuto vira regra, e se ficar baixo demais uma
        # extracao de 7.000 chamadas leva o dia inteiro em vez de meia hora.
        "por_minuto": 300,
    },
}

TEMPORADAS = PLANOS[PLANO]["temporadas"]
ORCAMENTO = PLANOS[PLANO]["orcamento"]


# ------------------------------------------------------------------ escopo

# COMO O ESCOPO CRESCE. Hoje partimos de um clube porque 100 requisicoes por dia
# nao comportam outra coisa: o calendario do Coritiba custa 3 chamadas e revela
# sozinho as 4 competicoes e 9 pares liga-temporada que ele disputou.
#
# No plano pago a pergunta deixa de ser "o que este time jogou" e passa a ser
# "quais competicoes o futebol brasileiro disputa" — Serie A, B e C, Copa do
# Brasil, estaduais, Libertadores e Sul-Americana. Ai o modo vira "ligas", a
# lista de ids entra em ESCOPO["ligas"] e a profundidade vira "tudo".
#
# O resto do arquivo nao muda. As ondas 2 e 3 ja trabalham em cima do conjunto
# de pares (liga, temporada), independentemente de como esse conjunto apareceu.

ESCOPO = {
    # "time"  — a semente e o calendario de um clube. As competicoes sao
    #           descobertas a partir dele, sem precisar listar nada na mao.
    # "ligas" — a semente e a lista explicita em "ligas". Exige plano pago,
    #           porque o custo deixa de ser proporcional a um time.
    "modo": "time",

    "time": 147,  # Coritiba

    # So usado no modo "ligas". Ids da API-Football:
    #   71 Serie A · 72 Serie B · 75 Serie C · 73 Copa do Brasil
    #   606 Paranaense · 13 Libertadores · 11 Sul-Americana
    "ligas": [],

    # Alcance da onda 3, que e a parte cara (4 requisicoes por jogo):
    #   "semente" — so os jogos do clube semente. ~670 chamadas.
    #   "tudo"    — todos os jogos de todas as ligas do escopo. Multiplica por
    #               dez: as 9 ligas-temporada atuais dariam ~7.000 chamadas.
    "profundidade": "semente",
}


# Um request por jogo, cada um. Sao estes quatro que dominam o custo total.
POR_JOGO = {
    "fixture_statistics": "fixtures/statistics",
    "fixture_events": "fixtures/events",
    "fixture_lineups": "fixtures/lineups",
    "fixture_players": "fixtures/players",
}

# Jogo que nao rolou nao tem estatistica, escalacao nem evento para buscar.
ENCERRADO = {"FT", "AET", "PEN"}


# ------------------------------------------------- o que a fonte nao tem

# (dataset, liga) que a API simplesmente nao cobre. Pedir isso gasta cota e
# devolve response vazio, entao a fila pula.
#
# NAO SUPONHA — MEDA. Cada par aqui saiu de `python extrair.py --diagnostico`,
# que le data/raw e mostra onde tudo que ja foi extraido voltou vazio. O caso
# do Paranaense: 23 arquivos de estatistica e 23 de jogadores, todos sem uma
# linha, enquanto evento e escalacao vieram normalmente nos mesmos jogos.
#
# Custo de nao ter isso: 43 das 243 requisicoes que restavam eram para esses
# dois pares — 18% da fila, e a Serie B 2024 inteira esperando atras deles.
#
# Se a API preencher esses dados um dia, apague a linha e rode de novo.
SEM_DADO = {
    ("fixture_statistics", 606),
    ("fixture_players", 606),
}

# Ordem de valor na onda 3. A fila e cara e longa, entao competicao mais
# informativa vem primeiro — o que nao esta na lista vai para o fim.
#
# Por que isto importa na pratica: sem ordenacao a fila segue o id da liga, e a
# Serie B 2024 (uma temporada inteira ainda intocada) ficava atras de 86
# requisicoes do estadual.
PRIORIDADE_LIGA = [71, 72, 73, 606]


def _ordem_da_liga(liga):
    return PRIORIDADE_LIGA.index(liga) if liga in PRIORIDADE_LIGA else len(PRIORIDADE_LIGA)


# ------------------------------------------------------------------ ondas


def _fixtures_de(padrao):
    """Le arquivos de calendario ja gravados e devolve (season, liga, jogo).

    Nao chama a API: tudo sai de data/raw. So partida encerrada entra, porque
    jogo que nao rolou nao tem estatistica, escalacao nem evento para buscar.
    """
    jogos = set()
    for arquivo in sorted(apifootball.RAW.glob(padrao)):
        documento = json.loads(arquivo.read_text(encoding="utf-8"))
        for jogo in documento.get("response", []):
            if jogo["fixture"]["status"]["short"] in ENCERRADO:
                jogos.add(
                    (jogo["league"]["season"], jogo["league"]["id"], jogo["fixture"]["id"])
                )
    return jogos


def jogos_da_semente():
    """Jogos que definem o escopo — deles saem as ligas da onda 2."""
    if ESCOPO["modo"] == "time":
        # Apenas o dataset "fixtures" (jogos do clube), nunca "fixtures_liga":
        # a onda 3 custa 4 requests por jogo, e incluir aqui os jogos das ligas
        # inteiras levaria o escopo de 672 para mais de 7.000 requisicoes.
        return sorted(_fixtures_de("fixtures/season=*/*.json"))
    # No modo "ligas" a semente e o proprio calendario das competicoes.
    return sorted(_fixtures_de("fixtures_liga/season=*/league=*.json"))


def jogos_da_onda_3():
    """Quais jogos recebem os quatro endpoints caros."""
    if ESCOPO["profundidade"] == "tudo":
        return sorted(_fixtures_de("fixtures_liga/season=*/league=*.json"))
    return jogos_da_semente()


def pares_liga_temporada(jogos):
    """(temporada, liga) de tudo que entrou no escopo."""
    if ESCOPO["modo"] == "ligas":
        return sorted({(s, liga) for s in TEMPORADAS for liga in ESCOPO["ligas"]})
    return sorted({(season, liga) for season, liga, _ in jogos})


def montar_tarefas():
    """Lista de Tarefa, na ordem em que devem ser buscadas."""
    tarefas = []
    time_semente = ESCOPO["time"]

    # Onda 1 — o que depende so do time. O calendario vem inteiro num request
    # por temporada, ja com todas as competicoes que ele disputou.
    #
    # No modo "ligas" nao ha clube semente: as competicoes ja estao declaradas,
    # e coachs/transfers de todos os times seria outra ordem de grandeza.
    if ESCOPO["modo"] == "time":
        for season in TEMPORADAS:
            tarefas.append(
                Tarefa("fixtures", "fixtures", {"team": time_semente, "season": season},
                       f"season={season}/team={time_semente}")
            )
        # Historico completo, sem recorte de temporada: um request cada.
        tarefas.append(Tarefa("coachs", "coachs", {"team": time_semente}, f"team={time_semente}"))
        tarefas.append(
            Tarefa("transfers", "transfers", {"team": time_semente}, f"team={time_semente}")
        )

    jogos = jogos_da_semente()
    pares = pares_liga_temporada(jogos)

    # Onda 2 — as ligas saem dos proprios fixtures, entao nao precisamos
    # descobrir na mao em quais competicoes o clube entrou em cada ano.
    for liga in sorted({liga for _, liga in pares}):
        tarefas.append(Tarefa("leagues", "leagues", {"id": liga}, f"league={liga}"))
    for season, liga in sorted(pares, key=lambda p: (_ordem_da_liga(p[1]), p[0])):
        tarefas.append(
            Tarefa("teams", "teams", {"league": liga, "season": season},
                   f"season={season}/league={liga}")
        )
        # copa nao tem tabela de classificacao: a API devolve vazio e esse
        # vazio fica gravado, o que impede a gente de tentar de novo amanha
        tarefas.append(
            Tarefa("standings", "standings", {"league": liga, "season": season},
                   f"season={season}/league={liga}")
        )
        # Calendario da competicao inteira. O dataset e "fixtures_liga" mas o
        # endpoint continua "fixtures": ver o comentario em _fixtures_de()
        # para entender por que os dois nao podem se misturar.
        tarefas.append(
            Tarefa("fixtures_liga", "fixtures", {"league": liga, "season": season},
                   f"season={season}/league={liga}")
        )
        # Artilheiros oficiais da competicao. Um request devolve a lista inteira.
        #
        # Vale explicar por que este endpoint existe no catalogo: gol de jogador
        # tambem esta em fixture_events, mas a onda 3 cobre so os jogos da
        # semente — gols marcados em Palmeiras x Flamengo nao entram na nossa
        # base. Artilharia da competicao exigiria os 1.746 jogos detalhados
        # (~7.000 requests). Aqui sao 9.
        tarefas.append(
            Tarefa("topscorers", "players/topscorers", {"league": liga, "season": season},
                   f"season={season}/league={liga}")
        )

    # Onda 3 — o grosso do custo: quatro requests por jogo encerrado.
    #
    # A ordem e (prioridade da liga, temporada, jogo) e os quatro endpoints do
    # mesmo jogo saem juntos. Isso e proposital: um jogo completo vale mais que
    # quatro jogos pela metade, porque as telas so acendem quando o jogo fecha.
    ordenados = sorted(
        jogos_da_onda_3(), key=lambda j: (_ordem_da_liga(j[1]), j[0], j[2])
    )
    for season, liga, jogo in ordenados:
        for dataset, endpoint in POR_JOGO.items():
            if (dataset, liga) in SEM_DADO:
                continue
            tarefas.append(
                Tarefa(dataset, endpoint, {"fixture": jogo},
                       f"season={season}/league={liga}/fixture={jogo}")
            )

    return tarefas


def pendentes():
    return [t for t in montar_tarefas() if not apifootball.ja_extraido(t.dataset, t.caminho)]


# ------------------------------------------------------------ diagnostico


def diagnostico():
    """Onde a cota foi gasta para nao trazer nada.

    Le data/raw e cruza (dataset, liga) com quantos arquivos vieram sem uma
    linha. Um par 100% vazio com varios arquivos e candidato a entrar em
    SEM_DADO — e este e o unico jeito honesto de montar aquela lista, ja que a
    API nao documenta que competicao ela cobre.

    Vai ser o primeiro comando a rodar quando o plano pago abrir Libertadores e
    Sul-Americana, que sao competicoes de cobertura desconhecida para nos.
    """
    contagem = collections.defaultdict(lambda: [0, 0])  # [arquivos, vazios]
    for arquivo in apifootball.RAW.glob("*/**/*.json"):
        partes = arquivo.relative_to(apifootball.RAW).parts
        dataset = partes[0]
        # O `league=` pode estar num diretorio ou no nome do arquivo, e neste
        # segundo caso vem com o .json colado.
        liga = next(
            (p.split("=")[1].removesuffix(".json") for p in partes if p.startswith("league=")),
            "—",
        )
        documento = json.loads(arquivo.read_text(encoding="utf-8"))
        chave = (dataset, liga)
        contagem[chave][0] += 1
        if not documento.get("response"):
            contagem[chave][1] += 1

    print("cobertura do que ja foi extraido (vazio = requisicao gasta a toa)\n")
    print(f"  {'dataset':22} {'liga':>6} {'arquivos':>9} {'vazios':>7}  ")
    for (dataset, liga), (total, vazios) in sorted(contagem.items()):
        if not vazios:
            continue
        # VAZIO NEM SEMPRE E DESPERDICIO. Copa nao tem tabela de classificacao,
        # entao standings vazio ali e a resposta certa — e custou 1 requisicao
        # por liga-temporada, nao por jogo. So os quatro datasets por jogo
        # acumulam desperdicio de verdade, entao so eles recebem a sugestao.
        candidato = dataset in POR_JOGO and vazios == total and total >= 3
        marca = "  <- candidato a SEM_DADO" if candidato else ""
        print(f"  {dataset:22} {liga:>6} {total:>9} {vazios:>7}{marca}")

    ja_pulados = sum(
        1
        for _, liga, _ in jogos_da_onda_3()
        for dataset in POR_JOGO
        if (dataset, liga) in SEM_DADO
    )
    print(f"\n  SEM_DADO ja evita {ja_pulados} requisicao(oes) nesta fila.")


def resumo(tarefas):
    contagem = collections.Counter(t.dataset for t in tarefas)
    for dataset, quantidade in sorted(contagem.items()):
        print(f"  {dataset:20} {quantidade:5}")


def previsao(tarefas):
    """Quantos dias de cota a fila ainda custa, no plano atual."""
    if not tarefas:
        return
    dias = -(-len(tarefas) // ORCAMENTO)  # divisao para cima
    print(f"  ~{dias} execucao(oes) de {ORCAMENTO} requisicoes")


# ------------------------------------------------------------------ rodar


def main():
    apifootball.definir_ritmo(PLANOS[PLANO]["por_minuto"])
    gastos = 0

    # A lista e remontada a cada volta porque as ondas 2 e 3 so aparecem
    # depois que os fixtures da onda 1 estao em disco.
    while True:
        fila = pendentes()
        if not fila:
            print("Nada pendente — data/raw completo para o escopo atual.")
            break
        if gastos >= ORCAMENTO:
            print(f"\nOrcamento de {ORCAMENTO} requisicoes atingido nesta execucao.")
            print(f"Faltam {len(fila)} tarefa(s). Rode de novo amanha.")
            break

        print(f"\n{len(fila)} tarefa(s) pendente(s) [plano {PLANO}]:")
        resumo(fila)
        previsao(fila)
        print()

        for tarefa in fila:
            if gastos >= ORCAMENTO:
                break
            # O orcamento conta CHAMADAS, nao tarefas: uma tarefa paginada
            # gasta uma requisicao por pagina.
            antes = apifootball.chamadas
            try:
                payload = apifootball.buscar(
                    tarefa.endpoint, tarefa.params, paginado=tarefa.paginado
                )
            except apifootball.RecusadoPelaAPI as erro:
                # Nao da para insistir: ou a cota acabou, ou o plano nao cobre
                # o que pedimos. Sai limpo, dizendo o que ficou faltando.
                gastos += apifootball.chamadas - antes
                print(f"\nA API recusou: {erro}")
                print(f"{gastos} requisicao(oes) gastas. Restam {len(pendentes())} tarefa(s).")
                return
            except apifootball.RespostaPaginada as erro:
                # A requisicao ja foi gasta, mas NADA e gravado: um arquivo com
                # a primeira pagina viraria "assunto encerrado" para o
                # ja_extraido e o resto do dado nunca mais seria buscado.
                gastos += apifootball.chamadas - antes
                print(f"  ! {tarefa.dataset} {tarefa.caminho}: {erro}")
                continue
            gastos += apifootball.chamadas - antes
            apifootball.salvar_raw(
                tarefa.dataset, tarefa.caminho, tarefa.endpoint, tarefa.params, payload
            )
            print(
                f"[{gastos:4}/{ORCAMENTO}] {tarefa.dataset:20} {tarefa.caminho:36} "
                f"results={payload.get('results')} cota={apifootball.cota_restante}"
            )

    print(f"\n{gastos} requisicao(oes) gastas. Restam {len(pendentes())} tarefa(s).")


if __name__ == "__main__":
    import sys

    if "--diagnostico" in sys.argv:
        diagnostico()
    else:
        main()
