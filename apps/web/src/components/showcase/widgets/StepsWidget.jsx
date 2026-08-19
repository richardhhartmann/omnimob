import { ShowcaseTexto } from "../contexto.jsx";
import { DADOS_PASSOS_PADRAO, lerDadosWidget } from "./widgetData.js";

export function StepsWidget({ widget }) {
  const dados = lerDadosWidget(widget.content, DADOS_PASSOS_PADRAO);
  const itens = Array.isArray(dados.itens) && dados.itens.length ? dados.itens : DADOS_PASSOS_PADRAO.itens;

  return (
    <div className="widget-steps">
      <div className="widget-steps__head">
        <ShowcaseTexto as="h3" campo={`widget|${widget.id}|title`} html={widget.title} />
        <p>{dados.subtitulo || DADOS_PASSOS_PADRAO.subtitulo}</p>
      </div>
      <div className="widget-steps__grid">
        {itens.slice(0, 6).map((item, i) => (
          <div className="widget-steps__item" key={`${item.titulo}-${i}`}>
            <span className="widget-steps__number">{String(i + 1).padStart(2, "0")}</span>
            <strong>{item.titulo || `Etapa ${i + 1}`}</strong>
            <p>{item.descricao || "Descreva esta etapa."}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
