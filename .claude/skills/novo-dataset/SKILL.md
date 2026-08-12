---
name: novo-dataset
description: Adicionar um dataset novo da API-Football ao projeto, da extração até a tela. Use quando for incluir um endpoint que ainda não existe em data/raw — artilheiros, lesões, odds, árbitros, elencos, ou qualquer outro. Cobre extrator, source, model de bronze, testes, API e front, com as armadilhas já mapeadas.
---

# Adicionar um dataset da API-Football

Fluxo completo, na ordem. Pular etapa custa cota ou gera model quebrado.

## 1. Sondar o endpoint antes de modelar (1 requisição)

Nunca escreva o model adivinhando a forma do payload. Gaste uma requisição:

```bash
env/bin/python -c "
import os, json, requests
from dotenv import load_dotenv; load_dotenv()
r = requests.get(os.getenv('URL')+'/ENDPOINT',
                 headers={'x-apisports-key':os.getenv('API-KEY')},
                 params={'league':71,'season':2023})
d = r.json()
print('results:', d['results'], '| paging:', d['paging'], '| errors:', d.get('errors'))
print(json.dumps(d['response'][:1], ensure_ascii=False, indent=1)[:1500])
"
```

Confira três coisas:

- **`paging.total`** — se for maior que 1, o extrator precisa de laço de páginas
- **arrays aninhados** — cada nível vira um `unnest` a mais no bronze
- **`errors`** — pode ser limitação de plano, e aí não adianta seguir

Antes de gastar, veja a cota:

```bash
env/bin/python -c "
import os,requests
from dotenv import load_dotenv; load_dotenv()
q=requests.get(os.getenv('URL')+'/status',headers={'x-apisports-key':os.getenv('API-KEY')}).json()['response']['requests']
print(q['current'],'/',q['limit_day'])
"
```

## 2. Acrescentar ao `extrair.py`

Uma tupla `(dataset, endpoint, params, caminho)` na onda certa:

- **onda 1** — depende só do time (`{"team": TIME}`)
- **onda 2** — depende de liga e temporada, dentro do laço `for season, liga in pares`
- **onda 3** — um request por jogo. **Pense duas vezes**: são 4 requisições por
  partida e o escopo atual já tem 672

O caminho segue `chave=valor`, usando os **nomes dos parâmetros da API**:

```python
tarefas.append(
    ("topscorers", "players/topscorers", {"league": liga, "season": season},
     f"season={season}/league={liga}")
)
```

Isso não é estética: o DuckDB lê `chave=valor` como hive partitioning e
transforma os diretórios em colunas.

## 3. Declarar em `transform/models/sources.yml`

```yaml
      - name: topscorers
```

**O nome declarado é o nome do diretório em `data/raw/`.** O `{name}` do
`external_location` vira parte do caminho — um `s` a mais quebra tudo. Já
aconteceu com `fixtures_statistics` contra `fixture_statistics`.

## 4. Extrair antes de escrever o model

```bash
env/bin/python extrair.py
```

**Não crie o model antes de existir arquivo.** O `read_json` sobre um glob vazio
é erro, e o `dbt build` inteiro quebra — inclusive os models que funcionavam.

## 5. Escrever o model de bronze

Um model por endpoint, fiel à fonte, sem regra de negócio. Padrão:

```sql
with resposta as (

    select * from {{ source('raw', 'topscorers') }}

),

itens as (

    select
        _meta.params.league as league_id,
        _meta.params.season as season,
        _meta.extraido_em   as extraido_em,
        unnest(response)    as item
    from resposta

)

select
    league_id,
    season,
    item.campo as campo,
    extraido_em
from itens
```

Armadilhas, todas já encontradas neste projeto:

- **`fixture_id` não vem no payload** dos endpoints por jogo. Só existe em
  `_meta.params.fixture`.
- **Palavras reservadas**: `end`, `group`, `all`, `for`, `in`, `on`, `time` são
  nomes de campo na API. Use aspas — `passagem."end"`, `linha."all".goals."for"`,
  `est.shots."on"`.
- **Campo esparso quebra o `union all`.** Se um array tem o campo preenchido e
  outro só nulos, o DuckDB infere tipos diferentes e a união falha (aconteceu com
  `grid` em `fixture_lineups`, tentando converter `"1:1"` para JSON). **Ache os
  campos com cast explícito antes de empilhar**, nunca empilhe os structs.
- **Chave-valor precisa de pivot.** `fixture_statistics` entrega
  `[{type, value}]`; vira coluna com `max(case when type = ... )`.
- **Lista de lista** existe: `standings` aninha grupos × times e precisa de dois
  `unnest`.

## 6. Validar sem tocar no warehouse

Roda o SQL do model contra o raw num DuckDB em memória. Não pega o lock do
`warehouse.duckdb`, então funciona com a API e a UI abertas:

```bash
env/bin/python -c "
import re, duckdb, pathlib
con = duckdb.connect()
RAW = \"read_json('data/raw/{}/**/*.json', union_by_name := true, hive_partitioning := true)\"
def res(s):
    s = re.sub(r\"{{\s*source\('raw',\s*'([a-z_]+)'\)\s*}}\", lambda m: RAW.format(m.group(1)), s)
    return re.sub(r\"{{\s*ref\('([a-z_]+)'\)\s*}}\", lambda m: m.group(1), s)
# liste os models em ordem de dependencia
for n in ['bronze_NOVO']:
    p = list(pathlib.Path('transform/models').rglob(n+'.sql'))[0]
    con.execute(f'create table {n} as ({res(p.read_text())})')
    print(n, con.sql(f'select count(*) from {n}').fetchone()[0], 'linhas')
    print(con.sql(f'select * from {n} limit 3'))
"
```

Faça sempre uma pergunta cuja resposta você conhece por fora. Se o número bater
com a realidade, a camada inteira ganha confiança.

## 7. Documentar e testar

Em `transform/models/<camada>/schema.yml`: descrição do model e das colunas que
possam ser mal interpretadas, mais `not_null` / `unique` / `accepted_values` nas
chaves.

Se houver uma verificação que cruze duas fontes independentes, faça um teste
singular em `transform/tests/` — a consulta deve retornar **zero linhas**.

```bash
cd transform && ../env/bin/dbt build
```

Pare o `uvicorn` e feche a UI do DuckDB antes: o banco é single-writer.

## 8. Silver e gold, se o dataset for consumido

- **silver** — universal, sem filtro de clube
- **gold** — agregado pronto para a tela, sem filtro de entidade (o `where` é de
  quem consulta)

## 9. API

`api/schemas.py` ganha o modelo Pydantic, `api/main.py` ganha o endpoint. O
endpoint **só seleciona, filtra e ordena** — cálculo novo vira model de gold.

Dado que não existe devolve **lista vazia**, não 404.

## 10. Front

Tipo em `web/src/api.ts` espelhando o Pydantic, mais a função em `api`. Depois o
componente.

```bash
cd web && npm run build
```

**Use o `build`, não `npx tsc --noEmit`** — o projeto usa project references e o
`tsc` solto deixa passar erro de tipo.

## Checklist

- [ ] Endpoint sondado, `paging.total` conferido
- [ ] Tarefa no `extrair.py`, na onda certa, caminho `chave=valor`
- [ ] Nome em `sources.yml` idêntico ao diretório
- [ ] Extração rodada — **antes** de criar o model
- [ ] Model de bronze validado em memória
- [ ] `schema.yml` com descrição e testes
- [ ] `dbt build` limpo
- [ ] Schema Pydantic e endpoint
- [ ] Tipo no front e `npm run build` limpo
