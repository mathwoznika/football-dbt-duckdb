import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api, type Time } from "../api";

/**
 * Busca de clubes com resultados enquanto se digita.
 *
 * O QUE ESTAVA ERRADO ANTES: o campo só reagia ao Enter, e Enter levava para a
 * listagem completa. Quem digita "pal" quer ver o Palmeiras e clicar — ter que
 * confirmar, trocar de tela e procurar de novo na tabela é uma etapa a mais
 * para a intenção mais comum do app.
 *
 * DEBOUNCE DE 200ms. Sem ele sai uma requisição por tecla: "palmeiras" viraria
 * nove chamadas, das quais oito são descartadas. Duzentos milissegundos é o
 * intervalo em que a digitação normal ainda não terminou — na prática a busca
 * dispara uma vez, quando os dedos param.
 *
 * O Enter continua funcionando e leva à listagem filtrada, que é o caminho para
 * quem quer comparar vários clubes em vez de abrir um.
 */
export default function BuscaClubes() {
  const [termo, setTermo] = useState("");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const [achados, setAchados] = useState<Time[]>([]);
  const caixa = useRef<HTMLDivElement>(null);
  const navegar = useNavigate();

  // espera a digitação parar antes de consultar
  useEffect(() => {
    const id = setTimeout(() => setBusca(termo.trim()), 200);
    return () => clearTimeout(id);
  }, [termo]);

  useEffect(() => {
    // a API exige 2 caracteres; abaixo disso nem vale a viagem
    if (busca.length < 2) {
      setAchados([]);
      return;
    }
    let ativo = true;
    api
      .times(busca)
      .then((lista) => {
        // a resposta pode chegar depois de o usuário já ter mudado o termo
        if (ativo) setAchados(lista.slice(0, 8));
      })
      .catch(() => {
        if (ativo) setAchados([]);
      });
    return () => {
      ativo = false;
    };
  }, [busca]);

  // clicar fora fecha a lista
  useEffect(() => {
    function fora(evento: MouseEvent) {
      if (caixa.current && !caixa.current.contains(evento.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  function abrirClube(id: number) {
    setTermo("");
    setAberto(false);
    navegar(`/times/${id}`);
  }

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    const limpo = termo.trim();
    // com um único resultado, Enter faz o óbvio em vez de mandar para a lista
    if (achados.length === 1) {
      abrirClube(achados[0].team_id);
      return;
    }
    setAberto(false);
    navegar(limpo ? `/times?busca=${encodeURIComponent(limpo)}` : "/times");
  }

  const mostrar = aberto && busca.length >= 2;

  return (
    <div className="busca" ref={caixa}>
      <form onSubmit={enviar} role="search">
        <input
          type="search"
          placeholder="Buscar clube..."
          value={termo}
          onChange={(e) => {
            setTermo(e.target.value);
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          onKeyDown={(e) => e.key === "Escape" && setAberto(false)}
          aria-label="Buscar clube"
          autoComplete="off"
        />
      </form>

      {mostrar && (
        <div className="busca-lista">
          {achados.length === 0 ? (
            <div className="busca-vazio discreto">Nenhum clube encontrado</div>
          ) : (
            achados.map((t) => (
              <button
                key={t.team_id}
                type="button"
                className="busca-item"
                onClick={() => abrirClube(t.team_id)}
              >
                {t.logo_url && <img src={t.logo_url} alt="" width={20} height={20} />}
                <span className="busca-nome">{t.team_nome}</span>
                {t.cidade && <span className="discreto">{t.cidade}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
