import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { normalizeShowcaseConfig } from "../utils/showcaseConfig";
import { ShowcaseHeader } from "../components/showcase/ShowcaseHeader.jsx";
import { ShowcaseFooter } from "../components/showcase/ShowcaseFooter.jsx";
import { CreditoOmnimob } from "../components/showcase/CreditoOmnimob.jsx";
import { classeDeAparencia, estiloDoTema, linkWhatsApp } from "../components/showcase/tema.js";
import { Panorama360 } from "../components/Panorama360";
import { comodidadesAtivas } from "../utils/comodidades";
import { tipoContratoInfo } from "../utils/tiposContrato";
import { loadShowcaseFonts, getCachedTenant, setCachedTenant } from "../utils/showcaseFonts";
import { IconeFaisca } from "../components/Icones.jsx";
import { IconeCheck } from "../components/Icones.jsx";
import { SITE, useSeo } from "../utils/seo";
import { esquemaDaTrilha, esquemaDoImovel, useDadosEstruturados } from "../utils/dadosEstruturados";
import { caminhoDaRegiao, regiaoDoImovel } from "../utils/regioes";

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

/* ── A ficha, no formato dos portais ────────────────────────────────────────
   A página seguia o desenho de "cartão": título do corretor, preço, quatro
   números e a descrição. Os portais grandes contam o imóvel de outro jeito, e
   é o jeito que o comprador já aprendeu a ler: um título COMPOSTO que diz tudo
   numa linha ("Apartamento para comprar com 68 m², 2 quartos e 1 vaga por
   R$ 450.000"), depois os cômodos com uma frase de apoio cada, as metragens
   explicadas, a descrição sob o título que o corretor escreveu, a
   infraestrutura, o bairro no mapa e um cartão de contato que acompanha a
   rolagem. Cada bloco só existe se há o que mostrar — número que não existe
   não vira "0 quartos". */
const APOIO_COMODO = {
  quartos: "Espaço para a família e para receber",
  suites: "Quarto com banheiro só seu",
  banheiros: "Mais comodidade e higiene para todos",
  vagas: "Facilita o dia a dia de quem chega de carro",
  salas: "Ambientes para receber e trabalhar",
};
const APOIO_AREA = {
  privativa: "Área exclusiva do imóvel, sem contar as paredes",
  construida: "Tudo o que está coberto e construído",
  terreno: "O terreno onde o imóvel está",
  total: "Área total, incluindo as partes comuns",
  util: "Área que você realmente usa",
};

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/** "Apartamento para comprar com 68 m², 2 quartos e 1 vaga por R$ 450.000". */
function tituloComposto(p) {
  if (!p) return "";
  const tipo = p.propertyType || "Imóvel";
  const acao = p.tipoContrato === "LOCACAO" || p.tipoContrato === "BUILT_TO_SUIT" ? "alugar" : "comprar";
  const area = Number(p.areaPrivativa || p.squareFootage || p.areaConstruida || p.areaTotal || 0);
  const partes = [
    area ? `${area.toLocaleString("pt-BR")} m²` : "",
    p.bedrooms ? plural(p.bedrooms, "quarto", "quartos") : "",
    p.finalidade === "COMERCIAL" && p.salas ? plural(p.salas, "sala", "salas") : "",
    p.banheiros && !p.bedrooms ? plural(p.banheiros, "banheiro", "banheiros") : "",
    p.parkingSpots ? plural(p.parkingSpots, "vaga", "vagas") : "",
  ].filter(Boolean);
  const com = partes.length ? ` com ${partes.length > 1 ? `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}` : partes[0]}` : "";
  const preco = Number(p.price) > 0 ? ` por R$ ${Number(p.price).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}` : "";
  return `${tipo} para ${acao}${com}${preco}`;
}

