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

**O Paranaense é raso na API, e isso muda o valor da cota.** Para a liga 606 os
endpoints `fixture_statistics` e `fixture_players` voltam **vazios** — 17 de 17
arquivos extraídos, nenhuma linha — e o lineup vem sem `grid`, então não há
campinho posicionado. Só eventos e nomes de escalação existem. A Copa do Brasil
vem pela metade: 2 dos 4 jogos de 2022 têm estatística.

A consequência é de planejamento, não de modelagem: dos 338 pedidos que faltam,
**56 são esses dois endpoints para os 28 jogos restantes do estadual**, e vão
voltar vazios. Pular a liga 606 neles no `extrair.py` liberaria mais de meio dia
de cota para a Série B 2024, que está inteiramente por extrair. Não foi feito —
decisão consciente de não mexer no extrator agora —, mas quem for otimizar a
fila começa por aqui.

Nada disso é bug do pipeline: os arquivos crus estão vazios em `data/raw`.

**Artilharia não é derivável da nossa base.** A onda 3 cobre só os jogos do
Coritiba, então gols em Palmeiras × Flamengo não existem aqui. O
`/players/topscorers` resolve com 1 requisição por liga-temporada.

**Cor de time não vem da API.** O `team.colors` do lineup é a cor do uniforme
daquele jogo — o Coritiba aparece como `#ffffff`. Para tematizar por clube seria
preciso uma tabela curada, provavelmente um seed do dbt.

**Substituição inverte o que os nomes sugerem.** Nos eventos de tipo `subst`, o
campo `player` é quem **sai** e `assist` é quem **entra**. Verificado nas 580
substituições da base: em 580 de 580 o "assist" era reserva na escalação, e em
577 o "player" era titular (as 3 restantes são reservas que entraram e depois
saíram). O `gold_partida_evento` resolve isso na coluna `papel_relacionado`,
para a tela não precisar saber da peculiaridade.

**Contador nulo na fonte significa zero.** A API nunca escreve `0` num campo de
contagem: em 2.021 atuações com minutos, `gols = 0` aparece **zero vez**, contra
1.859 nulos e 162 positivos. O mesmo payload traz `conceded: 0` explícito para o
goleiro, ou seja, ela sabe emitir zero quando quer — em contador ela usa nulo.

A prova de que não é bloco de estatística faltando: entre quem atuou 60+
minutos, `passes` é nulo em **0%** dos casos. Se a API estivesse omitindo a
estatística daquele jogador, passe cairia junto. Ele nunca cai, então o nulo em
gols (89,8%), chutes (52,7%) e desarmes (34,9%) é "não aconteceu".

Sem `coalesce`, `sum` de tudo-nulo devolve nulo e o zagueiro que nunca marcou
aparece com gols vazio — e qualquer soma que o envolva desaparece junto. A
exceção conhecida é `duelos`, nulo em 5,5% de quem jogou 60+ minutos: ali é
mesmo "não registrado", e o efeito de tratar como zero é subestimar, nunca
inventar.

**O gol contra é creditado ao time que se beneficia, mas guarda o autor
adversário.** Murillo, do Corinthians, aparece sob "Coritiba". A consequência é
assimétrica e vale registrar: somar gols por **time** é seguro — bate com o
placar em 168 de 168 times-jogo conferidos —, enquanto somar por **jogador**
exige excluir `Own Goal`, senão o autor recebe crédito por um gol do adversário.

**Assistência não existe em toda competição.** A fonte marca passe decisivo em
71% dos gols da Série A 2022 e 60% da de 2023, e em **zero** na Copa do Brasil e
no Paranaense — em todos os gols, de todos os times. Não é um ataque que nunca
teve assistência: é a competição que não tem o dado.

Por isso o `gold_gol_origem` carrega `assistencia_registrada` e devolve as
colunas de assistência **nulas** onde ela é falsa. Zero ali seria indistinguível
de "ninguém assistiu", que é afirmação que o dado não sustenta. É o mesmo
princípio do rótulo por quartil: não afirmar o que a fonte não carrega.

**Entre duas colunas que respondem o mesmo, prefira a de cobertura maior.** O
`gold_escalacao` tem `titular`, vindo do lineup, e `entrou_do_banco`, vindo do
`fixture_players`. O segundo tem o nome mais óbvio para "entrou do banco" e está
**0% preenchido no Paranaense** e 50% na Copa do Brasil, enquanto `titular` está
100% em todas as ligas. Usar o nome óbvio jogou os 28 gols do estadual para
"autor desconhecido" — a soma continuava fechando com o total, e o erro só
aparecia na distribuição. É a mesma família do `bronze_coachs`: prefira a fonte
mais próxima do fato.

