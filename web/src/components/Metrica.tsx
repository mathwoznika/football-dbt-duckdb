/**
 * Cartão de métrica: rótulo em cima, número grande embaixo.
 *
 * Estava duplicado em Time.tsx e Jogador.tsx, palavra por palavra. A terceira
 * cópia (Análises) foi o empurrão para extrair — três cópias de um componente
 * de layout divergem na primeira vez que alguém ajusta o espaçamento de uma só.
 *
 * A `nota` existe para desfazer ambiguidade de rótulo, e não para comentar o
 * número: é ela que diz "fase de grupos" embaixo de uma posição na tabela, ou
 * "de 38 jogos" embaixo de uma média com cobertura parcial. Sem esse segundo
 * andar, vários números do projeto seriam lidos como algo que não são.
 */
export default function Metrica({
  rotulo,
  valor,
  nota,
}: {
  rotulo: string;
  valor: string | number;
  nota?: string;
}) {
  return (
    <div className="metrica">
      <div className="rotulo">{rotulo}</div>
      <div className="valor">{valor}</div>
      {nota && (
        <div className="rotulo" style={{ textTransform: "none", letterSpacing: 0 }}>
          {nota}
        </div>
      )}
    </div>
  );
}
