/**
 * Camada de acesso a API. Todo fetch do app passa por aqui.
 *
 * Por que centralizar: a URL base aparece uma vez so (no dia do deploy, muda
 * um lugar), o tratamento de erro e igual em toda tela, e os tipos ficam ao
 * lado das funcoes que os devolvem.
 *
 * Os tipos abaixo espelham os response_model do Pydantic. Por enquanto estao
 * escritos a mao; da para gerar automaticamente a partir do /openapi.json do
 * FastAPI, e ai o front quebra na compilacao se a API mudar um campo.
 */

const BASE = "http://127.0.0.1:8000";

export type Time = {
  team_id: number;
  team_nome: string;
  pais: string | null;
  fundacao: number | null;
  cidade: string | null;
  estadio: string | null;
  capacidade: number | null;
  logo_url: string | null;
};

export type TemporadaDoTime = {
  league_id: number;
  league_nome: string;
  season: number;
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  gols_pro: number;
  gols_contra: number;
  saldo: number;
  pontos: number;
  aproveitamento_pct: number;
  /** MAIOR sequencia invicta da temporada — e um recorde, nao o estado atual. */
  maior_invencibilidade: number;
  jogos_sem_derrota: number;
  jogos_sem_vitoria: number;
  ultimo_resultado: string | null;
  /** Colocacao nos pontos corridos. Em mata-mata descreve a fase de grupos. */
  posicao: number | null;
  /** Como a campanha terminou de verdade: Campeao, Eliminado — <fase>, Nº lugar. */
  resultado_final: string | null;
  fase_mais_avancada: string | null;
};

export type ConfrontoEliminatorio = {
  fase: string;
  fase_nome: string;
  ordem_fase: number;
  partidas: number;
  time_a_id: number;
  time_a_nome: string | null;
  time_a_logo: string | null;
  gols_a: number;
  penaltis_a: number | null;
  time_b_id: number;
  time_b_nome: string | null;
  time_b_logo: string | null;
  gols_b: number;
  penaltis_b: number | null;
  /** Placar de cada perna — o agregado sozinho esconde como o confronto foi. */
  ida_data: string | null;
  ida_gols_a: number | null;
  ida_gols_b: number | null;
  ida_penaltis_a: number | null;
  ida_penaltis_b: number | null;
  volta_data: string | null;
  volta_gols_a: number | null;
  volta_gols_b: number | null;
  volta_penaltis_a: number | null;
  volta_penaltis_b: number | null;
  vencedor_id: number | null;
  eliminado_id: number | null;
  data_inicio: string;
  data_fim: string;
};

export type Partida = {
  fixture_id: number;
  data: string;
  season: number;
  league_id: number;
  league_nome: string;
  rodada: string | null;
  status: string;
  estadio: string | null;
  arbitro: string | null;
  time_casa_id: number;
  time_casa: string;
  time_casa_logo: string | null;
  gols_casa: number | null;
  gols_casa_1t: number | null;
  penaltis_casa: number | null;
  time_fora_id: number;
  time_fora: string;
  time_fora_logo: string | null;
  gols_fora: number | null;
  gols_fora_1t: number | null;
  penaltis_fora: number | null;
};

export type JogadorEscalado = {
  team_id: number;
  team_nome: string;
  formacao: string | null;
  tecnico: string | null;
  player_id: number;
  jogador: string;
  camisa: number | null;
  posicao: string | null;
  titular: boolean;
  /** 1 e o goleiro, crescendo em direcao ao ataque. Só titular tem. */
  linha: number | null;
  coluna: number | null;
  jogadores_na_linha: number | null;
  linhas_no_time: number | null;
  minutos: number | null;
  nota: number | null;
  gols: number | null;
  assistencias: number | null;
  chutes: number | null;
  chutes_no_gol: number | null;
  passes: number | null;
  desarmes: number | null;
  duelos: number | null;
  duelos_ganhos: number | null;
  amarelos: number | null;
  vermelhos: number | null;
  entrou_do_banco: boolean | null;
  saiu_no_minuto: number | null;
  entrou_no_minuto: number | null;
};

export type EstatisticaDaPartida = {
  team_id: number;
  team_nome: string;
  logo_url: string | null;
  e_do_mandante: boolean;
  posse_pct: number | null;
  chutes_total: number | null;
  chutes_no_gol: number | null;
  chutes_fora: number | null;
  chutes_bloqueados: number | null;
  chutes_dentro_area: number | null;
  escanteios: number | null;
  impedimentos: number | null;
  faltas: number | null;
  cartoes_amarelos: number | null;
  cartoes_vermelhos: number | null;
  defesas_goleiro: number | null;
  passes_total: number | null;
  passes_certos: number | null;
  precisao_passe_pct: number | null;
};

