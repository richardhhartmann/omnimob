import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { api } from "../api";
import { normalizeShowcaseConfig } from "../utils/showcaseConfig";
import { useSeo } from "../utils/seo";
import { loadShowcaseFonts, setCachedTenant } from "../utils/showcaseFonts";
import { VitrineProvider } from "../components/showcase/contexto.jsx";
import { ShowcaseRenderer } from "../components/showcase/ShowcaseRenderer.jsx";
import { useLayoutResolvido } from "../components/showcase/useLayoutResolvido.js";
import { alturaDoConteudo } from "../components/showcase/engine/layoutEngine.js";
import { classeDeAparencia, estiloDoTema, linkWhatsApp, modoDoViewport } from "../components/showcase/tema.js";

/* ────────────────────────────────────────────────────────────────────────────
   A vitrine pública.

   Esta página não desenha mais nada. Ela busca os dados, resolve o layout com a
   MESMA engine do editor e entrega tudo ao renderizador compartilhado — o mesmo
   que o construtor usa. Cabeçalho, título, destaques, grade de imóveis, cartão
   de imóvel, widgets e rodapé são componentes únicos: alterar um deles muda as
   duas telas ao mesmo tempo, que é a única forma de a paridade se manter sem
   alguém precisar lembrar dela.

   O que saiu daqui, e por quê:

     · o bloco condicional que desenhava cada tipo de widget → `ShowcaseWidget`;
     · a marcação do cartão de imóvel → `ShowcasePropertyCard`;
     · `sectionCombinedStyle()` → o cálculo de posição do `ShowcaseRenderer`;
     · `propsShift` — um deslocamento especial só para os blocos abaixo da grade
       de imóveis, que o editor desconhecia;
     · `mobileStack` — um empilhamento em coluna única que jogava fora as
       posições mobile salvas e publicava widgets a 100% de largura mesmo quando
       o editor mostrava 49%. Era a maior quebra de WYSIWYG do produto;
     · `widgetPos()` e a medição por `document.querySelector`.

   Tudo isso virou uma chamada a `useLayoutResolvido`.
   ──────────────────────────────────────────────────────────────────────────── */

export function ShowcasePage({ slugFixo }) {
  /* Em domínio próprio não há slug na URL — ele vem resolvido do host, por
     `slugFixo`. Nos endereços da Omnimob continua vindo da rota. */
  const { tenantSlug: slugDaRota } = useParams();
  const tenantSlug = slugFixo || slugDaRota;
  const location = useLocation();

  const [payload, setPayload] = useState(null);
  const [carouselIndexes, setCarouselIndexes] = useState({});
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [mode, setMode] = useState(() => modoDoViewport(window.innerWidth));

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      if (!tenantSlug) return;
      setCarregando(true);
      setErro("");
      try {
        const dados = await api.getPublicShowcase(tenantSlug);
        if (cancelado) return;
        setPayload(dados);
        setCachedTenant(tenantSlug, dados.tenant);
        const indices = {};
        (dados.properties || []).forEach((p) => { indices[p.id] = 0; });
        setCarouselIndexes(indices);
      } catch (err) {
        if (!cancelado) setErro(err.message);
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }
    carregar();
    return () => { cancelado = true; };
  }, [tenantSlug]);

  // O modo é decidido pelo MESMO limiar que o editor usa (ver `tema.js`).
  useEffect(() => {
    const aoRedimensionar = () => setMode(modoDoViewport(window.innerWidth));
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, []);

  useEffect(() => { loadShowcaseFonts(); }, []);

  // Após navegação SPA, rola até a seção do hash (#destaques / #footer).
  useEffect(() => {
    if (!payload || !location.hash) return;
    const el = document.getElementById(location.hash.slice(1));
    if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth" }));
  }, [payload, location.hash]);

  const tenant = payload?.tenant || {};
  const properties = payload?.properties || [];

  /* Memoizado porque é a entrada do `useLayoutResolvido`: um objeto novo a cada
     render reiniciaria a resolução em laço. */
  const config = useMemo(
    () => normalizeShowcaseConfig(tenant.showcaseConfig),
    [tenant.showcaseConfig]
  );

  const { layout, registrarPeca } = useLayoutResolvido({ config, mode });

  const nomeVitrine = tenant?.name;

  /* SEO. Precisa vir ANTES do retorno antecipado abaixo, porque hook não pode
     ser condicional. Sem isto toda vitrine seria indexada com o título e a
     descrição da Omnimob, competindo entre si pelas mesmas palavras em vez de
     cada uma aparecer pelo nome da própria imobiliária. */
  useSeo({
    titulo: nomeVitrine ? `${nomeVitrine} — Imóveis disponíveis` : "",
    descricao:
      tenant?.showcaseSubheadline ||
      (nomeVitrine
        ? `Veja os imóveis disponíveis na ${nomeVitrine}: fotos, localização e contato direto com a imobiliária.`
        : ""),
    // Em domínio próprio a vitrine É a raiz do site; nos endereços da Omnimob
    // ela vive sob /vitrine/:slug. O canonical precisa refletir o que vale ali.
    caminho: slugFixo ? "/" : `/vitrine/${tenantSlug}`,
    // A primeira foto do acervo diz mais numa prévia de link do que a marca da
    // Omnimob, que não é a dona desta página.
    imagem: properties?.[0]?.images?.[0]?.url,
  });

  if (!payload && !erro) {
    return <div style={{ minHeight: "100vh", background: "#0f172a" }} />;
  }

  const nome = nomeVitrine || tenantSlug?.toUpperCase() || "Omnimob";
  const vitrineTenant = { ...tenant, name: nome };
  const whatsappHref = linkWhatsApp(vitrineTenant);

  function proximaFoto(id, total) {
    setCarouselIndexes((prev) => ({ ...prev, [id]: ((prev[id] || 0) + 1) % total }));
  }
  function fotoAnterior(id, total) {
    setCarouselIndexes((prev) => ({ ...prev, [id]: ((prev[id] || 0) - 1 + total) % total }));
  }

  return (
    /* `dados` é o bloco de dados reais que a mesma resposta traz (equipe,
       endereço, números, regiões). Ele desce por contexto e não por prop
       porque os widgets estão a quatro níveis daqui, dentro do renderizador
       compartilhado — e passar de mão em mão até lá seria a porta para alguém
       resolver que é mais fácil o widget buscar sozinho. */
    <VitrineProvider modo="public" tenantSlug={tenantSlug} dados={payload?.vitrine}>
      <div className={`showcase-body ${classeDeAparencia(layout)}`} style={estiloDoTema(tenant, layout)}>
        <div
          className="showcase-container showcase-builder-canvas showcase-palco"
          style={{ minHeight: `${alturaDoConteudo(layout, mode)}px`, position: "relative" }}
        >
          <ShowcaseRenderer
            config={layout}
            mode={mode}
            tenant={vitrineTenant}
            tenantSlug={tenantSlug}
            properties={properties}
            carouselIndexes={carouselIndexes}
            onProxima={proximaFoto}
            onAnterior={fotoAnterior}
            carregando={carregando}
            erro={erro}
            whatsappHref={whatsappHref}
            envolverPeca={({ pieceId, estilo, temBanner, children }) => (
              <section
                key={pieceId}
                data-piece-id={pieceId}
                ref={registrarPeca(pieceId)}
                className={`showcase-layout-block${temBanner ? " showcase-section-has-bg" : ""}`}
                style={estilo}
              >
                {children}
              </section>
            )}
          />
        </div>
      </div>
    </VitrineProvider>
  );
}
