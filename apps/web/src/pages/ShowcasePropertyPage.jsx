import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";

export function ShowcasePropertyPage() {
  const { tenantSlug, propertyId } = useParams();
  const [property, setProperty] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sendingInterest, setSendingInterest] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const [interestForm, setInterestForm] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  async function loadProperty() {
    if (!tenantSlug || !propertyId) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.getPublicPropertyById(tenantSlug, propertyId);
      setProperty(data.property);
      setTenant(data.tenant);
      setCarouselIndex(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProperty();
  }, [tenantSlug, propertyId]);

  async function handleInterest() {
    if (!tenantSlug || !propertyId) return;
    setSendingInterest(true);
    setSuccessMessage("");
    setError("");
    try {
      const response = await api.registerPublicInterest(tenantSlug, propertyId, interestForm);
      setProperty((prev) => {
        if (!prev) return prev;
        return { ...prev, leadCount: response.property.leadCount };
      });
      setSuccessMessage("Interesse enviado! A imobiliaria entrara em contato em breve.");
      setInterestForm({ name: "", email: "", phone: "", message: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingInterest(false);
    }
  }

  const images = property?.images?.length ? property.images : [{ url: "https://via.placeholder.com/1200x700?text=Imovel+Domus" }];
  const currentImage = images[carouselIndex]?.url;
  const whatsappHref =
    tenant?.whatsapp && property
      ? `https://wa.me/${String(tenant.whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(
          `Ola, tenho interesse no imovel "${property.title}" (${property.city}/${property.state}).`
        )}`
      : null;

  function nextImage() {
    setCarouselIndex((prev) => (prev + 1) % images.length);
  }

  function prevImage() {
    setCarouselIndex((prev) => (prev - 1 + images.length) % images.length);
  }

  return (
    <div className="showcase-body">
      <div className="showcase-container">
        <header className="showcase-header">
          <div className="showcase-brand">
            <div className="brand-logo-exclusive">{(tenant?.name || "D").charAt(0).toUpperCase()}</div>
            <div className="brand-title-group">
              <h1>{tenant?.name || tenantSlug}</h1>
              <p>Detalhes completos do imovel</p>
            </div>
          </div>
          <nav className="showcase-nav">
            <Link to={`/vitrine/${tenantSlug}`} className="nav-button" style={{ fontSize: "14px" }}>
              Voltar para vitrine
            </Link>
          </nav>
        </header>

        {error ? <div className="error">{error}</div> : null}
        {successMessage ? <div className="success-banner">{successMessage}</div> : null}
        {loading ? <p style={{ textAlign: "center", color: "var(--text-muted)" }}>Carregando detalhes do imovel...</p> : null}

        {!loading && property ? (
          <section className="property-detail-layout">
            <div className="property-detail-media">
              <img src={currentImage} alt={property.title} />
              {images.length > 1 ? (
                <>
                  <button type="button" className="carousel-btn prev" onClick={prevImage}>
                    ‹
                  </button>
                  <button type="button" className="carousel-btn next" onClick={nextImage}>
                    ›
                  </button>
                  <span className="carousel-counter">
                    {carouselIndex + 1}/{images.length}
                  </span>
                </>
              ) : null}
            </div>

            <div className="property-detail-info">
              <h2>{property.title}</h2>
              <p className="detail-price">
                R$ {Number(property.price).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <p className="detail-description">{property.description}</p>

              <div className="detail-feature-grid">
                <div><strong>Tipo:</strong> {property.propertyType}</div>
                <div><strong>Metragem:</strong> {property.squareFootage || "-"}</div>
                <div><strong>Quartos:</strong> {property.bedrooms || 0}</div>
                <div><strong>Suites:</strong> {property.suites || 0}</div>
                <div><strong>Vagas:</strong> {property.parkingSpots || 0}</div>
                <div><strong>CEP:</strong> {property.cep || "-"}</div>
              </div>

              <p className="detail-location">
                <strong>Localizacao:</strong> {property.address}, {property.neighborhood}, {property.city} - {property.state}
              </p>

              <div className="detail-cta-box">
                <p>Gostou deste imovel? Clique em "Tenho interesse" para receber atendimento da imobiliaria.</p>
                <div className="grid">
                  <input
                    placeholder="Seu nome"
                    value={interestForm.name}
                    onChange={(e) => setInterestForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                  <div className="grid grid-2">
                    <input
                      type="email"
                      placeholder="Seu email"
                      value={interestForm.email}
                      onChange={(e) => setInterestForm((prev) => ({ ...prev, email: e.target.value }))}
                    />
                    <input
                      placeholder="Seu WhatsApp"
                      value={interestForm.phone}
                      onChange={(e) => setInterestForm((prev) => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <textarea
                    placeholder="Mensagem (opcional)"
                    value={interestForm.message}
                    onChange={(e) => setInterestForm((prev) => ({ ...prev, message: e.target.value }))}
                    rows={3}
                  />
                </div>
                <button type="button" className="btn-interest" onClick={handleInterest} disabled={sendingInterest}>
                  {sendingInterest ? "Enviando..." : "Tenho interesse"}
                </button>
                {whatsappHref ? (
                  <a href={whatsappHref} target="_blank" rel="noreferrer" className="btn-view-details" style={{ marginTop: "10px" }}>
                    Chamar no WhatsApp
                  </a>
                ) : null}
                <small>Interessados registrados: {property.leadCount ?? 0}</small>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
