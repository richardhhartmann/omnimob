import { ShowcaseLinkExterno, ShowcaseTexto } from "../contexto.jsx";
import { DADOS_REGIOES_PADRAO, lerDadosWidget, montarWhatsappUrl } from "./widgetData.js";

export function RegionsWidget({ widget }) {
  const dados = lerDadosWidget(widget.content, DADOS_REGIOES_PADRAO);
  const regioes = Array.isArray(dados.regioes) && dados.regioes.length ? dados.regioes : DADOS_REGIOES_PADRAO.regioes;

  return (
    <div className="widget-regions">
      <ShowcaseTexto as="h3" campo={`widget|${widget.id}|title`} html={widget.title} />
      <p>{dados.subtitulo || DADOS_REGIOES_PADRAO.subtitulo}</p>
      <div className="widget-regions__list">
        {regioes.slice(0, 16).map((regiao) => (
          <ShowcaseLinkExterno
            key={regiao}
            href={montarWhatsappUrl(widget.ctaUrl, `Olá! Gostaria de conhecer os imóveis disponíveis em ${regiao}.`)}
            className="widget-regions__chip"
          >
            <span>{regiao}</span>
            <span aria-hidden>↗</span>
          </ShowcaseLinkExterno>
        ))}
      </div>
    </div>
  );
}