export type EventoDaPartida = {
  minuto: number;
  acrescimo: number | null;
  tipo: string;
  rotulo: string;
  detalhe: string | null;
  team_id: number;
  team_nome: string;
  e_do_mandante: boolean | null;
  jogador_id: number | null;
  jogador: string | null;
  relacionado_id: number | null;
  relacionado: string | null;
  /** 'entrou' numa substituicao, 'assistencia' num gol. */
  papel_relacionado: string | null;
};

export type JogadorNaTemporada = {
  player_id: number;
  jogador_nome: string;
  team_id: number;
  team_nome: string;
  season: number;
  league_id: number;
  league_nome: string | null;
  posicao: string | null;
  jogos_com_dado: number;
  jogos_com_minutos: number | null;
  jogos_titular: number;
  minutos: number | null;
  nota_media: number | null;
  melhor_nota: number | null;
  gols: number | null;
  assistencias: number | null;
  chutes: number | null;
  chutes_no_gol: number | null;
  passes: number | null;
  desarmes: number | null;
  duelos: number | null;
  duelos_ganhos: number | null;
  dribles_tentados: number | null;
  dribles_certos: number | null;
  faltas_cometidas: number | null;
  amarelos: number | null;
  vermelhos: number | null;
  defesas: number | null;
  gols_sofridos: number | null;
};

export type AtuacaoDoJogador = {
  fixture_id: number;
  data: string;
  season: number;
  league_id: number;
  league_nome: string;
  team_id: number;
  team_nome: string;
  adversario_id: number;
  adversario_nome: string;
  mando: string;
  gols_time: number | null;
  gols_adversario: number | null;
  minutos: number | null;
  posicao: string | null;
  nota: number | null;
  entrou_do_banco: boolean | null;
  gols: number | null;
  assistencias: number | null;
  chutes: number | null;
  chutes_no_gol: number | null;
  passes: number | null;
  desarmes: number | null;
  duelos: number | null;
  duelos_ganhos: number | null;
  amarelos: number | null;
  vermelhos: number | null;
};

export type Artilheiro = {
  posicao_artilharia: number;
  player_id: number;
  jogador: string;
  foto_url: string | null;
  idade: number | null;
  nacionalidade: string | null;
  posicao: string | null;
  team_id: number;
  team_nome: string;
  team_logo: string | null;
  jogos: number | null;
  minutos: number | null;
  gols: number;
  assistencias: number | null;
  gols_por_jogo: number | null;
  nota_media: number | null;
  /** A fonte repete os numeros de quem trocou de clube; usamos o maximo. */
  teve_mais_de_um_clube: boolean;
};

export type JogadorNaBase = {
  player_id: number;
  jogador_nome: string;
  team_id: number | null;
  team_nome: string | null;
  clubes: number;
  posicao: string | null;
  primeira_temporada: number;
  ultima_temporada: number;
  temporadas: number;
  competicoes: number;
  /** Vezes que foi RELACIONADO, inclusive sem entrar em campo. */
  jogos_com_dado: number;
  /** Partidas em que de fato jogou. E este que qualifica a media. */
  jogos_com_minutos: number;
  jogos_titular: number | null;
  minutos: number | null;
  nota_media: number | null;
  melhor_nota: number | null;
  gols: number | null;
  assistencias: number | null;
  chutes: number | null;
  desarmes: number | null;
  duelos: number | null;
  duelos_ganhos: number | null;
  amarelos: number | null;
  vermelhos: number | null;
  defesas: number | null;
  gols_sofridos: number | null;
};

export type DesempenhoPorTempo = {
  league_id: number;
  league_nome: string;
  season: number;
  jogos: number;
  gols_1t: number;
  gols_2t: number;
  sofridos_1t: number;
  sofridos_2t: number;
  saldo_1t: number;
  saldo_2t: number;
  pontos: number;
  /** Pontos que teria somado se todo jogo acabasse no intervalo. */
  pontos_se_acabasse_no_1t: number;
  /** Negativo = o time perde pontos no segundo tempo. */
  diferenca_de_pontos: number;
  intervalos_vencendo: number;
  intervalos_empatando: number;
  intervalos_perdendo: number;
  viradas: number;
  reacoes: number;
  vantagens_empatadas: number;
  vantagens_perdidas: number;
};

