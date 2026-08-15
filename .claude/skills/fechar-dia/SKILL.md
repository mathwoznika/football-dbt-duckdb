---
name: fechar-dia
description: Fechar o trabalho do dia — verifica que tudo compila, decide o que virou documentação, atualiza CLAUDE.md, docs/contexto.md e as skills, e prepara o commit. Use quando o usuário disser que vai encerrar, fechar o dia, subir para o git ou consolidar o que foi feito.
---

# Fechar o dia

Três etapas: verificar, documentar, commitar. A do meio é a que exige
julgamento — as outras são mecânicas.

## 1. Verificar

Ordem importa: o DuckDB é single-writer, então nada pode estar segurando o
arquivo enquanto o dbt escreve.

```bash
cd /Users/mathwoznika/Developer/work/football-dbt-duckdb

# processos que seguram o warehouse
lsof data/warehouse.duckdb 2>/dev/null | tail -n +2 || echo "warehouse livre"
```

Se houver `uvicorn` ou `duckdb` na lista, peça ao usuário para parar antes de
seguir (⌃C no terminal correspondente).

```bash
# models + testes
cd transform && ../env/bin/dbt build; cd ..

# sintaxe do Python
env/bin/python -c "
import ast, pathlib
for f in ['apifootball.py','extrair.py','api/main.py','api/schemas.py','api/db.py']:
    ast.parse(pathlib.Path(f).read_text()); print('ok', f)
"

# front — o build, nao o tsc solto (project references)
cd web && npm run build; cd ..

# seletor CSS duplicado — o build NAO pega isso, e ja quebrou a aplicacao
# inteira uma vez (.cartao era painel e virou cartao de arbitragem)
env/bin/python -c "
import pathlib, re, collections
s = pathlib.Path('web/src/index.css').read_text()
sel = re.findall(r'^([.#a-zA-Z][^{\n]*?)\s*\{', s, re.M)
d = [k for k,v in collections.Counter(x.strip() for x in sel).items() if v > 1]
print('seletores duplicados:', d or 'nenhum')
"
```

CSS duplicado é sintaticamente válido: uma regra apenas sobrescreve a outra e
nada acusa. Só uma busca por nome repetido encontra.

Reporte também o estado da extração, que é o que define o dia seguinte:

```bash
env/bin/python -c "
import os, requests, extrair, collections
from dotenv import load_dotenv; load_dotenv()

# A cota vem primeiro, e pode nao vir: com o limite diario atingido a API
# recusa ate o /status, devolvendo response vazio e um bloco errors. Como o
# fechamento roda no fim do dia, esse e o caso COMUM e nao a excecao — por isso
# a consulta e opcional e a fila, que sai de data/raw, nunca depende dela.
try:
    r = requests.get(os.getenv('URL')+'/status',
                     headers={'x-apisports-key':os.getenv('API-KEY')}).json()
    q = r['response']['requests']
    print(f\"cota: {q['current']}/{q['limit_day']}\")
except Exception:
    print('cota: esgotada hoje (a API recusa ate o /status no limite)')

p = extrair.pendentes()
c = collections.Counter(t.dataset for t in p)
print(f'pendentes: {len(p)} de {len(extrair.montar_tarefas())}')
for k, v in sorted(c.items()): print(f'  {k:22} {v}')
"
```

O `t.dataset` acima depende de as tarefas serem `Tarefa` (NamedTuple). Se um dia
voltarem a ser tupla crua, e `t[0]`.

Qualquer falha aqui interrompe o fechamento. Não documente nem commite código
que não compila.

## 2. Decidir o que virou documentação

Olhe o que mudou desde o último commit:

```bash
git status --short
git diff --stat HEAD
```

Para cada mudança, pergunte **em qual categoria ela cai**. A maioria não gera
documentação nenhuma — model novo que segue o padrão existente já se documenta
no `schema.yml`.

| o que aconteceu | onde registrar |
|---|---|
| Nova regra ou convenção do projeto | `CLAUDE.md` → *Regras do projeto* |
| Armadilha que custou tempo para descobrir | `CLAUDE.md` → *Armadilhas conhecidas* |
| Comando novo ou alterado | `CLAUDE.md` → *Comandos* |
| Arquivo ou pasta nova na raiz | `CLAUDE.md` → *Estrutura* |
| Decisão de arquitetura, com alternativa descartada | `docs/contexto.md` |
| Particularidade do dado descoberta investigando | `docs/contexto.md` → *Particularidades do dado* |
| Mudança na ordem do que falta fazer | `docs/contexto.md` → *Ordem planejada* |
| Fluxo repetido pela terceira vez | skill nova em `.claude/skills/` |
| Passo novo num fluxo já existente | skill existente |
| Model que segue o padrão | só `schema.yml` — nada mais |

O teste para o `CLAUDE.md`: **isso mudaria o que alguém faz na próxima sessão?**
Se não, não entra. Ele é carregado toda vez e custa contexto — cada linha
inútil ali tira espaço de algo útil.

O teste para o `docs/contexto.md`: **alguém desfaria essa decisão por não saber
o motivo?** Se sim, o motivo precisa estar escrito.

O teste para uma skill: **isso vai ser refeito?** Duas vezes é coincidência,
três é padrão.

Registre também o que **não** funcionou e por quê. Saber que um caminho foi
tentado e descartado vale tanto quanto saber o escolhido — sem isso, alguém
tenta de novo. Exemplos já no `contexto.md`: cor de time pelo lineup, chaveamento
simétrico nas fases sem simetria.

## 3. Atualizar e commitar

Faça as edições nos documentos, depois:

```bash
git status --short
```

Confira antes de commitar — nada de `.env`, `env/`, `transform/target/`,
`transform/logs/`, `node_modules/` ou `dist/`.

Proponha a mensagem de commit e **deixe o usuário rodar**: ele prefere executar
os comandos. Uma linha de assunto no imperativo, e corpo em tópicos quando a
mudança tiver mais de uma frente.

```
adiciona artilheiros da competicao

- extracao: endpoint players/topscorers, 1 request por liga-temporada
- bronze_topscorers e gold_artilheiro
- painel abaixo da classificacao
- contexto.md: por que artilharia nao sai do fixture_events
```

## Ao final

Diga em uma frase onde o projeto parou e qual é o próximo passo, incluindo o que
o usuário precisa rodar amanhã (normalmente `env/bin/python extrair.py`, se
ainda houver fila).
