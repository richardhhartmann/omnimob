import { ShowcaseTexto, usaFonteReal, useDadosDaVitrine } from "../contexto.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   Bloco de números.

   Era a pior divergência da vitrine inteira. O conteúdo é gravado como uma
   string com barras — `"200+|Imóveis vendidos|15 anos|De experiência"` — e a
   página pública quebrava isso numa grade de cartões. O editor, não: ele
   mostrava a string crua num campo editável. A pessoa via uma linha de texto
   com barras no construtor e uma grade de três cartões na página publicada.

   Aqui a grade é a mesma nos dois, e no editor cada célula é editável no lugar.
   Editar o número onde o número aparece é, além de fiel, muito melhor do que
   contar barras numa linha de texto.
   ──────────────────────────────────────────────────────────────────────────── */

/** `"200+|Vendidos|15 anos|Experiência"` → `[["200+","Vendidos"],["15 anos","Experiência"]]` */
export function paresDeEstatistica(conteudo) {
  const partes = String(conteudo || "").split("|");
  const pares = [];
  for (let i = 0; i < partes.length; i += 2) {
    pares.push([partes[i] ?? "", partes[i + 1] ?? ""]);
  }
  return pares.slice(0, 4);
}

/** Caminho de volta: troca uma célula e devolve a string inteira. */
export function comCelulaTrocada(conteudo, indicePar, indiceCelula, valor) {
  const partes = String(conteudo || "").split("|");
  partes[indicePar * 2 + indiceCelula] = valor;
  return partes.join("|");
}

/* ── Os números de verdade ───────────────────────────────────────────────────
   O padrão do widget era `200+ | Imóveis vendidos | 15 anos | De experiência` —
   a mesma frase para toda imobiliária que arrastasse a peça, inclusive a que
   abriu ontem com quatro imóveis. Número redondo e inventado numa página que
   existe para gerar confiança é o pior lugar possível para um dado falso.

   Cada cartão só entra se o número EXISTIR. O servidor manda `null` no lugar de
   zero justamente para isto (ver `dadosDaVitrine.js`): imobiliária sem venda
   registrada não anuncia "0 negócios fechados" — ela mostra três cartões em vez
   de quatro, e ninguém percebe que faltou um.

   Os rótulos são fixos aqui, e não editáveis: eles descrevem o que a consulta
   contou. "Imóveis disponíveis" é o número de imóveis ACTIVE; deixar a pessoa
   trocar para "Imóveis vendidos" daria um rótulo mentindo sobre o número ao
   lado. Quem quiser escrever os próprios números desliga a fonte real no
   inspetor e recupera as quatro células editáveis. */
function paresReais(numeros) {
  if (!numeros) return [];
  const cartoes = [
    [numeros.imoveisAtivos, "Imóveis disponíveis"],
    [numeros.vendas, "Negócios fechados"],
    [numeros.anosDeMercado, numeros.anosDeMercado === 1 ? "Ano de mercado" : "Anos de mercado"],
    [numeros.cidadesAtendidas, numeros.cidadesAtendidas === 1 ? "Cidade atendida" : "Cidades atendidas"],
  ];
  return cartoes
    .filter(([valor]) => Number.isFinite(valor) && valor > 0)
    .slice(0, 4)
    .map(([valor, rotulo]) => [String(valor), rotulo]);
}

export function StatsWidget({ widget }) {
  const cor = widget.color ? { color: widget.color } : undefined;
  const dados = useDadosDaVitrine();
  const reais = paresReais(dados?.numeros);
  const real = usaFonteReal(widget, reais);
  const pares = real ? reais : paresDeEstatistica(widget.content);

  return (
    <div style={{ padding: "8px" }}>
      <ShowcaseTexto
        as="h3"
        campo={`widget|${widget.id}|title`}
        umaLinha
        html={widget.title}
        style={{ textAlign: "center", marginBottom: "24px", ...cor }}
      />
      <div className="widget-stats-grid">
        {pares.map(([numero, rotulo], i) => (
          <div key={i} className="widget-stat-box">
            {/* Com a fonte real ligada as células saem como texto simples, e
                não editáveis: elas não vêm do `content`, e um `contentEditable`
                ali deixaria a pessoa digitar por cima de um valor que a próxima
                leitura do servidor reescreve — trabalho perdido em silêncio. */}
            {real ? (
              <>
                <div className="widget-stat-number">{numero}</div>
                <div className="widget-stat-label">{rotulo}</div>
              </>
            ) : (
              <>
                <ShowcaseTexto
                  as="div"
                  className="widget-stat-number"
                  campo={`widget|${widget.id}|stat|${i}|0`}
                  umaLinha
                  html={numero}
                />
                <ShowcaseTexto
                  as="div"
                  className="widget-stat-label"
                  campo={`widget|${widget.id}|stat|${i}|1`}
                  umaLinha
                  html={rotulo}
                />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
