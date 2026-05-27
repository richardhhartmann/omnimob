 import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

function formatDate(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LeadsPage({ session }) {
  const tenantSlug = session?.tenant?.slug || "";
  const [data, setData] = useState({ leads: [], total: 0, page: 1, limit: 20 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState(null);

  async function loadLeads(p = 1) {
    if (!tenantSlug) return;
    setLoading(true);
    setError("");
    try {
      const result = await api.listLeads(tenantSlug, { page: p, limit: 20 });
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeads(page);
  }, [tenantSlug, page]);

  async function handleDelete(leadId) {
    if (!window.confirm("Remover este lead?")) return;
    setDeletingId(leadId);
    try {
      await api.deleteLead(tenantSlug, leadId);
      await loadLeads(page);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  const totalPages = Math.ceil(data.total / data.limit);

  return (
    <div className="main-content" style={{ maxWidth: "1100px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
        <div>
          <h1 style={{ fontSize: "28px", marginBottom: "8px" }}>Gestão de Leads</h1>
          <p style={{ color: "var(--text-muted)" }}>
            {data.total} lead{data.total !== 1 ? "s" : ""} captado{data.total !== 1 ? "s" : ""}
          </p>
        </div>
      </header>

      {error ? <div className="error">{error}</div> : null}
      {loading ? <p style={{ color: "var(--text-muted)", marginBottom: "16px" }}>Carregando leads...</p> : null}

      {!loading && data.leads.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: "center", padding: "48px" }}>
          <p style={{ color: "var(--text-muted)" }}>
            Nenhum lead registrado ainda. Quando visitantes manifestarem interesse pela vitrine, aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="glass-panel" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
                <th style={thStyle}>Imóvel</th>
                <th style={thStyle}>Nome</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>WhatsApp</th>
                <th style={thStyle}>Mensagem</th>
                <th style={thStyle}>Data</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {data.leads.map((lead) => (
                <tr key={lead.id} style={{ borderBottom: "1px solid var(--glass-border)" }}>
                  <td style={tdStyle}>
                    <Link
                      to={`/imoveis/${lead.property?.id}`}
                      style={{ color: "var(--accent)", textDecoration: "none", fontWeight: "500" }}
                    >
                      {lead.property?.title || "-"}
                    </Link>
                  </td>
                  <td style={tdStyle}>{lead.name || <span style={{ color: "var(--text-muted)" }}>-</span>}</td>
                  <td style={tdStyle}>
                    {lead.email ? (
                      <a href={`mailto:${lead.email}`} style={{ color: "var(--accent)", textDecoration: "none" }}>
                        {lead.email}
                      </a>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>-</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    {lead.phone ? (
                      <a
                        href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "var(--accent)", textDecoration: "none" }}
                      >
                        {lead.phone}
                      </a>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>-</span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {lead.message || <span style={{ color: "var(--text-muted)" }}>-</span>}
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap", color: "var(--text-muted)" }}>
                    {formatDate(lead.createdAt)}
                  </td>
                  <td style={tdStyle}>
                    <button
                      type="button"
                      className="button-secondary"
                      style={{ padding: "4px 12px", fontSize: "13px", borderColor: "var(--error)", color: "var(--error)" }}
                      onClick={() => handleDelete(lead.id)}
                      disabled={deletingId === lead.id}
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <div style={{ display: "flex", gap: "8px", marginTop: "16px", justifyContent: "center" }}>
          <button
            type="button"
            className="button-secondary"
            style={{ width: "auto", padding: "8px 16px" }}
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </button>
          <span style={{ display: "flex", alignItems: "center", color: "var(--text-muted)", fontSize: "14px" }}>
            Página {page} de {totalPages}
          </span>
          <button
            type="button"
            className="button-secondary"
            style={{ width: "auto", padding: "8px 16px" }}
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </button>
        </div>
      ) : null}
    </div>
  );
}

const thStyle = {
  textAlign: "left",
  padding: "10px 16px",
  fontWeight: "600",
  color: "var(--text-muted)",
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const tdStyle = {
  padding: "12px 16px",
  verticalAlign: "middle",
};
