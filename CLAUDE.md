# football-dbt-duckdb

Pipeline de dados do futebol brasileiro, com foco no Coritiba. Extrai da
API-Football, transforma com dbt sobre DuckDB, serve por FastAPI e exibe num
front React. O objetivo final inclui análises gerenciais e, depois, modelos de
previsão de resultado.

O **porquê** de cada decisão está em [docs/contexto.md](docs/contexto.md). Este
arquivo é só o operacional e as regras.

## Estrutura

```
apifootball.py     cliente da API-Football: HTTP, rate limit, gravação do raw
extrair.py         o que extrair (ligas, temporadas, escopo). É o arquivo editado
data/raw/          JSON cru, imutável, um arquivo por resposta da API
data/warehouse.duckdb   banco de trabalho do dbt
transform/         projeto dbt (38 models, 8 testes singulares)
api/               nossa API (FastAPI) — não confundir com apifootball.py
web/               front (Vite + React + TypeScript, 8 páginas)
ml/treinar.py      experimento de previsão — PAUSADO, sem consumidor
docs/contexto.md   por que cada decisão foi tomada
.claude/skills/    fluxos repetíveis (novo-dataset, fechar-dia)
```

## Comandos

```bash
# extração — uma vez por dia até a fila zerar
env/bin/python extrair.py

# transformação (models + testes, na ordem do DAG)
cd transform && ../env/bin/dbt build

# API
env/bin/uvicorn api.main:app --reload        # http://127.0.0.1:8000/docs

# front
cd web && npm run dev                        # http://localhost:5173

# verificação de tipos do front — use ESTE, não `tsc --noEmit`
cd web && npm run build
```

O venv é `env/`. Chame sempre pelo caminho (`env/bin/python`), sem depender de
`activate`.

## Regras do projeto

**Nomenclatura das camadas.** `raw` é JSON cru e não tabular. `bronze` só quando
vira tabular. Nunca chame o JSON da API de bronze.

**A extração não interpreta.** `apifootball.py` grava a resposta inteira, com o
envelope da API e um bloco `_meta` com os parâmetros da requisição. Nada de
`json_normalize`, nada de filtrar campo. Reprocessar depois é grátis; rebuscar
custa cota e dias.

**Bronze é fiel à fonte.** Um model por endpoint, só desaninhando. Sem regra de
negócio, sem escolher entre fontes redundantes.

**Silver é universal.** Todos os times, nenhum filtro de clube. Nada de `147`
hardcoded em silver — o recorte do Coritiba pertence ao gold.

**A API não calcula, e o front também não.** Endpoints só selecionam, filtram e
ordenam. Lógica nova vira model de gold, onde fica versionada e testada. Vale
para a tela pelo mesmo motivo: dividir o tamanho da tabela por 4 para achar o
tamanho do quartil funciona em liga de 20 times e mente numa de 18 — o número
tem que sair do mart, que sabe a resposta, e não de uma conta na renderização.

**Features de ML não podem vazar.** Toda janela em `gold_features_partida`
termina em `1 preceding`, nunca `current row`. As colunas de alvo têm prefixo
`alvo_`. O teste `assert_features_sem_vazamento` guarda isso.

**Endpoint sem dado devolve lista vazia, não 404.** Série A não tem chaveamento
e copa não tem tabela; as duas são respostas válidas.

## Armadilhas conhecidas

**DuckDB é single-writer.** Ou um processo escreve, ou vários leem. Pare o
`uvicorn` e feche a UI do DuckDB antes de rodar `dbt build`, senão dá erro de
lock. A API abre em `read_only` justamente por isso.

**`apifootball.py` vs `api/`.** O pacote `api/` sombreia qualquer módulo chamado
`api.py` — foi por isso que o cliente da API-Football tem outro nome. Não crie
um `api.py` na raiz.

**Cota de 100 requisições/dia** no plano Free, e só as temporadas **2022 a 2024**.
O extrator é idempotente: o que já está em `data/raw` é pulado sem gastar nada.

