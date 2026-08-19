import { ShowcaseLinkExterno, ShowcaseTexto } from "../contexto.jsx";
import { DADOS_EQUIPE_PADRAO, lerDadosWidget, montarWhatsappUrl } from "./widgetData.js";

function iniciais(nome) {
  return String(nome || "Corretor")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");
}

export function TeamWidget({ widget }) {
  const dados = lerDadosWidget(widget.content, DADOS_EQUIPE_PADRAO);
  const pessoas = Array.isArray(dados.pessoas) && dados.pessoas.length ? dados.pessoas : DADOS_EQUIPE_PADRAO.pessoas;

  return (
    <div className="widget-team">
      <div className="widget-team__head">
        <ShowcaseTexto as="h3" campo={`widget|${widget.id}|title`} html={widget.title} />
        <p>{dados.subtitulo || DADOS_EQUIPE_PADRAO.subtitulo}</p>
      </div>
      <div className="widget-team__grid">
        {pessoas.slice(0, 6).map((pessoa, i) => {
          const href = montarWhatsappUrl(
            pessoa.whatsapp ? `https://wa.me/${String(pessoa.whatsapp).replace(/\D/g, "")}` : widget.ctaUrl,
            `Olá, ${pessoa.nome || "tudo bem"}? Vim pela vitrine e gostaria de falar sobre um imóvel.`
          );
          return (
            <article className="widget-team__person" key={`${pessoa.nome}-${i}`}>
              <div className="widget-team__avatar">
                {pessoa.foto ? <img src={pessoa.foto} alt="" /> : <span>{iniciais(pessoa.nome)}</span>}
              </div>
              <div className="widget-team__info">
                <strong>{pessoa.nome || "Corretor"}</strong>
                <span>{pessoa.cargo || "Corretor"}</span>
                {pessoa.creci ? <small>{pessoa.creci}</small> : null}
              </div>
              <ShowcaseLinkExterno href={href} className="widget-team__contact">WhatsApp</ShowcaseLinkExterno>
            </article>
          );
        })}
      </div>
    </div>
  );
}
