import { Link, Route, Routes } from "react-router-dom";

import Times from "./pages/Times";
import TimePage from "./pages/Time";

/**
 * Layout e rotas do app.
 *
 * O <Routes> escolhe qual componente renderizar conforme a URL. O ":team_id"
 * marca um trecho variavel, exatamente como as chaves nas rotas do FastAPI —
 * e e por isso que o useParams do outro lado consegue le-lo.
 *
 * Tudo isso acontece no navegador, sem ida ao servidor: trocar de tela nao
 * recarrega a pagina.
 */
export default function App() {
  return (
    <>
      <header className="topo">
        <Link to="/">
          <strong>Futebol Brasileiro</strong>
        </Link>{" "}
        <span className="discreto">· Série A, Série B, Copa do Brasil e Paranaense</span>
      </header>

      <main className="conteudo">
        <Routes>
          <Route path="/" element={<Times />} />
          <Route path="/times/:id" element={<TimePage />} />
          <Route path="*" element={<p>Página não encontrada.</p>} />
        </Routes>
      </main>
    </>
  );
}