**A escalação vem com coordenadas.** O `grid` do lineup traz `"linha:coluna"` —
`1:1` é o goleiro, e a linha cresce em direção ao ataque. Isso significa que
desenhar o campinho **não exige codificar formação nenhuma**: o 4-2-3-1 e o
3-5-2 se posicionam sozinhos. Só o titular tem `grid`; reserva vem nulo.

**Estatística de jogador é 90% ruído fora do Coritiba.** O `fixture_players`
devolve os **dois** times de cada partida, e a onda 3 só cobre jogos do Coxa.
O resultado são 671 jogadores na base, mas:

```
317 jogadores com  1 jogo
292 jogadores com  2-3
 24 com 4-10 · 22 com 11-25 · 16 com 26+
```

Os 62 jogadores do Coritiba somam 986 atuações; os 617 adversários somam 978 no
total. Agregar isso como "estatística de carreira" seria enganoso — o Hulk
aparece com uma partida. Qualquer tela sobre jogador precisa mostrar
`jogos_com_dado` e filtrar amostra mínima.

Para uma base real de jogadores existe o `/players?league&season`, que devolve a
temporada inteira de todos independentemente de adversário. Ele **pagina** —
algo como 30 páginas por liga-temporada, ~270 requisições para os 9 pares. São
3 dias de cota Free, ou minutos no plano pago.

**`fixture_players` inclui quem não entrou.** São 902 das 2.923 linhas: jogador
relacionado que ficou no banco, com `minutos` nulo. Qualquer contagem de "jogos"
precisa decidir se conta **relacionamento** ou **minutos em campo** — o Henrique
foi relacionado 52 vezes e jogou 35. Por isso `gold_jogador` tem as duas
colunas, e a nota média é ponderada por jogos com minutos.

Consequência menos óbvia: `arg_max(team_id, minutos)` devolve **nulo** para quem
nunca entrou, porque `arg_max` ignora linhas com a chave nula. Isso deixou 217
de 880 jogadores sem clube e derrubou a listagem inteira na validação do
Pydantic. Sempre `coalesce` na chave de ordenação do `arg_max`.

**Artilharia repete os números de quem trocou de clube.** No `topscorers`, um
jogador transferido vem com duas entradas no array `statistics` e a API **copia
o mesmo bloco** sob os dois times. O Tiquinho Soares em 2023 aparece como
Botafogo 33 jogos / 17 gols e Santos 32 jogos / 17 gols — ele não jogou no
Santos naquele ano, e 33 + 32 seria impossível em 38 rodadas.

Somar daria 34 gols a quem fez 17. A própria ranking da API o lista com 17, o
que confirma que o total é o **máximo**, não a soma. O `gold_artilheiro`
consolida com `max` e marca os afetados em `teve_mais_de_um_clube`. São 4 em
176 — e o erro seria invisível, apareceria como um artilheiro inventado no topo.

## Concorrência: por que Postgres entra depois

O DuckDB aceita **ou** um processo escrevendo **ou** vários lendo. Isso já
apareceu na prática: a UI aberta impede o `dbt build`, e a API aberta também.

Para desenvolvimento, a API abrir em `read_only` resolve. Quando a aplicação for
para o ar e o pipeline rodar junto, a saída é separar papéis: DuckDB transforma,
Postgres serve. Não é redundância — o Postgres é ruim em ler 770 JSONs
aninhados, e o DuckDB é ruim em servir leitura concorrente. Cada um onde é forte.

**Transferências duplicam e misturam dois campos.** O mesmo jogador com o mesmo
destino aparece em dias consecutivos — 55 linhas de 1.020 — porque a API
reprocessa e regrava; ficamos com a data mais antiga. E o campo `type` guarda a
modalidade (`Loan`, `Free`) **e o valor** (`€ 1.5M`, `€ 500K`) no mesmo lugar,
separados no gold em `tipo` e `valor_eur`.

Detalhe que confunde na tela: as transferências vão até **julho de 2026**,
enquanto os jogos param em 2024 por limitação do plano. É o único dado do
projeto que alcança o presente, e a seção avisa isso em texto.

## ML: o que foi tentado e por que parou

