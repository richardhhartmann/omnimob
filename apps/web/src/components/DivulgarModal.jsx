import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api.js";
import { loadSession } from "../session.js";
import { planoLiberaIA } from "../utils/planos.js";
import { overlay360 } from "../utils/cloudinaryOverlay.js";
import { shareWhatsapp } from "../utils/shareWhatsapp.js";
import { useConfirm } from "./ConfirmModal";
import {
  FacebookPreview, InstagramPreview, WhatsAppPreview, PostSimCard, RepublishModal,
  FB_ICON, IG_ICON, WA_ICON,
} from "./PropertyForm.jsx";

const pubBtnBase = { padding: "11px 16px", borderRadius: "9px", fontSize: "13px", fontWeight: 600, color: "#fff", border: "none", width: "100%", textAlign: "center", cursor: "pointer" };

// Modal de divulgação com a MESMA experiência do step "Divulgar" do cadastro:
// prévias editáveis por rede (Facebook / Instagram / WhatsApp), publicar/republicar,
// posts ativos com métricas reais e geração de texto por IA por rede.
export function DivulgarModal({ property, tenantSlug, onClose, onSuccess }) {
  const { confirm, modal: confirmModal } = useConfirm();
  const session = loadSession();
  const cargo = session?.usuario?.cargo;
  const canUseIA = planoLiberaIA(session?.tenant?.plano);

  const [captions, setCaptions] = useState({ facebook: "", instagram: "", whatsapp: "" });
  const [coverUrls, setCoverUrls] = useState([]);
  const [socialStatus, setSocialStatus] = useState(null);
  const [publishLoading, setPublishLoading] = useState({ facebook: false, instagram: false });
  const [publishResults, setPublishResults] = useState({});
  const [publications, setPublications] = useState(() => (property.publications || []).filter((p) => p.status === "PUBLISHED"));
  const [removingId, setRemovingId] = useState(null);
  const [republishAsk, setRepublishAsk] = useState(null);
  const [expandedPostId, setExpandedPostId] = useState(null);
  const [postInsights, setPostInsights] = useState({});
  const [removeNote, setRemoveNote] = useState({});
  const [descHover, setDescHover] = useState(null);
  const [redeIaLoading, setRedeIaLoading] = useState({});
  const [redeIaErro, setRedeIaErro] = useState({});

  // Trava a rolagem da página enquanto o modal está aberto — assim a rolagem vai
  // toda para o conteúdo do modal, sem "vazar" para o portfólio atrás.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    // Legenda base a partir dos dados do imóvel (igual à do cadastro).
    const price = Number(property.price);
    const priceStr = price > 0 ? `R$ ${price.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "";
    const location = [property.neighborhood, property.city, property.state].filter(Boolean).join(", ");
    const isComercial = property.finalidade === "COMERCIAL";
    const stats = [
      isComercial
        ? (property.salas ? `${property.salas} sala${property.salas !== 1 ? "s" : ""}` : "")
        : (property.bedrooms ? `${property.bedrooms} quarto${property.bedrooms !== 1 ? "s" : ""}` : ""),
      isComercial && property.banheiros ? `${property.banheiros} banheiro${property.banheiros !== 1 ? "s" : ""}` : "",
      property.squareFootage ? `${property.squareFootage} m²` : "",
      property.parkingSpots ? `${property.parkingSpots} vaga${property.parkingSpots !== 1 ? "s" : ""}` : "",
    ].filter(Boolean).join(" · ");
    const atribs = property.atributos?.map((a) => a.atributo?.descricao).filter(Boolean) || [];
    const vitrineUrl = `${window.location.origin}/vitrine/${tenantSlug}/imovel/${property.id}`;
    const whatsapp = session?.tenant?.whatsapp || "";
    const lines = [
      `🏠 ${property.title}`,
      location ? `📍 ${location}` : "",
      priceStr ? `💰 ${priceStr}` : "",
      stats ? `📐 ${stats}` : "",
      atribs.length > 0 ? `✅ ${atribs.join(" · ")}` : "",
      property.aceitaPermuta ? "🔄 Aceita permuta" : "",
      "",
      property.description || "",
      "",
      `🔗 Ver detalhes: ${vitrineUrl}`,
      whatsapp ? `📲 Contato: ${whatsapp}` : "",
    ].filter((l, i, arr) => !(l === "" && arr[i - 1] === ""));
    const base = lines.join("\n").trim();
    setCaptions({ facebook: base, instagram: base, whatsapp: base });

    api.getSocialStatus(tenantSlug).then(setSocialStatus).catch(() => {});
    // Reconcilia com as redes: se o post foi apagado manualmente, o status some.
    api.reconcileProperty(tenantSlug, property.id)
      .then((data) => setPublications((data.publications || []).filter((p) => p.status === "PUBLISHED")))
      .catch(() => {});
    // Fotos: 360° recebem a faixa gravada (mesma do post real).
    api.listPropertyImages(tenantSlug, property.id)
      .then((imgs) => setCoverUrls((imgs || []).map((i) => (i.is360 ? overlay360(i.url) : i.url)).filter(Boolean)))
      .catch(() => setCoverUrls([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property.id]);

  async function refreshPublications() {
    try {
      const list = await api.listPublications(tenantSlug, property.id);
      setPublications((Array.isArray(list) ? list : []).filter((p) => p.status === "PUBLISHED"));
    } catch { /* mantém o estado atual */ }
  }

  async function handleGerarRedeIA(rede) {
    setRedeIaErro((prev) => ({ ...prev, [rede]: "" }));
    setRedeIaLoading((prev) => ({ ...prev, [rede]: true }));
    try {
      const { resultados, erros } = await api.gerarConteudoPropertyIA(tenantSlug, property.id, [rede]);
      if (resultados?.[rede]) setCaptions((prev) => ({ ...prev, [rede]: resultados[rede] }));
      else setRedeIaErro((prev) => ({ ...prev, [rede]: erros?.[rede] || "A IA não retornou um texto." }));
    } catch (err) {
      setRedeIaErro((prev) => ({ ...prev, [rede]: err.message || "Não foi possível gerar o texto." }));
    } finally {
      setRedeIaLoading((prev) => ({ ...prev, [rede]: false }));
    }
  }

  async function handlePublish(platform, replace = false) {
    setRepublishAsk(null);
    setPublishLoading((prev) => ({ ...prev, [platform]: true }));
    setPublishResults((prev) => { const next = { ...prev }; delete next[platform]; return next; });
    setRemoveNote((prev) => ({ ...prev, [platform]: "" }));
    try {
      const result = await api.publishProperty(tenantSlug, property.id, { platforms: [platform], caption: captions[platform] ?? "", replace });
      const r = result?.[platform];
      if (r) setPublishResults((prev) => ({ ...prev, [platform]: r }));
      if (r?.note) setRemoveNote((prev) => ({ ...prev, [platform]: r.note }));
      await refreshPublications();
      if (r?.success) onSuccess?.();
    } catch (err) {
      setPublishResults((prev) => ({ ...prev, [platform]: { success: false, error: err.message } }));
    } finally {
      setPublishLoading((prev) => ({ ...prev, [platform]: false }));
    }
  }

  // Se já existe post nesta rede, pergunta manter+novo ou substituir; senão publica direto.
  function onPublishClick(platform) {
    const channel = platform === "facebook" ? "FACEBOOK" : "INSTAGRAM";
    const jaTem = publications.some((p) => p.channel === channel);
    if (jaTem) setRepublishAsk(platform);
    else handlePublish(platform, false);
  }

  function togglePost(pub) {
    const willOpen = expandedPostId !== pub.id;
    setExpandedPostId(willOpen ? pub.id : null);
    if (willOpen && !postInsights[pub.id]) {
      setPostInsights((prev) => ({ ...prev, [pub.id]: { loading: true } }));
      api.getPublicationInsights(tenantSlug, pub.id)
        .then((data) => setPostInsights((prev) => ({ ...prev, [pub.id]: { loading: false, ...data } })))
        .catch(() => setPostInsights((prev) => ({ ...prev, [pub.id]: { loading: false, likes: 0, comments: 0, shares: null, available: false } })));
    }
  }

  async function handleRemovePost(pub) {
    const nome = pub.channel === "FACEBOOK" ? "Facebook" : pub.channel === "INSTAGRAM" ? "Instagram" : "WhatsApp";
    if (!await confirm(`Remover este post do ${nome}?`, "Remover")) return;
    const platformKey = pub.channel.toLowerCase();
    setRemovingId(pub.id);
    setRemoveNote((prev) => ({ ...prev, [platformKey]: "" }));
    try {
      const [result] = await Promise.all([
        api.removePublicationById(tenantSlug, pub.id),
        new Promise((r) => setTimeout(r, 400)),
      ]);
      if (result?.note) setRemoveNote((prev) => ({ ...prev, [platformKey]: result.note }));
      await refreshPublications();
      onSuccess?.();
    } catch (err) {
      setRemoveNote((prev) => ({ ...prev, [platformKey]: err.message }));
    } finally {
      setRemovingId(null);
    }
  }

  function handleWhatsApp() {
    const vitrineUrl = `${window.location.origin}/vitrine/${tenantSlug}/imovel/${property.id}`;
    const text = captions.whatsapp || `🏠 ${property.title}\n🔗 ${vitrineUrl}`;
    shareWhatsapp({ text, imageUrls: coverUrls, title: property.title });
  }

  const fbPosts = publications.filter((p) => p.channel === "FACEBOOK");
  const igPosts = publications.filter((p) => p.channel === "INSTAGRAM");

  return createPortal(
    <>
      {confirmModal}
      <RepublishModal
        platform={republishAsk}
        onKeep={() => handlePublish(republishAsk, false)}
        onReplace={() => handlePublish(republishAsk, true)}
        onCancel={() => setRepublishAsk(null)}
      />
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", animation: "fadeIn 0.15s ease-out" }}
        onClick={onClose}
      >
        <div
          className="input-scroll"
          style={{ background: "rgba(18,18,30,0.99)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "20px", padding: "24px 28px", width: "100%", maxWidth: "1120px", maxHeight: "92vh", overflowY: "auto", overscrollBehavior: "contain" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
            <div>
              <div style={{ fontSize: "18px", fontWeight: "700" }}>Divulgar Imóvel</div>
            </div>
            <button onClick={onClose} aria-label="Fechar"
              style={{ width: "32px", height: "32px", padding: 0, background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "var(--text-muted)", cursor: "pointer", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <p style={{ margin: "0 0 4px", fontSize: "13px", color: "var(--text-muted)" }}>
            Edite o texto de cada rede e publique. As prévias mostram como o post vai ficar.
          </p>

          {!cargo?.publicarRedes && (
            <div style={{ marginTop: "12px", padding: "10px 14px", borderRadius: "10px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", fontSize: "13px", color: "#fbbf24" }}>
              Você não tem permissão para publicar nas redes sociais.
            </div>
          )}

          <div className="divulgar-grid">
            {cargo?.publicarRedes && (
              <FacebookPreview
                nome={session?.tenant?.name}
                avatarUrl={session?.tenant?.logoUrl || null}
                coverUrls={coverUrls}
                caption={captions.facebook}
                onChange={(v) => setCaptions((p) => ({ ...p, facebook: v }))}
                descActive={descHover === "facebook"}
                onDescEnter={() => setDescHover("facebook")}
                onDescLeave={() => setDescHover(null)}
                onGerarIA={canUseIA ? () => handleGerarRedeIA("facebook") : undefined}
                iaLoading={redeIaLoading.facebook}
                iaErro={redeIaErro.facebook}
                statusText={socialStatus === null ? "Verificando…" : socialStatus.facebook.connected ? socialStatus.facebook.pageName : "Não conectado"}
                published={fbPosts.length > 0}
                publishedCount={fbPosts.length}
                publishing={publishLoading.facebook}
                locked={socialStatus !== null && !socialStatus.facebook.connected}
                lockLabel="Conecte sua Página do Facebook em Configurações para publicar aqui."
                acao={
                  <button type="button" className="divulgar-pub" onClick={() => onPublishClick("facebook")} disabled={!socialStatus?.facebook?.connected || publishLoading.facebook}
                    style={{ ...pubBtnBase, background: "#1877f2", cursor: socialStatus?.facebook?.connected ? "pointer" : "not-allowed", opacity: socialStatus?.facebook?.connected ? 1 : 0.4 }}>
                    {publishLoading.facebook ? "Publicando…" : fbPosts.length > 0 ? "Publicar novamente" : "Publicar"}
                  </button>
                }
              />
            )}

            {cargo?.publicarRedes && (
              <InstagramPreview
                nome={session?.tenant?.name}
                avatarUrl={session?.tenant?.logoUrl || null}
                coverUrls={coverUrls}
                caption={captions.instagram}
                onChange={(v) => setCaptions((p) => ({ ...p, instagram: v }))}
                descActive={descHover === "instagram"}
                onDescEnter={() => setDescHover("instagram")}
                onDescLeave={() => setDescHover(null)}
                onGerarIA={canUseIA ? () => handleGerarRedeIA("instagram") : undefined}
                iaLoading={redeIaLoading.instagram}
                iaErro={redeIaErro.instagram}
                statusText={socialStatus === null ? "Verificando…" : socialStatus.instagram.connected ? "Conta conectada" : "Não conectado"}
                published={igPosts.length > 0}
                publishedCount={igPosts.length}
                publishing={publishLoading.instagram}
                locked={socialStatus !== null && !socialStatus.instagram.connected}
                lockLabel="Conecte sua conta do Instagram em Configurações para publicar aqui."
                acao={
                  <button type="button" className="divulgar-pub" onClick={() => onPublishClick("instagram")} disabled={!socialStatus?.instagram?.connected || publishLoading.instagram}
                    style={{ ...pubBtnBase, background: "linear-gradient(135deg, #f09433, #dc2743, #bc1888)", cursor: socialStatus?.instagram?.connected ? "pointer" : "not-allowed", opacity: socialStatus?.instagram?.connected ? 1 : 0.4 }}>
                    {publishLoading.instagram ? "Publicando…" : igPosts.length > 0 ? "Publicar novamente" : "Publicar"}
                  </button>
                }
              />
            )}

            <WhatsAppPreview
              nome={session?.tenant?.name}
              avatarUrl={session?.tenant?.logoUrl || null}
              coverUrls={coverUrls}
              caption={captions.whatsapp}
              onChange={(v) => setCaptions((p) => ({ ...p, whatsapp: v }))}
              descActive={descHover === "whatsapp"}
              onDescEnter={() => setDescHover("whatsapp")}
              onDescLeave={() => setDescHover(null)}
              onGerarIA={canUseIA ? () => handleGerarRedeIA("whatsapp") : undefined}
              iaLoading={redeIaLoading.whatsapp}
              iaErro={redeIaErro.whatsapp}
              statusText="Sempre disponível"
              acao={
                <button type="button" className="divulgar-pub btn-whatsapp" onClick={handleWhatsApp} style={{ ...pubBtnBase, background: "#25d366", cursor: "pointer" }}>
                  Compartilhar
                </button>
              }
            />
          </div>

          {(publishResults.facebook?.error || publishResults.instagram?.error) && (
            <div style={{ padding: "12px 16px", borderRadius: "10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", fontSize: "13px", color: "#f87171", display: "flex", flexDirection: "column", gap: "4px", marginBottom: "12px" }}>
              {publishResults.facebook?.error && <span>Facebook: {publishResults.facebook.error}</span>}
              {publishResults.instagram?.error && <span>Instagram: {publishResults.instagram.error}</span>}
            </div>
          )}

          {(removeNote.facebook || removeNote.instagram) && (
            <div style={{ padding: "12px 16px", borderRadius: "10px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", fontSize: "13px", color: "#fbbf24", display: "flex", flexDirection: "column", gap: "4px", marginBottom: "12px" }}>
              {removeNote.facebook && <span>{removeNote.facebook}</span>}
              {removeNote.instagram && <span>{removeNote.instagram}</span>}
            </div>
          )}

          {publications.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                Publicações ativas ({publications.length})
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {publications.map((pub) => {
                  const isFb = pub.channel === "FACEBOOK";
                  const isIg = pub.channel === "INSTAGRAM";
                  const label = isFb ? "Facebook" : isIg ? "Instagram" : "WhatsApp";
                  const brandBg = isFb ? "#1877f2" : isIg ? "linear-gradient(135deg,#f09433,#dc2743,#bc1888)" : "#25d366";
                  const brandIcon = isFb ? FB_ICON : isIg ? IG_ICON : WA_ICON;
                  const removing = removingId === pub.id;
                  const isOpen = expandedPostId === pub.id;
                  const data = pub.createdAt
                    ? new Date(pub.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "";
                  const captionReal = pub.caption ?? captions[pub.channel.toLowerCase()] ?? "";
                  return (
                    <div key={pub.id} style={{
                      borderRadius: "10px", border: `1px solid ${isOpen ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.08)"}`,
                      background: "rgba(255,255,255,0.03)", overflow: "hidden",
                      transition: "border-color 0.15s",
                      animation: removing ? "divulgar-post-out 0.4s ease forwards" : undefined,
                    }}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => togglePost(pub)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); togglePost(pub); } }}
                        title="Ver como ficou o post"
                        style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", cursor: "pointer" }}
                      >
                        <span style={{ width: "34px", height: "34px", borderRadius: "9px", background: brandBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}>
                          <span style={{ display: "flex", transform: "scale(0.72)" }}>{brandIcon}</span>
                        </span>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0, flex: 1 }}>
                          <span style={{ fontSize: "13px", fontWeight: 600 }}>{label}</span>
                          {data && <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Publicado em {data}</span>}
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-muted)", flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.25s ease" }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                        <button
                          type="button"
                          className="btn-danger"
                          onClick={(e) => { e.stopPropagation(); handleRemovePost(pub); }}
                          disabled={removing}
                          title="Remover publicação"
                          aria-label="Remover publicação"
                          style={{
                            width: "34px", height: "34px", borderRadius: "9px", flexShrink: 0, padding: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)",
                            cursor: removing ? "default" : "pointer", opacity: removing ? 0.6 : 1, transition: "background 0.15s, color 0.15s",
                          }}
                          onMouseEnter={(e) => { if (removing) return; e.currentTarget.style.background = "rgba(239,68,68,0.22)"; e.currentTarget.style.color = "#fca5a5"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; e.currentTarget.style.color = "#f87171"; }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                          </svg>
                        </button>
                      </div>
                      {/* Dropdown: abre/fecha animando a altura (grid-template-rows 0fr→1fr) */}
                      <div style={{ display: "grid", gridTemplateRows: isOpen ? "1fr" : "0fr", transition: "grid-template-rows 0.32s ease" }}>
                        <div style={{ minHeight: 0, overflow: "hidden" }}>
                          <div style={{ padding: "0 10px 10px" }}>
                            <PostSimCard
                              pub={pub}
                              coverUrls={coverUrls}
                              caption={captionReal}
                              insights={postInsights[pub.id]}
                              nome={session?.tenant?.name}
                              avatarUrl={session?.tenant?.logoUrl || null}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
