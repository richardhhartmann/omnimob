import { mergeBlockWrapperStyle } from "../../utils/showcaseConfig";
import { ShowcaseTexto } from "./contexto.jsx";
import { TEXTO_PADRAO } from "./tema.js";

/* O rodapé.

   As duas versões estavam próximas, mas não iguais: a coluna de contato do
   editor escrevia "Email:" e "WhatsApp:" antes de cada campo, e a pública
   listava os dois como links soltos. Uma linha a mais de texto por campo é meia
   dúzia de pixels de altura — o suficiente para o bloco medido no editor não
   bater com o publicado.

   Ficou a versão pública. Os campos continuam editáveis: no editor eles são o
   mesmo `<a>`, sem destino. */

export function ShowcaseFooter({ tenant, config, blockStyles, whatsappHref }) {
  const cor = blockStyles?.footer?.color;
  const corTexto = cor || "var(--text-muted)";
  const nome = tenant?.name || "";

  return (
    <footer className="showcase-footer" style={mergeBlockWrapperStyle(blockStyles?.footer)}>
      <div className="showcase-footer-grid">
        <div className="footer-col">
          <ShowcaseTexto as="h4" campo="footerTitle" umaLinha html={config.footerTitle} style={{ color: cor || "inherit" }} />
          <ShowcaseTexto
            as="p"
            campo="form|description"
            html={tenant?.description || TEXTO_PADRAO.descricao}
            style={{ color: corTexto }}
          />
        </div>

        <div className="footer-col">
          <h4 style={{ color: cor || "inherit" }}>Imobiliária</h4>
          <p style={{ color: corTexto, margin: "0 0 8px 0" }}>{nome}</p>
          {tenant?.creci ? <p style={{ color: corTexto, margin: "0 0 8px 0" }}>CRECI {tenant.creci}</p> : null}
          {tenant?.cidade ? <p style={{ color: corTexto, margin: "0 0 8px 0" }}>{tenant.cidade}</p> : null}
        </div>

        <div className="footer-col">
          <h4 style={{ color: cor || "inherit" }}>Contato</h4>
          {tenant?.email ? (
            <ShowcaseTexto as="a" campo="form|email" umaLinha html={tenant.email} hrefPublico={`mailto:${tenant.email}`} style={{ color: corTexto }} />
          ) : null}
          {tenant?.whatsapp ? (
            <ShowcaseTexto as="a" campo="form|whatsapp" umaLinha html={tenant.whatsapp} hrefPublico={whatsappHref} alvoExterno style={{ color: corTexto }} />
          ) : null}
        </div>
      </div>

      <div className="footer-bottom" style={{ color: corTexto }}>
        &copy; {new Date().getFullYear()} {nome}. Todos os direitos reservados.
      </div>
    </footer>
  );
}
