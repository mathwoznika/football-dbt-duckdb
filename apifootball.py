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

# O plano Free aceita 10 chamadas por minuto; 6.5s de intervalo deixa folga.
INTERVALO = 6.5

# Quanto ainda resta da cota diaria, segundo o header da ultima resposta.
cota_restante = None

_ultima_chamada = 0.0


class RecusadoPelaAPI(Exception):
    """A API entendeu o pedido e recusou (plano, cota, chave invalida).

    Isso nao e falha temporaria: tentar de novo so gasta mais uma requisicao.
    """


def buscar(endpoint, params):
    """Chama a API e devolve o JSON exatamente como veio.

    Cuida sozinho do intervalo entre chamadas e de tentar de novo quando o
    problema e passageiro (429 ou erro do servidor).
    """
    global _ultima_chamada, cota_restante

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
