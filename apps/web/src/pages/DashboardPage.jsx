import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { PropertyForm } from "../components/PropertyForm";
import { PropertyList } from "../components/PropertyList";
import { uploadToCloudinary } from "../utils/uploadToCloudinary";

export function DashboardPage({ session, onLogout }) {
  const tenantSlug = session?.tenant?.slug || "";
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("create");
  const [editingProperty, setEditingProperty] = useState(null);

  const showcaseLink = useMemo(() => (tenantSlug ? `/vitrine/${tenantSlug}` : "#"), [tenantSlug]);
  const showcaseEditorLink = useMemo(() => (tenantSlug ? `/vitrine/${tenantSlug}/editar` : "#"), [tenantSlug]);
  const initialLetter = session?.tenant?.name?.charAt(0)?.toUpperCase() || "D";
  const userInitial = session?.user?.name?.charAt(0)?.toUpperCase() || "U";

  async function loadProperties() {
    if (!tenantSlug) {
      setProperties([]);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await api.listProperties(tenantSlug);
      setProperties(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProperties();
  }, [tenantSlug]);

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
        setActiveSection("list");
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
    setActiveSection("create");
  }

  function handleCancelEdit() {
    setEditingProperty(null);
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="tenant-logo">
            {initialLetter}
          </div>
          <div className="tenant-title-group">
            <h1>{session.tenant.name}</h1>
            <p>Infraestrutura Domus</p>
          </div>
        </div>

        <nav className="sidebar-nav" style={{ marginTop: "24px" }}>
          <button
            type="button"
            className={`nav-button ${activeSection === "create" ? "active" : ""}`}
            onClick={() => setActiveSection("create")}
          >
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Cadastrar Ativo
          </button>
          
          <button
            type="button"
            className={`nav-button ${activeSection === "list" ? "active" : ""}`}
            onClick={() => setActiveSection("list")}
          >
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Portfólio Ativo
          </button>
        </nav>

        <div className="sidebar-nav" style={{ marginTop: "32px" }}>
          <Link to={showcaseLink} className="button-secondary" target="_blank">
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Acessar site
          </Link>
          <Link to={showcaseEditorLink} className="button-secondary">
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Editar vitrine
          </Link>
          <button type="button" className="button-secondary" onClick={onLogout}>
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Encerrar Sessão
          </button>
        </div>

        <div className="user-profile">
          <div className="avatar">
            {userInitial}
          </div>
          <div className="user-details">
            <span className="user-name">{session.user.name}</span>
            <span className="user-role">Operador de Conta</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {error ? <div className="error">{error}</div> : null}
        {loading ? <p style={{ color: "var(--text-muted)", marginBottom: "16px" }}>Sincronizando dados...</p> : null}

        {activeSection === "create" ? (
          <PropertyForm
            onSubmit={handleCreateOrUpdateProperty}
            disabled={!tenantSlug || loading}
            initialData={editingProperty}
            onCancelEdit={handleCancelEdit}
          />
        ) : (
          <PropertyList
            properties={properties}
            onDelete={handleDelete}
            onToggleStatus={handleToggleStatus}
            onEdit={handleStartEdit}
            disabled={!tenantSlug || loading}
          />
        )}
      </main>
    </div>
  );
}