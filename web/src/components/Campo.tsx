import { Link } from "react-router-dom";

import type { JogadorEscalado } from "../api";

/**
 * Escalacao desenhada num campo.
 *
 * As coordenadas vem prontas da API-Football, no campo `grid` do lineup:
 * "linha:coluna", onde a linha 1 e o goleiro e cresce em direcao ao ataque.
 * Nao inventamos layout por formacao — o 4-2-3-1 se desenha sozinho porque o
 * dado ja diz quem esta onde.
 *
 * A conversao para porcentagem usa `jogadores_na_linha + 1` como divisor. Isso
 * distribui a linha com margem nas pontas: 4 zagueiros caem em 20%, 40%, 60% e
 * 80%, em vez de encostarem na lateral.
 */
export default function Campo({ jogadores }: { jogadores: JogadorEscalado[] }) {
  const titulares = jogadores.filter(
    (j) => j.titular && j.linha !== null && j.coluna !== null,
  );

  if (!titulares.length) {
    return (
      <p className="discreto">
        Sem posicionamento para este jogo — a API nem sempre entrega o campo
        `grid` da escalação.
      </p>
    );
  }

  return (
    <div className="campo">
      {/* marcacoes do campo: so linhas, sem texto */}
      <svg viewBox="0 0 100 150" preserveAspectRatio="none" className="campo-linhas">
        <rect x="1" y="1" width="98" height="148" />
        <line x1="1" y1="75" x2="99" y2="75" />
        <circle cx="50" cy="75" r="14" />
        {/* area do gol defendido (embaixo) e do atacado (em cima) */}
        <rect x="22" y="127" width="56" height="22" />
        <rect x="36" y="141" width="28" height="8" />
        <rect x="22" y="1" width="56" height="22" />
        <rect x="36" y="1" width="28" height="8" />
      </svg>

      {titulares.map((j) => {
        // o goleiro (linha 1) fica embaixo; o ataque, em cima
        const y = 100 - (j.linha! / (j.linhas_no_time! + 1)) * 100;
        const x = (j.coluna! / (j.jogadores_na_linha! + 1)) * 100;

        return (
          <div
            key={j.player_id}
            className="campo-jogador"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <span className={`camisa ${classeDaNota(j.nota)}`}>
              {j.camisa ?? "–"}
            </span>
            <span className="campo-nome">{sobrenome(j.jogador)}</span>
            {j.nota !== null && <span className="campo-nota">{j.nota.toFixed(1)}</span>}
            {/* o cartao inteiro leva para a pagina do jogador */}
            <Link
              className="campo-link"
              to={`/jogadores/${j.player_id}`}
              title={j.jogador}
            />
          </div>
        );
      })}
    </div>
  );
}

/** Nota vira cor: acima de 7 e boa atuacao, abaixo de 6 e ruim. */
function classeDaNota(nota: number | null) {
  if (nota === null) return "";
  if (nota >= 7) return "boa";
  if (nota < 6) return "ruim";
  return "media";
}

/**
 * O campinho e estreito e nome completo nao cabe. Fica a ultima palavra, que e
 * como o jogador costuma ser chamado — exceto quando o nome ja e curto.
 */
function sobrenome(nome: string) {
  const partes = nome.split(" ");
  return partes.length <= 2 ? nome : partes[partes.length - 1];
}