export type GolsPorPeriodo = {
  faixa: string;
  ordem_faixa: number;
  marcados: number;
  sofridos: number;
  /** Cobertura parcial: sobre quantos jogos a distribuicao foi calculada. */
  jogos_com_evento: number;
};

export type TecnicoDoTime = {
  coach_id: number;
  tecnico: string;
  season: number;
  league_id: number;
  league_nome: string;
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  gols_pro: number;
  gols_contra: number;
  pontos: number;
  aproveitamento_pct: number;
  primeiro_jogo: string;
  ultimo_jogo: string;
};

export type ArbitroDoTime = {
  arbitro: string;
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  gols_pro: number;
  gols_contra: number;
  pontos: number;
  aproveitamento_pct: number;
  /** Aproveitamento do time em TODOS os jogos, para servir de contraponto. */
  aproveitamento_geral_pct: number;
  diferenca_aproveitamento: number;
  /** Sobre quantos jogos faltas e cartoes foram somados (cobertura da onda 3). */
  jogos_com_estatistica: number;
  faltas_pro: number | null;
  faltas_contra: number | null;
  amarelos_pro: number | null;
  amarelos_contra: number | null;
  vermelhos_pro: number | null;
  vermelhos_contra: number | null;
  amarelos_por_jogo: number | null;
  amarelos_por_jogo_geral: number | null;
  diferenca_amarelos: number | null;
  primeiro_jogo: string;
  ultimo_jogo: string;
};

export type Competicao = {
  league_id: number;
  league_nome: string;
  season: number;
  times: number;
  jogos: number;
  campeao_id: number | null;
  campeao: string | null;
  tem_chaveamento: boolean;
  tem_classificacao: boolean;
};

export type PontoDaEvolucao = {
  rodada_n: number;
  time_id: number;
  time_nome: string;
  posicao: number;
  pontos_acum: number;
};

export type Transferencia = {
  player_id: number;
  jogador: string;
  data: string;
  tipo: string;
  valor_eur: number | null;
  /** 'chegou' ou 'saiu', do ponto de vista do clube consultado. */
  sentido: string | null;
  team_origem_id: number | null;
  team_origem: string | null;
  team_destino_id: number | null;
  team_destino: string | null;
};

export type LinhaClassificacao = {
  posicao: number;
  time_id: number;
  time_nome: string;
  logo_url: string | null;
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  gols_pro: number;
  gols_contra: number;
  saldo: number;
  pontos: number;
  aproveitamento_pct: number;
  /**
   * Resultados dos 5 ultimos jogos em ORDEM CRONOLOGICA: o primeiro caractere
   * e o mais antigo, o ultimo e o jogo mais recente. Por isso o front percorre
   * a string na ordem e o resultado recente cai na direita.
   */
  ultimos_5: string | null;
};

export type JogoDaCampanha = {
  fixture_id: number;
  jogo_n: number;
  data: string;
  league_id: number;
  league_nome: string;
  season: number;
  rodada: string | null;
  mando: string;
  adversario_id: number;
  adversario_nome: string;
  gols_pro: number;
  gols_contra: number;
  penaltis_pro: number | null;
  penaltis_contra: number | null;
  resultado: string;
  pontos: number;
  pontos_acumulados: number;
  saldo_acumulado: number;
  pontos_5_anteriores: number | null;
};

export type Confronto = {
  adversario_id: number;
  adversario_nome: string;
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  gols_pro: number;
  gols_contra: number;
  saldo: number;
  aproveitamento_pct: number;
  primeiro_confronto: string;
  ultimo_confronto: string;
};

/**
 * Faz a requisicao e converte a resposta.
 *
 * O <T> e um generico: quem chama diz qual tipo espera de volta, e o
 * TypeScript propaga isso pelo resto do codigo. E o que faz `times[0].team_nome`
 * ser autocompletado no editor.
 *
 * Detalhe importante: fetch NAO lança erro em resposta 404 ou 500 — ele so
 * lança se a rede falhar. Por isso o `if (!resposta.ok)` explicito; sem ele,
 * um 404 viraria um objeto de erro tratado como se fosse dado valido.
 */
