import { verbete, type ChaveGlossario } from "../glossario";

/**
 * Cabeçalho de coluna que se explica.
 *
 * Renderiza o rótulo do glossário com um sublinhado pontilhado e a definição no
 * `title`, que o navegador mostra ao passar o mouse. O tooltip nativo é
 * limitado — não abre no toque, por exemplo —, e é por isso que ele NÃO é a
 * única forma de explicação: toda tabela que usa <Termo> também traz o
 * <Glossario> embaixo, que funciona em qualquer dispositivo e pode ser lido de
 * uma vez. O tooltip é o atalho, a legenda é a garantia.
 */
export function Termo({ k }: { k: ChaveGlossario }) {
  const v = verbete(k);
  const dica = [v.definicao, v.formula && `(${v.formula})`, v.cuidado]
    .filter(Boolean)
    .join(" ");

  return (
    <span className="termo" title={dica}>
      {v.rotulo}
    </span>
  );
}

/**
 * Legenda das métricas usadas numa tabela.
 *
 * Recebe as mesmas chaves que os cabeçalhos e monta as definições a partir da
 * fonte única. Assim não existe o caso clássico de a nota de rodapé continuar
 * descrevendo a versão antiga do cálculo.
 *
 * O `cuidado` aparece destacado porque é a parte que costumava sumir: é ele que
 * diz que a amostra é pequena ou que a cobertura é parcial.
 */
export function Glossario({ termos }: { termos: ChaveGlossario[] }) {
  return (
    <details className="glossario">
      <summary>O que significa cada coluna</summary>
      <dl>
        {termos.map((k) => {
          const v = verbete(k);
          return (
            <div key={k}>
              <dt>{v.rotulo}</dt>
              <dd>
                {v.definicao}
                {v.formula && <code className="glossario-formula">{v.formula}</code>}
                {v.cuidado && <span className="glossario-cuidado">{v.cuidado}</span>}
              </dd>
            </div>
          );
        })}
      </dl>
    </details>
  );
}
