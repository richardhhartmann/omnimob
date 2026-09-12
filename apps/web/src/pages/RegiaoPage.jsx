import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { normalizeShowcaseConfig } from "../utils/showcaseConfig";
import { ShowcaseHeader } from "../components/showcase/ShowcaseHeader.jsx";
import { ShowcaseFooter } from "../components/showcase/ShowcaseFooter.jsx";
import { CreditoOmnimob } from "../components/showcase/CreditoOmnimob.jsx";
import { ShowcasePropertyCard } from "../components/showcase/ShowcasePropertyCard.jsx";
import { VitrineProvider } from "../components/showcase/contexto.jsx";
import { classeDeAparencia, estiloDoTema, linkWhatsApp } from "../components/showcase/tema.js";
import { loadShowcaseFonts, getCachedTenant, setCachedTenant } from "../utils/showcaseFonts";
import { SITE, useSeo } from "../utils/seo";
import { esquemaDaTrilha, useDadosEstruturados } from "../utils/dadosEstruturados";
import { caminhoDaRegiao, filtrarPorRegiao, paginasDeRegiao, textosDaRegiao } from "../utils/regioes";

/* ────────────────────────────────────────────────────────────────────────────
   A página de região: "Imóveis em Jardins, São Paulo" — e "Apartamentos em
   Jardins, São Paulo" quando a rota traz o tipo.

   É uma página de BUSCA, no sentido do Google: quem procura "apartamento no
   Jardins" cai aqui, e não na home da vitrine nem num imóvel específico. Por
   isso ela tem endereço próprio, título próprio, H1 com o nome do lugar, a
   lista dos imóveis de lá e links para as regiões e tipos vizinhos — é a
   malha de links que faz o robô achar todas as outras.

   Não usa o layout do construtor, como a página do imóvel: o que ela
   compartilha com a vitrine são o tema, o cabeçalho, o rodapé e o cartão de
   imóvel — as mesmas peças, e nenhuma cópia. Os dados vêm do mesmo payload
   público da vitrine (`/public/:slug/properties`), filtrados aqui — o acervo
   inteiro já viaja para a home, e uma rota nova por bairro seria uma segunda
   fonte para o mesmo fato.

   Sem imóvel na região, a página diz isso e continua indexável com `noindex`:
   um bairro que esvaziou não deve seguir aparecendo na busca com "3 imóveis".
   ──────────────────────────────────────────────────────────────────────────── */