**Palavras reservadas no payload.** `end`, `group`, `all`, `for`, `in`, `on` e
`time` são nomes de campo na API e precisam de aspas no SQL.

**`_meta.params` é essencial.** Os endpoints por jogo não devolvem o
`fixture_id` no corpo — ele só existe nos parâmetros que gravamos.

**Campo JSON de tipo misto perde o cast com `::varchar`.** Quando um campo do
payload mistura número e texto, o DuckDB o infere como `JSON` — e ali
`::varchar` **preserva as aspas**. O valor `"52%"` vira `'"52%"'`, tirar o `%`
deixa `'"52"'`, e o `try_cast` para inteiro devolve nulo sem erro nenhum. Foi
assim que `posse_pct` e `precisao_passe_pct` ficaram nulas em 130 de 130 linhas
desde que o pipeline nasceu, com a tela mostrando campo vazio. Use
`campo ->> '$'`, que extrai o texto já desempacotado. Campo sempre-string vira
VARCHAR e não sofre disso — é por isso que o `grid` do lineup escapou.

Nenhum teste pega isso, porque a coluna existe e é só nula. O detector é varrer
colunas 100% vazias:

```bash
env/bin/python -c "
import duckdb
con = duckdb.connect('data/warehouse.duckdb', read_only=True)
for (t,) in con.execute(\"select table_name from duckdb_tables()\").fetchall():
    cols = [r[0] for r in con.execute(f'describe {t}').fetchall()]
    n = con.execute(f'select count(*) from {t}').fetchone()[0]
    if not n: continue
    v = con.execute('select ' + ','.join(f'count(\"{c}\")' for c in cols) + f' from {t}').fetchone()
    vazias = [c for c, k in zip(cols, v) if k == 0]
    if vazias: print(t, vazias)
"
```

**Nomes sobrecarregados em português.** `cartao` já é o painel da interface no
CSS — usar a mesma classe para cartão de arbitragem colapsou todos os painéis
do app para 6px. Antes de criar uma classe, verifique se o nome já existe:

```bash
env/bin/python -c "
import pathlib, re, collections
s = pathlib.Path('web/src/index.css').read_text()
sel = re.findall(r'^([.#a-zA-Z][^{\n]*?)\s*\{', s, re.M)
print([k for k,v in collections.Counter(x.strip() for x in sel).items() if v > 1] or 'nenhum')
"
```

O mesmo cuidado vale para `time` (equipe vs. tempo) e `partida` (jogo vs. início).

## Onde o projeto está

**Extração:** onda 3 em 84 de 168 jogos, 338 tarefas pendentes, uns 3,5 dias a
95 requisições/dia. Rodar `env/bin/python extrair.py` uma vez por dia até zerar.
Tudo o mais (calendários, ligas, times, classificações, artilheiros, técnicos,
transferências) já está extraído. Parte da fila vai voltar vazia — ver o
Paranaense nas *Particularidades do dado* do `contexto.md`.

**Pronto e no ar:** 38 models, 26 endpoints, 8 páginas — times, jogadores,
jogo com campinho posicionado, competições com classificação/artilharia/
chaveamento/evolução, e análises (1º x 2º tempo, momento dos gols, técnicos,
arbitragem, perfil estatístico, faixa do adversário, formações).

**ML pausado**, e não por falta de esforço: ver a seção correspondente no
`docs/contexto.md` antes de retomar.

**Próximo bloco:** esgotar o que a base já tem em telas e relatórios, e só
depois Dagster, Postgres e docker-compose. O raciocínio está no fim do
`contexto.md`.

## Skills

- **`novo-dataset`** — incluir um endpoint da API-Football que ainda não existe
  em `data/raw`, da extração até a tela
- **`fechar-dia`** — verificar que tudo compila, decidir o que virou
  documentação, atualizar os documentos e preparar o commit
