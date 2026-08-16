# Extrai, transforma, sincroniza e orquestra.
#
# Uma imagem, dois usos: `docker compose run pipeline` executa a corrente uma
# vez e morre; o servico `dagster` usa a mesma imagem para subir a interface de
# orquestracao. Duplicar isso em duas imagens so faria as duas divergirem.
#
# Python 3.13 e nao 3.14: o dagster-dbt exige <3.14. Fixar a versao aqui e o que
# permite orquestrar sem tocar no venv 3.14 da maquina.
FROM python:3.13-slim

WORKDIR /app

# git e exigido pelo dagster (GitPython) e nao vem na imagem slim.
RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-pipeline.txt .
RUN pip install --no-cache-dir -r requirements-pipeline.txt

COPY apifootball.py extrair.py sincronizar.py ./
COPY transform/ ./transform/
COPY orquestracao/ ./orquestracao/
COPY api/main.py ./api/main.py

# O manifest do dbt e o que o dagster-dbt le para montar um asset por model.
# Gerado na construcao da imagem para o Dagster subir instantaneo — sem isso
# ele parsearia o projeto a cada carga da interface.
RUN cd transform && dbt parse --profiles-dir . || echo "manifest sera gerado no runtime"

ENV DAGSTER_HOME=/app/.dagster
RUN mkdir -p $DAGSTER_HOME
COPY orquestracao/dagster.yaml $DAGSTER_HOME/dagster.yaml

CMD ["bash", "-c", "cd transform && dbt build && cd .. && python sincronizar.py"]