export function RegiaoPage({ slugFixo }) {
  const { tenantSlug: slugDaRota, regiao: regiaoSlug, tipo: tipoSlug } = useParams();
  const tenantSlug = slugFixo || slugDaRota;
  const [payload, setPayload] = useState(null);
  const [tenant, setTenant] = useState(() => getCachedTenant(tenantSlug));
  const [erro, setErro] = useState("");
  const [isMobileViewport, setIsMobileViewport] = useState(() => window.innerWidth < 768);
  const [indices, setIndices] = useState({});

  useEffect(() => {
    if (!tenantSlug) return;
    let vivo = true;
    api.getPublicShowcase(tenantSlug)
      .then((dados) => {
        if (!vivo) return;
        setPayload(dados);
        setTenant(dados.tenant);
        setCachedTenant(tenantSlug, dados.tenant);
      })
      .catch((e) => vivo && setErro(e.message || "Não foi possível carregar a vitrine."));
    return () => { vivo = false; };
  }, [tenantSlug]);

  useEffect(() => { loadShowcaseFonts(); }, []);

  useEffect(() => {
    const aoRedimensionar = () => setIsMobileViewport(window.innerWidth < 768);
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, []);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [regiaoSlug, tipoSlug]);

  const todos = payload?.properties || [];
  const paginas = useMemo(() => paginasDeRegiao(todos), [todos]);
  const regiao = paginas.find((r) => r.slug === regiaoSlug) || null;
  const tipo = tipoSlug ? regiao?.tipos.find((t) => t.slug === tipoSlug) || null : null;
  const imoveis = useMemo(() => filtrarPorRegiao(todos, regiaoSlug, tipoSlug), [todos, regiaoSlug, tipoSlug]);

  const showcaseConfig = normalizeShowcaseConfig(tenant?.showcaseConfig);
  const isLightMode = showcaseConfig.appearanceMode === "light";
  const themeStyle = estiloDoTema(tenant, showcaseConfig);
  const headerWhatsappHref = linkWhatsApp({ ...tenant, name: tenant?.name || tenantSlug });

  const caminho = (r, t) => caminhoDaRegiao({ tenantSlug, slugFixo, regiao: r, tipo: t });
  const caminhoVitrine = slugFixo ? "/" : `/vitrine/${tenantSlug}`;
  const textos = regiao ? textosDaRegiao({ regiao, tipo, total: imoveis.length, imobiliaria: tenant?.name }) : null;

  useSeo({
    /* Região inexistente também recebe título: `useSeo` não escreve nada sem
       ele, e é o `noindex` abaixo que precisa chegar ao <head>. */
    titulo: textos?.titulo || (payload ? `Região não encontrada — ${tenant?.name || "Vitrine"}` : ""),
    descricao: textos?.descricao || "Não há imóveis nesta região no momento.",
    caminho: caminho(regiaoSlug, tipoSlug),
    imagem: imoveis[0]?.images?.[0]?.url,
    /* Região sem imóvel sai do índice — ver o cabeçalho. Tipo desconhecido,
       idem: é endereço inventado ou de um tipo que a imobiliária deixou de ter. */
    indexavel: Boolean(regiao) && imoveis.length > 0,
  });

  useDadosEstruturados("regiao", regiao && imoveis.length ? [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: textos.h1,
      numberOfItems: imoveis.length,
      itemListElement: imoveis.slice(0, 50).map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: p.title,
        url: `${SITE}${slugFixo ? `/imovel/${p.id}` : `/vitrine/${tenantSlug}/imovel/${p.id}`}`,
      })),
    },
    esquemaDaTrilha([
      { nome: tenant?.name || "Vitrine", url: `${SITE}${caminhoVitrine}` },
      { nome: `Imóveis em ${textos.onde}`, url: `${SITE}${caminho(regiaoSlug)}` },
      ...(tipo ? [{ nome: textos.h1, url: `${SITE}${caminho(regiaoSlug, tipoSlug)}` }] : []),
    ]),
  ] : null);

  if (!payload && !erro) {
    return <div style={{ minHeight: "100vh", background: isLightMode ? "#f8fafc" : "#0f172a" }} />;
  }

  const outrasRegioes = paginas.filter((r) => r.slug !== regiaoSlug).slice(0, 12);
  const proximo = (id, total) => setIndices((i) => ({ ...i, [id]: ((i[id] || 0) + 1) % total }));
  const anterior = (id, total) => setIndices((i) => ({ ...i, [id]: ((i[id] || 0) - 1 + total) % total }));

  return (
    <VitrineProvider modo="public" tenantSlug={tenantSlug} dados={payload?.vitrine}>
      <div className={`showcase-body ${classeDeAparencia(showcaseConfig)}`} style={themeStyle}>
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

        <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px 80px" }}>
          {/* Trilha */}
          <nav aria-label="Você está em" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "22px", flexWrap: "wrap", fontSize: "13px", color: "var(--text-muted)" }}>
            <Link to={caminhoVitrine} style={{ color: "inherit", textDecoration: "none", fontWeight: 600, opacity: 0.8 }}>{tenant?.name || "Vitrine"}</Link>
            <span style={{ opacity: 0.35 }}>›</span>
            {tipo ? (
              <>
                <Link to={caminho(regiaoSlug)} style={{ color: "inherit", textDecoration: "none", fontWeight: 600, opacity: 0.8 }}>Imóveis em {textos.onde}</Link>
                <span style={{ opacity: 0.35 }}>›</span>
                <span style={{ opacity: 0.65 }}>{textos.h1}</span>
              </>
            ) : (
              <span style={{ opacity: 0.65 }}>{regiao ? `Imóveis em ${textos.onde}` : "Região"}</span>
            )}
          </nav>

          {erro ? <div className="error">{erro}</div> : null}

          {!regiao ? (
            <section style={{ padding: "48px 0", textAlign: "center" }}>
              <h1 style={{ fontSize: "clamp(24px, 3vw, 34px)", margin: "0 0 10px" }}>Região não encontrada</h1>
              <p style={{ color: "var(--text-muted)", margin: "0 0 22px" }}>Não há imóveis cadastrados neste endereço.</p>
              <Link to={caminhoVitrine} className="widget-regions__chip" style={{ display: "inline-flex", textDecoration: "none" }}><span>Ver todos os imóveis</span></Link>
            </section>
          ) : (
            <>
              <header style={{ marginBottom: "26px" }}>
                <h1 style={{ fontSize: "clamp(26px, 3.4vw, 40px)", lineHeight: 1.1, letterSpacing: "-0.02em", margin: "0 0 10px" }}>{textos.h1}</h1>
                <p style={{ color: "var(--text-muted)", margin: 0, fontSize: "15px" }}>
                  {imoveis.length === 1 ? "1 imóvel disponível" : `${imoveis.length} imóveis disponíveis`}
                  {tenant?.name ? ` na ${tenant.name}` : ""}.
                </p>

                {/* Os tipos da região: "Apartamentos", "Casas"… são as páginas
                    filhas, e o link é o que as torna alcançáveis pelo robô. */}
                {regiao.tipos.length > 1 || tipo ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "16px" }}>
                    <Link to={caminho(regiaoSlug)} className={`widget-regions__chip${!tipo ? " is-ativo" : ""}`} style={{ textDecoration: "none" }}>
                      <span>Todos</span><span className="widget-regions__conta">{regiao.total}</span>
                    </Link>
                    {regiao.tipos.map((t) => (
                      <Link key={t.slug} to={caminho(regiaoSlug, t.slug)} className={`widget-regions__chip${tipo?.slug === t.slug ? " is-ativo" : ""}`} style={{ textDecoration: "none" }}>
                        <span>{t.nome}</span><span className="widget-regions__conta">{t.total}</span>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </header>

              <div className="property-grid">
                {imoveis.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", gridColumn: "1 / -1", textAlign: "center", padding: "40px 0" }}>
                    Nenhum imóvel deste tipo nesta região no momento.
                  </p>
                ) : imoveis.map((p) => (
                  <ShowcasePropertyCard
                    key={p.id}
                    property={p}
                    tenantSlug={tenantSlug}
                    carouselIndex={indices[p.id] || 0}
                    onProxima={proximo}
                    onAnterior={anterior}
                  />
                ))}
              </div>

              {outrasRegioes.length ? (
                <section style={{ marginTop: "48px" }}>
                  <h2 style={{ fontSize: "18px", margin: "0 0 12px" }}>Outras regiões</h2>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {outrasRegioes.map((r) => (
                      <Link key={r.slug} to={caminho(r.slug)} className="widget-regions__chip" style={{ textDecoration: "none" }}>
                        <span>{r.cidade && r.cidade !== r.nome ? `${r.nome}, ${r.cidade}` : r.nome}</span>
                        <span className="widget-regions__conta">{r.total}</span>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          )}
        </main>

        <div className="showcase-container" style={{ paddingBlock: 0 }}>
          <ShowcaseFooter
            tenant={tenant}
            config={showcaseConfig}
            blockStyles={showcaseConfig.blockStyles}
            whatsappHref={headerWhatsappHref}
          />
        </div>
        <CreditoOmnimob tenantSlug={tenantSlug} isLightMode={isLightMode} />
      </div>
    </VitrineProvider>
  );
}
