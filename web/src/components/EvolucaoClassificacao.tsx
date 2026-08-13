import { useState } from "react";

import type { PontoDaEvolucao } from "../api";

/**
 * Posição de cada time ao longo das rodadas, em SVG puro.
 *
 * Duas correções de leitura chegaram nesta versão:
 *
 * As 20 linhas com o mesmo peso eram ilegíveis — num campeonato de 20 times as
 * trajetórias se cruzam a cada rodada. O gráfico mostra **uma história por
 * vez**: a linha escolhida em destaque, as outras como fundo apagado.
 *
 * E ele era alto demais. O viewBox largo e baixo (320×96) mais um teto de
 * largura mantêm a proporção de gráfico de linha em vez de um quadrado
 * ocupando a tela inteira.
 *
 * O eixo Y é INVERTIDO: a 1ª posição fica no topo.
 */
export default function EvolucaoClassificacao({
  pontos,
  destaque,
}: {
  pontos: PontoDaEvolucao[];
  destaque?: number;
}) {
  const [escolhido, setEscolhido] = useState<number | null>(null);

  if (!pontos.length) return null;

  const maxRodada = Math.max(...pontos.map((p) => p.rodada_n));
  const maxPosicao = Math.max(...pontos.map((p) => p.posicao));

  const porTime = new Map<number, PontoDaEvolucao[]>();
  for (const p of pontos) {
    if (!porTime.has(p.time_id)) porTime.set(p.time_id, []);
    porTime.get(p.time_id)!.push(p);
  }

  const times = [...porTime.entries()]
    .map(([id, serie]) => ({ id, serie, final: serie[serie.length - 1] }))
    .sort((a, b) => a.final.posicao - b.final.posicao);

  const focado = escolhido ?? destaque ?? times[0]?.id;
  const serie = porTime.get(focado);

  const L = 16;
  const R = 3;
  const T = 5;
  const B = 11;
  const W = 320;
  const H = 96;

  const x = (r: number) => L + ((r - 1) / Math.max(1, maxRodada - 1)) * (W - L - R);
  const y = (p: number) => T + ((p - 1) / Math.max(1, maxPosicao - 1)) * (H - T - B);
  const traco = (s: PontoDaEvolucao[]) =>
    s.map((p) => `${x(p.rodada_n)},${y(p.posicao)}`).join(" ");

  const rodadas = [1, 10, 20, 30, maxRodada].filter(
    (v, i, a) => v <= maxRodada && a.indexOf(v) === i,
  );

  const melhor = serie ? Math.min(...serie.map((p) => p.posicao)) : null;
  const pior = serie ? Math.max(...serie.map((p) => p.posicao)) : null;
  const fim = serie?.[serie.length - 1];

  // Resumo da campanha, tirado da propria curva.
  //
  // "4 primeiros" e "4 ultimos" sao descritivos de proposito: quem classifica
  // e quem cai muda por competicao e por ano, e afirmar "zona de rebaixamento"
  // seria inventar regra que o dado nao tem.
  const resumo = serie
    ? {
        media: (serie.reduce((a, p) => a + p.posicao, 0) / serie.length).toFixed(1),
        lider: serie.filter((p) => p.posicao === 1).length,
        topo: serie.filter((p) => p.posicao <= 4).length,
        fundo: serie.filter((p) => p.posicao > maxPosicao - 4).length,
        // maior variacao entre duas rodadas seguidas
        subida: Math.max(
          0,
          ...serie.slice(1).map((p, i) => serie[i].posicao - p.posicao),
        ),
        queda: Math.max(
          0,
          ...serie.slice(1).map((p, i) => p.posicao - serie[i].posicao),
        ),
      }
    : null;

  return (
    <div className="evolucao">
      <div className="linha" style={{ marginBottom: "0.5rem" }}>
        <select
          className="compacto"
          value={focado ?? ""}
          onChange={(e) => setEscolhido(Number(e.target.value))}
        >
          {times.map((t) => (
            <option key={t.id} value={t.id}>
              {t.final.posicao}º · {t.final.time_nome}
            </option>
          ))}
        </select>
        {fim && (
          <span className="discreto" style={{ fontSize: "0.8rem" }}>
            melhor {melhor}º · pior {pior}º · {fim.pontos_acum} pts
          </span>
        )}
      </div>

      <div className="evolucao-corpo">
      <svg viewBox={`0 0 ${W} ${H}`} className="evolucao-svg">
        {/* só duas referências: topo e fundo da tabela */}
        {[1, maxPosicao].map((pos) => (
          <g key={pos}>
            <line x1={L} y1={y(pos)} x2={W - R} y2={y(pos)} className="grade" />
            <text x={L - 3} y={y(pos) + 1.6} className="eixo" textAnchor="end">
              {pos}º
            </text>
          </g>
        ))}

        {rodadas.map((r) => (
          <text key={r} x={x(r)} y={H - 2} className="eixo" textAnchor="middle">
            {r}
          </text>
        ))}

        {times
          .filter((t) => t.id !== focado)
          .map((t) => (
            <polyline key={t.id} points={traco(t.serie)} className="serie fundo" />
          ))}

        {serie && (
          <>
            <polyline points={traco(serie)} className="serie focada" />
            {/* ponto no fim, para o olho achar onde a campanha terminou */}
            <circle cx={x(fim!.rodada_n)} cy={y(fim!.posicao)} r={2} className="ponta" />
          </>
        )}
      </svg>

      {resumo && (
        <div className="evolucao-resumo">
          <Linha rotulo="Posição média" valor={resumo.media} />
          <Linha rotulo="Rodadas na liderança" valor={resumo.lider} />
          <Linha rotulo="Rodadas entre os 4 primeiros" valor={resumo.topo} />
          <Linha rotulo="Rodadas entre os 4 últimos" valor={resumo.fundo} />
          <Linha
            rotulo="Maior salto numa rodada"
            valor={resumo.subida > 0 ? `+${resumo.subida}` : "—"}
          />
          <Linha
            rotulo="Maior queda numa rodada"
            valor={resumo.queda > 0 ? `−${resumo.queda}` : "—"}
          />
        </div>
      )}
      </div>
    </div>
  );
}

/** Uma linha do resumo: rótulo à esquerda, número à direita. */
function Linha({ rotulo, valor }: { rotulo: string; valor: string | number }) {
  return (
    <div className="evolucao-linha">
      <span className="discreto">{rotulo}</span>
      <strong>{valor}</strong>
    </div>
  );
}
