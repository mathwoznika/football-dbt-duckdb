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
};
