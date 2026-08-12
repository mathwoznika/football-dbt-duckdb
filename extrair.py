"""O que extrair da API-Football. Este e o arquivo que voce edita.

    python extrair.py

Rodar varias vezes e seguro: o que ja esta em data/raw e pulado sem gastar
requisicao. Como a cota do Free e de 100 por dia e o escopo passa de 700
chamadas, a rotina normal e rodar todo dia ate as pendencias zerarem.

O escopo se monta em ondas porque um dado depende do outro: so da para pedir a
escalacao de um jogo depois de saber que o jogo existe. As ondas 2 e 3 saem da
leitura de data/raw, entao descobrir o que falta nao custa nenhuma requisicao.

Sao extraidos dois calendarios diferentes, e a distincao importa:

  fixtures       jogos do Coritiba. E daqui que sai a onda 3, cara.
  fixtures_liga  jogos de todas as competicoes que ele disputou. Sai barato
                 (um request por liga/temporada) e serve para calcular forma e
                 sequencia dos adversarios entre si.
"""

import collections
import json

import api

TIME = 147  # Coritiba
SEASONS = [2022, 2023, 2024]  # janela que o plano Free libera
ORCAMENTO = 95  # teto de requisicoes por execucao

# Um request por jogo, cada um. Sao estes quatro que dominam o custo total.
POR_JOGO = {
    "fixture_statistics": "fixtures/statistics",
    "fixture_events": "fixtures/events",
    "fixture_lineups": "fixtures/lineups",
    "fixture_players": "fixtures/players",
}

# Jogo que nao rolou nao tem estatistica, escalacao nem evento para buscar.
ENCERRADO = {"FT", "AET", "PEN"}


def jogos_conhecidos():
    """Le os fixtures ja gravados em data/raw. Nao chama a API.

    Devolve (season, liga, id do jogo) de cada partida encerrada. Como a busca
    e por time, vem tudo que o Coritiba jogou: Serie A, Serie B, estadual e copa.
    """
    jogos = set()
    # Le apenas o dataset "fixtures" (jogos do Coritiba), nunca "fixtures_liga":
    # a onda 3 custa 4 requests por jogo, e incluir aqui os jogos das ligas
    # inteiras levaria o escopo de 672 para mais de 7.000 requisicoes.
    for arquivo in sorted(api.RAW.glob("fixtures/season=*/*.json")):
        documento = json.loads(arquivo.read_text(encoding="utf-8"))
        for jogo in documento.get("response", []):
            if jogo["fixture"]["status"]["short"] in ENCERRADO:
                jogos.add(
                    (jogo["league"]["season"], jogo["league"]["id"], jogo["fixture"]["id"])
                )
    return sorted(jogos)


def montar_tarefas():
    """Lista de (dataset, endpoint, params, caminho dentro de data/raw)."""
    tarefas = []

    # Onda 1 — o que depende so do time. O calendario vem inteiro num request
    # por temporada, ja com todas as competicoes que ele disputou.
    for season in SEASONS:
        tarefas.append(
            ("fixtures", "fixtures", {"team": TIME, "season": season},
             f"season={season}/team={TIME}")
        )
    # Historico completo, sem recorte de temporada: um request cada.
    tarefas.append(("coachs", "coachs", {"team": TIME}, f"team={TIME}"))
    tarefas.append(("transfers", "transfers", {"team": TIME}, f"team={TIME}"))

    jogos = jogos_conhecidos()

    # Onda 2 — as ligas saem dos proprios fixtures, entao nao precisamos
    # descobrir na mao em quais competicoes o Coritiba entrou em cada ano.
    pares = sorted({(season, liga) for season, liga, _ in jogos})
    for liga in sorted({liga for _, liga in pares}):
        tarefas.append(("leagues", "leagues", {"id": liga}, f"league={liga}"))
    for season, liga in pares:
        tarefas.append(
            ("teams", "teams", {"league": liga, "season": season},
             f"season={season}/league={liga}")
        )
        # copa nao tem tabela de classificacao: a API devolve vazio e esse
        # vazio fica gravado, o que impede a gente de tentar de novo amanha
        tarefas.append(
            ("standings", "standings", {"league": liga, "season": season},
             f"season={season}/league={liga}")
        )
        # Calendario da competicao inteira. O dataset e "fixtures_liga" mas o
        # endpoint continua "fixtures": ver o comentario em jogos_conhecidos()
        # para entender por que os dois nao podem se misturar.
        tarefas.append(
            ("fixtures_liga", "fixtures", {"league": liga, "season": season},
             f"season={season}/league={liga}")
        )

    # Onda 3 — o grosso do custo: quatro requests por jogo encerrado.
    for season, liga, jogo in jogos:
        for dataset, endpoint in POR_JOGO.items():
            tarefas.append(
                (dataset, endpoint, {"fixture": jogo},
                 f"season={season}/league={liga}/fixture={jogo}")
            )

    return tarefas


def pendentes():
    return [t for t in montar_tarefas() if not api.ja_extraido(t[0], t[3])]


def resumo(tarefas):
    contagem = collections.Counter(dataset for dataset, _, _, _ in tarefas)
    for dataset, quantidade in sorted(contagem.items()):
        print(f"  {dataset:20} {quantidade:5}")


def main():
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

        print(f"\n{len(fila)} tarefa(s) pendente(s):")
        resumo(fila)
        print()

        for dataset, endpoint, params, caminho in fila:
            if gastos >= ORCAMENTO:
                break
            try:
                payload = api.buscar(endpoint, params)
            except api.RecusadoPelaAPI as erro:
                # Nao da para insistir: ou a cota acabou, ou o plano nao cobre
                # o que pedimos. Sai limpo, dizendo o que ficou faltando.
                print(f"\nA API recusou: {erro}")
                print(f"{gastos} requisicao(oes) gastas. Restam {len(pendentes())} tarefa(s).")
                return
            gastos += 1
            api.salvar_raw(dataset, caminho, endpoint, params, payload)
            print(
                f"[{gastos:4}/{ORCAMENTO}] {dataset:20} {caminho:36} "
                f"results={payload.get('results')} cota={api.cota_restante}"
            )

    print(f"\n{gastos} requisicao(oes) gastas. Restam {len(pendentes())} tarefa(s).")


if __name__ == "__main__":
    main()
