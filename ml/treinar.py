"""Treina um modelo de previsao de resultado e registra o experimento no MLflow.

    env/bin/python ml/treinar.py
    env/bin/mlflow ui --backend-store-uri sqlite:///ml/mlflow.db

Tres decisoes metodologicas governam este arquivo, e vale entender cada uma
antes de mexer:

1. A DIVISAO E TEMPORAL, nao aleatoria. Treina em 2022-2023, testa em 2024.
   Embaralhar as linhas usaria jogos de dezembro para prever jogos de marco —
   vazamento pela porta dos fundos, mesmo com as features ja protegidas contra
   ele no dbt.

2. NENHUMA COLUNA `alvo_*` ENTRA COMO FEATURE. A lista de features e explicita
   e escrita a mao justamente por isso: um `select *` com drop depois e o jeito
   mais facil de vazar o resultado para dentro do modelo sem perceber.

3. O BASELINE E "MANDANTE VENCE", nao a classe majoritaria. O mando sozinho
   acerta 48,2% nesta base. Um modelo que faz 50% nao aprendeu quase nada —
   comparar com 33% (tres classes equiprovaveis) daria uma falsa sensacao de
   sucesso.

Detalhe do grao: cada partida aparece DUAS vezes na base, uma por time, com as
features espelhadas. Isso e proposital (o silver e universal), mas significa que
a amostra efetiva e metade do numero de linhas.
"""

from pathlib import Path

import duckdb
import mlflow
import pandas as pd
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, log_loss
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

RAIZ = Path(__file__).resolve().parent.parent
WAREHOUSE = RAIZ / "data" / "warehouse.duckdb"
# O MLflow 3 aposentou o store em arquivo ("./mlruns") e exige um banco.
# SQLite resolve sem subir servico nenhum — mesma filosofia do DuckDB aqui.
BANCO = RAIZ / "ml" / "mlflow.db"
ARTEFATOS = RAIZ / "ml" / "artefatos"

SEASON_TESTE = 2024

# Features, escritas uma a uma de proposito. Tudo aqui e conhecido ANTES da
# bola rolar — as janelas do gold_features_partida terminam em "1 preceding".
FEATURES = [
    "eh_mandante",
    "jogo_n",
    "dias_descanso",
    "pontos_antes",
    "saldo_antes",
    "pts_5",
    "gols_pro_5",
    "gols_contra_5",
    "jogos_na_janela",
    "adv_jogo_n",
    "adv_dias_descanso",
    "adv_pontos_antes",
    "adv_saldo_antes",
    "adv_pts_5",
    "adv_gols_pro_5",
    "adv_gols_contra_5",
    "dif_pontos_antes",
    "dif_saldo_antes",
    "dif_forma_5",
]

ALVO = "alvo_resultado"


def carregar() -> pd.DataFrame:
    """Le o mart de features. Read-only para nao brigar com a API pelo lock."""
    with duckdb.connect(str(WAREHOUSE), read_only=True) as con:
        df = con.execute(
            """
            select
                season,
                data,
                mando = 'casa' as eh_mandante,
                jogo_n, dias_descanso, pontos_antes, saldo_antes,
                pts_5, gols_pro_5, gols_contra_5, jogos_na_janela,
                adv_jogo_n, adv_dias_descanso, adv_pontos_antes, adv_saldo_antes,
                adv_pts_5, adv_gols_pro_5, adv_gols_contra_5,
                dif_pontos_antes, dif_saldo_antes, dif_forma_5,
                alvo_resultado
            from gold_features_partida
            -- Sem historico nao ha o que aprender. Precisa dos DOIS lados:
            -- pts_5 nulo e o primeiro jogo do time na competicao, e
            -- adv_pts_5 nulo e o primeiro jogo do adversario. Sao 372 + 32
            -- linhas de 3.492 — cerca de 12%, quase tudo estreia de temporada.
            where pts_5 is not null and adv_pts_5 is not null
            order by data
            """
        ).df()
    return df


def preparar(df: pd.DataFrame):
    """Divide no tempo e confere que nao sobrou buraco.

    Nao imputamos nada: o filtro do SQL ja tira as linhas sem historico, e
    preencher NaN em silencio esconderia um problema de dado em vez de
    resolve-lo. Se aparecer nulo aqui, e porque o mart mudou — e melhor quebrar
    do que treinar com media inventada.
    """
    treino = df[df.season < SEASON_TESTE].copy()
    teste = df[df.season >= SEASON_TESTE].copy()

    faltando = df[FEATURES].isna().sum()
    if faltando.any():
        raise ValueError(
            "features com valores nulos:\n"
            + faltando[faltando > 0].to_string()
        )

    return (
        treino[FEATURES],
        treino[ALVO],
        teste[FEATURES],
        teste[ALVO],
        teste["eh_mandante"],
    )


