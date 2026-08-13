import { useEffect, useRef, useState } from "react";
import { baseDaVitrine } from "../utils/enderecoVitrine";
import { useLocation, useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import {
  Buildings,
  SquaresFour,
  Users,
  UserCircle,
  UserSquare,
  Shield,
  GearSix,
  PencilSimple,
  ArrowSquareOut,
} from "@phosphor-icons/react";
import { api } from "../api";
import { PropertyManagement } from "../components/PropertyForm";
import { PropertyList } from "../components/PropertyList";
import { uploadToCloudinary } from "../utils/uploadToCloudinary";
import { spawnRipple } from "../utils/rippleDrop";
import { ReescritaEmMassa } from "../components/ReescritaEmMassa";
import { IconeRelatorios } from "../utils/iconesRelatorios";

// ─── Landing page ─────────────────────────────────────────────────────────────

function KpiCard({ label, value, accent, icon, loading }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "18px 20px", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
      <div style={{ width: "40px", height: "40px", borderRadius: "10px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${accent}22`, color: accent }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: "22px", fontWeight: 700, lineHeight: 1, color: loading ? "var(--text-muted)" : "inherit" }}>
          {loading ? "—" : value}
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>{label}</div>
      </div>
    </div>
  );
}

function HomePage({ session }) {
  const navigate = useNavigate();
  const cargo = session?.usuario?.cargo;
  const tenantSlug = session?.tenant?.slug;
  const primeiroNome = session?.usuario?.nome?.split(" ")[0] || "Usuário";

  const [kpis, setKpis] = useState(null);
  useEffect(() => {
    if (!tenantSlug) return;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    Promise.all([
      cargo?.gerenciarImoveis
        ? api.listProperties(tenantSlug, { limit: 500 }).catch(() => null)
        : Promise.resolve(null),
      cargo?.verRelatorios
        ? api.listLeads(tenantSlug, { page: 1, limit: 100 }).catch(() => null)
        : Promise.resolve(null),
    ]).then(([propsResult, leadsResult]) => {
      const props = propsResult?.properties ?? (Array.isArray(propsResult) ? propsResult : []);
      const activeProps = props.filter((p) => p.status === "ACTIVE").length;
      const allLeads = leadsResult?.leads ?? [];
      const totalLeads = leadsResult?.total ?? allLeads.length;
      const recentLeads = allLeads.filter((l) => new Date(l.createdAt).getTime() >= sevenDaysAgo).length;
      setKpis({ activeProps, totalLeads, recentLeads });
    });
  }, [tenantSlug]);

  const showKpis = cargo?.gerenciarImoveis || cargo?.verRelatorios;

  const cards = [
    cargo?.gerenciarImoveis && {
      icon: <Buildings size={32} weight="duotone" />,
      title: "Gerenciar Imóveis",
      description: "Adicione um novo ativo ao portfólio da imobiliária.",
      onClick: () => navigate("/imoveis/novo"),
      accent: "#6366f1",
    },
    cargo?.gerenciarImoveis && {
      icon: <SquaresFour size={32} weight="duotone" />,
      title: "Portfólio Ativo",
      description: "Visualize e gerencie os imóveis cadastrados.",
      onClick: () => navigate("/imoveis"),
      accent: "#6366f1",
    },
    /* Um atalho só para tudo que é acompanhamento — leads, relatório mensal,
       funil e comissões. Segue "Ver Relatórios": quem tem a permissão alcança a
       página inteira, e quem não tem não vê o atalho. */
    cargo?.verRelatorios && {
      icon: <IconeRelatorios size={32} weight="duotone" />,
      title: "Relatórios",
      description: "Leads, relatório mensal, funil de vendas e comissões.",
      onClick: () => navigate("/relatorios"),
      accent: "#10b981",
    },
    cargo?.gerenciarClientes && {
      icon: <UserCircle size={32} weight="duotone" />,
      title: "Clientes",
      description: "Gerencie os clientes cadastrados na imobiliária.",
      onClick: () => navigate("/clientes"),
      accent: "#06b6d4",
    },
    cargo?.gerenciarUsuarios && {
      icon: <UserSquare size={32} weight="duotone" />,
      title: "Usuários",
      description: "Gerencie os membros e acessos da equipe.",
      onClick: () => navigate("/usuarios"),
      accent: "#f59e0b",
    },
    cargo?.gerenciarCargos && {
      icon: <Shield size={32} weight="duotone" />,
      title: "Cargos",
      description: "Gerencie os cargos e permissões da equipe.",
      onClick: () => navigate("/cargos"),
      accent: "#e04212",
    },
    cargo?.verConfiguracoes && {
      icon: <GearSix size={32} weight="duotone" />,
      title: "Configurações",
      description: "Dados legais, contato, endereço e identidade visual.",
      onClick: () => navigate("/configuracoes"),
      accent: "#64748b",
    },
    cargo?.editarPagina && {
      icon: <PencilSimple size={32} weight="duotone" />,
      title: "Editar página",
      description: "Personalize a página pública da imobiliária.",
      onClick: () => navigate(`/vitrine/${tenantSlug}/editar`),
      accent: "#8b5cf6",
    },
    {
      icon: <ArrowSquareOut size={32} weight="duotone" />,
      title: "Ver página",
      description: "Veja sua página pública como um cliente veria.",
      // Endereço público de verdade: domínio da imobiliária quando existe.
      onClick: () => window.open(baseDaVitrine(session?.tenant), "_blank"),
      accent: "#475569",
    },
  ].filter(Boolean);

  return (
    <div style={{ animation: "fadeIn 0.4s ease-out" }}>
      <div data-tour="inicio-saudacao" style={{ marginBottom: "24px", padding: "32px 0px" }}>
        <h2 style={{ margin: "0 0 6px 0", fontSize: "26px", fontWeight: "700" }}>
          Olá, {primeiroNome}!
        </h2>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "15px" }}>
          {session?.tenant?.name} · {cargo?.descricao || "Operador"}
        </p>
      </div>

      <div data-tour="inicio-atalhos" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
        {cards.map((card) => (
          <button
            key={card.title}
            onClick={card.onClick}
            className="pg-follow"
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
              background: "linear-gradient(var(--pg-angle, 145deg), rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)",
              color: "inherit",
              transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.25s, box-shadow 0.25s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.border = `1px solid ${card.accent}55`;
              e.currentTarget.style.background = `radial-gradient(circle at var(--px, 50%) var(--py, 50%), ${card.accent}33 0%, transparent 90%), linear-gradient(var(--pg-angle, 145deg), ${card.accent}18 0%, rgba(255,255,255,0.02) 100%)`;
              e.currentTarget.style.boxShadow = `0 12px 32px rgba(0,0,0,0.2)`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)";
              e.currentTarget.style.background = "linear-gradient(var(--pg-angle, 145deg), rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)";
              e.currentTarget.style.boxShadow = "none";
            }}
            onMouseDown={(e) => {
              spawnRipple(e, card.accent);
              e.currentTarget.style.transform = "translateY(-1px) scale(0.975)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
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

// ─── Lista de imóveis ─────────────────────────────────────────────────────────

export function ImovelListPage({ session }) {
  const navigate = useNavigate();
  const ctx = useOutletContext();
  const showToast = ctx?.showToast;
  const tenantSlug = session?.tenant?.slug || "";
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  /* Só a PRIMEIRA carga avisa quantos imóveis vieram. `loadProperties` também
     roda depois de excluir, ativar e reescrever em massa — e essas ações já têm
     o toast delas. Sem esta trava, cada exclusão daria dois avisos seguidos: o
     da exclusão e um "12 imóveis carregados" logo atrás. */
  const jaContou = useRef(false);

  async function loadProperties() {
    if (!tenantSlug) { setProperties([]); return; }
    setLoading(true);
    setError("");
    try {
      const result = await api.listProperties(tenantSlug);
      const lista = result.properties ?? result;
      setProperties(lista);
      if (!jaContou.current) {
        jaContou.current = true;
        const n = lista.length;
        showToast?.(
          n === 0 ? "Nenhum imóvel cadastrado ainda."
          : n === 1 ? "1 imóvel carregado."
          : `${n} imóveis carregados.`,
        );
      }
    } catch (err) {
      setError(err.message);
      showToast?.(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadProperties(); }, [tenantSlug]);

  async function handleDelete(propertyId) {
    setLoading(true);
    setError("");
    try {
      await api.deleteProperty(tenantSlug, propertyId);
      await loadProperties();
      showToast?.("Imóvel excluído com sucesso.");
    } catch (err) {
      setError(err.message);
      showToast?.(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus(propertyId, nextStatus) {
    setLoading(true);
    setError("");
    try {
      await api.updateProperty(tenantSlug, propertyId, { status: nextStatus });
      await loadProperties();
      showToast?.(nextStatus === "ACTIVE" ? "Imóvel ativado." : "Imóvel desativado.");
    } catch (err) {
      setError(err.message);
      showToast?.(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  function handleStartEdit(property) {
    navigate("/imoveis/editar", { state: { editingProperty: property } });
  }

  return (
    <>
      {error ? <div className="error">{error}</div> : null}

      {/* Só no Premium — o componente devolve null nos outros planos. Fica
          acima da lista porque age sobre ela, e não sobre um imóvel. */}
      {properties.length > 0 ? (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "14px" }}>
          <ReescritaEmMassa
            session={session}
            properties={properties}
            aoConcluir={(salvos) => {
              loadProperties();
              showToast?.(
                salvos === 1 ? "1 descrição reescrita." : `${salvos} descrições reescritas.`,
              );
            }}
          />
        </div>
      ) : null}

      <PropertyList
        properties={properties}
        onDelete={handleDelete}
        onToggleStatus={handleToggleStatus}
        onEdit={handleStartEdit}
        onPublishSuccess={loadProperties}
        disabled={!tenantSlug || loading}
        loading={loading && properties.length === 0}
      />
    </>
  );
}

// ─── Formulário de imóvel (criar / editar) ────────────────────────────────────

export function ImovelFormPage({ session }) {
  const { state, pathname } = useLocation();
  const navigate = useNavigate();
  const ctx = useOutletContext();
  const showToast = ctx?.showToast;
  const tenantSlug = session?.tenant?.slug || "";
  const editingProperty = state?.editingProperty || null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // /imoveis/editar exige um imóvel no state. Sem ele (ex.: refresh da página),
  // volta para a lista em vez de mostrar o menu de "novo imóvel".
  useEffect(() => {
    if (pathname === "/imoveis/editar" && !editingProperty) {
      navigate("/imoveis", { replace: true });
    }
  }, [pathname, editingProperty, navigate]);

  async function handleSubmit(payload) {
    if (!tenantSlug) return null;
    setLoading(true);
    setError("");
    try {
      const { imageFiles = [], imageIs360 = [], ...propertyPayload } = payload;
      let targetPropertyId = null;

      if (editingProperty?.id) {
        const updated = await api.updateProperty(tenantSlug, editingProperty.id, propertyPayload);
        targetPropertyId = updated.id;
        showToast?.("Imóvel atualizado com sucesso!");
        navigate("/imoveis");
      } else {
        const created = await api.createProperty(tenantSlug, propertyPayload);
        targetPropertyId = created.id;
        showToast?.("Imóvel criado com sucesso!");
      }

      if (targetPropertyId && imageFiles.length > 0) {
        for (let i = 0; i < imageFiles.length; i++) {
          const uploaded = await uploadToCloudinary(imageFiles[i]);
          await api.addPropertyImage(tenantSlug, targetPropertyId, { ...uploaded, is360: Boolean(imageIs360[i]) });
        }
      }

      return targetPropertyId ? { id: targetPropertyId } : null;
    } catch (err) {
      setError(err.message);
      showToast?.(err.message, "error");
      return null;
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {error ? <div className="error">{error}</div> : null}
      <PropertyManagement
        onSubmitProperty={handleSubmit}
        disabled={!tenantSlug || loading}
        initialData={editingProperty}
      />
    </>
  );
}

// ─── Dashboard principal ──────────────────────────────────────────────────────

export function DashboardPage({ session }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Redireciona URLs legadas com ?tab= para as rotas novas
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "create") navigate("/imoveis/novo", { replace: true });
    else if (tab === "list") navigate("/imoveis", { replace: true });
  }, []);

  return <HomePage session={session} />;
}
