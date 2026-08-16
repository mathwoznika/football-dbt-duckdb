"""Orquestracao do pipeline no Dagster.

    docker compose --profile orquestracao up -d dagster
    http://localhost:3000

O QUE ELE RESOLVE, concretamente. Sao tres etapas com dependencia e ritmos
diferentes: extrair (uma vez por dia, limitado por cota), transformar (depois da
extracao) e sincronizar para o Postgres (depois da transformacao). Rodadas a
mao, a etapa esquecida e sempre a do meio — ja aconteceu de a extracao rodar e
as telas nao mudarem porque faltou o `dbt build`. Aqui a ordem e declarada, nao
lembrada.

POR QUE dbt-core 1.11 E NAO 1.12. O `dagster-dbt` exige `dbt-core<1.12`. Sem
isso o pip nao falha — ele desce silenciosamente para uma versao de 2021 que
nao tem `@dbt_assets` e ainda arrasta um `agate` velho. Testamos o projeto
inteiro em 1.11.13 antes de fixar: 173 passos, zero erro. Ver o
requirements-pipeline.txt.

O GRAFO. Cada model do dbt vira um asset proprio, o que e a razao de usar o
dagster-dbt em vez de chamar `dbt build` por subprocess: da para ver quais
marts dependem de que, materializar so um ramo, e ler o resultado dos testes
como metadado do asset.
"""

import sys
from pathlib import Path

from dagster import (
    AssetExecutionContext,
    AssetKey,
    AssetSpec,
    Definitions,
    MaterializeResult,
    MetadataValue,
    DefaultScheduleStatus,
    ScheduleDefinition,
    asset,
    define_asset_job,
    multi_asset,
)
from dagster_dbt import DbtCliResource, DbtProject, dbt_assets

RAIZ = Path(__file__).resolve().parent.parent

def _raiz_no_path():
    """Garante que extrair.py e sincronizar.py sejam importaveis.

    CHAMADA DENTRO DE CADA ASSET, e nao no topo do modulo — foi onde a primeira
    tentativa falhou. O executor multiprocesso do Dagster roda cada step num
    processo filho que NAO reimporta este modulo: ele reconstroi o job a partir
    do que foi serializado. Efeito colateral no nivel do modulo simplesmente nao
    acontece la, e o `import extrair` morria com ModuleNotFoundError apesar de o
    caminho estar certo no processo que carregou as definicoes.

    Dentro da funcao, roda em qualquer processo que execute o step.
    """
    if str(RAIZ) not in sys.path:
        sys.path.insert(0, str(RAIZ))

PROJETO_DBT = DbtProject(project_dir=RAIZ / "transform")
PROJETO_DBT.prepare_if_dev()

def datasets_do_raw():
    """Os datasets declarados em sources.yml, lidos do proprio arquivo.

    Derivar em vez de repetir a lista aqui: acrescentar um endpoint passa a
    exigir edicao num lugar so, e o grafo do Dagster nunca fica dessincronizado
    do que o dbt enxerga.
    """
    import yaml

    fonte = yaml.safe_load((RAIZ / "transform" / "models" / "sources.yml").read_text())
    for origem in fonte["sources"]:
        if origem["name"] == "raw":
            return [t["name"] for t in origem["tables"]]
    return []


DATASETS = datasets_do_raw()

# As chaves que o dagster-dbt da as sources: [nome_da_source, nome_da_tabela].
# O asset de extracao precisa produzir exatamente estas para o grafo se ligar.
CHAVES_RAW = [AssetKey(["raw", nome]) for nome in DATASETS]


@multi_asset(
    specs=[
        AssetSpec(
            key=chave,
            description=f"JSON cru de {nome} em data/raw.",
            kinds={"json", "api"},
        )
        for chave, nome in zip(CHAVES_RAW, DATASETS)
    ],
)
def raw_api_football(context: AssetExecutionContext):
    """Roda a fila de extracao ate o orcamento do dia acabar.

    UM ASSET COM DOZE SAIDAS, e nao doze assets. A primeira versao tentou
    colapsar as doze sources numa chave unica e o Dagster recusou: cada recurso
    do dbt precisa de chave propria. Doze assets independentes tambem seria
    errado — sugeriria que da para materializar `leagues` sem `fixtures`, e nao
    da: a fila e uma so, ordenada por dependencia e limitada por cota. O
    multi_asset descreve o que de fato acontece — uma execucao, doze destinos.

    Nao falha quando a cota termina: isso e operacao normal, nao erro. O escopo
    completo passa de 600 chamadas e o plano Free da 100 por dia, entao a
    materializacao "certa" e parcial na maioria dos dias. Falhar aqui deixaria o
    dbt sem rodar por um motivo que nao e problema.
    """
    _raiz_no_path()
    import extrair

    pendentes_antes = len(extrair.pendentes())
    extrair.main()
    pendentes_depois = len(extrair.pendentes())

    context.log.info(
        f"{pendentes_antes - pendentes_depois} tarefas buscadas, "
        f"{pendentes_depois} pendentes"
    )
    for chave in CHAVES_RAW:
        yield MaterializeResult(
            asset_key=chave,
            metadata={
                "tarefas_pendentes": pendentes_depois,
                "buscadas_nesta_execucao": pendentes_antes - pendentes_depois,
                "fila_zerada": pendentes_depois == 0,
            },
        )


@dbt_assets(manifest=PROJETO_DBT.manifest_path)
def marts_dbt(context: AssetExecutionContext, dbt: DbtCliResource):
    """Os 45 models e os testes, cada um como asset.

    `build` e nao `run`: assim os testes rodam junto e um mart que quebrou uma
    asercao aparece vermelho no grafo, em vez de verde com dado errado dentro.
    """
    yield from dbt.cli(["build"], context=context).stream()


@asset(
    deps=[marts_dbt],
    compute_kind="postgres",
    description=(
        "Copia a camada de leitura do DuckDB para o Postgres, que e quem "
        "serve a API."
    ),
)
def warehouse_postgres(context: AssetExecutionContext):
    """Ultima etapa: sem ela o dbt roda e a aplicacao continua mostrando o dado antigo.

    E exatamente o passo que se esquece quando a orquestracao e manual.
    """
    _raiz_no_path()
    import sincronizar

    tabelas = sincronizar.sincronizar(verboso=False)
    context.add_output_metadata(
        {
            "tabelas": len(tabelas),
            "lista": MetadataValue.md("\n".join(f"- {t}" for t in tabelas)),
        }
    )


# Um job com tudo, agendado uma vez por dia. O horario e de madrugada porque a
# cota da API-Football reinicia em UTC e assim a execucao pega o dia cheio.
job_diario = define_asset_job("pipeline_diario", selection="*")

agenda_diaria = ScheduleDefinition(
    job=job_diario,
    cron_schedule="0 6 * * *",
    execution_timezone="America/Sao_Paulo",
    # Agendamento nasce LIGADO. O padrao do Dagster e criar parado, o que faz
    # sentido em producao compartilhada — nao aqui, onde subir o servico e a
    # propria declaracao de que se quer o pipeline rodando.
    default_status=DefaultScheduleStatus.RUNNING,
)

defs = Definitions(
    assets=[raw_api_football, marts_dbt, warehouse_postgres],
    jobs=[job_diario],
    schedules=[agenda_diaria],
    resources={
        "dbt": DbtCliResource(
            project_dir=PROJETO_DBT,
            profiles_dir=str(RAIZ / "transform"),
        )
    },
)
