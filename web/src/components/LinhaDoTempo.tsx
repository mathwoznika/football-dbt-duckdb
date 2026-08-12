import type { EventoDaPartida } from "../api";

/** Ícone de cada tipo de lance. */
function icone(e: EventoDaPartida) {
  if (e.tipo === "Goal") return "⚽";
  if (e.tipo === "subst") return "🔁";
  if (e.tipo === "Var") return "📺";
  if (e.detalhe?.toLowerCase().includes("red")) return "🟥";
  return "🟨";
}

/**
 * Linha do tempo da partida, mandante à esquerda e visitante à direita.
 *
 * A leitura dos dois jogadores de cada lance vem pronta do dbt, no
 * `papel_relacionado`. Isso importa porque o significado muda com o tipo: num
 * gol o segundo nome é quem deu a assistência, numa substituição é quem entrou
 * — e a API inverte o que o nome dos campos sugere.
 */
export default function LinhaDoTempo({ eventos }: { eventos: EventoDaPartida[] }) {
  if (!eventos.length) {
    return (
      <p className="discreto" style={{ marginBottom: 0 }}>
        Lances ainda não extraídos para este jogo.
      </p>
    );
  }

  return (
    <div className="timeline">
      {eventos.map((e, i) => (
        <div
          key={i}
          className={`timeline-item ${e.e_do_mandante ? "casa" : "fora"}`}
        >
          <div className="timeline-minuto">
            {e.minuto}
            {e.acrescimo ? `+${e.acrescimo}` : ""}'
          </div>
          <div className="timeline-corpo">
            <span className="timeline-icone">{icone(e)}</span>
            <div>
              <div className="timeline-principal">{e.jogador ?? e.rotulo}</div>
              <div className="discreto timeline-nota">
                {e.tipo === "subst" && e.relacionado
                  ? `entra ${e.relacionado}`
                  : e.papel_relacionado === "assistencia"
                    ? `${e.rotulo} · assistência de ${e.relacionado}`
                    : e.rotulo}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