O `ml/treinar.py` treina um classificador de resultado (V/E/D) sobre o
`gold_features_partida` e registra tudo no MLflow. O resultado, com o split
temporal 2022-2023 → 2024:

```
baseline "mandante vence"    0,517
regressao logistica          0,517    empatou
gradient boosting            0,461    ficou abaixo
```

**Duas coisas estavam erradas, e sao independentes.**

A primeira foi minha: aquele split treina 72% em Serie A e testa 72% em Serie B
— ligas diferentes, e 25 dos 106 times do teste nunca aparecem no treino. A
avaliacao era ininterpretavel.

A segunda sobrevive a correcao. Com recorte limpo (so Serie A, treina 2022,
testa 2023) o baseline faz 0,462 e a logistica 0,470 — oito milesimos em 370
partidas, ou seja ruido. **As features nao carregam sinal alem do mando.**

O gargalo e volume: 740 linhas de treino sao 370 partidas. O plano Pro libera
2015 em diante, o que daria ~4.500 partidas so de Serie A — uma ordem de
grandeza a mais. Somado as features de estatistica da onda 3, ai existe
experimento de verdade.

Ate la, o script fica como o que ele e: o experimento que estabeleceu o baseline
e mostrou que as features atuais nao o superam. Num portfolio isso vale mais que
um numero inflado por vazamento.

Detalhe metodologico que vale manter: o script **quebra** se aparecer NaN nas
features, em vez de imputar. Preencher com a mediana em silencio esconderia
mudanca no mart.

## Lições de visualização

Duas correções que valem para os próximos gráficos.

**O gráfico de evolução com as 20 linhas iguais era ilegível.** Num campeonato
de 20 times as trajetórias se cruzam a cada rodada e o resultado é emaranhado.
A correção não foi de estilo, foi de **recorte**: mostrar uma história por vez,
com a linha escolhida em destaque e as outras como fundo apagado.

**E ele era alto demais.** Um viewBox quase quadrado esticado até os 1500px do
container vira um bloco de 700px de altura para mostrar uma curva. Gráfico de
linha quer viewBox largo e baixo mais um teto de largura — e a sobra à direita
é lugar para resumo, não para vazio.

**Vocabulário:** os rótulos dizem "4 primeiros" e "4 últimos", não "G4" e "zona
de rebaixamento". Quem classifica e quem cai muda por competição e por ano; o
Paranaense tem 12 times e outro formato. Rótulo descritivo funciona em qualquer
competição sem afirmar regra que o dado não carrega. Mesma disciplina do aviso
na tela de arbitragem.

## Ordem planejada do que falta

Esta lista já esteve duplicada — Dagster e Postgres apareciam duas vezes, em
ordens contrárias, resíduo de duas edições. Foi consolidada; se ela voltar a ter
o mesmo item em dois lugares, o de baixo é o antigo.

1. **Terminar a onda 3** — 338 requisições, uns 3,5 dias. É o que mais entrega
   valor por requisição, então vem antes de qualquer extração nova. Quando
   fechar, as telas que hoje mostram cobertura parcial (momento dos gols,
   estatística de jogo, perfil estatístico, elenco) se completam sozinhas.
   Lembrando que 56 desses pedidos vão voltar vazios, pelo Paranaense.
2. **Esgotar em tela o que a base já tem.** Prioridade acima de infraestrutura:
   dado extraído e não exibido não vale nada, e cada mart novo custa horas
   contra os dias de cota que a extração custa. Foi o que revelou, numa sessão
   só, que `silver_partida_estatistica` não tinha nenhum consumidor no gold e
   que a posse de bola estava nula desde o começo. Enquanto houver coluna sem
   consumidor, este item continua aberto.
3. **Dagster** — três etapas com dependência e ritmos diferentes (extração
   diária, dbt depois dela, treino sob demanda), e automatiza o `extrair.py`
   que hoje é rodado à mão todo dia.
4. **Postgres e docker-compose** — separar os papéis (DuckDB transforma,
   Postgres serve) e tirar a aplicação do "roda na minha máquina". É aqui que o
   MinIO entra, se a ideia de exercitar object storage for retomada.
5. **Retomar o ML** quando houver volume: plano Pro (2015+) e/ou onda 3
   completa para as features de estatística.

Condicionado ao plano pago: `/players` completo sobe para o topo, porque deixa
de custar 3 dias de cota e passa a custar minutos.
