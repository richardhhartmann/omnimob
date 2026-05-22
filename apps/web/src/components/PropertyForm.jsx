import { useEffect, useState } from "react";

export const INITIAL_PROPERTY_TYPES = [
  "Casa",
  "Apartamento",
  "Cobertura",
  "Studio",
  "Terreno",
  "Comercial",
  "Sala Comercial",
  "Casa em Condominio",
];

const EMPTY = {
  cep: "",
  title: "",
  description: "",
  price: "",
  address: "",
  neighborhood: "",
  city: "",
  state: "",
  propertyType: "",
  bedrooms: "",
  parkingSpots: "",
  suites: "",
  squareFootage: "",

  status: "DRAFT",
};

function formatCep(value) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function formatCurrencyBRL(rawValue) {
  const digits = rawValue.replace(/\D/g, "");
  if (!digits) return "";
  const amount = Number(digits) / 100;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
}

function parseCurrencyBRL(rawValue) {
  const digits = rawValue.replace(/\D/g, "");
  if (!digits) return NaN;
  return Number(digits) / 100;
}

export function PropertyManagement({ onSubmitProperty, onSubmitType, disabled, initialData }) {
  const [view, setView] = useState(initialData?.id ? "PROPERTY" : "MENU");
  const [propertyTypes, setPropertyTypes] = useState(INITIAL_PROPERTY_TYPES);

  return (
    <div className="management-container">
      {view === "MENU" && (
        <div className="glass-panel" style={{ textAlign: "center", padding: "56px 40px", animation: "fadeIn 0.4s ease-out" }}>
          <h2 style={{ marginBottom: "8px", fontSize: "28px", fontWeight: "700" }}>Gerenciamento de Ativos</h2>
          <p style={{ marginBottom: "48px", color: "var(--text-muted)", fontSize: "16px" }}>
            Selecione o tipo de cadastro que deseja realizar no sistema.
          </p>

          <div className="grid grid-2" style={{ gap: "32px", maxWidth: "800px", margin: "0 auto" }}>
            <button
              onClick={() => setView("PROPERTY")}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "48px 32px",
                borderRadius: "24px",
                cursor: "pointer",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                background: "linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 100%)",
                backdropFilter: "blur(12px)",
                color: "inherit",
                gap: "24px"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-6px)";
                e.currentTarget.style.border = "1px solid rgba(255, 255, 255, 0.3)";
                e.currentTarget.style.background = "linear-gradient(145deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 100%)";
                e.currentTarget.style.boxShadow = "0 20px 40px rgba(0, 0, 0, 0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.border = "1px solid rgba(255, 255, 255, 0.15)";
                e.currentTarget.style.background = "linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 100%)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{
                background: "rgba(255,255,255,0.1)",
                padding: "20px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "inset 0 2px 4px rgba(255,255,255,0.1)"
              }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ fontSize: "22px", fontWeight: "600", letterSpacing: "-0.5px" }}>Novo Imóvel</span>
                <span style={{ fontSize: "14px", opacity: 0.7, fontWeight: "400", lineHeight: "1.5" }}>
                  Cadastre propriedades, defina valores, envie fotos e gerencie as informações.
                </span>
              </div>
            </button>

            <button
              onClick={() => setView("TYPE")}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "48px 32px",
                borderRadius: "24px",
                cursor: "pointer",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                background: "linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 100%)",
                backdropFilter: "blur(12px)",
                color: "inherit",
                gap: "24px"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-6px)";
                e.currentTarget.style.border = "1px solid rgba(255, 255, 255, 0.3)";
                e.currentTarget.style.background = "linear-gradient(145deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 100%)";
                e.currentTarget.style.boxShadow = "0 20px 40px rgba(0, 0, 0, 0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.border = "1px solid rgba(255, 255, 255, 0.15)";
                e.currentTarget.style.background = "linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 100%)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{
                background: "rgba(255,255,255,0.1)",
                padding: "20px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "inset 0 2px 4px rgba(255,255,255,0.1)"
              }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                  <line x1="7" y1="7" x2="7.01" y2="7" />
                </svg>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ fontSize: "22px", fontWeight: "600", letterSpacing: "-0.5px" }}>Categoria de Imóvel</span>
                <span style={{ fontSize: "14px", opacity: 0.7, fontWeight: "400", lineHeight: "1.5" }}>
                  Adicione novas tipologias ao sistema para categorizar seu portfólio.
                </span>
              </div>
            </button>
          </div>
        </div>
      )}

      {view === "PROPERTY" && (
        <PropertyForm
          onSubmit={onSubmitProperty}
          disabled={disabled}
          initialData={initialData}
          onCancelEdit={() => setView("MENU")}
          availableTypes={propertyTypes}
        />
      )}

      {view === "TYPE" && (
        <PropertyTypeForm
          onSave={(newType) => {
            setPropertyTypes((prev) => [...prev, newType]);
            if (onSubmitType) onSubmitType(newType);
            setView("MENU");
          }}
          onCancel={() => setView("MENU")}
          disabled={disabled}
        />
      )}
    </div>
  );
}

