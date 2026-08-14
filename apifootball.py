"""Conversa com a API-Football e grava a resposta crua em data/raw.

Este arquivo e o encanamento: escreve uma vez e quase nunca mexe. O que muda
de semana para semana (quais ligas, quais temporadas) esta em extrair.py.

Regra da casa: aqui ninguem interpreta dado. A resposta e gravada como veio,
inteira. Tratar custa zero depois; buscar de novo custa cota e dias de espera.
"""

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()

CHAVE = os.getenv("API_FOOTBALL_KEY") or os.getenv("API-KEY")
BASE = (os.getenv("API_FOOTBALL_URL") or os.getenv("URL") or "").rstrip("/")
RAW = Path(__file__).resolve().parent / "data" / "raw"

# Intervalo entre chamadas, em segundos. O Free aceita 10 por minuto e 6.5s
# deixa folga. Quem manda nisto e o extrair.py, via definir_ritmo() — no plano
# pago manter 6.5s faria uma extracao de 7.000 chamadas levar treze horas.
INTERVALO = 6.5

# Quanto ainda resta da cota diaria, segundo o header da ultima resposta.
cota_restante = None

# Quantas chamadas HTTP sairam daqui nesta execucao. O extrair.py conta o
# orcamento por este numero e nao por tarefa concluida, porque uma tarefa
# paginada gasta varias requisicoes.
chamadas = 0

_ultima_chamada = 0.0


def definir_ritmo(por_minuto):
    """Ajusta o intervalo entre chamadas ao limite do plano, com 10% de folga."""
    global INTERVALO
    if por_minuto and por_minuto > 0:
        INTERVALO = (60.0 / por_minuto) * 1.1


class RecusadoPelaAPI(Exception):
    """A API entendeu o pedido e recusou (plano, cota, chave invalida).

    Isso nao e falha temporaria: tentar de novo so gasta mais uma requisicao.
    """


class RespostaPaginada(Exception):
    """A resposta tem mais de uma pagina e o chamador nao pediu paginacao.

    Existe para transformar perda silenciosa em erro alto. Gravar so a primeira
    pagina seria pior que falhar: `ja_extraido` trata arquivo em disco como
    assunto encerrado, entao o resto do dado nunca mais seria buscado — e o
    truncamento so apareceria muito depois, como um total que nao fecha.

    Hoje nenhum endpoint do escopo pagina (476 arquivos, todos com
    paging.total = 1). O caso conhecido que vai paginar e /players?league&season
    no plano pago, com ~30 paginas por liga-temporada.
    """


def buscar(endpoint, params, paginado=False):
    """Chama a API e devolve o JSON exatamente como veio.

    Cuida sozinho do intervalo entre chamadas e de tentar de novo quando o
    problema e passageiro (429 ou erro do servidor).

    Com paginado=False (o padrao) uma resposta de varias paginas levanta
    RespostaPaginada em vez de devolver a primeira — ver a classe para o porque.
    Com paginado=True as paginas sao lidas em sequencia e concatenadas; o
    envelope guarda quantas foram, para a gravacao continuar auditavel.
    """
    if paginado:
        return _buscar_paginas(endpoint, params)
    return _buscar_pagina(endpoint, params)


def _buscar_paginas(endpoint, params):
    """Le todas as paginas e devolve um envelope com o response concatenado.

    Concatenar e nao gravar uma pagina por arquivo mantem a promessa da casa —
    nada e descartado — e deixa o dbt continuar lendo um arquivo por resposta
    logica. `paging.lidas` registra o que foi juntado.
    """
    primeira = _buscar_pagina(endpoint, params, aceita_paginas=True)
    total = (primeira.get("paging") or {}).get("total") or 1
    if total <= 1:
        return primeira

    resposta = list(primeira.get("response") or [])
    for pagina in range(2, total + 1):
        seguinte = _buscar_pagina(
            endpoint, {**params, "page": pagina}, aceita_paginas=True
        )
        resposta.extend(seguinte.get("response") or [])

    return {
        **primeira,
        "response": resposta,
        "results": len(resposta),
        "paging": {**(primeira.get("paging") or {}), "lidas": total},
    }


