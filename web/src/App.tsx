import { NavLink, Route, Routes } from "react-router-dom";

import BuscaClubes from "./components/BuscaClubes";
import Inicio from "./pages/Inicio";
import Jogadores from "./pages/Jogadores";
import Times from "./pages/Times";
import Analises from "./pages/Analises";
import CompeticaoPage from "./pages/Competicao";
import Competicoes from "./pages/Competicoes";
import JogadorPage from "./pages/Jogador";
import JogoPage from "./pages/Jogo";
import TimePage from "./pages/Time";

/**
 * Cabecalho e rotas.
 *
 * O <Routes> escolhe qual componente renderizar conforme a URL. O ":id" marca um
 * trecho variavel, exatamente como as chaves nas rotas do FastAPI — e e por isso
 * que o useParams do outro lado consegue le-lo. Tudo no navegador, sem ida ao
 * servidor: trocar de tela nao recarrega a pagina.
 *
 * O CABECALHO usa <NavLink> e nao <Link> por um motivo so: ele sabe se a rota
 * esta ativa e aplica a classe sozinho. Saber onde se esta e a funcao mais
 * basica de uma navegacao, e antes disso a barra era uma fileira de links
 * separados por ponto, sem nenhuma indicacao.
 *
 * A BUSCA mostra os clubes enquanto se digita — ver BuscaClubes. Clicar num
 * resultado abre o clube direto; Enter leva a listagem filtrada por
 * /times?busca=, que e o caminho de quem quer comparar varios de uma vez.
 */
/**
 * Itens do menu, em ordem.
 *
 * Lista e nao JSX repetido: adicionar uma secao passa a ser uma linha aqui, e o
 * comportamento — estado ativo, espacamento, rolagem quando nao cabe — vem de
 * graca e igual para todos. Quando o app crescer para arbitros, estadios ou
 * comparacoes, e este array que cresce.
 */
const MENU = [
  { para: "/", rotulo: "Início", exato: true },
  { para: "/competicoes", rotulo: "Competições" },
  { para: "/times", rotulo: "Clubes" },
  { para: "/jogadores", rotulo: "Jogadores" },
];

/**
 * Cabecalho em duas faixas.
 *
 * POR QUE DUAS E NAO UMA. Numa faixa so, marca + menu + busca competem pela
 * mesma largura: ou o menu vai para a direita (contraintuitivo — a leitura
 * comeca na esquerda, e o menu e a primeira coisa que se procura), ou a busca
 * encolhe ate nao caber o nome de um clube. Separando, cada um fica onde se
 * espera: identidade e busca em cima, navegacao embaixo, tudo ancorado na
 * esquerda.
 *
 * A faixa do menu rola na horizontal quando nao cabe, entao acrescentar itens
 * nunca quebra o layout nem obriga a inventar um menu sanduiche.
 */
function Cabecalho() {
  return (
    <header className="topo">
      <div className="topo-faixa">
        <NavLink to="/" className="marca">
          <span className="marca-bola" aria-hidden="true" />
          <span>
            Futebol <strong>Brasileiro</strong>
          </span>
        </NavLink>

        <BuscaClubes />
      </div>

      <nav className="menu">
        {MENU.map((item) => (
          <NavLink key={item.para} to={item.para} end={item.exato}>
            {item.rotulo}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

export default function App() {
  return (
    <>
      <Cabecalho />

      <main className="conteudo">
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/times" element={<Times />} />
          <Route path="/jogadores" element={<Jogadores />} />
          <Route path="/competicoes" element={<Competicoes />} />
          <Route path="/competicoes/:leagueId/:season" element={<CompeticaoPage />} />
          <Route path="/times/:id" element={<TimePage />} />
          <Route path="/times/:id/analises" element={<Analises />} />
          <Route path="/jogos/:fixtureId" element={<JogoPage />} />
          <Route path="/jogadores/:playerId" element={<JogadorPage />} />
          <Route path="*" element={<p>Página não encontrada.</p>} />
        </Routes>
      </main>
    </>
  );
}
