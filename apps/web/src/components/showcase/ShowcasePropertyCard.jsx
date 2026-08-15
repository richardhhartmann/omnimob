import { comodidadesAtivas } from "../../utils/comodidades";
import { tipoContratoInfo } from "../../utils/tiposContrato";
import { ShowcaseLink } from "./contexto.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   O cartão de imóvel — um só, para a vitrine e para o editor.

   Eram dois, e tinham divergido bastante: o do editor mostrava um selo fixo
   "Disponível" e um botão "Ver detalhes"; o público mostrava selos reais
   (lançamento, andamento da obra, tipo de contrato, aceita permuta) e as fichas
   de metragem, quartos e vagas — nenhuma das quais aparecia no editor. Quem
   montava a vitrine escolhia a altura do bloco de imóveis olhando para um
   cartão mais baixo do que o que seria publicado, e a página saía com os
   cartões estourando o bloco.

   A versão que ficou é a PÚBLICA, porque é a que o visitante recebe. O editor
   ganhou tudo o que lhe faltava.

   A navegação é a única diferença: no editor `ShowcaseLink` vira um `<span>`,
   porque clicar num imóvel no meio de uma edição levaria a pessoa para fora do
   construtor.
   ──────────────────────────────────────────────────────────────────────────── */

const IcPin = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
);
const IcArea = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 9V3h6" /><path d="M3 3l6 6" /><path d="M21 15v6h-6" /><path d="M21 21l-6-6" /></svg>
);
const IcBed = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M2 4v16" /><path d="M22 8v12" /><path d="M2 8h20" /><rect x="6" y="4" width="12" height="4" rx="1" /></svg>
);
const IcCar = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="2" y="10" width="20" height="10" rx="2" /><path d="m6 10 3-6h6l3 6" /><circle cx="7" cy="17" r="1" fill="currentColor" /><circle cx="17" cy="17" r="1" fill="currentColor" /></svg>
);

/* As fichas (m², quartos, vagas) e as comodidades saíram do estilo inline para
   uma classe. O fundo era `rgba(255,255,255,0.04)` cravado no JSX: no modo
   escuro é um cinza discreto, no modo CLARO é branco sobre branco — as fichas
   simplesmente sumiam, e nenhuma regra de CSS conseguia corrigir porque estilo
   inline vence folha de estilo. */

function ehLancamento(createdAt) {
  if (!createdAt) return false;
  return (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24) <= 30;
}

export function ShowcasePropertyCard({ property: p, tenantSlug, carouselIndex = 0, onProxima, onAnterior }) {
  const images = p.images?.length ? p.images : [{ url: "/property-placeholder.svg" }];
  const indice = Math.min(carouselIndex, images.length - 1);
  const principal = images[indice]?.url;
  const lancamento = ehLancamento(p.createdAt);
  const andamento = { PRONTO_PARA_MORAR: "Pronto para morar", EM_CONSTRUCAO: "Em construção" }[p.andamento];
  const contrato = tipoContratoInfo(p.tipoContrato);
  const ativas = comodidadesAtivas(p.comodidades);
  const visiveis = ativas.slice(0, 6);
  const restantes = ativas.length - visiveis.length;

  return (
    <ShowcaseLink para={`/vitrine/${tenantSlug}/imovel/${p.id}`} style={{ textDecoration: "none", display: "block" }}>
      <article className={`property-card-luxury ${lancamento ? "is-lancamento" : ""}`}>
        <div className="card-image-wrapper">
          <img key={principal} src={principal} alt={p.title} style={{ animation: "imgFade 0.3s ease" }} />

          {/* Cada quina tem um dono. O selo de situação (lançamento / andamento
              da obra) e o de tipo de contrato eram os dois posicionados no alto
              à direita — e todo imóvel novo COM tipo de contrato, que é o caso
              comum, publicava os dois empilhados, um tapando o outro. */}
          {lancamento ? (
            <span className="featured-badge is-status is-lancamento">Lançamento</span>
          ) : null}
          {!lancamento && andamento ? <span className="featured-badge is-status">{andamento}</span> : null}
          {contrato ? (
            <span
              className="featured-badge is-contrato"
              title={contrato.descricao}
              style={{ background: contrato.cor, color: "#fff", borderColor: "transparent" }}
            >
              {contrato.label}
            </span>
          ) : null}
          {p.aceitaPermuta ? (
            <span className="featured-badge is-permuta">Aceita permuta</span>
          ) : null}

          {images.length > 1 ? (
            <>
              <button
                type="button"
                className="carousel-btn prev"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAnterior?.(p.id, images.length); }}
              >
                ‹
              </button>
              <button
                type="button"
                className="carousel-btn next"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onProxima?.(p.id, images.length); }}
              >
                ›
              </button>
              <span className="carousel-counter">{indice + 1}/{images.length}</span>
            </>
          ) : null}
        </div>

        <div className="card-info-wrapper">
          <h3>{p.title}</h3>

          {p.neighborhood || p.city ? (
            <div className="card-location">
              <IcPin />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {[p.neighborhood, p.city, p.state].filter(Boolean).join(", ")}
              </span>
            </div>
          ) : null}

          {p.description ? (
            <p
              style={{
                fontSize: "14px", color: "var(--text-muted)", lineHeight: "1.6", margin: "0 0 16px 0",
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
              }}
            >
              {p.description}
            </p>
          ) : null}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
            {p.squareFootage ? <span className="card-ficha"><IcArea />{p.squareFootage} m²</span> : null}
            {p.bedrooms ? (
              <span className="card-ficha">
                <IcBed />{p.bedrooms} qto{p.bedrooms !== 1 ? "s" : ""}
                {p.suites ? ` · ${p.suites} suíte${p.suites !== 1 ? "s" : ""}` : ""}
              </span>
            ) : null}
            {p.parkingSpots ? <span className="card-ficha"><IcCar />{p.parkingSpots} vaga{p.parkingSpots !== 1 ? "s" : ""}</span> : null}
          </div>

          {ativas.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px" }}>
              {visiveis.map((c) => (
                <span key={c.key} title={c.label} className="card-ficha is-comodidade">
                  <c.Icone size={13} />{c.label}
                </span>
              ))}
              {restantes > 0 ? <span className="card-ficha is-comodidade">+{restantes}</span> : null}
            </div>
          ) : null}

          <div className="card-price-wrapper">
            <div>
              <span className="price-label">Valor</span>
              <p className="card-price">
                R$ {Number(p.price).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </div>
      </article>
    </ShowcaseLink>
  );
}
