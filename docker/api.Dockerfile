# API do projeto. Python 3.13 e nao 3.14 de proposito: e a versao que o
# dagster-dbt aceita, e manter as duas imagens no mesmo interpretador evita
# descobrir uma incompatibilidade so quando o Dagster entrar.
FROM python:3.13-slim

WORKDIR /app

# As dependencias entram antes do codigo para o cache da camada sobreviver a
# cada edicao de endpoint. Sem isso, mudar uma linha de main.py reinstalaria
# tudo.
COPY requirements-api.txt .
RUN pip install --no-cache-dir -r requirements-api.txt

COPY api/ ./api/

# Le do Postgres, nao do arquivo DuckDB — o compose sobrescreve se precisar.
ENV BANCO=postgres

EXPOSE 8000
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
