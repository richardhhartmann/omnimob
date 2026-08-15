import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { normalizeShowcaseConfig } from "../utils/showcaseConfig";
import { ShowcaseHeader } from "../components/showcase/ShowcaseHeader.jsx";
import { ShowcaseFooter } from "../components/showcase/ShowcaseFooter.jsx";
import { classeDeAparencia, estiloDoTema, linkWhatsApp } from "../components/showcase/tema.js";
import { Panorama360 } from "../components/Panorama360";
import { comodidadesAtivas } from "../utils/comodidades";
import { tipoContratoInfo } from "../utils/tiposContrato";
import { loadShowcaseFonts, getCachedTenant, setCachedTenant } from "../utils/showcaseFonts";
import { IconeFaisca } from "../components/Icones.jsx";
import { IconeCheck } from "../components/Icones.jsx";
import { useSeo } from "../utils/seo";

const IcPin  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const IcArea = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9V3h6"/><path d="M3 3l6 6"/><path d="M21 15v6h-6"/><path d="M21 21l-6-6"/></svg>;
const IcBed  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4v16"/><path d="M22 8v12"/><path d="M2 8h20"/><rect x="6" y="4" width="12" height="4" rx="1"/></svg>;
const IcCar  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="10" width="20" height="10" rx="2"/><path d="m6 10 3-6h6l3 6"/><circle cx="7" cy="17" r="1" fill="currentColor"/><circle cx="17" cy="17" r="1" fill="currentColor"/></svg>;
const IcSuite = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 22V8l9-6 9 6v14"/><path d="M9 22V12h6v10"/></svg>;
const IcHome = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5 12 3l9 6.5V21H3V9.5z"/><path d="M9 21v-6h6v6"/></svg>;
const IcCheck = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;

function isLancamento(createdAt) {
  if (!createdAt) return false;
  return (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24) <= 30;
}

