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
            </summary>
            <ShowcaseTexto
              as="p"
              campo={`widget|${widget.id}|dados|itens|${i}|resposta`}
              html={item.resposta || "Resposta ainda não preenchida."}
            />
            {ehEditor ? (
              <button
                type="button"
                className="widget-editor-apenas widget-faq__tirar"
                title="Remover esta pergunta"
                /* O × mora dentro do `<summary>`? Não: ali o clique alternaria
                   o `<details>` junto, e a pergunta abriria e fecharia enquanto
                   some. Fica no corpo, e o `stopPropagation` protege do resto. */
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  aoEditar(`widget|${widget.id}|dados|itens`, itens.filter((_, j) => j !== i));
                }}
              >
                × Remover pergunta
              </button>
            ) : null}
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
