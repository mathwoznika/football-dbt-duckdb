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
transform/         projeto dbt (45 models, 12 testes singulares)
api/               nossa API (FastAPI) — não confundir com apifootball.py
web/               front (Vite + React + TypeScript, 9 páginas)
sincronizar.py     copia o gold do DuckDB para o Postgres, que serve a API
verificar_bancos.py  compara as respostas da API nos dois bancos, rota a rota
orquestracao/      definições do Dagster (assets, agendamento)
docker/            Dockerfiles e nginx
docker-compose.yml postgres · pipeline · api · web · dagster
requirements-*.txt api e pipeline, separados — ver o topo de cada um
ml/treinar.py      experimento de previsão — PAUSADO, sem consumidor
docs/contexto.md   por que cada decisão foi tomada
.claude/skills/    fluxos repetíveis (novo-dataset, fechar-dia)
```

**Dois ambientes, e eles usam bancos diferentes.** Na máquina, a API lê o
arquivo DuckDB direto (`BANCO=duckdb`, o padrão). No compose, ela lê o Postgres
(`BANCO=postgres`), alimentado pelo `sincronizar.py`. O SQL é o mesmo nos dois —
ver *Arquitetura de dois bancos* no `contexto.md`.

## Comandos

```bash
# extração — uma vez por dia até a fila zerar
env/bin/python extrair.py

# onde a cota foi gasta sem trazer nada (monta a lista SEM_DADO com evidência)
env/bin/python extrair.py --diagnostico

# transformação (models + testes, na ordem do DAG)
cd transform && ../env/bin/dbt build

# API
env/bin/uvicorn api.main:app --reload        # http://127.0.0.1:8000/docs

# front
cd web && npm run dev                        # http://localhost:5173

# verificação de tipos do front — use ESTE, não `tsc --noEmit`
cd web && npm run build

# ---------------------------------------------------------- docker
# a stack inteira: postgres, pipeline (dbt + sync), api e front
docker compose up -d --build     # front :8080 · api :8000 · postgres :5432

# reprocessa depois de uma extração nova, sem subir o resto de novo
docker compose run --rm pipeline

# orquestração, atrás de profile porque o site não depende dela
docker compose --profile orquestracao up -d dagster   # http://localhost:3000

# ---------------------------------------------------------- verificações
# copia o gold para o Postgres (o compose já faz isso; use solto ao depurar)
env/bin/python sincronizar.py

# a API responde igual nos dois bancos? roda com os dois de pé
env/bin/uvicorn api.main:app --port 8011 &
env/bin/python verificar_bancos.py
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

**Rótulo de métrica nasce no glossário.** Nome de coluna e definição moram em
`web/src/glossario.ts`, e a tela usa `<Termo k="...">` no cabeçalho e
`<Glossario termos={[...]}>` na legenda. Escrever o rótulo direto no JSX volta
ao problema que isso resolveu: o mesmo conceito com quatro nomes em quatro
tabelas, cada um explicado por uma nota de rodapé diferente. Chave inexistente
quebra na compilação.

**Features de ML não podem vazar.** Toda janela em `gold_features_partida`
termina em `1 preceding`, nunca `current row`. As colunas de alvo têm prefixo
`alvo_`. O teste `assert_features_sem_vazamento` guarda isso.

**Endpoint sem dado devolve lista vazia, não 404.** Série A não tem chaveamento
e copa não tem tabela; as duas são respostas válidas.

**Todo `ORDER BY` precisa de desempate.** Ordenação que não define uma ordem
total deixa as linhas empatadas em posição arbitrária — e o motor escolhe
diferente entre execuções e entre bancos. Com `LIMIT`, muda **quais** linhas
aparecem, não só a ordem: em `/transferencias` o empate caía no corte do
`limit 60`. Termine sempre com uma coluna que identifique a linha
(`player_id`, `league_id`, `arbitro`). O `verificar_bancos.py` pega o que
escapar.

**O SQL da API roda nos dois bancos.** Nada de função exclusiva do DuckDB nas
rotas — `year()` não existe no Postgres, use `extract(year from ...)`. Isso é
barato de manter só porque a API não calcula: o que sobra é `select … where …
order by`, que é ANSI. Se uma consulta precisar de algo específico do motor, o
lugar dela é num model.

## Armadilhas conhecidas

**DuckDB é single-writer.** Ou um processo escreve, ou vários leem. Pare o
`uvicorn` e feche a UI do DuckDB antes de rodar `dbt build`, senão dá erro de
lock. A API abre em `read_only` justamente por isso.

**`apifootball.py` vs `api/`.** O pacote `api/` sombreia qualquer módulo chamado
`api.py` — foi por isso que o cliente da API-Football tem outro nome. Não crie
um `api.py` na raiz.

**Cota de 100 requisições/dia** no plano Free, e só as temporadas **2022 a 2024**.
O extrator é idempotente: o que já está em `data/raw` é pulado sem gastar nada.
O plano fica em `PLANOS` no `extrair.py` e governa temporadas, orçamento e ritmo
de uma vez — trocar `PLANO = "free"` por `"pago"` é a única edição necessária.