export function PropertyTypeForm({ onSave, onCancel, disabled }) {
  const [newType, setNewType] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newType.trim()) {
      onSave(newType.trim());
      setNewType("");
    }
  };

  return (
    <section className="glass-panel" style={{ animation: "fadeIn 0.3s ease-in-out" }}>
      <h2 style={{ marginBottom: "24px" }}>Nova Categoria de Imóvel</h2>
      <form className="grid" onSubmit={handleSubmit}>
        <input
          placeholder="Ex: Chácara, Galpão, Loja..."
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
          required
          disabled={disabled}
        />
        <div className="actions" style={{ marginTop: "24px" }}>
          <button type="submit" disabled={disabled || !newType.trim()}>
            Salvar Categoria
          </button>
          <button type="button" className="button-secondary" onClick={onCancel} disabled={disabled}>
            Voltar ao Menu
          </button>
        </div>
      </form>
    </section>
  );
}

export function PropertyForm({ onSubmit, disabled, initialData, onCancelEdit, availableTypes = INITIAL_PROPERTY_TYPES }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [imageFiles, setImageFiles] = useState([]);
  const isEditing = Boolean(initialData?.id);

  useEffect(() => {
    if (!initialData) {
      setForm(EMPTY);
      setImageFiles([]);
      return;
    }

    setForm({
      cep: formatCep(initialData.cep || ""),
      title: initialData.title || "",
      description: initialData.description || "",
      price: formatCurrencyBRL(String(initialData.price ?? "")),
      address: initialData.address || "",
      neighborhood: initialData.neighborhood || "",
      city: initialData.city || "",
      state: initialData.state || "",
      propertyType: initialData.propertyType || "",
      bedrooms: initialData.bedrooms != null ? String(initialData.bedrooms) : "",
      parkingSpots: initialData.parkingSpots != null ? String(initialData.parkingSpots) : "",
      suites: initialData.suites != null ? String(initialData.suites) : "",
      squareFootage: initialData.squareFootage != null ? String(initialData.squareFootage) : "",
      status: initialData.status || "DRAFT",
    });
    setImageFiles([]);
  }, [initialData]);

  async function handleCepBlur() {
    const cleanCep = String(form.cep || "").replace(/\D/g, "");
    if (cleanCep.length !== 8) {
      return;
    }

    setCepLoading(true);
    setError("");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      if (!response.ok) {
        throw new Error("Falha ao consultar CEP.");
      }

      const data = await response.json();
      if (data.erro) {
        throw new Error("CEP não encontrado.");
      }

      const street = [data.logradouro, data.complemento].filter(Boolean).join(" - ");
      setForm((prev) => ({
        ...prev,
        cep: formatCep(cleanCep),
        address: street || prev.address,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
      }));
    } catch (err) {
      setError(err.message || "Não foi possível buscar o CEP.");
    } finally {
      setCepLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const normalizedPrice = parseCurrencyBRL(String(form.price));
    if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
      setError("Preço inválido. Use um número maior que zero.");
      return;
    }

    const normalizedBedrooms = Number(form.bedrooms);
    const normalizedParkingSpots = Number(form.parkingSpots);
    const normalizedSuites = Number(form.suites);

    if ([normalizedBedrooms, normalizedParkingSpots, normalizedSuites].some((v) => !Number.isInteger(v) || v < 0)) {
      setError("Quartos, vagas e suítes devem ser números inteiros maiores ou iguais a zero.");
      return;
    }

    const normalizedSquareFootage = parseFloat(form.squareFootage);
    if (!Number.isFinite(normalizedSquareFootage) || normalizedSquareFootage <= 0) {
      setError("Metragem invalida. Use um numero maior que zero.");
      return;
    }

    await onSubmit({
      ...form,
      cep: form.cep.replace(/\D/g, ""),
      price: normalizedPrice,
      bedrooms: normalizedBedrooms,
      parkingSpots: normalizedParkingSpots,
      suites: normalizedSuites,
      squareFootage: normalizedSquareFootage,
      imageFiles,
    });
    if (!isEditing) {
      setForm(EMPTY);
      setImageFiles([]);
    }
  }

  return (
    <section className="glass-panel" style={{ animation: "fadeIn 0.3s ease-in-out" }}>
      <h2 style={{ marginBottom: "24px" }}>{isEditing ? "Editar Ativo" : "Novo Ativo"}</h2>
      {error ? <div className="error">{error}</div> : null}
      <form className="grid" onSubmit={handleSubmit}>
        <input
          placeholder="CEP (opcional, preenche endereço automático)"
          value={form.cep}
          onChange={(e) => setForm((prev) => ({ ...prev, cep: formatCep(e.target.value) }))}
          onBlur={handleCepBlur}
          maxLength={9}
          disabled={disabled || cepLoading}
        />
        {cepLoading ? <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Consultando...</p> : null}
        <input
          placeholder="Título do Imóvel"
          value={form.title}
          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          minLength={3}
          required
          disabled={disabled}
        />
        <textarea
          placeholder="Descrição detalhada"
          value={form.description}
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          minLength={10}
          required
          disabled={disabled}
          rows={4}
        />
        <input
          placeholder="Preço (R$)"
          type="text"
          inputMode="numeric"
          value={form.price}
          onChange={(e) => setForm((prev) => ({ ...prev, price: formatCurrencyBRL(e.target.value) }))}
          required
          disabled={disabled}
        />
        <input
          placeholder="Endereço"
          value={form.address}
          onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
          minLength={5}
          required
          disabled={disabled}
        />
        <div className="grid grid-2">
          <input
            placeholder="Bairro"
            value={form.neighborhood}
            onChange={(e) => setForm((prev) => ({ ...prev, neighborhood: e.target.value }))}
            minLength={2}
            required
            disabled={disabled}
          />
          <input
            placeholder="Cidade"
            value={form.city}
            onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
            minLength={2}
            required
            disabled={disabled}
          />
        </div>
        <div className="grid grid-2">
          <input
            placeholder="Estado (UF)"
            value={form.state}
            onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value.toUpperCase() }))}
            minLength={2}
            required
            disabled={disabled}
          />
          <select
            value={form.propertyType}
            onChange={(e) => setForm((prev) => ({ ...prev, propertyType: e.target.value }))}
            required
            disabled={disabled}
          >
            <option value="" disabled hidden>Tipo de imóvel</option>
            {availableTypes.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-2">
          <input
            placeholder="Quartos"
            type="number"
            min="0"
            value={form.bedrooms}
            onChange={(e) => setForm((prev) => ({ ...prev, bedrooms: e.target.value }))}
            required
            disabled={disabled}
          />
          <input
            placeholder="Vagas"
            type="number"
            min="0"
            value={form.parkingSpots}
            onChange={(e) => setForm((prev) => ({ ...prev, parkingSpots: e.target.value }))}
            required
            disabled={disabled}
          />
        </div>
        <div className="grid grid-2">
          <input
            placeholder="Suítes"
            type="number"
            min="0"
            value={form.suites}
            onChange={(e) => setForm((prev) => ({ ...prev, suites: e.target.value }))}
            required
            disabled={disabled}
          />
          <input
            placeholder="Metragem (m²)"
            type="number"
            min="1"
            step="0.01"
            value={form.squareFootage}
            onChange={(e) => setForm((prev) => ({ ...prev, squareFootage: e.target.value }))}
            required
            disabled={disabled}
          />
        </div>
        <select
          value={form.status}
          onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
          disabled={disabled}
        >
          <option value="DRAFT">Status</option>
          <option value="ACTIVE">Ativo</option>
          <option value="INACTIVE">Inativo</option>
        </select>
        
        <div style={{ marginTop: "8px" }}>
          <span style={{ display: "block", marginBottom: "8px", fontSize: "14px" }}>Fotos do imóvel (opcional)</span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setImageFiles(Array.from(e.target.files || []))}
            disabled={disabled}
          />
          {imageFiles.length > 0 ? <p className="hint">{imageFiles.length} arquivo(s) selecionado(s)</p> : null}
        </div>

        <div className="actions" style={{ marginTop: "24px" }}>
          <button type="submit" disabled={disabled}>
            {isEditing ? "Salvar Alterações" : "Salvar Imóvel"}
          </button>
          <button type="button" className="button-secondary" onClick={onCancelEdit} disabled={disabled}>
            {isEditing ? "Cancelar Edição" : "Voltar ao Menu"}
          </button>
        </div>
      </form>
    </section>
  );
}