async function get<T>(caminho: string): Promise<T> {
  const resposta = await fetch(`${BASE}${caminho}`);
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => null);
    throw new Error(corpo?.detail ?? `HTTP ${resposta.status}`);
  }
  return (await resposta.json()) as T;
}

/** Monta a query string ignorando o que estiver vazio. */
function query(params: Record<string, string | number | undefined>): string {
  const partes = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return partes.length ? `?${partes.join("&")}` : "";
}

export const api = {
  times: (busca?: string) =>
    // a API exige no minimo 2 caracteres na busca; abaixo disso nem enviamos
    get<Time[]>(
      `/times${query({ busca: busca && busca.length >= 2 ? busca : undefined, limite: 100 })}`,
    ),

  time: (id: number) => get<Time>(`/times/${id}`),

  temporadas: (id: number) => get<TemporadaDoTime[]>(`/times/${id}/temporadas`),

  campanha: (id: number, season?: number, league_id?: number) =>
    get<JogoDaCampanha[]>(`/times/${id}/campanha${query({ season, league_id })}`),

  confrontos: (id: number, min_jogos = 3) =>
    get<Confronto[]>(`/times/${id}/confrontos${query({ min_jogos })}`),

  // Os dois endpoints abaixo devolvem lista vazia quando a competicao nao tem
  // aquilo — pontos corridos nao tem chaveamento, copa pura nao tem tabela.
  // A tela decide o que mostrar olhando qual dos dois veio preenchido.
  chaveamento: (league_id: number, season: number) =>
    get<ConfrontoEliminatorio[]>(
      `/competicoes/${league_id}/temporadas/${season}/chaveamento`,
    ),

  classificacao: (league_id: number, season: number) =>
    get<LinhaClassificacao[]>(
      `/competicoes/${league_id}/temporadas/${season}/classificacao`,
    ),

  partida: (fixture_id: number) => get<Partida>(`/jogos/${fixture_id}`),

  // vazio enquanto a onda 3 nao cobrir aquele jogo
  escalacoes: (fixture_id: number) =>
    get<JogadorEscalado[]>(`/jogos/${fixture_id}/escalacoes`),

  estatisticasDaPartida: (fixture_id: number) =>
    get<EstatisticaDaPartida[]>(`/jogos/${fixture_id}/estatisticas`),

  eventosDaPartida: (fixture_id: number) =>
    get<EventoDaPartida[]>(`/jogos/${fixture_id}/eventos`),

  elenco: (team_id: number, season?: number, league_id?: number) =>
    get<JogadorNaTemporada[]>(`/times/${team_id}/elenco${query({ season, league_id })}`),

  temporadasDoJogador: (player_id: number) =>
    get<JogadorNaTemporada[]>(`/jogadores/${player_id}/temporadas`),

  jogosDoJogador: (player_id: number, season?: number, league_id?: number) =>
    get<AtuacaoDoJogador[]>(`/jogadores/${player_id}/jogos${query({ season, league_id })}`),

  jogadores: (busca?: string, min_jogos = 5) =>
    get<JogadorNaBase[]>(
      `/jogadores${query({ busca: busca && busca.length >= 2 ? busca : undefined, min_jogos, limite: 100 })}`,
    ),

  desempenhoPorTempo: (team_id: number) =>
    get<DesempenhoPorTempo[]>(`/times/${team_id}/desempenho-por-tempo`),

  golsPorPeriodo: (team_id: number, season?: number, league_id?: number) =>
    get<GolsPorPeriodo[]>(
      `/times/${team_id}/gols-por-periodo${query({ season, league_id })}`,
    ),

  arbitragem: (team_id: number, min_jogos = 3) =>
    get<ArbitroDoTime[]>(`/times/${team_id}/arbitragem${query({ min_jogos })}`),

  tecnicos: (team_id: number) => get<TecnicoDoTime[]>(`/times/${team_id}/tecnicos`),

  competicoes: () => get<Competicao[]>("/competicoes"),

  evolucao: (league_id: number, season: number) =>
    get<PontoDaEvolucao[]>(
      `/competicoes/${league_id}/temporadas/${season}/evolucao`,
    ),

  transferencias: (team_id: number, desde?: number, limite = 60) =>
    get<Transferencia[]>(
      `/times/${team_id}/transferencias${query({ desde, limite })}`,
    ),

  artilheiros: (league_id: number, season: number, limite = 10) =>
    get<Artilheiro[]>(
      `/competicoes/${league_id}/temporadas/${season}/artilheiros${query({ limite })}`,
    ),
};
