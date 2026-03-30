import { Link } from "react-router-dom";

export function PropertyList({ properties, onDelete, onToggleStatus, onEdit, disabled }) {
  return (
    <section className="glass-panel">
      <h2 style={{ marginBottom: "24px" }}>Portfólio Ativo</h2>
      {properties.length === 0 ? <p style={{ color: "var(--text-muted)" }}>Nenhum imóvel encontrado para este tenant.</p> : null}

      <div className="list">
        {properties.map((property) => (
          <article key={property.id} className="property-item glass-panel" style={{ padding: "20px" }}>
            <h3>{property.title}</h3>
            <p>{property.description}</p>
            <div style={{ margin: "16px 0", display: "grid", gap: "8px" }}>
              <p><strong>Preço:</strong> R$ {Number(property.price).toLocaleString("pt-BR")}</p>
              <p><strong>Endereço:</strong> {property.address}</p>
              <p>
                <strong>Bairro:</strong> {property.neighborhood || "-"} | <strong>Cidade/UF:</strong> {property.city || "-"} / {property.state || "-"}
              </p>
              <p>
                <strong>CEP:</strong> {property.cep || "-"} | <strong>Tipo:</strong> {property.propertyType || "-"}
              </p>
              <p>
                <strong>Quartos:</strong> {property.bedrooms ?? 0} | <strong>Suítes:</strong> {property.suites ?? 0} | <strong>Vagas:</strong> {property.parkingSpots ?? 0} | <strong>Metragem:</strong> {property.squareFootage || "-"}
              </p>
              <p><strong>Status:</strong> {property.status}</p>
            </div>
            
            <div className="chips">
              {(property.publications || []).map((pub) => (
                <span key={pub.id} className="chip">
                  {pub.channel}: {pub.status}
                </span>
              ))}
            </div>
            
            <div className="actions" style={{ marginTop: "20px" }}>
              <Link to={`/imoveis/${property.id}`} className="link-button">
                Painel do Imóvel
              </Link>
              <button className="button-secondary" onClick={() => onEdit(property)} disabled={disabled}>
                Editar
              </button>
              <button className="button-secondary" onClick={() => onToggleStatus(property.id, property.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")} disabled={disabled}>
                Alternar Status
              </button>
              <button style={{ background: "rgba(239, 68, 68, 0.2)", color: "#fca5a5", borderColor: "rgba(239, 68, 68, 0.3)" }} className="button-secondary" onClick={() => onDelete(property.id)} disabled={disabled}>
                Excluir
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}