def _buscar_pagina(endpoint, params, aceita_paginas=False):
    global _ultima_chamada, cota_restante, chamadas

    for tentativa in range(3):
        espera = INTERVALO - (time.monotonic() - _ultima_chamada)
        if _ultima_chamada and espera > 0:
            time.sleep(espera)

        resposta = requests.get(
            f"{BASE}/{endpoint}",
            params=params,
            headers={"x-apisports-key": CHAVE},
            timeout=30,
        )
        _ultima_chamada = time.monotonic()
        chamadas += 1

        if resposta.headers.get("x-ratelimit-requests-remaining"):
            cota_restante = resposta.headers["x-ratelimit-requests-remaining"]

        # O 429 tem duas causas bem diferentes e so uma delas vale insistir:
        # estourar as 10 chamadas por minuto passa em segundos, mas acabar a
        # cota do dia so passa amanha. Quem separa as duas e a cota restante.
        if resposta.status_code == 429:
            restante = resposta.headers.get(
                "x-ratelimit-requests-remaining", cota_restante
            )
            if str(restante) == "0":
                raise RecusadoPelaAPI(
                    "cota diaria esgotada — rode de novo amanha para continuar"
                )
            pausa = INTERVALO * 2 ** (tentativa + 1)
            print(f"  ! limite por minuto, esperando {pausa:.0f}s")
            time.sleep(pausa)
            continue

        if resposta.status_code >= 500:
            pausa = INTERVALO * 2 ** (tentativa + 1)
            print(f"  ! HTTP {resposta.status_code}, esperando {pausa:.0f}s")
            time.sleep(pausa)
            continue

        resposta.raise_for_status()
        payload = resposta.json()

        # Pegadinha da API-Football: ela responde HTTP 200 mesmo quando recusa
        # o pedido. O motivo vem no corpo, em "errors" — lista vazia quando
        # esta tudo certo, dicionario quando tem problema.
        erros = payload.get("errors")
        if isinstance(erros, dict) and erros:
            raise RecusadoPelaAPI("; ".join(f"{k}: {v}" for k, v in erros.items()))

        # Truncamento silencioso morre aqui. Sem esta guarda, gravariamos a
        # pagina 1 como se fosse a resposta inteira e o ja_extraido daria o
        # assunto por encerrado para sempre.
        total = (payload.get("paging") or {}).get("total") or 1
        if total > 1 and not aceita_paginas:
            raise RespostaPaginada(
                f"{endpoint} devolveu {total} paginas e a tarefa nao pede "
                f"paginacao — marque paginado=True em extrair.py"
            )

        return payload

    raise RuntimeError(f"{endpoint} falhou depois de 3 tentativas")


def arquivo_de(dataset, caminho):
    """data/raw/<dataset>/<caminho>.json"""
    return RAW / dataset / f"{caminho}.json"


def ja_extraido(dataset, caminho):
    """Arquivo em disco significa cota ja gasta nesse dado — nao busca de novo."""
    arquivo = arquivo_de(dataset, caminho)
    return arquivo.exists() and arquivo.stat().st_size > 0


def salvar_raw(dataset, caminho, endpoint, params, payload):
    """Grava a resposta inteira mais um bloco com o contexto da extracao."""
    arquivo = arquivo_de(dataset, caminho)
    arquivo.parent.mkdir(parents=True, exist_ok=True)

    documento = {
        "_meta": {
            "dataset": dataset,
            "endpoint": endpoint,
            "params": params,
            "extraido_em": datetime.now(timezone.utc).isoformat(),
        },
        # o envelope da API entra inteiro: "paging" e "results" sao a prova
        # de que a resposta veio completa
        **payload,
    }

    # escreve num temporario e renomeia: um Ctrl+C no meio da gravacao nao pode
    # deixar um arquivo pela metade, que a proxima execucao leria como pronto
    temporario = arquivo.with_suffix(".json.tmp")
    temporario.write_text(json.dumps(documento, ensure_ascii=False), encoding="utf-8")
    temporario.replace(arquivo)
