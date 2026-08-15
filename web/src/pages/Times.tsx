import { Link, useSearchParams } from "react-router-dom";

import { api } from "../api";
import { useDados } from "../useDados";

/**
 * Lista de clubes com busca.
 *
 * A busca refaz a requisicao a cada tecla porque `busca` esta na lista de
 * dependencias do useDados. Para 153 clubes numa API local isso e instantaneo;
 * numa base grande o certo seria esperar o usuario parar de digitar (debounce).
 */
export default function Times() {
  // A busca vive na URL, e nao num useState local. Assim o campo do cabecalho
  // e o desta tela sao o mesmo estado, o resultado e compartilhavel por link e
  // o botao voltar do navegador funciona sobre as buscas.
  const [params, setParams] = useSearchParams();
  const busca = params.get("busca") ?? "";
  const { dados: times, erro, carregando } = useDados(() => api.times(busca), [busca]);

  function setBusca(valor: string) {
    setParams(valor ? { busca: valor } : {}, { replace: true });
  }

  return (
    <>
      <div className="cartao">
        <div className="linha">
          <input
            placeholder="Buscar clube..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ minWidth: 260 }}
          />
          <span className="discreto">
            {carregando ? "buscando..." : `${times?.length ?? 0} clubes`}
          </span>
        </div>
      </div>

      {erro && <div className="cartao">Erro: {erro}</div>}

      <div className="cartao">
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Clube</th>
                <th>Cidade</th>
                <th>Estádio</th>
                <th className="num">Capacidade</th>
                <th className="num">Fundação</th>
              </tr>
            </thead>
            <tbody>
              {times?.map((t) => (
                <tr key={t.team_id}>
                  <td>
                    {t.logo_url && (
                      <img src={t.logo_url} alt="" width={22} height={22} />
                    )}
                  </td>
                  <td>
                    {/* Link troca de tela sem recarregar a pagina */}
                    <Link to={`/times/${t.team_id}`}>
                      <strong>{t.team_nome}</strong>
                    </Link>
                  </td>
                  <td className="discreto">{t.cidade ?? "—"}</td>
                  <td className="discreto">{t.estadio ?? "—"}</td>
                  <td className="num">
                    {t.capacidade?.toLocaleString("pt-BR") ?? "—"}
                  </td>
                  <td className="num">{t.fundacao ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
