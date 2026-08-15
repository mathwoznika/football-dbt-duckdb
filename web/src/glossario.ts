/**
 * Dicionário único das métricas do app.
 *
 * POR QUE ISTO EXISTE. As telas vinham explicando número com asterisco e nota
 * de rodapé, e o mesmo conceito ganhava nome diferente em cada tabela —
 * "J*", "Amostra*", "cobertura" e "jogos_com_evento" eram a mesma coisa em
 * quatro lugares. Quem lê tem que descer até o rodapé, achar o asterisco certo
 * e voltar; quem escreve acaba redefinindo o termo de um jeito ligeiramente
 * diferente na próxima tabela.
 *
 * Aqui cada métrica tem UM nome e UMA definição. O <Termo> usa isso no cabeçalho
 * da coluna e o <Glossario> monta a legenda embaixo da tabela a partir das
 * mesmas chaves. Mudou a definição num lugar, mudou em todos.
 *
 * REGRA PARA ESCREVER UMA DEFINIÇÃO AQUI: ela tem que fazer sentido para quem
 * abriu o app agora e não leu nenhuma outra tela. Nada de "ver seção acima",
 * nada de jargão sem tradução. Quando o número tem armadilha — amostra pequena,
 * cobertura parcial, aproximação — a armadilha entra na definição, porque é
 * justamente ela que o rodapé escondia.
 */

export type Verbete = {
  /** Cabeçalho da coluna. Curto, mas sem abreviação críptica. */
  rotulo: string;
  /** Uma frase em português claro. É o que aparece na legenda e no tooltip. */
  definicao: string;
  /** Como o número é calculado, quando ajuda. */
  formula?: string;
  /** Alerta de leitura, quando o número engana com facilidade. */
  cuidado?: string;
};

