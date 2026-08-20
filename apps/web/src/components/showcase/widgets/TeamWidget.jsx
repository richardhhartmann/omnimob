import { ShowcaseLinkExterno, ShowcaseTexto, usaFonteReal, useDadosDaVitrine } from "../contexto.jsx";
import { DADOS_EQUIPE_PADRAO, lerDadosWidget, montarWhatsappUrl } from "./widgetData.js";

/* ────────────────────────────────────────────────────────────────────────────
   Equipe — os corretores de verdade.

   Este widget nasceu com "Ana Souza", "João Lima" e "Marina Alves" escritos no
   código, com CRECI inventado. Toda imobiliária que arrastasse a peça publicava
   os mesmos três nomes na própria vitrine, e várias publicaram.

   Agora a fonte é o cadastro de Usuários: quem está ativo E marcou "aparecer na
   vitrine". A marcação é opt-in de propósito — o painel tem gente que não
   atende cliente (financeiro, administrativo, o dono), e ter login não é
   consentimento para aparecer com foto numa página pública.

   O CRECI mostrado é o DA PESSOA, não o da empresa. São documentos diferentes,
   e o cliente que confere antes de assinar procura o do corretor com quem
   falou.
   ──────────────────────────────────────────────────────────────────────────── */

function iniciais(nome) {
  return String(nome || "Corretor")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");
}

export function TeamWidget({ widget }) {
  const dadosReais = useDadosDaVitrine();
  const equipeReal = dadosReais?.equipe || [];
  const real = usaFonteReal(widget, equipeReal);

  const manual = lerDadosWidget(widget.content, DADOS_EQUIPE_PADRAO);
  const pessoas = real
    ? equipeReal
    : (Array.isArray(manual.pessoas) && manual.pessoas.length ? manual.pessoas : DADOS_EQUIPE_PADRAO.pessoas);

  /* O subtítulo continua sendo texto do cliente nos dois casos: ele é a frase
     de apresentação da equipe, não um dado que o banco tenha. */
  const subtitulo = manual.subtitulo || DADOS_EQUIPE_PADRAO.subtitulo;

  return (
    <div className="widget-team">
      <div className="widget-team__head">
        <ShowcaseTexto as="h3" campo={`widget|${widget.id}|title`} html={widget.title} />
        <p>{subtitulo}</p>
      </div>
      <div className="widget-team__grid">
        {pessoas.slice(0, 6).map((pessoa, i) => {
          /* O WhatsApp da PESSOA quando ela tem um; o do widget como rede de
             segurança. Sem o fallback, o corretor sem número cadastrado
             ganharia um botão que não abre nada — pior que mandar para o
             telefone geral da imobiliária, que ao menos atende. */
          const href = montarWhatsappUrl(
            pessoa.whatsapp
              ? `https://wa.me/${String(pessoa.whatsapp).replace(/\D/g, "")}`
              : widget.ctaUrl,
            `Olá, ${pessoa.nome || "tudo bem"}? Vim pelo site e gostaria de falar sobre um imóvel.`,
          );
          return (
            <article className="widget-team__person" key={pessoa.id || `${pessoa.nome}-${i}`}>
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
