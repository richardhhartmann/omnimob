import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { PropertyManagement } from "../components/PropertyForm";
import { PropertyList } from "../components/PropertyList";
import { uploadToCloudinary } from "../utils/uploadToCloudinary";

// ─── Landing page ─────────────────────────────────────────────────────────────

function HomePage({ session }) {
  const navigate = useNavigate();
  const cargo = session?.usuario?.cargo;
  const tenantSlug = session?.tenant?.slug;
  const primeiroNome = session?.usuario?.nome?.split(" ")[0] || "Usuário";

  const cards = [
    cargo?.gerenciarImoveis && {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
      title: "Gerenciar Imóveis",
      description: "Adicione um novo ativo ao portfólio da imobiliária.",
      onClick: () => navigate("/?tab=create"),
      accent: "#6366f1",
    },
    cargo?.gerenciarImoveis && {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      title: "Portfólio Ativo",
      description: "Visualize e gerencie os imóveis cadastrados.",
      onClick: () => navigate("/?tab=list"),
      accent: "#6366f1",
    },
    cargo?.gerenciarLeads && {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      title: "Leads",
      description: "Acompanhe os contatos interessados nos imóveis.",
      onClick: () => navigate("/leads"),
      accent: "#10b981",
    },
    cargo?.gerenciarUsuarios && {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      title: "Usuários",
      description: "Gerencie os membros e acessos da equipe.",
      onClick: () => navigate("/usuarios"),
      accent: "#f59e0b",
    },
    cargo?.gerenciarCargos && {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      title: "Cargos",
      description: "Gerencie os cargos e permissões da equipe.",
      onClick: () => navigate("/cargos"),
      accent: "#e04212",
    },
    (cargo?.editarPagina || cargo?.gerenciarUsuarios) && {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
      title: "Configurações",
      description: "Dados legais, contato, endereço e identidade visual.",
      onClick: () => navigate("/configuracoes"),
      accent: "#64748b",
    },
    cargo?.editarPagina && {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      title: "Editar Vitrine",
      description: "Personalize a página pública da imobiliária.",
      onClick: () => navigate(`/vitrine/${tenantSlug}/editar`),
      accent: "#8b5cf6",
    },
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      ),
      title: "Ver Vitrine",
      description: "Veja sua página pública como um cliente veria.",
      onClick: () => window.open(`/vitrine/${tenantSlug}`, "_blank"),
      accent: "#475569",
    },
  ].filter(Boolean);

  return (
    <div style={{ animation: "fadeIn 0.4s ease-out" }}>
      <div className="glass-panel" style={{ marginBottom: "24px", padding: "32px 40px" }}>
        <h2 style={{ margin: "0 0 6px 0", fontSize: "26px", fontWeight: "700" }}>
          Olá, {primeiroNome}!
        </h2>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "15px" }}>
          {session?.tenant?.name} · {cargo?.descricao || "Operador"}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
        {cards.map((card) => (
          <button
            key={card.title}
            onClick={card.onClick}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "16px",
              padding: "28px 28px",
              borderRadius: "16px",
              cursor: "pointer",
              textAlign: "left",
              border: "1px solid rgba(255,255,255,0.1)",
              background: "linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)",
              color: "inherit",
              transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.border = `1px solid ${card.accent}55`;
              e.currentTarget.style.background = `linear-gradient(145deg, ${card.accent}14 0%, rgba(255,255,255,0.02) 100%)`;
              e.currentTarget.style.boxShadow = `0 12px 32px rgba(0,0,0,0.2)`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)";
              e.currentTarget.style.background = "linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div style={{
              padding: "12px",
              borderRadius: "12px",
              background: `${card.accent}22`,
              color: card.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              {card.icon}
            </div>
            <div>
              <div style={{ fontWeight: "600", fontSize: "16px", marginBottom: "6px" }}>{card.title}</div>
              <div style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.5" }}>{card.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Dashboard principal ──────────────────────────────────────────────────────

export function DashboardPage({ session }) {
  const tenantSlug = session?.tenant?.slug || "";
  const cargo = session?.usuario?.cargo;
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingProperty, setEditingProperty] = useState(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab");

  const showCreate = tab === "create" && cargo?.gerenciarImoveis;
  const showList = tab === "list" && cargo?.gerenciarImoveis;
  const showHome = !showCreate && !showList;

  async function loadProperties() {
    if (!tenantSlug) { setProperties([]); return; }
    setLoading(true);
    setError("");
    try {
      const result = await api.listProperties(tenantSlug);
      setProperties(result.properties ?? result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (showList || showCreate) loadProperties();
  }, [tenantSlug, tab]);

  async function handleCreateOrUpdateProperty(payload) {
    if (!tenantSlug) return;
    setLoading(true);
    setError("");
    try {
      const { imageFiles = [], ...propertyPayload } = payload;
      let targetPropertyId = null;

      if (editingProperty?.id) {
        const updated = await api.updateProperty(tenantSlug, editingProperty.id, propertyPayload);
        targetPropertyId = updated.id;
        setEditingProperty(null);
        setSearchParams({ tab: "list" });
      } else {
        const created = await api.createProperty(tenantSlug, propertyPayload);
        targetPropertyId = created.id;
      }

      if (targetPropertyId && imageFiles.length > 0) {
        for (const file of imageFiles) {
          const uploaded = await uploadToCloudinary(file);
          await api.addPropertyImage(tenantSlug, targetPropertyId, uploaded);
        }
      }

      await loadProperties();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(propertyId) {
    if (!tenantSlug) return;
    setLoading(true);
    setError("");
    try {
      await api.deleteProperty(tenantSlug, propertyId);
      await loadProperties();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus(propertyId, nextStatus) {
    if (!tenantSlug) return;
    setLoading(true);
    setError("");
    try {
      await api.updateProperty(tenantSlug, propertyId, { status: nextStatus });
      await loadProperties();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleStartEdit(property) {
    setEditingProperty(property);
    setSearchParams({ tab: "create" });
  }

  return (
    <>
      {error ? <div className="error">{error}</div> : null}

      {showHome && <HomePage session={session} />}

      {showCreate && (
        <PropertyManagement
          onSubmitProperty={handleCreateOrUpdateProperty}
          disabled={!tenantSlug || loading}
          initialData={editingProperty}
        />
      )}

      {showList && (
        <PropertyList
          properties={properties}
          onDelete={handleDelete}
          onToggleStatus={handleToggleStatus}
          onEdit={handleStartEdit}
          disabled={!tenantSlug || loading}
        />
      )}
    </>
  );
}
