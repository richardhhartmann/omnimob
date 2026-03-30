const API_URL = "http://localhost:4000";

function normalizeErrorMessage(body) {
  if (!body || typeof body !== "object") return "Erro na requisicao.";
  if (body.details?.fieldErrors && typeof body.details.fieldErrors === "object") {
    const firstField = Object.values(body.details.fieldErrors).find(
      (messages) => Array.isArray(messages) && messages.length > 0
    );
    if (firstField) return `${body.error || "Dados invalidos."} ${firstField[0]}`;
  }
  return body.error || "Erro na requisicao.";
}

async function request(path, options = {}) {
  const { headers: customHeaders = {}, ...restOptions } = options;

  const response = await fetch(`${API_URL}${path}`, {
    ...restOptions,
    headers: {
      "Content-Type": "application/json",
      ...customHeaders,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(normalizeErrorMessage(body));
  }

  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  login: (payload) =>
    request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listTenants: () => request("/api/tenants"),
  createTenant: (payload) =>
    request("/api/tenants", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getTenantProfile: (tenantSlug) =>
    request("/api/tenants/me", {
      headers: { "x-tenant-slug": tenantSlug },
    }),
  updateTenantProfile: (tenantSlug, payload) =>
    request("/api/tenants/me", {
      method: "PUT",
      headers: { "x-tenant-slug": tenantSlug },
      body: JSON.stringify(payload),
    }),
  listProperties: (tenantSlug) =>
    request("/api/properties", {
      headers: { "x-tenant-slug": tenantSlug },
    }),
  createProperty: (tenantSlug, payload) =>
    request("/api/properties", {
      method: "POST",
      headers: { "x-tenant-slug": tenantSlug },
      body: JSON.stringify(payload),
    }),
  updateProperty: (tenantSlug, propertyId, payload) =>
    request(`/api/properties/${propertyId}`, {
      method: "PUT",
      headers: { "x-tenant-slug": tenantSlug },
      body: JSON.stringify(payload),
    }),
  deleteProperty: (tenantSlug, propertyId) =>
    request(`/api/properties/${propertyId}`, {
      method: "DELETE",
      headers: { "x-tenant-slug": tenantSlug },
    }),
  getPropertyById: (tenantSlug, propertyId) =>
    request(`/api/properties/${propertyId}`, {
      headers: { "x-tenant-slug": tenantSlug },
    }),
  getPropertyMetrics: (tenantSlug, propertyId) =>
    request(`/api/properties/${propertyId}/metrics`, {
      headers: { "x-tenant-slug": tenantSlug },
    }),
  registerPropertyView: (tenantSlug, propertyId) =>
    request(`/api/properties/${propertyId}/metrics/view`, {
      method: "POST",
      headers: { "x-tenant-slug": tenantSlug },
    }),
  registerPropertyLead: (tenantSlug, propertyId) =>
    request(`/api/properties/${propertyId}/metrics/lead`, {
      method: "POST",
      headers: { "x-tenant-slug": tenantSlug },
    }),
  registerPropertySale: (tenantSlug, propertyId) =>
    request(`/api/properties/${propertyId}/metrics/sale`, {
      method: "POST",
      headers: { "x-tenant-slug": tenantSlug },
    }),
  listPropertyImages: (tenantSlug, propertyId) =>
    request(`/api/properties/${propertyId}/images`, {
      headers: { "x-tenant-slug": tenantSlug },
    }),
  addPropertyImage: (tenantSlug, propertyId, payload) =>
    request(`/api/properties/${propertyId}/images`, {
      method: "POST",
      headers: { "x-tenant-slug": tenantSlug },
      body: JSON.stringify(payload),
    }),
  deletePropertyImage: (tenantSlug, propertyId, imageId) =>
    request(`/api/properties/${propertyId}/images/${imageId}`, {
      method: "DELETE",
      headers: { "x-tenant-slug": tenantSlug },
    }),
  getPublicShowcase: (tenantSlug) => request(`/public/${tenantSlug}/properties`),
  getPublicPropertyById: (tenantSlug, propertyId) =>
    request(`/public/${tenantSlug}/properties/${propertyId}`),
  registerPublicInterest: (tenantSlug, propertyId, payload = {}) =>
    request(`/public/${tenantSlug}/properties/${propertyId}/interest`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
