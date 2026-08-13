import { Link } from "react-router-dom";

import type { JogadorEscalado } from "../api";

/**
 * Escalação desenhada num campo.
 *
 * As coordenadas vêm prontas da API-Football, no campo `grid` do lineup:
 * "linha:coluna", onde a linha 1 é o goleiro e cresce em direção ao ataque.
 * Nenhuma formação é codificada — o 4-2-3-1 e o 3-5-2 se desenham sozinhos.
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
      {/* marcações do campo: só linhas, sem texto */}
      <svg viewBox="0 0 100 135" preserveAspectRatio="none" className="campo-linhas">
        <rect x="1" y="1" width="98" height="133" />
        <line x1="1" y1="67.5" x2="99" y2="67.5" />
        <circle cx="50" cy="67.5" r="12" />
        {/* área defendida (embaixo) e atacada (em cima) */}
        <rect x="24" y="114" width="52" height="20" />
        <rect x="37" y="127" width="26" height="7" />
        <rect x="24" y="1" width="52" height="20" />
        <rect x="37" y="1" width="26" height="7" />
      </svg>

      {titulares.map((j) => (
        <div
          key={j.player_id}
          className="campo-jogador"
          style={{ left: `${posicaoX(j)}%`, top: `${posicaoY(j)}%` }}
        >
          <span className={`camisa ${classeDaNota(j.nota)}`}>{j.camisa ?? "–"}</span>
          <span className="campo-nome">{sobrenome(j.jogador)}</span>

          <span className="campo-marcas">
            {j.nota !== null && <span className="campo-nota">{j.nota.toFixed(1)}</span>}
            {(j.amarelos ?? 0) > 0 && <span className="marca-cartao amarelo" title="Cartão amarelo" />}
            {(j.vermelhos ?? 0) > 0 && <span className="marca-cartao vermelho" title="Cartão vermelho" />}
            {j.saiu_no_minuto !== null && (
              <span className="saiu" title={`Substituído aos ${j.saiu_no_minuto}'`}>
                ↓{j.saiu_no_minuto}
              </span>
            )}
          </span>

          <Link className="campo-link" to={`/jogadores/${j.player_id}`} title={j.jogador} />
        </div>
      ))}
    </div>
  );
}

/**
 * Posição vertical. O goleiro cola no gol e as linhas de campo ocupam o miolo.
 *
 * Distribuir todas as linhas uniformemente pela altura — que era o que eu fazia
 * antes — deixava o goleiro FORA da própria área, flutuando à frente dela. Num
 * campo real a distância do goleiro para a zaga é bem maior que entre as linhas
 * de campo, e é isso que a exceção do `linha === 1` reproduz.
 */
function posicaoY(j: JogadorEscalado) {
  const linha = j.linha!;
  const total = j.linhas_no_time!;
  if (linha === 1) return 92; // dentro da área
  // as demais se espalham de 77% (zaga) a 16% (ataque)
  return 77 - ((linha - 2) / Math.max(1, total - 2)) * 61;
}

/** Distribui a linha com margem nas pontas: 4 zagueiros caem em 20/40/60/80%. */
function posicaoX(j: JogadorEscalado) {
  return (j.coluna! / (j.jogadores_na_linha! + 1)) * 100;
}

/** Nota vira cor: acima de 7 é boa atuação, abaixo de 6 é ruim. */
function classeDaNota(nota: number | null) {
  if (nota === null) return "";
  if (nota >= 7) return "boa";
  if (nota < 6) return "ruim";
  return "media";
}

/**
 * O campinho é estreito e nome completo não cabe. Fica a última palavra, que é
 * como o jogador costuma ser chamado — exceto quando o nome já é curto.
 */
function sobrenome(nome: string) {
  const partes = nome.split(" ");
  return partes.length <= 2 ? nome : partes[partes.length - 1];
}
