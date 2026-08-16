"""Copia a camada de leitura do DuckDB para o Postgres.

    env/bin/python sincronizar.py

Roda DEPOIS do `dbt build` e antes de a API servir. O DuckDB transforma, o
Postgres serve — ver o cabecalho de api/db.py para o porque da separacao.

COMO A COPIA E FEITA. Nao ha exportacao para CSV nem laco em Python lendo linha
a linha: o proprio DuckDB tem uma extensao que ATTACHa um Postgres como se fosse
um banco local, e ai `create table pg.x as select * from x` roda dentro do
motor, em bloco. Menos codigo, menos conversao de tipo na mao, e mais rapido.

O QUE E COPIADO sao apenas as tabelas que a API le. Bronze e silver ficam no
DuckDB de proposito: sao insumo de transformacao, ninguem consulta pela tela, e
mandar tudo dobraria o tempo de sincronia sem servir a ninguem. A lista sai da
propria api/main.py, entao um endpoint novo que leia uma tabela nova quebra alto
aqui em vez de silenciosamente devolver erro no ambiente com Postgres.

IDEMPOTENTE: cada tabela e recriada do zero. Sincronia incremental precisaria de
chave e marca de tempo em cada mart, e o gold e pequeno — o maior tem 3.492
linhas. Complexidade que a escala nao pede.
"""

import os
import pathlib
import re
import sys

import duckdb
from dotenv import load_dotenv

# Le o .env como o apifootball.py ja fazia. Sem isso, rodar na maquina pega os
# valores padrao e falha contra um Postgres criado pelo compose com a senha do
# .env — o container recebe as variaveis pelo compose, o script no host nao
# recebia nada. O load_dotenv NAO sobrescreve variavel ja definida, entao dentro
# do container o que o compose passou continua valendo.
load_dotenv()

RAIZ = pathlib.Path(__file__).resolve().parent
WAREHOUSE = RAIZ / "data" / "warehouse.duckdb"

DSN = os.getenv("POSTGRES_DSN") or (
    f"host={os.getenv('POSTGRES_HOST', 'localhost')} "
    f"port={os.getenv('POSTGRES_PORT', '5432')} "
    f"dbname={os.getenv('POSTGRES_DB', 'futebol')} "
    f"user={os.getenv('POSTGRES_USER', 'futebol')} "
    f"password={os.getenv('POSTGRES_PASSWORD', 'futebol')}"
)


def tabelas_que_a_api_le():
    """Le api/main.py e devolve as tabelas citadas nas consultas.

    Derivar da fonte em vez de manter uma lista aqui evita o modo de falha mais
    chato: alguem adiciona um endpoint, esquece de atualizar a sincronia, e a
    tela quebra so no ambiente com Postgres — onde ninguem desenvolve.
    """
    fonte = (RAIZ / "api" / "main.py").read_text(encoding="utf-8")
    return sorted(set(re.findall(r"from\s+((?:gold|silver|bronze)_\w+)", fonte)))


def sincronizar(verboso=True):
    if not WAREHOUSE.exists():
        raise SystemExit(f"warehouse nao encontrado em {WAREHOUSE} — rode o dbt build antes")

    alvos = tabelas_que_a_api_le()

    # CONEXAO EM MEMORIA COMO INTERMEDIARIA, e isso nao e enfeite.
    #
    # A versao obvia — abrir o warehouse com read_only=True e dar ATTACH no
    # Postgres — falha com "Cannot execute statement of type CREATE on database
    # pg which is attached in read-only mode". O modo read-only vale para a
    # CONEXAO inteira, e todo banco anexado a ela herda a restricao, inclusive o
    # Postgres que a gente quer escrever.
    #
    # Abrir o warehouse em escrita resolveria e traria outro problema: tomaria o
    # lock exclusivo do DuckDB durante a copia, justamente o que a separacao de
    # papeis existe para evitar.
    #
    # Com um banco em memoria no meio, cada anexo tem o modo que precisa: o
    # warehouse entra read-only e o Postgres entra gravavel.
    con = duckdb.connect()
    con.execute(f"attach '{WAREHOUSE}' as wh (read_only)")

    existentes = {
        r[0]
        for r in con.execute(
            "select table_name from duckdb_tables() where database_name = 'wh'"
        ).fetchall()
    }
    ausentes = [t for t in alvos if t not in existentes]
    if ausentes:
        raise SystemExit(
            "a API le tabelas que nao existem no warehouse: "
            + ", ".join(ausentes)
            + "\nrode o dbt build antes de sincronizar"
        )

    con.execute("install postgres")
    con.execute("load postgres")
    con.execute(f"attach '{DSN}' as pg (type postgres)")

    for tabela in alvos:
        origem = f"wh.main.{tabela}"
        linhas = con.execute(f"select count(*) from {origem}").fetchone()[0]
        # drop + create, e nao "create or replace": o replace nao e suportado
        # atraves do attach do Postgres.
        con.execute(f"drop table if exists pg.public.{tabela}")
        con.execute(f"create table pg.public.{tabela} as select * from {origem}")
        if verboso:
            print(f"  {tabela:38} {linhas:>6} linhas")

    con.execute("detach pg")
    con.execute("detach wh")
    con.close()
    if verboso:
        print(f"\n{len(alvos)} tabelas sincronizadas.")
    return alvos


if __name__ == "__main__":
    print(f"sincronizando {WAREHOUSE.name} -> Postgres\n")
    try:
        sincronizar()
    except duckdb.Error as erro:
        # Sem chutar a causa: a primeira versao dizia "o Postgres esta de pe?"
        # e o erro real era attach em modo read-only, com o banco no ar. Palpite
        # errado em mensagem de erro custa mais tempo do que nenhum palpite.
        print(f"\nfalhou: {erro}\n", file=sys.stderr)
        print("por onde comecar:", file=sys.stderr)
        print("  - o Postgres responde?  docker compose up -d postgres", file=sys.stderr)
        print("  - o warehouse existe?   cd transform && dbt build", file=sys.stderr)
        print("  - as credenciais batem? POSTGRES_* no ambiente", file=sys.stderr)
        raise SystemExit(1)
