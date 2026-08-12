import { Link, useParams } from "react-router-dom";

import { api, type JogadorEscalado } from "../api";
import Campo from "../components/Campo";
import EstatisticasDaPartida from "../components/EstatisticasDaPartida";
import LinhaDoTempo from "../components/LinhaDoTempo";
import { useDados } from "../useDados";

function dataBr(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function JogoPage() {
  const { fixtureId } = useParams();
  const id = Number(fixtureId);

  const { dados: jogo, erro } = useDados(() => api.partida(id), [id]);
  const { dados: escalacoes } = useDados(() => api.escalacoes(id), [id]);
  const { dados: estatisticas } = useDados(
    () => api.estatisticasDaPartida(id),
    [id],
  );
  const { dados: eventos } = useDados(() => api.eventosDaPartida(id), [id]);

  if (erro) {
    return (
      <div className="cartao">
        Jogo não encontrado. <Link to="/">Voltar</Link>
      </div>
    );
  }

  const daCasa = escalacoes?.filter((e) => e.team_id === jogo?.time_casa_id) ?? [];
  const deFora = escalacoes?.filter((e) => e.team_id === jogo?.time_fora_id) ?? [];
  const temEscalacao = daCasa.length > 0 || deFora.length > 0;

  return (
    <>
      {/* ------------------------------------------------- placar */}
      <div className="cartao">
        <p className="discreto" style={{ marginTop: 0 }}>
          {jogo && (
            <>
              {dataBr(jogo.data)} · {jogo.league_nome}
              {jogo.rodada ? ` · ${jogo.rodada}` : ""}
              {jogo.estadio ? ` · ${jogo.estadio}` : ""}
            </>
          )}
        </p>

        <div className="placar">
          <LadoDoPlacar
            id={jogo?.time_casa_id}
            nome={jogo?.time_casa}
            logo={jogo?.time_casa_logo}
            alinhamento="direita"
          />
          <div className="placar-numeros">
            <span>
              {jogo?.gols_casa ?? "–"} <span className="discreto">×</span>{" "}
              {jogo?.gols_fora ?? "–"}
            </span>
            {jogo?.penaltis_casa != null && jogo?.penaltis_fora != null && (
              <div className="discreto">
                pênaltis {jogo.penaltis_casa} × {jogo.penaltis_fora}
              </div>
            )}
            {jogo?.gols_casa_1t != null && (
              <div className="discreto">
                1º tempo {jogo.gols_casa_1t} × {jogo.gols_fora_1t}
              </div>
            )}
          </div>
          <LadoDoPlacar
            id={jogo?.time_fora_id}
            nome={jogo?.time_fora}
            logo={jogo?.time_fora_logo}
            alinhamento="esquerda"
          />
        </div>

        {jogo?.arbitro && (
          <p className="discreto" style={{ marginBottom: 0, textAlign: "center" }}>
            Árbitro: {jogo.arbitro}
          </p>
        )}
      </div>

      {/* ------------------------------- estatísticas e lances */}
      {(estatisticas?.length || eventos?.length) && (
        <div className="duas-colunas-iguais">
          {estatisticas && estatisticas.length > 0 && (
            <div className="cartao">
              <h2>Estatísticas</h2>
              <EstatisticasDaPartida lados={estatisticas} />
            </div>
          )}
          {eventos && eventos.length > 0 && (
            <div className="cartao">
              <h2>Lances</h2>
              <LinhaDoTempo eventos={eventos} />
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------- escalações */}
      {temEscalacao ? (
        <div className="duas-colunas-iguais">
          <TimeEmCampo titulo={jogo?.time_casa ?? ""} jogadores={daCasa} />
          <TimeEmCampo titulo={jogo?.time_fora ?? ""} jogadores={deFora} />
        </div>
      ) : (
        <div className="cartao">
          <h2>Escalações</h2>
          <p className="discreto" style={{ marginBottom: 0 }}>
            Ainda não extraídas para este jogo — a onda 3 está em andamento e
            cobre parte das partidas.
          </p>
        </div>
      )}
    </>
  );
}

function LadoDoPlacar({
  id,
  nome,
  logo,
  alinhamento,
}: {
  id?: number;
  nome?: string;
  logo?: string | null;
  alinhamento: "esquerda" | "direita";
}) {
  return (
    <div className={`placar-time ${alinhamento}`}>
      {logo && <img src={logo} alt="" width={38} height={38} />}
      <Link to={`/times/${id}`}>
        <strong>{nome}</strong>
      </Link>
    </div>
  );
}

function TimeEmCampo({
  titulo,
  jogadores,
}: {
  titulo: string;
  jogadores: JogadorEscalado[];
}) {
  const formacao = jogadores.find((j) => j.formacao)?.formacao;
  const tecnico = jogadores.find((j) => j.tecnico)?.tecnico;
  const reservas = jogadores.filter((j) => !j.titular);

  return (
    <div className="cartao">
      <h2>
        {titulo} {formacao && <span className="faixa">{formacao}</span>}
      </h2>

      <Campo jogadores={jogadores} />

      {tecnico && <p className="discreto">Técnico: {tecnico}</p>}

      {reservas.length > 0 && (
        <details>
          <summary>
            <span className="discreto">Banco ({reservas.length})</span>
          </summary>
          <div className="tabela-wrap" style={{ marginTop: "0.6rem" }}>
            <table className="tabela-compacta">
              <thead>
                <tr>
                  <th className="num">#</th>
                  <th>Jogador</th>
                  <th>Pos</th>
                  <th className="num">Min</th>
                  <th className="num">Nota</th>
                </tr>
              </thead>
              <tbody>
                {reservas.map((r) => (
                  <tr key={r.player_id}>
                    <td className="num discreto">{r.camisa ?? "–"}</td>
                    <td>{r.jogador}</td>
                    <td className="discreto">{r.posicao ?? "–"}</td>
                    <td className="num discreto">{r.minutos ?? "–"}</td>
                    <td className="num">{r.nota?.toFixed(1) ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