function comodosDoImovel(p) {
  const lista = [
    p.bedrooms ? { chave: "quartos", n: p.bedrooms, rotulo: plural(p.bedrooms, "Quarto", "Quartos"), apoio: APOIO_COMODO.quartos, Icone: IcBed } : null,
    p.suites ? { chave: "suites", n: p.suites, rotulo: plural(p.suites, "Suíte", "Suítes"), apoio: APOIO_COMODO.suites, Icone: IcSuite } : null,
    p.banheiros ? { chave: "banheiros", n: p.banheiros, rotulo: plural(p.banheiros, "Banheiro", "Banheiros"), apoio: APOIO_COMODO.banheiros, Icone: IcSuite } : null,
    p.salas ? { chave: "salas", n: p.salas, rotulo: plural(p.salas, "Sala", "Salas"), apoio: APOIO_COMODO.salas, Icone: IcHome } : null,
    p.parkingSpots ? { chave: "vagas", n: p.parkingSpots, rotulo: plural(p.parkingSpots, "Vaga de garagem", "Vagas de garagem"), apoio: APOIO_COMODO.vagas, Icone: IcCar } : null,
  ];
  return lista.filter(Boolean);
}

function metragensDoImovel(p) {
  const m2 = (v) => `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m²`;
  const lista = [
    p.areaPrivativa ? { chave: "privativa", valor: m2(p.areaPrivativa), rotulo: "área privativa", apoio: APOIO_AREA.privativa } : null,
    p.areaConstruida ? { chave: "construida", valor: m2(p.areaConstruida), rotulo: "área construída", apoio: APOIO_AREA.construida } : null,
    p.areaTerreno ? { chave: "terreno", valor: m2(p.areaTerreno), rotulo: "de terreno", apoio: APOIO_AREA.terreno } : null,
    p.areaTotal ? { chave: "total", valor: m2(p.areaTotal), rotulo: "área total", apoio: APOIO_AREA.total } : null,
  ].filter(Boolean);
  // Sem nenhuma das quatro, a metragem simples do cadastro é a "área útil".
  if (!lista.length && p.squareFootage) lista.push({ chave: "util", valor: m2(p.squareFootage), rotulo: "área útil", apoio: APOIO_AREA.util });
  return lista;
}

/* ── O modo ISOLADO (`isolada`) ──────────────────────────────────────────────
   A landing page do imóvel: a mesma página, sem o que distrai — cabeçalho com
   menu, trilha, sugestões de outros imóveis e rodapé completo. Sobram a
   galeria, a ficha, o preço e o formulário; no celular, uma barra fixa de
   WhatsApp. É o endereço que a imobiliária põe num anúncio pago ou manda para
   o cliente de um lançamento: quem chega dali não deve ter para onde ir a não
   ser "tenho interesse".

   É um interruptor na página, e não uma segunda página: as duas telas
   mostrariam o mesmo imóvel, e duas cópias divergiriam na primeira mudança
   da ficha. A URL canônica continua sendo a página normal (`noindex` aqui):
   o Google não precisa indexar duas vezes o mesmo anúncio. */
