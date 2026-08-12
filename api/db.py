"""Conexao com o warehouse. Read-only de proposito.

O DuckDB aceita OU um processo escrevendo OU varios lendo. Se a API abrisse em
modo escrita, um dbt run travaria — e vice-versa. Em read-only, varios leitores
convivem, que e tudo que uma API de consulta precisa.

A conexao abre e fecha a cada consulta. Nessa escala o custo e irrelevante, e
em troca o arquivo nunca fica preso por um processo ocioso.
"""

from pathlib import Path

import duckdb

WAREHOUSE = Path(__file__).resolve().parent.parent / "data" / "warehouse.duckdb"


def consultar(sql: str, params: list | None = None) -> list[dict]:
    """Roda o SQL e devolve uma lista de dicionarios, pronta para virar JSON."""
    with duckdb.connect(str(WAREHOUSE), read_only=True) as con:
        resultado = con.execute(sql, params or [])
        colunas = [d[0] for d in resultado.description]
        return [dict(zip(colunas, linha)) for linha in resultado.fetchall()]
