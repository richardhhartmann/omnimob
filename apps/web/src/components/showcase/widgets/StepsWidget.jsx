import { ShowcaseTexto, useVitrine } from "../contexto.jsx";
import { DADOS_PASSOS_PADRAO, lerDadosWidget } from "./widgetData.js";
import { TituloDoWidget } from "../TituloDoWidget.jsx";

export function StepsWidget({ widget }) {
  const { modo, aoEditar } = useVitrine();
  const ehEditor = modo === "editor" && Boolean(aoEditar);
  const dados = lerDadosWidget(widget.content, DADOS_PASSOS_PADRAO);
  const itens = Array.isArray(dados.itens) && dados.itens.length ? dados.itens : DADOS_PASSOS_PADRAO.itens;

  return (
    <div className="widget-steps">
      <div className="widget-steps__head">
        <TituloDoWidget widget={widget} />
        {/* Editado NA PEÇA, não no inspetor: é conteúdo, e conteúdo se
            escreve onde ele aparece. Ver o roteador `widget|<id>|dados|…`. */}
        <ShowcaseTexto
          as="p"
          campo={`widget|${widget.id}|dados|subtitulo`}
          html={dados.subtitulo || DADOS_PASSOS_PADRAO.subtitulo}
        />
      </div>
      <div className="widget-steps__grid">
        {itens.slice(0, 6).map((item, i) => (
          // Índice na chave pelo mesmo motivo do FAQ: com o título na chave, o
          // item remonta a cada tecla e o cursor salta para fora.
          <div className="widget-steps__item" key={i}>
            <span className="widget-steps__number">{String(i + 1).padStart(2, "0")}</span>
            <ShowcaseTexto
              as="strong"
              umaLinha
              campo={`widget|${widget.id}|dados|itens|${i}|titulo`}
              html={item.titulo || `Etapa ${i + 1}`}
            />
            <ShowcaseTexto
              as="p"
              campo={`widget|${widget.id}|dados|itens|${i}|descricao`}
              html={item.descricao || "Descreva esta etapa."}
            />
            {ehEditor ? (
              <button
                type="button"
                className="widget-editor-apenas widget-steps__tirar"
                title="Remover esta etapa"
                onClick={() => aoEditar(`widget|${widget.id}|dados|itens`, itens.filter((_, j) => j !== i))}
              >
                ×
              </button>
            ) : null}
          </div>
        ))}
        {/* Acrescentar entra como MAIS UM item da grade, e não como um botão
            solto embaixo: assim ele ocupa o lugar da etapa que vai nascer, e a
            grade não muda de forma quando ela nasce. */}
        {ehEditor && itens.length < 6 ? (
          <button
            type="button"
            className="widget-editor-apenas widget-steps__mais"
            onClick={() => aoEditar(`widget|${widget.id}|dados|itens`, [...itens, { titulo: "Nova etapa", descricao: "Descreva esta etapa." }])}
          >
            + Etapa
          </button>
        ) : null}
      </div>
    </div>
  );
}