export function ShowcasePropertyPage({ slugFixo, isolada = false }) {
  /* Mesma história do ShowcasePage: em domínio próprio o slug vem do host. */
  const { tenantSlug: slugDaRota, propertyId } = useParams();
  const tenantSlug = slugFixo || slugDaRota;
  const [property, setProperty] = useState(null);
  const [tenant, setTenant] = useState(() => getCachedTenant(tenantSlug));
  const [contatoDaCasa, setContatoDaCasa] = useState(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sendingInterest, setSendingInterest] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [interestForm, setInterestForm] = useState({ name: "", email: "", phone: "", message: "" });
  /* O pedido de visita: aberto pelo botão, some depois de enviado. Não é
     agenda — é o mesmo lead com "quando" (ver `pedidoDeVisita.js` na API). */
  const [visitaAberta, setVisitaAberta] = useState(false);
  const [visita, setVisita] = useState({ data: "", periodo: "tarde" });
  /* "Ligamos para você": o mesmo formulário, só nome e telefone, com o pedido
     na mensagem. É um lead como outro qualquer, marcado para ser retornado. */
  const [ligacao, setLigacao] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const formRef = useRef(null);
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
        // O CRECI e o telefone da casa, para o rodapé mínimo da landing isolada.
        setContatoDaCasa(data.vitrine?.contato || null);
      })
      .catch(() => {});
  }, [tenantSlug, propertyId]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [propertyId]);

  async function handleInterest() {
    if (!tenantSlug || !propertyId) return;
    if (visitaAberta && !visita.data) {
      setError("Escolha a data da visita.");
      return;
    }
    setSendingInterest(true);
    setSuccessMessage("");
    setError("");
    try {
      const payload = visitaAberta
        ? { ...interestForm, visita }
        : ligacao
          ? { ...interestForm, message: ["Pedido de ligação: prefiro que a imobiliária me ligue.", interestForm.message].filter(Boolean).join("\n") }
          : interestForm;
      const response = await api.registerPublicInterest(tenantSlug, propertyId, payload);
      setProperty((prev) => prev ? { ...prev, leadCount: response.property.leadCount } : prev);
      setSuccessMessage(visitaAberta
        ? "Pedido de visita enviado! A imobiliária vai confirmar o horário com você."
        : "Interesse enviado! A imobiliária entrará em contato em breve.");
      setInterestForm({ name: "", email: "", phone: "", message: "" });
      setVisitaAberta(false);
      setLigacao(false);
      setVisita({ data: "", periodo: "tarde" });
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
    // A landing isolada aponta o canonical para a página normal e fica fora do índice.
    indexavel: !isolada,
  });

  /* Dados estruturados: o anúncio (preço, quartos, metragem, endereço público)
     e a trilha "Vitrine › Imóvel". É o que faz esta página concorrer como
     ANÚNCIO na busca, e não como texto — ver `utils/dadosEstruturados.js`. */
  const urlVitrine = `${SITE}${slugFixo ? "/" : `/vitrine/${tenantSlug}`}`;
  const urlImovel = `${SITE}${slugFixo ? `/imovel/${propertyId}` : `/vitrine/${tenantSlug}/imovel/${propertyId}`}`;
  useDadosEstruturados("imovel", property ? [
    esquemaDoImovel({ property, tenant, url: urlImovel }),
    esquemaDaTrilha([
      { nome: tenant?.name || "Vitrine", url: urlVitrine },
      { nome: property.title, url: urlImovel },
    ]),
  ] : null);

  function irAoFormulario(modo) {
    setLigacao(modo === "ligacao");
    if (modo === "ligacao") setVisitaAberta(false);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => formRef.current?.querySelector("input")?.focus(), 450);
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(window.location.href.replace(/\/lp$/, ""));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch { /* sem clipboard */ }
  }


  /* Classe, e não objeto inline: os campos usavam fundo branco a 5% cravado no
     JSX, o que no modo CLARO vira branco sobre branco — e estilo inline não tem
     como ser corrigido por folha de estilo. */

  return (
    <div className={`showcase-body ${classeDeAparencia(showcaseConfig)}${showcaseConfig.zebrado ? " is-zebrada" : ""}`} style={themeStyle}>
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
      {isolada ? (
        /* Só a marca, sem menu: na landing não existe "para onde ir". */
        <div className="prop-lp__marca">
          {tenant?.logoUrl
            ? <img src={tenant.logoUrl} alt={tenant?.name || ""} className="prop-lp__logo" />
            : <span className="prop-lp__nome">{tenant?.name || tenantSlug}</span>}
          {headerWhatsappHref ? (
            <a href={headerWhatsappHref} target="_blank" rel="noreferrer" className="prop-lp__whats">Falar no WhatsApp</a>
          ) : null}
        </div>
      ) : (
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
      )}

      {/* `prop-secoes`: com a zebra ligada, cada `.prop-secao` alterna o fundo
          — ver `.is-zebrada` em styles.css. É o mesmo interruptor do editor. */}
      <div className="prop-secoes" style={{ maxWidth: "1200px", margin: "0 auto", padding: isolada ? "16px 24px 110px" : "32px 24px 80px" }}>
        {/* Breadcrumb */}
        {isolada ? null : (
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
        )}

        {error ? <div className="error" style={{ marginBottom: "24px" }}>{error}</div> : null}
        {successMessage ? <div className="success-banner" style={{ marginBottom: "24px" }}>{successMessage}</div> : null}
        {loading ? <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "80px 0" }}>Carregando detalhes...</p> : null}

        {!loading && property ? (
          <>
            {/* ── CAROUSEL ── */}
            <div className="prop-secao" style={{ marginBottom: "32px" }}>
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
            <div className="prop-grid prop-secao">
              {/* Left: a ficha, no formato dos portais — ver `tituloComposto`. */}
              <div style={{ display: "flex", flexDirection: "column", gap: "30px", minWidth: 0 }}>
                {/* ── Título composto, endereço e compartilhar ── */}
                <header>
                  {property.propertyType && (
                    <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", color: primaryColor, marginBottom: "8px", display: "block" }}>
                      <IcHome style={{ display: "inline" }} /> {property.propertyType}
                    </span>
                  )}
                  <h1 style={{ fontSize: "clamp(22px, 2.4vw, 30px)", fontWeight: "800", letterSpacing: "-0.4px", margin: "0 0 8px", color: isLightMode ? "#0f172a" : "#fff", lineHeight: 1.25 }}>
                    {tituloComposto(property)}
                  </h1>
                  {/* A rua só aparece quando a imobiliária marcou. O corte de
                      verdade é no servidor — com a opção desligada, `address` e
                      `cep` nem chegam aqui (ver `semEnderecoOculto`). */}
                  <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.6, color: isLightMode ? "#334155" : "#cbd5e1", display: "flex", gap: "8px", alignItems: "flex-start" }}>
                    <span style={{ color: primaryColor, marginTop: "2px", flexShrink: 0 }}><IcPin /></span>
                    <span>
                      {property.address && <>{property.address}<br /></>}
                      {[property.neighborhood, property.city, property.state].filter(Boolean).join(", ")}
                      {property.cep && <> · CEP {property.cep}</>}
                    </span>
                  </p>
                  <div className="prop-compartilhe">
                    <span>Compartilhe</span>
                    <button type="button" onClick={copiarLink}>{copiado ? "Link copiado" : "Copiar link"}</button>
                    <a href={`https://wa.me/?text=${encodeURIComponent(`${tituloComposto(property)} — ${window.location.href.replace(/\/lp$/, "")}`)}`} target="_blank" rel="noreferrer">WhatsApp</a>
                  </div>
                </header>

                {/* ── Cômodos e espaços ── */}
                {comodosDoImovel(property).length ? (
                  <section className="prop-secaoFicha">
                    <h2 className="prop-h2">Cômodos e espaços</h2>
                    <div className="prop-itens">
                      {comodosDoImovel(property).map((c) => (
                        <div key={c.chave} className="prop-item">
                          <span className="prop-item__icone"><c.Icone /></span>
                          <div>
                            <strong>{c.rotulo}</strong>
                            <span>{c.apoio}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {/* ── Dimensões e metragens ── */}
                {metragensDoImovel(property).length ? (
                  <section className="prop-secaoFicha">
                    <h2 className="prop-h2">Dimensões e metragens</h2>
                    <div className="prop-itens">
                      {metragensDoImovel(property).map((m) => (
                        <div key={m.chave} className="prop-item">
                          <span className="prop-item__icone"><IcArea /></span>
                          <div>
                            <strong>{m.valor} {m.rotulo}</strong>
                            <span>{m.apoio}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {/* ── Descrição: o título que o corretor escreveu vira o h2 ── */}
                <section className="prop-secaoFicha">
                  <h2 className="prop-h2 prop-h2--titulo">{property.title}</h2>
                  {property.description ? (
                    <p style={{ fontSize: "15px", color: isLightMode ? "#334155" : "#cbd5e1", lineHeight: "1.75", margin: 0, whiteSpace: "pre-line" }}>{property.description}</p>
                  ) : null}
                </section>

                {/* ── Quer mais informações? ── */}
                <div className="prop-chamada">
                  <div>
                    <strong>Quer mais informações?</strong>
                    <span>Fale com quem conhece o imóvel. Sem compromisso.</span>
                  </div>
                  <button type="button" onClick={() => irAoFormulario()} style={{ background: primaryColor }}>Quero falar com a imobiliária</button>
                </div>

                {/* ── Infraestrutura: atributos do imóvel + o que tem por perto ── */}
                {(() => {
                  const atributos = (property.atributos || []).map((a) => a?.atributo || a).filter((a) => a?.descricao);
                  const ativas = comodidadesAtivas(property.comodidades);
                  if (!atributos.length && !ativas.length) return null;
                  return (
                    <section className="prop-secaoFicha">
                      <h2 className="prop-h2">Infraestrutura</h2>
                      {atributos.length ? (
                        <div className="prop-tags">
                          {atributos.map((a) => <span key={a.descricao} className="prop-tag"><IconeCheck size={12} /> {a.descricao}</span>)}
                        </div>
                      ) : null}
                      {ativas.length ? (
                        <>
                          <p className="prop-sub">O que tem por perto</p>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
                            {ativas.map((c) => (
                              <div key={c.key} className="prop-comodidade">
                                <c.Icone size={21} style={{ flexShrink: 0, color: "var(--accent, #818cf8)" }} />
                                <span style={{ fontSize: "14px", fontWeight: "600", color: isLightMode ? "#0f172a" : "#fff" }}>{c.label}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : null}
                    </section>
                  );
                })()}

                {/* ── Conheça a região ── O mapa é do BAIRRO, nunca da rua: com
                    o endereço oculto, a busca leva só bairro e cidade. */}
                {(property.neighborhood || property.city) ? (() => {
                  const r = regiaoDoImovel(property);
                  const busca = encodeURIComponent([property.exibirEnderecoCompleto ? property.address : "", property.neighborhood, property.city, property.state].filter(Boolean).join(", "));
                  return (
                    <section className="prop-secaoFicha">
                      <h2 className="prop-h2">Conheça a região{property.neighborhood ? ` do bairro ${property.neighborhood}` : ""}</h2>
                      <div className="prop-mapa">
                        <iframe title={`Mapa de ${property.neighborhood || property.city}`} src={`https://maps.google.com/maps?q=${busca}&z=15&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                      </div>
                      {r && !isolada ? (
                        <Link to={caminhoDaRegiao({ tenantSlug, slugFixo, regiao: r.slug })} className="prop-explorar">
                          Explore o bairro: mais imóveis em {r.nome} →
                        </Link>
                      ) : null}
                    </section>
                  );
                })() : null}
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
                    {property.tipoContrato === "LOCACAO" || property.tipoContrato === "BUILT_TO_SUIT" ? <small> /mês</small> : null}
                  </strong>
                  {contratoInfo ? <span className="prop-aside__contrato" style={{ color: contratoInfo.cor }}>{contratoInfo.label}</span> : null}
                </div>
                {/* Os três caminhos do modelo dos portais: WhatsApp, "ligamos
                    para você" e o formulário. Todos levam ao mesmo lead. */}
                {whatsappHref && (
                  <a href={whatsappHref} target="_blank" rel="noreferrer" className="prop-aside__whats">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654z"/></svg>
                    Converse por WhatsApp
                  </a>
                )}
                <button type="button" className="prop-aside__ligar" onClick={() => irAoFormulario("ligacao")}>Ligamos para você</button>
                <div ref={formRef}>
                  <p className="prop-aside__titulo">{ligacao ? "Ligamos para você" : "Gostou deste imóvel?"}</p>
                  <p className="prop-aside__sub">{ligacao ? "Deixe seu telefone e a imobiliária liga no melhor horário." : "Preencha e nossa equipe entrará em contato."}</p>
                </div>
                <input className="prop-campo" placeholder="Seu nome" value={interestForm.name} onChange={(e) => setInterestForm((p) => ({ ...p, name: e.target.value }))} />
                {ligacao ? null : <input className="prop-campo" type="email" placeholder="E-mail" value={interestForm.email} onChange={(e) => setInterestForm((p) => ({ ...p, email: e.target.value }))} />}
                <input className="prop-campo" placeholder="WhatsApp / Telefone" value={interestForm.phone} onChange={(e) => setInterestForm((p) => ({ ...p, phone: e.target.value }))} />
                {ligacao ? null : <textarea className="prop-campo prop-campo--area" placeholder="Mensagem (opcional)" value={interestForm.message} onChange={(e) => setInterestForm((p) => ({ ...p, message: e.target.value }))} rows={3} />}

                {/* Agendar visita: abre data + período dentro do mesmo formulário.
                    Um clique a mais e o lead chega com "quando" — sem tela nova,
                    sem calendário. */}
                {visitaAberta ? (
                  <div className="prop-visita">
                    <div className="prop-visita__topo">
                      <span>Quando você quer visitar?</span>
                      <button type="button" onClick={() => setVisitaAberta(false)} aria-label="Cancelar visita">×</button>
                    </div>
                    <div className="prop-visita__campos">
                      <input
                        className="prop-campo"
                        type="date"
                        value={visita.data}
                        min={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => setVisita((v) => ({ ...v, data: e.target.value }))}
                        aria-label="Data da visita"
                      />
                      <select className="prop-campo" value={visita.periodo} onChange={(e) => setVisita((v) => ({ ...v, periodo: e.target.value }))} aria-label="Período">
                        <option value="manha">De manhã</option>
                        <option value="tarde">À tarde</option>
                        <option value="noite">À noite</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="prop-visita__abrir" onClick={() => setVisitaAberta(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                    Quero agendar uma visita
                  </button>
                )}

                <button type="button" onClick={handleInterest} disabled={sendingInterest} style={{ padding: "13px", borderRadius: "12px", background: primaryColor, color: "#fff", fontWeight: "700", fontSize: "14px", border: "none", cursor: "pointer", boxShadow: `0 4px 18px ${primaryColor}44`, transition: "opacity 0.2s", opacity: sendingInterest ? 0.7 : 1 }}>
                  {sendingInterest ? "Enviando..." : visitaAberta ? "Pedir visita" : ligacao ? "Pedir ligação" : "Quero mais informações"}
                </button>
                <p className="prop-aside__quem">
                  {[tenant?.name, contatoDaCasa?.creci && `CRECI ${contatoDaCasa.creci}`].filter(Boolean).join(" · ")}
                </p>
                {property.leadCount > 0 && (
                  <p className="prop-aside__prova">
                    {property.leadCount} pessoa{property.leadCount !== 1 ? "s" : ""} já demonstrou interesse
                  </p>
                )}
              </aside>
            </div>

            {/* ── SUGGESTIONS ── */}
            {!isolada && suggestions.length > 0 && (
              <section className="prop-secao" style={{ marginTop: "64px" }}>
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
      {isolada ? (
        <>
          {/* Rodapé mínimo: quem é a imobiliária. Sem links de navegação. */}
          <p className="prop-lp__rodape">
            {[tenant?.name, contatoDaCasa?.creci && `CRECI ${contatoDaCasa.creci}`, contatoDaCasa?.telefone || tenant?.whatsapp].filter(Boolean).join(" · ")}
          </p>
          {/* Barra fixa no celular: o WhatsApp a um toque, sempre à vista. */}
          {whatsappHref ? (
            <a href={whatsappHref} target="_blank" rel="noreferrer" className="prop-lp__barra">Chamar no WhatsApp sobre este imóvel</a>
          ) : null}
        </>
      ) : (
      <div className="showcase-container" style={{ paddingBlock: 0 }}>
        <ShowcaseFooter
          tenant={tenant}
          config={showcaseConfig}
          blockStyles={showcaseConfig.blockStyles}
          whatsappHref={headerWhatsappHref}
        />
      </div>
      )}

      {/* A assinatura do produto, sempre — inclusive no modo isolado, que
          tira o rodapé da imobiliária mas não o crédito de quem fez a página. */}
      <CreditoOmnimob tenantSlug={tenantSlug} isLightMode={isLightMode} />

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