def baseline_mandante(eh_mandante: pd.Series) -> pd.Series:
    """Sempre aposta no mandante: V se joga em casa, D se joga fora."""
    return eh_mandante.map({True: "V", False: "D"})


def registrar(nome, modelo, X_treino, y_treino, X_teste, y_teste, extras=None):
    """Treina, avalia e registra um run no MLflow."""
    with mlflow.start_run(run_name=nome):
        modelo.fit(X_treino, y_treino)
        previsto = modelo.predict(X_teste)
        prob = modelo.predict_proba(X_teste)

        acuracia = accuracy_score(y_teste, previsto)
        perda = log_loss(y_teste, prob, labels=list(modelo.classes_))

        mlflow.log_param("modelo", nome)
        mlflow.log_param("features", len(FEATURES))
        mlflow.log_param("linhas_treino", len(X_treino))
        mlflow.log_param("linhas_teste", len(X_teste))
        mlflow.log_param("season_teste", SEASON_TESTE)
        for chave, valor in (extras or {}).items():
            mlflow.log_param(chave, valor)

        mlflow.log_metric("acuracia", acuracia)
        mlflow.log_metric("log_loss", perda)

        relatorio = classification_report(y_teste, previsto, zero_division=0)
        mlflow.log_text(relatorio, "classification_report.txt")

        print(f"\n{'=' * 62}\n{nome}")
        print(f"  acuracia {acuracia:.3f} | log-loss {perda:.3f}")
        print(relatorio)
        return acuracia


def main():
    ARTEFATOS.mkdir(parents=True, exist_ok=True)
    # quatro barras porque o caminho e absoluto
    mlflow.set_tracking_uri(f"sqlite:///{BANCO}")
    # artifact_location nao e parametro de set_experiment no MLflow 3; o
    # experimento e criado com ele e depois selecionado pelo nome
    if mlflow.get_experiment_by_name("previsao-resultado") is None:
        mlflow.create_experiment(
            "previsao-resultado", artifact_location=f"file://{ARTEFATOS}"
        )
    mlflow.set_experiment("previsao-resultado")

    df = carregar()
    X_treino, y_treino, X_teste, y_teste, mandante_teste = preparar(df)

    print(f"treino: {len(X_treino)} linhas ({sorted(df.season.unique())[:-1]})")
    print(f"teste : {len(X_teste)} linhas ({SEASON_TESTE})")
    print(f"amostra efetiva: ~{len(X_teste) // 2} partidas no teste "
          "(cada uma aparece duas vezes, uma por time)")

    # ---- baseline 1: sempre o mandante ----------------------------------
    palpite = baseline_mandante(mandante_teste)
    base_mandante = accuracy_score(y_teste, palpite)
    with mlflow.start_run(run_name="baseline-mandante"):
        mlflow.log_param("modelo", "sempre o mandante vence")
        mlflow.log_metric("acuracia", base_mandante)
    print(f"\n{'=' * 62}\nbaseline-mandante\n  acuracia {base_mandante:.3f}")

    # ---- baseline 2: classe majoritaria ---------------------------------
    registrar(
        "baseline-majoritaria",
        DummyClassifier(strategy="most_frequent"),
        X_treino, y_treino, X_teste, y_teste,
    )

    # ---- modelo 1: regressao logistica ----------------------------------
    # StandardScaler porque a escala varia muito entre as colunas (pontos
    # acumulados vai a ~90, dias de descanso fica em ~7)
    registrar(
        "logistica",
        make_pipeline(
            StandardScaler(),
            # multi_class saiu do scikit-learn 1.9; multinomial virou o padrao
            LogisticRegression(max_iter=2000),
        ),
        X_treino, y_treino, X_teste, y_teste,
    )

    # ---- modelo 2: gradient boosting ------------------------------------
    # lida com nao-linearidade e nao precisa de escala
    acuracia_gb = registrar(
        "gradient-boosting",
        HistGradientBoostingClassifier(
            max_iter=300, learning_rate=0.06, max_depth=4, random_state=42
        ),
        X_treino, y_treino, X_teste, y_teste,
    )

    print(f"\n{'=' * 62}")
    print(f"baseline (mandante): {base_mandante:.3f}")
    print(f"melhor modelo      : {acuracia_gb:.3f}")
    diferenca = acuracia_gb - base_mandante
    print(f"ganho sobre o baseline: {diferenca:+.3f}")
    if diferenca <= 0.01:
        print("\nO modelo nao supera o baseline de forma relevante. Isso e um")
        print("resultado, nao um erro: as features atuais (forma, descanso,")
        print("mando) carregam pouco sinal alem do mando em si.")
    print(f"\nenv/bin/mlflow ui --backend-store-uri sqlite:///{BANCO}")


if __name__ == "__main__":
    main()
