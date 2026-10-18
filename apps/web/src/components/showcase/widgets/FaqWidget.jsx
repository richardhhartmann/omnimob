import { ShowcaseTexto, useVitrine } from "../contexto.jsx";
import { conteudoEhJson, DADOS_FAQ_PADRAO, lerDadosWidget, somenteTexto } from "./widgetData.js";
import { TituloDoWidget } from "../TituloDoWidget.jsx";

export function FaqWidget({ widget }) {
  const { modo, aoEditar } = useVitrine();
  const ehEditor = modo === "editor" && Boolean(aoEditar);
  const estruturado = conteudoEhJson(widget.content);
  const dados = lerDadosWidget(widget.content, DADOS_FAQ_PADRAO);
  const itens = estruturado && Array.isArray(dados.itens) && dados.itens.length
    ? dados.itens
    : [{ pergunta: somenteTexto(widget.title) || "Pergunta frequente", resposta: somenteTexto(widget.content) || "Adicione uma resposta no inspetor." }];

  return (
    <div className="widget-faq">
      {estruturado ? <TituloDoWidget widget={widget} /> : null}
      <div className="widget-faq__list">
        {itens.slice(0, 8).map((item, i) => (
          /* A CHAVE É O ÍNDICE, e aqui isso é o certo: com a pergunta na chave,
             cada tecla digitada trocava a identidade do `<details>`, o React o
             remontava e o campo perdia o foco na primeira letra. */
          <details key={i} className="widget-faq__item" open={i === 0}>
            <summary>
              {/* Pergunta e resposta editadas NA PEÇA. Saíram do inspetor, onde
                  eram uma caixa de texto com `::` separando os dois campos —
                  formato que só quem leu a dica entendia. */}
              <ShowcaseTexto
                as="span"
                umaLinha
                campo={`widget|${widget.id}|dados|itens|${i}|pergunta`}
                html={item.pergunta || `Pergunta ${i + 1}`}
              />
              <span className="widget-faq__plus" aria-hidden>+</span>
              {/* No editor, o lugar do "+" é do "×" que REMOVE a pergunta.

                  O "+" da vitrine gira 45° quando a pergunta abre e vira um
                  "×" — e no editor quem o via esperava que ele apagasse algo,
                  enquanto ele só fechava a pergunta. Aqui o × passa a fazer o
                  que parece, e o "+" sai de cena pelo CSS (`:has`). Botão à
                  parte, e não o mesmo `<span>` com outro papel, porque a
                  vitrine publicada precisa sair com o HTML de sempre — e
                  `widget-editor-apenas` é a marca que o teste de paridade
                  descarta. `preventDefault` porque o clique está dentro do
                  `<summary>`, que senão abriria e fecharia a pergunta enquanto
                  ela some. */}
              {ehEditor ? (
                <button
                  type="button"
                  className="widget-editor-apenas widget-faq__remover"
                  title="Remover esta pergunta"
                  aria-label="Remover esta pergunta"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    aoEditar(`widget|${widget.id}|dados|itens`, itens.filter((_, j) => j !== i));
                  }}
                >
                  ×
                </button>
              ) : null}
            </summary>
            <ShowcaseTexto
              as="p"
              campo={`widget|${widget.id}|dados|itens|${i}|resposta`}
              html={item.resposta || "Resposta ainda não preenchida."}
            />
          </details>
        ))}

        {/* Mais uma pergunta entra como MAIS UM item da lista, no fim — a mesma
            gramática do chip de Região e da etapa de "Como funciona": o botão
            ocupa o lugar do item que vai nascer. */}
        {ehEditor && itens.length < 8 ? (
          <button
            type="button"
            className="widget-editor-apenas widget-faq__mais"
            onClick={() => aoEditar(
              `widget|${widget.id}|dados|itens`,
              [...itens, { pergunta: "Nova pergunta", resposta: "Escreva a resposta." }],
            )}
          >
            + Pergunta
          </button>
        ) : null}
      </div>
    </div>
  );
}
