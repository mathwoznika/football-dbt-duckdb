# Contexto e decisões

Por que o projeto é do jeito que é. O operacional está no `CLAUDE.md` na raiz;
aqui fica o raciocínio, para quem (ou o que) precisar mexer sem repetir erros já
cometidos.

## O que restringe tudo: a cota

Plano Free da API-Football: **100 requisições por dia**, 10 por minuto, e apenas
as temporadas **2022 a 2024**. Pedir 2025 devolve erro de plano.

Esse é o fato que molda o resto. O recurso escasso é a requisição, não o disco —
o raw completo projetado dá cerca de 10 MB. Daí a regra de gravar a resposta
íntegra e nunca reprocessar contra a API: se um campo for descartado na
extração, recuperá-lo custa cota e dias de espera.

O plano pago (7.500/dia) libera de 2015 em diante, que é quando a API passa a ter
estatística completa. Com ele, o futebol brasileiro inteiro de 2015 a hoje sai em
cerca de uma semana de extração.

## As ondas da extração

A extração se monta em ondas porque um dado depende do outro, e o custo entre
elas difere em ordens de grandeza.

| onda | o que busca | custo |
|---|---|---|
| 1 | calendário do Coritiba, técnicos, transferências | 5 requisições |
| 2 | ligas, times, classificações, calendário das ligas inteiras, artilheiros | ~40 |
| 3 | estatística, eventos, escalação e notas — **por jogo** | 4 × 168 = 672 |

A onda 1 é semente: dela sai a lista de ligas-temporada que o Coritiba disputou,
e é essa lista que monta a onda 2. Sem ela não haveria como saber quais
competições buscar.

**Profundidade só para o Coritiba, largura para todo mundo.** A onda 3 custa 4
requisições por jogo; fazê-la para os 1.746 jogos das ligas seria ~7.000
requisições. Mas o placar de todos eles custou 9 (`fixtures` por liga-temporada).
É isso que dá contexto de adversário — para prever Coritiba × Santos você precisa
da forma do Santos contra todo mundo, não só contra o Coritiba.

## Layout do raw

```
data/raw/<dataset>/season=<ano>/league=<id>/fixture=<id>.json
```

O padrão `chave=valor` não é decoração: o DuckDB lê isso como *hive
partitioning* e transforma os diretórios em colunas. `season` e `league` chegam
aos models de graça, sem estarem no payload.

Cada arquivo guarda a resposta inteira mais um bloco `_meta`:

```json
{"_meta": {"dataset": ..., "endpoint": ..., "params": {...}, "extraido_em": ...}}
```

O `params` é indispensável: os quatro endpoints por jogo **não devolvem o
`fixture_id` no corpo**. Sem esse bloco, `fixture_statistics`, `fixture_events`,
`fixture_lineups` e `fixture_players` seriam inutilizáveis.

## Camadas

```
data/raw/*.json            JSON cru, imutável
  ↓ dbt (read_json direto, sem etapa de carga)
bronze                     1 model por endpoint, só desaninha
  ↓
silver                     universal: fato de partida, dimensões
  ↓
gold                       marts prontos para consumo
  ↓
FastAPI → React
```

O dbt lê o JSON direto pelo `external_location` do `dbt-duckdb`, com um único
template servindo os 12 datasets:

```yaml
external_location: "read_json('../data/raw/{name}/**/*.json', union_by_name := true, hive_partitioning := true)"
```

O nome declarado em `sources.yml` **é** o nome do diretório, porque o `{name}`
vira parte do caminho. Um `s` a mais quebra tudo.

### Por que silver universal

O `silver_partida_time` tem uma linha por time por jogo — 3.492 linhas para
1.746 partidas. O formato longo faz recorte casa/fora virar um `where` e junção
com o adversário virar um join simples. No formato largo (`gols_casa`/
`gols_fora`) toda consulta repetiria o mesmo `case`.

Nenhum filtro de clube nessa camada. Quando a base crescer para o futebol
brasileiro inteiro, o silver não muda uma linha; nascem novos marts ao lado.

### Uma lição aprendida na prática

O primeiro mart de campanha nasceu como `gold_coritiba_campanha`, filtrando o
clube dentro do model. Ele só se revelou mal modelado quando apareceu o
consumidor: a API precisava de `/times/{id}/campanha` para qualquer time.

**O gold pode agregar de um jeito específico, mas filtrar por entidade é
trabalho de quem consulta.** Construir o consumidor cedo é o que revela isso.

## Particularidades do dado

**`fixtures` é subconjunto exato de `fixtures_liga`.** Os 168 jogos do Coritiba
estão inteiramente dentro dos 1.746. Alimentar o silver com os dois dobraria os
pontos dele sem nenhum erro aparecer. O silver lê só do `fixtures_liga`; o
`assert_silver_duas_linhas_por_jogo` tranca essa porta.

**Classificação não descreve mata-mata.** O Coritiba terminou a fase de grupos
do Paranaense 2022 em segundo e foi campeão. As duas coisas são verdade —
`posicao` responde a primeira, `resultado_final` responde a segunda.

**A API conta só a fase regular na classificação.** Comparar nossa conta com o
`standings` oficial acusou 19 divergências, todas no estadual: a API contava 11
jogos e nós 17, porque incluíamos o mata-mata. Com o filtro de fase, zero
divergência. O `assert_classificacao_bate_com_api` guarda isso.

**Quem passou num confronto empatado** sai de três mecanismos em cascata:
agregado de gols, pênaltis, e — quando nem isso resolve — presença numa fase
posterior. O terceiro cobre gol fora, melhor campanha e sorteio sem precisar
modelar nenhuma dessas regras: o próprio calendário conta.

**`bronze_coachs` não serve para desempenho de técnico.** As datas vêm sempre no
dia 01, com `fim` nulo em passagens já encerradas e meses inteiros sem ninguém.
Use `bronze_fixture_lineups`, que diz quem estava no banco naquele jogo. Regra
geral: prefira a fonte que é subproduto do fato à que é cadastro.

**Artilharia não é derivável da nossa base.** A onda 3 cobre só os jogos do
Coritiba, então gols em Palmeiras × Flamengo não existem aqui. O
`/players/topscorers` resolve com 1 requisição por liga-temporada.

**Cor de time não vem da API.** O `team.colors` do lineup é a cor do uniforme
daquele jogo — o Coritiba aparece como `#ffffff`. Para tematizar por clube seria
preciso uma tabela curada, provavelmente um seed do dbt.

## Concorrência: por que Postgres entra depois

O DuckDB aceita **ou** um processo escrevendo **ou** vários lendo. Isso já
apareceu na prática: a UI aberta impede o `dbt build`, e a API aberta também.

Para desenvolvimento, a API abrir em `read_only` resolve. Quando a aplicação for
para o ar e o pipeline rodar junto, a saída é separar papéis: DuckDB transforma,
Postgres serve. Não é redundância — o Postgres é ruim em ler 770 JSONs
aninhados, e o DuckDB é ruim em servir leitura concorrente. Cada um onde é forte.

## Ordem planejada do que falta

1. Artilheiros (extração feita, models e painel pendentes)
2. ML com MLflow — `gold_features_partida` já tem 3.492 linhas prontas e **não
   depende da onda 3**
3. Postgres como camada de serving
4. Dagster, por último: ele resolve orquestração de várias etapas
   interdependentes, e orquestrar duas coisas rodadas à mão é cerimônia
5. docker-compose, junto com o Dagster