export function ShowcasePropertyPage({ slugFixo }) {
  /* Mesma história do ShowcasePage: em domínio próprio o slug vem do host. */
  const { tenantSlug: slugDaRota, propertyId } = useParams();
  const tenantSlug = slugFixo || slugDaRota;
  const [property, setProperty] = useState(null);
  const [tenant, setTenant] = useState(() => getCachedTenant(tenantSlug));
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sendingInterest, setSendingInterest] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [interestForm, setInterestForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [isMobileViewport, setIsMobileViewport] = useState(() => window.innerWidth < 768);
  const thumbsRef = useRef(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  // Ponteiro sobre a galeria segura o auto-avanço (ver o efeito mais abaixo).
  const [pausado, setPausado] = useState(false);
  const [lightboxClosing, setLightboxClosing] = useState(false);

  useEffect(() => {
    const handler = () => setIsMobileViewport(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => { loadShowcaseFonts(); }, []);

  useEffect(() => {
    if (!tenantSlug || !propertyId) return;
    setLoading(true);
    setError("");
    api.getPublicPropertyById(tenantSlug, propertyId)
      .then((data) => {
        setProperty(data.property);
        setTenant(data.tenant);
        setCachedTenant(tenantSlug, data.tenant);
        setCarouselIndex(0);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [tenantSlug, propertyId]);

  useEffect(() => {
    if (!tenantSlug) return;
    api.getPublicShowcase(tenantSlug)
      .then((data) => {
        setSuggestions((data.properties || []).filter((p) => p.id !== propertyId).slice(0, 4));
      })
      .catch(() => {});
  }, [tenantSlug, propertyId]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [propertyId]);

  async function handleInterest() {
    if (!tenantSlug || !propertyId) return;
    setSendingInterest(true);
    setSuccessMessage("");
    setError("");
    try {
      const response = await api.registerPublicInterest(tenantSlug, propertyId, interestForm);
      setProperty((prev) => prev ? { ...prev, leadCount: response.property.leadCount } : prev);
      setSuccessMessage("Interesse enviado! A imobiliária entrará em contato em breve.");
      setInterestForm({ name: "", email: "", phone: "", message: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingInterest(false);
    }
  }

  const images = property?.images?.length ? property.images : [{ url: "/property-placeholder.svg" }];
  const current360 = Boolean(images[carouselIndex]?.is360); // foto atual é panorâmica 360°?

  function goTo(i) {
    setCarouselIndex((i + images.length) % images.length);
  }

  /* A faixa de miniaturas acompanha a foto — rolando SÓ ELA, no eixo X.

     Antes isto era `thumb.scrollIntoView({ block: "nearest" })` dentro do
     `goTo`, e `scrollIntoView` não escolhe o contêiner: ele rola todos os
     ancestrais roláveis, a janela inclusive. Com o auto-avanço ligado, quem
     estivesse lendo a descrição era puxado de volta para a galeria a cada cinco
     segundos. `scrollTo` no próprio elemento da faixa mexe só na faixa. */
  useEffect(() => {
    const faixa = thumbsRef.current;
    const alvo = faixa?.children[carouselIndex];
    if (!faixa || !alvo) return;
    faixa.scrollTo({
      left: alvo.offsetLeft - (faixa.clientWidth - alvo.clientWidth) / 2,
      behavior: "smooth",
    });
  }, [carouselIndex]);

  function openLightbox() { setLightboxClosing(false); setLightboxOpen(true); }
  function closeLightbox() {
    setLightboxClosing(true);
    setTimeout(() => { setLightboxOpen(false); setLightboxClosing(false); }, 280);
  }

  // Lightbox: trava o scroll do body enquanto aberto.
  useEffect(() => {
    if (!lightboxOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [lightboxOpen]);

  // Lightbox: teclado — Esc fecha, setas navegam.
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowRight") goTo(carouselIndex + 1);
      else if (e.key === "ArrowLeft") goTo(carouselIndex - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, carouselIndex]);

  /* ── Auto-avanço do carrossel ──────────────────────────────────────────────
     Intervalo, e não um `setTimeout` reagendado a cada índice.

     A versão anterior tinha `carouselIndex` nas dependências: qualquer coisa
     que mudasse o índice — ou qualquer re-render que passasse por ali — limpava
     o relógio e começava a contagem do zero. Bastava uma atualização de estado
     a cada menos de cinco segundos para o cronômetro nunca chegar ao fim, e a
     foto ficava parada sem erro nenhum aparecer.

     Com intervalo e atualização funcional (`(i) => i + 1`), o relógio não
     depende do índice atual: ele só é recriado quando algo que realmente
     interessa muda — pausa, quantidade de fotos ou modo 360.

     Pausa em três situações: lightbox aberto (lá a navegação é manual), foto
     panorâmica (a pessoa está explorando aquela) e ponteiro sobre a galeria —
     ninguém quer que a foto troque no instante em que foi olhar um detalhe. */
  useEffect(() => {
    if (lightboxOpen || pausado || images.length <= 1 || current360) return undefined;
    const id = setInterval(() => {
      setCarouselIndex((i) => (i + 1) % images.length);
    }, 5000);
    return () => clearInterval(id);
  }, [lightboxOpen, pausado, images.length, current360]);

  /* Esta página NÃO usa o layout do construtor — ela tem estrutura própria
     (galeria, ficha, formulário de contato, sugestões) e continua assim. O que
     ela compartilha são os elementos globais: o tema da imobiliária, o
     cabeçalho e o endereço de WhatsApp — as três coisas que apareciam
     recalculadas aqui, em `ShowcasePage` e no editor. */
  const showcaseConfig = normalizeShowcaseConfig(tenant?.showcaseConfig);
  const isLightMode = showcaseConfig.appearanceMode === "light";
  const primaryColor = tenant?.primaryColor || "#6366f1";
  const themeStyle = estiloDoTema(tenant, showcaseConfig);

  const headerWhatsappHref = linkWhatsApp({ ...tenant, name: tenant?.name || tenantSlug });
  const whatsappHref = tenant?.whatsapp && property
    ? `https://wa.me/${String(tenant.whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(`Olá, tenho interesse no imóvel "${property?.title}" (${property?.city}/${property?.state}).`)}`
    : null;

  const andamentoLabel = { PRONTO_PARA_MORAR: "Pronto para morar", EM_CONSTRUCAO: "Em construção" }[property?.andamento];
  const contratoInfo = tipoContratoInfo(property?.tipoContrato);
  const lancamento = isLancamento(property?.createdAt);

  /* SEO do imóvel. É a página com maior chance de trazer visita de busca — quem
     procura "apartamento 2 quartos em <bairro>" cai aqui, não na home da
     vitrine. Por isso o título carrega cidade/estado e a descrição usa o texto
     do próprio anúncio, cortado no limite que o Google costuma exibir. */
  const local = [property?.city, property?.state].filter(Boolean).join("/");
  useSeo({
    titulo: property?.title
      ? [property.title, local && `em ${local}`, tenant?.name && `— ${tenant.name}`].filter(Boolean).join(" ")
      : "",
    descricao:
      property?.description?.trim()
        ? `${property.description.trim().slice(0, 155).replace(/\s+\S*$/, "")}…`
        : property?.title
          ? `${property.title}${local ? ` em ${local}` : ""}. Fotos, detalhes e contato direto com a imobiliária.`
          : "",
    caminho: slugFixo ? `/imovel/${propertyId}` : `/vitrine/${tenantSlug}/imovel/${propertyId}`,
    imagem: property?.images?.[0]?.url,
    tipo: "article",
  });

  const stat = (icon, label, value) => value ? (
    <div className="prop-stat">
      <div className="prop-stat__rotulo">{icon} {label}</div>
      <div className="prop-stat__valor">{value}</div>
    </div>
  ) : null;

  /* Classe, e não objeto inline: os campos usavam fundo branco a 5% cravado no
     JSX, o que no modo CLARO vira branco sobre branco — e estilo inline não tem
     como ser corrigido por folha de estilo. */

  return (
    <div className={`showcase-body ${classeDeAparencia(showcaseConfig)}`} style={themeStyle}>
      <style>{`
        .showcase-body span[style*="color"], .showcase-body font[color] { -webkit-text-fill-color: currentcolor !important; -webkit-background-clip: initial !important; background: none !important; }
        .prop-thumb { transition: opacity 0.2s, border-color 0.2s; }
        .prop-thumb:hover { opacity: 1 !important; }
        .sug-card { transition: transform 0.2s, box-shadow 0.2s; }
        .sug-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.3) !important; }

        @keyframes propLbFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes propLbZoom { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        @keyframes propLbProgress { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        .prop-lightbox { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 6vh 5vw; background: rgba(3,6,16,0.85); -webkit-backdrop-filter: blur(18px) brightness(0.6); backdrop-filter: blur(18px) brightness(0.6); animation: propLbFade 0.3s ease both; cursor: zoom-out; }
        .prop-lightbox.is-closing { animation: propLbFade 0.26s ease reverse both; }
        .prop-lightbox-stage { position: relative; max-width: 100%; max-height: 100%; display: flex; animation: propLbZoom 0.42s cubic-bezier(0.22,1,0.36,1) both; }
        .prop-lightbox.is-closing .prop-lightbox-stage { animation: propLbZoom 0.24s ease reverse both; }
        .prop-lightbox-img { max-width: 100%; max-height: 88vh; object-fit: contain; border-radius: 14px; box-shadow: 0 40px 90px rgba(0,0,0,0.65); cursor: default; animation: fadeIn 0.3s ease; }
        .prop-lightbox-close { position: absolute; top: 20px; right: 24px; width: 44px; height: 44px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.1); color: #fff; font-size: 17px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s, transform 0.3s; z-index: 3; }
        .prop-lightbox-close:hover { background: rgba(255,255,255,0.22); transform: rotate(90deg); }
        .prop-lightbox-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 52px; height: 52px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.1); color: #fff; font-size: 26px; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s, transform 0.2s; z-index: 3; }
        .prop-lightbox-nav:hover { background: rgba(255,255,255,0.22); transform: translateY(-50%) scale(1.08); }
        .prop-lightbox-nav.prev { left: 22px; } .prop-lightbox-nav.next { right: 22px; }
        .prop-lightbox-counter { position: absolute; bottom: 22px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.45); color: #fff; font-size: 13px; font-weight: 600; padding: 5px 14px; border-radius: 999px; z-index: 3; }
        .prop-carousel-progress { position: absolute; top: 0; left: 0; right: 0; height: 3px; background: rgba(255,255,255,0.22); z-index: 4; }
        .prop-carousel-progress-fill { height: 100%; background: var(--accent, #818cf8); transform-origin: left; animation: propLbProgress 5s linear; }
        @media (prefers-reduced-motion: reduce) { .prop-lightbox, .prop-lightbox-stage, .prop-lightbox-img { animation: none; } }

        /* ── Palco da foto ── */
        .prop-palco { position: relative; width: 100%; height: 520px; border-radius: 20px; overflow: hidden; background: rgba(0,0,0,0.3); }
        @media (max-width: 640px) { .prop-palco { height: 320px; border-radius: 16px; } }

        /* ── Grade de conteúdo ──
           A coluna do formulário tinha largura fixa (1fr 380px) sem nenhum
           ponto de quebra: num tablet de 768px sobravam ~300px para a ficha do
           imóvel, com o título de 32px quebrando em cinco linhas. Abaixo de
           1020px as duas viram uma coluna só e o cartão perde a fixação — um
           elemento sticky numa coluna única é só um bloco que fica para trás. */
        .prop-grid { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 40px; align-items: start; }
        @media (max-width: 1020px) {
          .prop-grid { grid-template-columns: minmax(0, 1fr); gap: 28px; }
          .prop-aside { position: static; }
        }

        /* ── Cartão do formulário ──
           Duas camadas de luz em vez de uma cor chapada: um degradê vertical
           quase imperceptível e um fio claro na borda de cima (o inset). É o que
           dá volume de vidro sem recorrer a sombra pesada. */
        .prop-aside {
          position: sticky; top: 88px;
          display: flex; flex-direction: column; gap: 14px;
          padding: 26px; border-radius: 22px;
          background: linear-gradient(180deg, rgba(255,255,255,0.065), rgba(255,255,255,0.02));
          border: 1px solid rgba(255,255,255,0.09);
          box-shadow: 0 28px 60px -34px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.08);
          -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px);
        }
        .prop-aside__preco {
          display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px;
          padding-bottom: 16px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .prop-aside__preco-rotulo {
          width: 100%;
          font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--text-muted);
        }
        .prop-aside__preco-valor { font-size: 27px; font-weight: 800; letter-spacing: -0.8px; color: var(--accent); }
        .prop-aside__contrato { margin-left: auto; font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
        .prop-aside__titulo { font-size: 16px; font-weight: 700; margin: 0 0 4px; }
        .prop-aside__sub { font-size: 13px; color: var(--text-muted); margin: 0; }
        .prop-aside__prova { font-size: 11px; color: var(--text-muted); text-align: center; margin: 0; }

        .prop-campo {
          width: 100%; padding: 11px 14px; box-sizing: border-box;
          border-radius: 10px; border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05); color: inherit;
          font-family: inherit; font-size: 13px; outline: none;
          transition: border-color 0.18s ease, background 0.18s ease;
        }
        .prop-campo::placeholder { color: var(--text-muted); opacity: 0.75; }
        .prop-campo:focus { border-color: var(--accent); background: rgba(255,255,255,0.08); }
        .prop-campo--area { resize: vertical; min-height: 80px; }

        /* ── Blocos da ficha ── */
        .prop-stat, .prop-bloco, .prop-comodidade {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px;
          transition: border-color 0.2s ease, background 0.2s ease;
        }
        .prop-stat { display: flex; flex-direction: column; gap: 6px; padding: 16px; }
        .prop-stat:hover, .prop-comodidade:hover { border-color: rgba(255,255,255,0.15); background: rgba(255,255,255,0.06); }
        .prop-stat__rotulo {
          display: flex; align-items: center; gap: 6px;
          font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
          color: var(--text-muted);
        }
        .prop-stat__valor { font-size: 20px; font-weight: 800; letter-spacing: -0.4px; line-height: 1; }
        .prop-bloco { padding: 20px; }
        .prop-comodidade { display: flex; align-items: center; gap: 12px; padding: 14px 16px; }

        /* ── Sugestões: todos os cartões da mesma altura ──
           grid-auto-rows: 1fr iguala as FAIXAS; o resto da corrente precisa
           esticar junto, senão o cartão continua do tamanho do próprio texto
           dentro de uma faixa alta. Daí o height 100% no link e no artigo, e o
           corpo em coluna com o preço empurrado para a base. */
        .sug-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(260px, 100%), 1fr)); grid-auto-rows: 1fr; gap: 20px; }
        /* color: inherit e nao a cor de link. O titulo tinha cor explicita no
           JSX; ao virar classe sem cor, ele passou a herdar do proprio <a> e
           saia em indigo sobre o cartao. */
        .sug-link { display: block; height: 100%; text-decoration: none; color: inherit; }
        .sug-card {
          display: flex; flex-direction: column; height: 100%;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px; overflow: hidden;
        }
        .sug-card.is-lancamento { border: 1.5px solid #f59e0b; box-shadow: 0 0 18px rgba(245,158,11,0.2); }
        .sug-card__foto { height: 170px; flex-shrink: 0; overflow: hidden; }
        .sug-card__foto img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease; }
        .sug-card:hover .sug-card__foto img { transform: scale(1.05); }
        .sug-card__corpo { display: flex; flex-direction: column; flex: 1; padding: 16px; }
        .sug-card__titulo {
          color: var(--text-main);
          font-size: 14px; font-weight: 700; margin: 4px 0 6px;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .sug-card__local { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-muted); margin: 0 0 8px; }
        .sug-card__fichas { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
        .sug-card__fichas span { font-size: 11px; color: var(--text-muted); background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 5px; }
        .sug-card__preco { margin: auto 0 0; font-size: 18px; font-weight: 800; letter-spacing: -0.5px; }

        /* ── Modo claro ──
           Os fundos acima são branco translúcido: sobre o claro eles somem. O
           mesmo valia para os campos do formulário, que eram branco a 5% cravado
           no JSX — invisíveis contra o cartão claro, e sem conserto possível por
           folha de estilo enquanto fossem inline. */
        .showcase-theme-light .prop-aside {
          background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.76));
          border-color: rgba(15,23,42,0.09);
          box-shadow: 0 22px 50px -30px rgba(15,23,42,0.35), inset 0 1px 0 rgba(255,255,255,0.9);
        }
        .showcase-theme-light .prop-aside__preco { border-bottom-color: rgba(15,23,42,0.09); }
        .showcase-theme-light .prop-campo { background: rgba(15,23,42,0.04); border-color: rgba(15,23,42,0.12); }
        .showcase-theme-light .prop-campo:focus { background: rgba(15,23,42,0.06); }
        .showcase-theme-light .prop-stat,
        .showcase-theme-light .prop-bloco,
        .showcase-theme-light .prop-comodidade,
        .showcase-theme-light .sug-card { background: rgba(15,23,42,0.035); border-color: rgba(15,23,42,0.08); }
        .showcase-theme-light .prop-stat:hover,
        .showcase-theme-light .prop-comodidade:hover { background: rgba(15,23,42,0.055); border-color: rgba(15,23,42,0.16); }
        .showcase-theme-light .sug-card__fichas span { background: rgba(15,23,42,0.05); }

      `}</style>

      {/* ── Header ── */}
      <div className="showcase-detail-header" style={{ position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(20px)" }}>
        <ShowcaseHeader
          tenant={tenant}
          tenantSlug={tenantSlug}
          blockStyles={showcaseConfig.blockStyles}
          isMobileViewport={isMobileViewport}
          whatsappHref={headerWhatsappHref}
          isLightMode={isLightMode}
        />
      </div>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px 80px" }}>
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
          <Link to={`/vitrine/${tenantSlug}`} style={{ display: "flex", alignItems: "center", gap: "5px", textDecoration: "none", fontSize: "13px", fontWeight: "600", color: "var(--text-muted)", opacity: 0.8 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Voltar
          </Link>
          {property ? (
            <>
              <span style={{ color: "var(--text-muted)", opacity: 0.35, fontSize: "13px" }}>›</span>
              <span style={{ fontSize: "13px", color: "var(--text-muted)", opacity: 0.65, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "400px" }}>{property.title}</span>
            </>
          ) : null}
        </div>

        {error ? <div className="error" style={{ marginBottom: "24px" }}>{error}</div> : null}
        {successMessage ? <div className="success-banner" style={{ marginBottom: "24px" }}>{successMessage}</div> : null}
        {loading ? <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "80px 0" }}>Carregando detalhes...</p> : null}

        {!loading && property ? (
          <>
            {/* ── CAROUSEL ── */}
            <div style={{ marginBottom: "32px" }}>
              {/* Main image */}
              <div
                className="prop-palco"
                onPointerEnter={() => setPausado(true)}
                onPointerLeave={() => setPausado(false)}
              >
                {current360 ? (
                  <Panorama360 key={`pano-${carouselIndex}`} src={images[carouselIndex]?.url} height={520} />
                ) : (
                  <img
                    key={carouselIndex}
                    src={images[carouselIndex]?.url}
                    alt={`${property.title} — foto ${carouselIndex + 1}`}
                    onClick={openLightbox}
                    style={{ width: "100%", height: "100%", objectFit: "cover", animation: "fadeIn 0.3s ease", cursor: "zoom-in" }}
                  />
                )}
                {/* Timer de auto-avanço (barra de progresso) — some no modo 360 */}
                {images.length > 1 && !lightboxOpen && !current360 && !pausado && (
                  <div className="prop-carousel-progress"><div key={carouselIndex} className="prop-carousel-progress-fill" /></div>
                )}
                {/* Gradient overlay bottom */}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 45%)", pointerEvents: "none" }} />

                {/* Badges */}
                <div style={{ position: "absolute", top: "16px", left: "16px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {contratoInfo && <span title={contratoInfo.descricao} style={{ fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.06em", color: "#fff", background: contratoInfo.cor, padding: "4px 12px", borderRadius: "999px", boxShadow: `0 2px 10px ${contratoInfo.cor}80` }}>{contratoInfo.label}</span>}
                  {lancamento && <span style={{ fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.06em", color: "#fff", background: "linear-gradient(135deg,#f59e0b,#ef4444)", padding: "4px 12px", borderRadius: "999px", boxShadow: "0 2px 10px rgba(245,158,11,0.5)", display: "inline-flex", alignItems: "center", gap: "5px" }}><IconeFaisca size={10} />Lançamento</span>}
                  {andamentoLabel && <span style={{ fontSize: "11px", fontWeight: "700", color: "#fff", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", padding: "4px 12px", borderRadius: "999px" }}>{andamentoLabel}</span>}
                  {property.aceitaPermuta && <span style={{ fontSize: "11px", fontWeight: "700", color: "#fff", background: "rgba(99,102,241,0.85)", backdropFilter: "blur(6px)", padding: "4px 12px", borderRadius: "999px", display: "inline-flex", alignItems: "center", gap: "5px" }}><IconeCheck size={11} />Aceita permuta</span>}
                </div>

                {/* Counter */}
                {images.length > 1 && (
                  <span style={{ position: "absolute", top: "16px", right: "16px", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", color: "#fff", fontSize: "12px", fontWeight: "600", padding: "4px 12px", borderRadius: "999px" }}>{carouselIndex + 1} / {images.length}</span>
                )}

                {/* Navigation arrows */}
                {images.length > 1 && (
                  <>
                    <button type="button" onClick={() => goTo(carouselIndex - 1)} style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", width: "44px", height: "44px", borderRadius: "50%", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: "22px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, transition: "background 0.2s" }}>‹</button>
                    <button type="button" onClick={() => goTo(carouselIndex + 1)} style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", width: "44px", height: "44px", borderRadius: "50%", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: "22px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, transition: "background 0.2s" }}>›</button>
                  </>
                )}

                {/* Dot indicators */}
                {images.length > 1 && images.length <= 12 && (
                  <div style={{ position: "absolute", bottom: "16px", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "6px" }}>
                    {images.map((_, i) => (
                      <button key={i} type="button" onClick={() => goTo(i)} style={{ width: i === carouselIndex ? "20px" : "6px", height: "6px", borderRadius: "3px", background: i === carouselIndex ? "#fff" : "rgba(255,255,255,0.45)", border: "none", cursor: "pointer", padding: 0, transition: "all 0.3s" }} />
                    ))}
                  </div>
                )}
              </div>

              {/* Thumbnail strip */}
              {images.length > 1 && (
                <div ref={thumbsRef} style={{ display: "flex", gap: "8px", overflowX: "auto", padding: "12px 0", scrollbarWidth: "none" }}>
                  {images.map((img, i) => (
                    <button key={i} type="button" className="prop-thumb" onClick={() => goTo(i)} style={{ position: "relative", flexShrink: 0, width: "88px", height: "64px", borderRadius: "10px", overflow: "hidden", border: `2px solid ${i === carouselIndex ? primaryColor : "transparent"}`, padding: 0, cursor: "pointer", opacity: i === carouselIndex ? 1 : 0.55 }}>
                      <img src={img.url} alt={`Foto ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      {img.is360 && (
                        <span style={{ position: "absolute", bottom: "4px", right: "4px", fontSize: "8px", fontWeight: 800, letterSpacing: "0.03em", color: "#fff", background: "rgba(99,102,241,0.95)", padding: "1px 5px", borderRadius: "999px", boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }}>360°</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── CONTENT GRID ── */}
            <div className="prop-grid">
              {/* Left: property info */}
              <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
                {/* Title + price */}
                <div>
                  {property.propertyType && (
                    <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", color: primaryColor, marginBottom: "8px", display: "block" }}>
                      <IcHome style={{ display: "inline" }} /> {property.propertyType}
                    </span>
                  )}
                  <h1 style={{ fontSize: "32px", fontWeight: "800", letterSpacing: "-0.5px", margin: "0 0 12px", color: isLightMode ? "#0f172a" : "#fff", lineHeight: 1.2 }}>
                    {property.title}
                  </h1>
                  <p style={{ fontSize: "36px", fontWeight: "800", color: primaryColor, margin: 0, letterSpacing: "-1px" }}>
                    R$ {Number(property.price).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                </div>

                {/* Stats grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "10px" }}>
                  {stat(<IcArea />, "Área", property.squareFootage ? `${property.squareFootage} m²` : null)}
                  {stat(<IcBed />, "Quartos", property.bedrooms || null)}
                  {stat(<IcSuite />, "Suítes", property.suites || null)}
                  {stat(<IcCar />, "Vagas", property.parkingSpots || null)}
                </div>

                {/* Description */}
                {property.description && (
                  <div>
                    <p style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: "10px" }}>Descrição</p>
                    <p style={{ fontSize: "15px", color: isLightMode ? "#334155" : "#cbd5e1", lineHeight: "1.7", margin: 0 }}>{property.description}</p>
                  </div>
                )}

                {/* Location */}
                <div className="prop-bloco">
                  <p style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: "12px" }}>Localização</p>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", color: isLightMode ? "#334155" : "#cbd5e1" }}>
                    <span style={{ color: primaryColor, marginTop: "2px", flexShrink: 0 }}><IcPin /></span>
                    <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.6" }}>
                      {property.address && <><strong>{property.address}</strong><br /></>}
                      {[property.neighborhood, property.city, property.state].filter(Boolean).join(", ")}
                      {property.cep && <> · CEP {property.cep}</>}
                    </p>
                  </div>
                </div>

                {/* Comodidades da região */}
                {(() => {
                  const ativas = comodidadesAtivas(property.comodidades);
                  if (ativas.length === 0) return null;
                  return (
                    <div>
                      <p style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: "12px" }}>
                        O que tem por perto
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
                        {ativas.map((c) => (
                          <div key={c.key} className="prop-comodidade">
                            <c.Icone size={21} style={{ flexShrink: 0, color: "var(--accent, #818cf8)" }} />
                            <span style={{ fontSize: "14px", fontWeight: "600", color: isLightMode ? "#0f172a" : "#fff" }}>{c.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Right: lead form */}
              <aside className="prop-aside">
                {/* O valor abre o cartão. Quem chega até aqui já decidiu
                    perguntar — ver o preço no alto do formulário evita a
                    subida de volta para conferir antes de escrever. */}
                <div className="prop-aside__preco">
                  <span className="prop-aside__preco-rotulo">Valor</span>
                  <strong className="prop-aside__preco-valor">
                    R$ {Number(property.price).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </strong>
                  {contratoInfo ? <span className="prop-aside__contrato" style={{ color: contratoInfo.cor }}>{contratoInfo.label}</span> : null}
                </div>
                <div>
                  <p className="prop-aside__titulo">Tenho interesse</p>
                  <p className="prop-aside__sub">Preencha e nossa equipe entrará em contato.</p>
                </div>
                <input className="prop-campo" placeholder="Seu nome" value={interestForm.name} onChange={(e) => setInterestForm((p) => ({ ...p, name: e.target.value }))} />
                <input className="prop-campo" type="email" placeholder="E-mail" value={interestForm.email} onChange={(e) => setInterestForm((p) => ({ ...p, email: e.target.value }))} />
                <input className="prop-campo" placeholder="WhatsApp / Telefone" value={interestForm.phone} onChange={(e) => setInterestForm((p) => ({ ...p, phone: e.target.value }))} />
                <textarea className="prop-campo prop-campo--area" placeholder="Mensagem (opcional)" value={interestForm.message} onChange={(e) => setInterestForm((p) => ({ ...p, message: e.target.value }))} rows={3} />
                <button type="button" onClick={handleInterest} disabled={sendingInterest} style={{ padding: "13px", borderRadius: "12px", background: primaryColor, color: "#fff", fontWeight: "700", fontSize: "14px", border: "none", cursor: "pointer", boxShadow: `0 4px 18px ${primaryColor}44`, transition: "opacity 0.2s", opacity: sendingInterest ? 0.7 : 1 }}>
                  {sendingInterest ? "Enviando..." : "Enviar interesse"}
                </button>
                {whatsappHref && (
                  <a href={whatsappHref} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "12px", borderRadius: "12px", background: "#25D366", color: "#fff", fontWeight: "700", fontSize: "14px", textDecoration: "none" }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/></svg>
                    Chamar no WhatsApp
                  </a>
                )}
                {property.leadCount > 0 && (
                  <p className="prop-aside__prova">
                    {property.leadCount} pessoa{property.leadCount !== 1 ? "s" : ""} já demonstrou interesse
                  </p>
                )}
              </aside>
            </div>

            {/* ── SUGGESTIONS ── */}
            {suggestions.length > 0 && (
              <section style={{ marginTop: "64px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
                  <h2 style={{ fontSize: "22px", fontWeight: "800", color: isLightMode ? "#0f172a" : "#fff", margin: 0, letterSpacing: "-0.4px" }}>Mais imóveis disponíveis</h2>
                  <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.07)" }} />
                </div>
                <div className="sug-grid">
                  {suggestions.map((s) => {
                    const sImg = s.images?.[0]?.url || "/property-placeholder.svg";
                    const sLancamento = isLancamento(s.createdAt);
                    return (
                      <Link key={s.id} to={`/vitrine/${tenantSlug}/imovel/${s.id}`} className="sug-link">
                        <article className={`sug-card${sLancamento ? " is-lancamento" : ""}`}>
                          <div className="sug-card__foto">
                            <img src={sImg} alt={s.title} />
                          </div>
                          <div className="sug-card__corpo">
                            {sLancamento && <span style={{ fontSize: "10px", fontWeight: "800", textTransform: "uppercase", color: "#f59e0b", letterSpacing: "0.06em" }}>Lançamento · </span>}
                            <h3 className="sug-card__titulo">{s.title}</h3>
                            {(s.neighborhood || s.city) && (
                              <p className="sug-card__local">
                                <IcPin /> {[s.neighborhood, s.city].filter(Boolean).join(", ")}
                              </p>
                            )}
                            <div className="sug-card__fichas">
                              {s.squareFootage ? <span>{s.squareFootage} m²</span> : null}
                              {s.bedrooms ? <span>{s.bedrooms} qtos</span> : null}
                            </div>
                            {/* `margin-top: auto` na classe: o preço desce para a
                                base do cartão, então cartões com uma linha a
                                menos de endereço não deixam o valor flutuando no
                                meio. É o que alinha os preços entre si. */}
                            <p className="sug-card__preco" style={{ color: primaryColor }}>
                              R$ {Number(s.price).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </p>
                          </div>
                        </article>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        ) : null}
      </div>

      {/* ── Rodapé ────────────────────────────────────────────────────────────
          O MESMO componente da vitrine. A página de imóvel tinha estrutura
          própria e terminava no ar, depois das sugestões: quem rolava até o fim
          não encontrava contato, CRECI nem cidade — as informações que fecham
          uma página de anúncio — e a única saída era o botão Voltar.

          Como é o componente compartilhado, mexer no rodapé da vitrine mexe
          neste junto; e o que a imobiliária escreveu no editor aparece aqui sem
          precisar de segunda configuração.

          O invólucro é o MESMO .showcase-container da vitrine, com o respiro
          vertical zerado (lá o rodapé é um bloco posicionado, e o padding de
          cima do contêiner não o alcança). Sem ele, o rodapé caía direto no
          corpo da página e as três colunas se espalhavam pela largura inteira
          do monitor — mesmo componente, caixa diferente. */}
      <div className="showcase-container" style={{ paddingBlock: 0 }}>
        <ShowcaseFooter
          tenant={tenant}
          config={showcaseConfig}
          blockStyles={showcaseConfig.blockStyles}
          whatsappHref={headerWhatsappHref}
        />
      </div>

      {/* ── Lightbox (galeria em tela cheia) ── */}
      {lightboxOpen && (
        <div className={`prop-lightbox${lightboxClosing ? " is-closing" : ""}`} onClick={closeLightbox} role="dialog" aria-modal="true">
          <button type="button" className="prop-lightbox-close" onClick={closeLightbox} aria-label="Fechar">✕</button>
          {images.length > 1 && (
            <>
              <button type="button" className="prop-lightbox-nav prev" onClick={(e) => { e.stopPropagation(); goTo(carouselIndex - 1); }} aria-label="Foto anterior">‹</button>
              <button type="button" className="prop-lightbox-nav next" onClick={(e) => { e.stopPropagation(); goTo(carouselIndex + 1); }} aria-label="Próxima foto">›</button>
            </>
          )}
          <div className="prop-lightbox-stage" onClick={(e) => e.stopPropagation()}>
            <img key={carouselIndex} src={images[carouselIndex]?.url} alt={`Foto ${carouselIndex + 1}`} className="prop-lightbox-img" />
          </div>
          {images.length > 1 && (
            <span className="prop-lightbox-counter">{carouselIndex + 1} / {images.length}</span>
          )}
        </div>
      )}
    </div>
  );
}
