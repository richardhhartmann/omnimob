import { ShowcaseTexto } from "../contexto.jsx";
import { conteudoEhJson, DADOS_FAQ_PADRAO, lerDadosWidget, somenteTexto } from "./widgetData.js";

export function FaqWidget({ widget }) {
  const estruturado = conteudoEhJson(widget.content);
  const dados = lerDadosWidget(widget.content, DADOS_FAQ_PADRAO);
  const itens = estruturado && Array.isArray(dados.itens) && dados.itens.length
    ? dados.itens
    : [{ pergunta: somenteTexto(widget.title) || "Pergunta frequente", resposta: somenteTexto(widget.content) || "Adicione uma resposta no inspetor." }];

  return (
    <div className="widget-faq">
      {estruturado ? <ShowcaseTexto as="h3" campo={`widget|${widget.id}|title`} html={widget.title} /> : null}
      <div className="widget-faq__list">
        {itens.slice(0, 8).map((item, i) => (
          <details key={`${item.pergunta}-${i}`} className="widget-faq__item" open={i === 0}>
            <summary>
              <span>{item.pergunta || `Pergunta ${i + 1}`}</span>
              <span className="widget-faq__plus" aria-hidden>+</span>
            </summary>
            <p>{item.resposta || "Resposta ainda não preenchida."}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
