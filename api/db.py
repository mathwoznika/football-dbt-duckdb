"""Conexao com a camada de leitura. Fala DuckDB ou Postgres.

POR QUE DOIS BANCOS, e nao um so. O DuckDB aceita OU um processo escrevendo OU
varios lendo — a UI aberta impede o `dbt build`, e a API aberta tambem. Isso e
tolerado no desenvolvimento, onde a API abre em read_only e quem roda o dbt
fecha o resto. Nao e tolerado com a aplicacao no ar, onde o pipeline transforma
enquanto alguem navega.

A saida nao e trocar de banco, e separar papeis: o DuckDB transforma, porque le
770 JSONs aninhados sem esforco e o Postgres nao; o Postgres serve, porque
aguenta leitura concorrente e o DuckDB nao. O `sincronizar.py` copia o gold de
um para o outro no fim de cada build.

QUAL BANCO usar vem da variavel BANCO:

    BANCO=duckdb    (padrao) desenvolvimento na maquina, sem subir nada
    BANCO=postgres  docker-compose, com o warehouse ja sincronizado

O SQL dos endpoints e o mesmo nos dois. Isso nao foi sorte: e consequencia da
regra de que a API nao calcula. Como toda agregacao mora no dbt, o que sobra nas
rotas e `select ... where ... order by`, que e ANSI puro. A unica diferenca de
dialeto e o marcador de parametro, tratado abaixo.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# Permite rodar a API na maquina contra o Postgres do compose sem exportar
# variavel na mao. Nao sobrescreve o que ja veio do ambiente, entao dentro do
# container vale o que o compose definiu.
load_dotenv()

BANCO = os.getenv("BANCO", "duckdb").lower()

WAREHOUSE = Path(__file__).resolve().parent.parent / "data" / "warehouse.duckdb"

# Montada a partir de partes para o compose poder definir so o que muda.
POSTGRES_DSN = os.getenv("POSTGRES_DSN") or (
    f"host={os.getenv('POSTGRES_HOST', 'localhost')} "
    f"port={os.getenv('POSTGRES_PORT', '5432')} "
    f"dbname={os.getenv('POSTGRES_DB', 'futebol')} "
    f"user={os.getenv('POSTGRES_USER', 'futebol')} "
    f"password={os.getenv('POSTGRES_PASSWORD', 'futebol')}"
)

_pool = None


def _pool_postgres():
    """Pool criado na primeira consulta, e nao na importacao do modulo.

    Importar este arquivo nao pode exigir um banco de pe: os testes, o
    `--help` da API e qualquer script que so queira ler POSTGRES_DSN quebrariam
    se a conexao fosse aberta aqui em cima.
    """
    global _pool
    if _pool is None:
        try:
            from psycopg_pool import ConnectionPool
        except ImportError as erro:
            # O venv de desenvolvimento nao tem psycopg, de proposito: fora do
            # compose o backend padrao e o DuckDB e o driver seria peso morto.
            raise RuntimeError(
                "BANCO=postgres exige o psycopg, que nao esta neste ambiente.\n"
                "Dentro do compose ele ja vem na imagem. Para rodar a API na "
                "maquina contra o Postgres do compose:\n"
                "  env/bin/pip install 'psycopg[binary]' psycopg-pool"
            ) from erro

        _pool = ConnectionPool(POSTGRES_DSN, min_size=1, max_size=8, open=True)
    return _pool


def consultar(sql: str, params: list | None = None) -> list[dict]:
    """Roda o SQL e devolve uma lista de dicionarios, pronta para virar JSON."""
    if BANCO == "postgres":
        return _consultar_postgres(sql, params or [])
    return _consultar_duckdb(sql, params or [])


def _consultar_duckdb(sql: str, params: list) -> list[dict]:
    """Read-only de proposito: em modo escrita, um `dbt run` travaria a API.

    A conexao abre e fecha a cada consulta. Nessa escala o custo e irrelevante,
    e em troca o arquivo nunca fica preso por um processo ocioso.
    """
    import duckdb

    with duckdb.connect(str(WAREHOUSE), read_only=True) as con:
        resultado = con.execute(sql, params)
        colunas = [d[0] for d in resultado.description]
        return [dict(zip(colunas, linha)) for linha in resultado.fetchall()]


def _consultar_postgres(sql: str, params: list) -> list[dict]:
    """Mesmo SQL, outro marcador de parametro.

    DUAS TROCAS, E A ORDEM IMPORTA.

    O DuckDB usa `?` e o psycopg usa `%s` — essa e a obvia. A segunda nao e: o
    psycopg trata `%` como inicio de marcador, entao qualquer `%` literal do SQL
    precisa virar `%%` antes. Sem isso, o `like lower('%' || ? || '%')` da busca
    de clube explode com "only '%s', '%b', '%t' are allowed as placeholders,
    got '%''" — e so nas rotas que buscam por nome.

    Escapar PRIMEIRO e inserir os marcadores DEPOIS. Na ordem inversa, o `%s`
    recem-criado viraria `%%s` e deixaria de ser marcador.

    A troca de `?` e segura porque nenhuma consulta do projeto tem `?` dentro de
    string. O verificar_bancos.py guarda as duas coisas comparando as respostas
    dos dois bancos rota a rota.

    Ao contrario do DuckDB, aqui a conexao vem de um pool: abrir conexao no
    Postgres custa ordens de grandeza mais, e servir leitura concorrente e
    justamente o motivo de ele existir neste projeto.
    """
    traduzido = sql.replace("%", "%%").replace("?", "%s")
    with _pool_postgres().connection() as con:
        with con.cursor() as cur:
            cur.execute(traduzido, params)
            colunas = [d[0] for d in cur.description]
            return [dict(zip(colunas, linha)) for linha in cur.fetchall()]