export const GLOSSARIO = {
  // ---------------------------------------------------------- cobertura
  jogos_analisados: {
    rotulo: "Jogos analisados",
    definicao:
      "De quantas partidas este número foi calculado. Nem todo jogo da base tem detalhe lance a lance — a extração é feita aos poucos, dentro da cota diária da API.",
    cuidado:
      "Comparar duas temporadas com jogos analisados diferentes leva a conclusão errada.",
  },

  // ------------------------------------------------------------ básicas
  aproveitamento: {
    rotulo: "Aproveitamento",
    definicao:
      "Quanto o time somou dos pontos que estavam em disputa. Vencer tudo dá 100%.",
    formula: "pontos ÷ (jogos × 3)",
  },
  saldo: {
    rotulo: "Saldo",
    definicao: "Gols marcados menos gols sofridos.",
  },

  // -------------------------------------------------- primeiro x segundo
  pontos_se_1t: {
    rotulo: "Pontos até o intervalo",
    definicao:
      "Quantos pontos o time teria somado se todos os jogos acabassem no intervalo. Comparado com os pontos reais, mostra o que o segundo tempo deu ou tirou.",
  },
  viradas: {
    rotulo: "Viradas",
    definicao: "Jogos em que o time estava perdendo no intervalo e venceu.",
  },
  reacoes: {
    rotulo: "Empates buscados",
    definicao: "Jogos em que o time estava perdendo no intervalo e empatou.",
  },
  vantagens_empatadas: {
    rotulo: "Vantagens empatadas",
    definicao: "Jogos em que o time vencia no intervalo e terminou empatando.",
  },
  vantagens_perdidas: {
    rotulo: "Vantagens perdidas",
    definicao: "Jogos em que o time vencia no intervalo e terminou perdendo.",
  },

  // ------------------------------------------------ perfil estatístico
  posse: {
    rotulo: "Posse de bola",
    definicao: "Percentual médio do tempo com a bola.",
  },
  precisao_passe: {
    rotulo: "Precisão de passe",
    definicao: "Percentual dos passes que chegaram a um companheiro.",
  },
  pontaria: {
    rotulo: "Pontaria",
    definicao:
      "Dos chutes que o time deu, quantos foram na direção do gol. Mede se o time finaliza com critério.",
    formula: "chutes no gol ÷ chutes totais",
  },
  conversao: {
    rotulo: "Conversão",
    definicao:
      "Dos chutes que foram na direção do gol, quantos viraram gol. Mede o acabamento.",
    formula: "gols ÷ chutes no gol",
  },
  chutes_por_gol: {
    rotulo: "Chutes por gol",
    definicao: "Quantas finalizações o time precisou dar, em média, para fazer um gol.",
  },

  // --------------------------------------------------- força do rival
  faixa_tabela: {
    rotulo: "Faixa do adversário",
    definicao:
      "A tabela final dividida em quatro partes iguais. O 1º quarto são os melhores colocados, o 4º são os últimos.",
    cuidado:
      'Não é "G4" nem "zona de rebaixamento": quem classifica e quem cai muda por competição e por ano.',
  },
  posicao_media_adversario: {
    rotulo: "Colocação média do rival",
    definicao:
      "Em que posição, na média, terminaram os adversários enfrentados naquela faixa. Enfrentar o 1º quarto não é a mesma coisa se foi o campeão ou o quinto colocado.",
  },

  // -------------------------------------------------------- origem do gol
  gol_contra_a_favor: {
    rotulo: "Gols contra a favor",
    definicao:
      "Gols que o adversário marcou contra a própria meta. Contam no placar do time, como manda a regra.",
  },
  assistidos: {
    rotulo: "Com assistência",
    definicao: "Gols que vieram de um passe decisivo registrado.",
    cuidado:
      "A fonte não registra assistência na Copa do Brasil nem no Paranaense — nesses casos a coluna fica vazia em vez de zero.",
  },

  // -------------------------------------------------------------- banco
  gols_do_banco: {
    rotulo: "Gols de quem entrou",
    definicao:
      "Gols marcados por jogadores que começaram no banco e entraram durante a partida.",
  },
  primeira_troca: {
    rotulo: "Minuto da 1ª substituição",
    definicao:
      "Em que minuto, na média, o técnico fez a primeira troca. Descreve a intenção melhor que a média de todas as substituições, que mistura ajuste tático com queima de tempo no fim.",
  },
  autor_nao_identificado: {
    rotulo: "Autor não identificado",
    definicao:
      "Gols em partidas que têm os lances extraídos mas não a escalação, então não dá para saber se quem marcou era titular ou reserva.",
  },

  // -------------------------------------------------------- disciplina
  jogos_com_expulsao: {
    rotulo: "Jogos com expulsão",
    definicao: "Em quantas partidas o time ficou com um jogador a menos.",
    cuidado:
      "É a amostra das duas colunas seguintes. Com dois ou três jogos, a taxa não sustenta conclusão.",
  },
  sofridos_um_a_menos: {
    rotulo: "Gols sofridos por 90min com um a menos",
    definicao:
      "Ritmo de gols sofridos enquanto o time jogava em desvantagem numérica. Só faz sentido lido contra o ritmo normal, na coluna ao lado.",
    formula: "gols sofridos após a expulsão ÷ minutos em desvantagem × 90",
    cuidado:
      "Os minutos em desvantagem ignoram acréscimos, então a taxa sai um pouco alta demais.",
  },
  ritmo_normal: {
    rotulo: "Ritmo normal",
    definicao:
      "Gols sofridos por jogo pelo time no conjunto das partidas analisadas. É o ponto de comparação.",
  },

  // ------------------------------------------------------- arbitragem
  vs_media: {
    rotulo: "Diferença para a média",
    definicao:
      "Quanto o aproveitamento sob aquele árbitro foge da média do próprio time.",
    cuidado:
      "Nenhum árbitro apitou muitos jogos do mesmo time. Nessa amostra, a diferença é ruído e não tendência.",
  },

  // ---------------------------------------------------------- jogadores
  por_90: {
    rotulo: "Por 90 minutos",
    definicao:
      "Produção ajustada ao tempo em campo, como se todos tivessem jogado o mesmo. Responde quem rende mais quando joga, e não quem jogou mais.",
    cuidado:
      "Sem um mínimo de minutos a taxa engana: quem entrou 12 minutos e marcou aparece com 7,5 gols por 90.",
  },
  duelos_ganhos_pct: {
    rotulo: "Duelos ganhos",
    definicao: "Percentual das disputas diretas que o jogador venceu.",
  },
  minutos_por_jogo: {
    rotulo: "Minutos por jogo",
    definicao: "Média de minutos em campo, contando só os jogos em que entrou.",
  },
} satisfies Record<string, Verbete>;

export type ChaveGlossario = keyof typeof GLOSSARIO;

/**
 * Acesso uniforme a um verbete.
 *
 * O `satisfies` acima é proposital: ele valida cada entrada contra Verbete e
 * ainda deixa `ChaveGlossario` ser a união das chaves reais, então errar o nome
 * de um termo quebra na compilação. O efeito colateral é que cada entrada
 * mantém seu tipo literal, e quem tem só `definicao` não expõe `formula` nem
 * `cuidado`. Esta função devolve o tipo largo e resolve isso num lugar só, em
 * vez de espalhar `in` ou cast por todo componente que lê o glossário.
 */
export function verbete(k: ChaveGlossario): Verbete {
  return GLOSSARIO[k];
}
