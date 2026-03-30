import { useEffect, useState } from "react";

const PROPERTY_TYPE_OPTIONS = [
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

export function PropertyForm({ onSubmit, disabled, initialData, onCancelEdit }) {
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
      squareFootage: initialData.squareFootage || "",
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

    await onSubmit({
      ...form,
      cep: form.cep.replace(/\D/g, ""),
      price: normalizedPrice,
      bedrooms: normalizedBedrooms,
      parkingSpots: normalizedParkingSpots,
      suites: normalizedSuites,
      imageFiles,
    });
    if (!isEditing) {
      setForm(EMPTY);
      setImageFiles([]);
    }
  }

  return (
    <section className="glass-panel">
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
        {cepLoading ? <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Consultando base dos Correios...</p> : null}
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
            {PROPERTY_TYPE_OPTIONS.map((option) => (
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
            placeholder="Metragem (ex.: 85m2)"
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
          <option value="DRAFT">Rascunho</option>
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
          {isEditing ? (
            <button type="button" className="button-secondary" onClick={onCancelEdit} disabled={disabled}>
              Cancelar Edição
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}