**Nunca grave uma resposta paginada pela metade.** Arquivo em disco significa
"assunto encerrado" para o `ja_extraido`, então uma primeira página gravada faz
o resto do dado nunca mais ser buscado, e o truncamento só aparece muito depois
como um total que não fecha. O `apifootball.buscar` levanta `RespostaPaginada`
em vez de devolver a página 1; quem precisa de várias páginas declara
`paginado=True` na `Tarefa`. Hoje nenhum endpoint do escopo pagina — o caso
conhecido é `/players?league&season` no plano pago, com ~30 páginas por
liga-temporada.

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

**Hook depois de `return` passa no build e quebra na tela.** O React exige que
todo hook rode em toda renderização, na mesma ordem. Colocar um `useState` ou
`useDados` abaixo de um early return — ou dentro de um `if` — faz o hook rodar
em umas renderizações e não em outras, e o React perde a conta de qual estado
pertence a qual hook. **O TypeScript não pega isso**: `npm run build` passa
limpo e o erro só aparece em execução, no caminho raro (o jogador sem dado, o
time não encontrado). Ao inserir hook em componente que já existe, confira que
ele está acima de qualquer `return`:

```bash
cd web/src/pages && for f in *.tsx; do
  h=$(grep -n "useDados(\|useState(\|useLimiteDeLinhas(" $f | grep -v import | tail -1 | cut -d: -f1)
  r=$(grep -n "^  if (.*) {" $f | head -1 | cut -d: -f1)
  [ -n "$h" ] && [ -n "$r" ] && [ "$h" -gt "$r" ] && echo "VERIFICAR $f: hook na $h, return na $r"
done; echo ok
```

**Parâmetro e `%` mudam de forma no Postgres.** Duas diferenças que o DuckDB
perdoa e o Postgres não, ambas tratadas em `api/db.py`:

- Parâmetro usado só em `? is null` não tem tipo inferível — o Postgres responde
  `could not determine data type of parameter $2`. Escreva
  `cast(? as integer) is null`, que funciona nos dois.
- O psycopg trata `%` como início de marcador, então `like '%' || ? || '%'`
  explode. O `%` vira `%%` **antes** de `?` virar `%s` — na ordem inversa o `%s`
  recém-criado viraria `%%s`.

Nada disso aparece na compilação: só como 500 numa rota específica, no ambiente
onde ninguém desenvolve. Rode o `verificar_bancos.py` depois de mexer em
qualquer consulta.

**No Dagster, efeito de nível de módulo não chega ao step.** O executor
multiprocesso roda cada step num processo filho que **não reimporta** o módulo
de definições — ele reconstrói o job a partir do que foi serializado. Um
`sys.path.insert` no topo do arquivo executa ao carregar a interface e some na
hora de executar, com `ModuleNotFoundError` apesar de o caminho estar certo. O
que o step precisa tem que rodar **dentro da função do asset**.

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

**A extração acabou.** Zero tarefas pendentes — a onda 3 fechou. Série A 2022,
Série A 2023 e Série B 2024 estão 100% nos quatro datasets. Copa do Brasil e
Paranaense fecharam evento e escalação; estatística e nota de jogador não
existem na fonte para essas competições, e os pares estão em `SEM_DADO`.

Só volta a haver fila quando o escopo crescer — plano pago, mais temporadas ou
mais competições. O `extrair.py` já está preparado para isso: mexe-se em
`PLANO` e `ESCOPO`, e o resto do arquivo não muda.

**Pronto e no ar:** 45 models, 32 endpoints, 9 páginas, e a aplicação inteira
sobe em container. Home com recordes e campeões, competições, clubes,
jogadores, jogo com campinho posicionado, elenco em duas leituras (totais e por
90 minutos), e análises com 11 seções em 4 abas.

**Infraestrutura fechada:** Postgres serve a API, DuckDB transforma, e o Dagster
orquestra a corrente com 58 assets e agendamento diário às 6h. As 39 rotas
respondem idênticas nos dois bancos — conferido pelo `verificar_bancos.py`.

**ML pausado**, e não por falta de esforço: ver a seção correspondente no
`docs/contexto.md` antes de retomar. Atenção a um detalhe que já esteve errado
no roteiro — fechar a onda 3 **não** destravou features de estatística, porque
ela sempre cobriu só os jogos do Coritiba. São 6,8% das linhas do
`gold_features_partida`. O bloqueio continua sendo volume, e só o plano pago
resolve.

**Próximo bloco:** não há um óbvio. O roteiro do `contexto.md` está cumprido até
o ML, que depende de assinatura. O que sobra é produto — comparar clubes lado a
lado é a lacuna mais visível — ou expandir o escopo da extração.

## Skills

- **`novo-dataset`** — incluir um endpoint da API-Football que ainda não existe
  em `data/raw`, da extração até a tela
- **`fechar-dia`** — verificar que tudo compila, decidir o que virou
  documentação, atualizar os documentos e preparar o commit
