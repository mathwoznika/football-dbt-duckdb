"""Compara a API rodando sobre DuckDB e sobre Postgres.

    # DuckDB numa porta, Postgres na outra
    env/bin/uvicorn api.main:app --port 8011 &
    docker compose up -d
    env/bin/python verificar_bancos.py

POR QUE ISTO EXISTE. A API atende dois bancos com o mesmo SQL, o que so funciona
porque toda agregacao mora no dbt. Mas "o mesmo SQL" nao garante "o mesmo
resultado": ha diferenca de dialeto que o DuckDB perdoa e o Postgres nao, e ela
nao aparece na compilacao nem no `dbt build` — aparece como 500 numa rota
especifica, no ambiente onde ninguem desenvolve.

Duas ja aconteceram, e nenhuma seria pega por teste de tipo:

  - parametro usado so em `? is null` nao tem tipo inferivel no Postgres, que
    responde "could not determine data type of parameter $2". Exige cast.
  - `year(data)` existe no DuckDB e nao no Postgres. Exige `extract`.

O script bate status e corpo dos dois lados em todas as rotas. Rodar depois de
mexer em qualquer consulta e mais barato que descobrir no deploy.
"""

import json
import sys
import urllib.error
import urllib.request

DUCKDB = "http://127.0.0.1:8011"
POSTGRES = "http://localhost:8000"

# Rotas com parametros representativos. O que importa aqui e exercitar os
# CAMINHOS de SQL, entao toda rota com filtro opcional aparece duas vezes: uma
# sem o filtro (onde o parametro chega nulo, que foi o caso que quebrou) e uma
# com ele.
ROTAS = [
    "/resumo",
    "/destaques",
    "/competicoes",
    "/times",
    "/times?busca=cor",
    "/times/147",
    "/times/147/temporadas",
    "/times/147/campanha",
    "/times/147/campanha?season=2023&league_id=71",
    "/times/147/confrontos",
    "/times/147/desempenho-por-tempo",
    "/times/147/gols-por-periodo",
    "/times/147/gols-por-periodo?season=2023&league_id=71",
    "/times/147/cartoes-por-periodo",
    "/times/147/cartoes-por-periodo?season=2023&league_id=71",
    "/times/147/disciplina",
    "/times/147/origem-dos-gols",
    "/times/147/banco",
    "/times/147/estatisticas-temporada",
    "/times/147/formacoes",
    "/times/147/formacoes?season=2023",
    "/times/147/forca-adversario",
    "/times/147/tecnicos",
    "/times/147/arbitragem",
    "/times/147/elenco",
    "/times/147/elenco?season=2023&league_id=71",
    "/times/147/transferencias",
    "/times/147/transferencias?desde=2024",
    "/jogadores",
    "/jogadores?busca=hen",
    "/jogadores/1234/temporadas",
    "/jogos/838005",
    "/jogos/838005/escalacoes",
    "/jogos/838005/estatisticas",
    "/jogos/838005/eventos",
    "/competicoes/71/temporadas/2023/classificacao",
    "/competicoes/71/temporadas/2023/artilheiros",
    "/competicoes/71/temporadas/2023/evolucao",
    "/competicoes/73/temporadas/2022/chaveamento",
]


def buscar(base, rota):
    try:
        with urllib.request.urlopen(base + rota, timeout=30) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, None
    except Exception as e:  # servidor fora do ar
        return None, str(e)


def main():
    falhas = []
    for rota in ROTAS:
        sd, cd = buscar(DUCKDB, rota)
        sp, cp = buscar(POSTGRES, rota)

        if sd is None or sp is None:
            print(f"  ?  {rota}\n     inacessivel: duckdb={cd} postgres={cp}")
            falhas.append(rota)
            continue

        if sd != sp:
            print(f"  x  {rota}\n     status difere: duckdb={sd} postgres={sp}")
            falhas.append(rota)
            continue

        # Comparacao pelo JSON serializado com chaves ordenadas: pega diferenca
        # de valor e de tipo (1 contra 1.0, "2023-01-01" contra data) que uma
        # simples contagem de linhas deixaria passar.
        if json.dumps(cd, sort_keys=True, default=str) != json.dumps(
            cp, sort_keys=True, default=str
        ):
            n_d = len(cd) if isinstance(cd, list) else 1
            n_p = len(cp) if isinstance(cp, list) else 1
            print(f"  x  {rota}\n     corpo difere (duckdb {n_d} vs postgres {n_p} registros)")
            falhas.append(rota)
            continue

        print(f"  ok {rota}")

    print(f"\n{len(ROTAS) - len(falhas)} de {len(ROTAS)} rotas identicas nos dois bancos.")
    if falhas:
        print("divergentes: " + ", ".join(falhas))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
