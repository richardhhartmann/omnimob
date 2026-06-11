const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

let authToken = null;
let adminToken = null;

export function setApiToken(token) {
  authToken = token;
}

export function setAdminToken(token) {
  adminToken = token;
}

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

  const headers = {
    "Content-Type": "application/json",
    ...customHeaders,
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...restOptions,
    headers,
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
    request("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),

  getMe: (tenantSlug) =>
    request("/api/auth/me", { headers: { "x-tenant-slug": tenantSlug } }),

  listTenants: () => request("/api/tenants"),

  createTenant: (payload) =>
    request("/api/tenants", { method: "POST", body: JSON.stringify(payload) }),

  getTenantProfile: (tenantSlug) =>
    request("/api/tenants/me", { headers: { "x-tenant-slug": tenantSlug } }),

  updateTenantProfile: (tenantSlug, payload) =>
    request("/api/tenants/me", {
      method: "PUT",
      headers: { "x-tenant-slug": tenantSlug },
      body: JSON.stringify(payload),
    }),

  updateTenantConfiguracao: (tenantSlug, payload) =>
    request("/api/tenants/me/configuracao", {
      method: "PUT",
      headers: { "x-tenant-slug": tenantSlug },
      body: JSON.stringify(payload),
    }),

  getTiposImovel: (tenantSlug) =>
    request("/api/properties/tipos", {
      headers: { "x-tenant-slug": tenantSlug },
    }),

  listProperties: (tenantSlug, { page = 1, limit = 50, status } = {}) => {
    const params = new URLSearchParams({ page, limit });
    if (status) params.set("status", status);
    return request(`/api/properties?${params}`, {
      headers: { "x-tenant-slug": tenantSlug },
    });
  },

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

  getPropertyMetrics: (tenantSlug, propertyId, { from, to } = {}) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const query = params.toString() ? `?${params}` : "";
    return request(`/api/properties/${propertyId}/metrics${query}`, {
      headers: { "x-tenant-slug": tenantSlug },
    });
  },

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

  reorderPropertyImages: (tenantSlug, propertyId, order) =>
    request(`/api/properties/${propertyId}/images/reorder`, {
      method: "PUT",
      headers: { "x-tenant-slug": tenantSlug },
      body: JSON.stringify({ order }),
    }),

  listLeads: (tenantSlug, { page = 1, limit = 20, propertyId } = {}) => {
    const params = new URLSearchParams({ page, limit });
    if (propertyId) params.set("propertyId", propertyId);
    return request(`/api/leads?${params}`, {
      headers: { "x-tenant-slug": tenantSlug },
    });
  },

  deleteLead: (tenantSlug, leadId) =>
    request(`/api/leads/${leadId}`, {
      method: "DELETE",
      headers: { "x-tenant-slug": tenantSlug },
    }),

  // ─── Usuários ────────────────────────────────────────────────────────────
  listUsuarios: (tenantSlug) =>
    request("/api/usuarios", { headers: { "x-tenant-slug": tenantSlug } }),

  createUsuario: (tenantSlug, payload) =>
    request("/api/usuarios", { method: "POST", headers: { "x-tenant-slug": tenantSlug }, body: JSON.stringify(payload) }),

  updateUsuario: (tenantSlug, id, payload) =>
    request(`/api/usuarios/${id}`, { method: "PUT", headers: { "x-tenant-slug": tenantSlug }, body: JSON.stringify(payload) }),

  desativarUsuario: (tenantSlug, id) =>
    request(`/api/usuarios/${id}`, { method: "DELETE", headers: { "x-tenant-slug": tenantSlug } }),

  // ─── Cargos ──────────────────────────────────────────────────────────────
  listCargos: (tenantSlug) =>
    request("/api/cargos", { headers: { "x-tenant-slug": tenantSlug } }),

  createCargo: (tenantSlug, payload) =>
    request("/api/cargos", { method: "POST", headers: { "x-tenant-slug": tenantSlug }, body: JSON.stringify(payload) }),

  updateCargo: (tenantSlug, id, payload) =>
    request(`/api/cargos/${id}`, { method: "PUT", headers: { "x-tenant-slug": tenantSlug }, body: JSON.stringify(payload) }),

  deleteCargo: (tenantSlug, id) =>
    request(`/api/cargos/${id}`, { method: "DELETE", headers: { "x-tenant-slug": tenantSlug } }),

  // ─── Clientes ────────────────────────────────────────────────────────────
  listClientes: (tenantSlug, { search = "", ativo } = {}) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (ativo !== undefined) params.set("ativo", String(ativo));
    const query = params.toString() ? `?${params}` : "";
    return request(`/api/clientes${query}`, { headers: { "x-tenant-slug": tenantSlug } });
  },

  createCliente: (tenantSlug, payload) =>
    request("/api/clientes", { method: "POST", headers: { "x-tenant-slug": tenantSlug }, body: JSON.stringify(payload) }),

  updateCliente: (tenantSlug, id, payload) =>
    request(`/api/clientes/${id}`, { method: "PUT", headers: { "x-tenant-slug": tenantSlug }, body: JSON.stringify(payload) }),

  desativarCliente: (tenantSlug, id) =>
    request(`/api/clientes/${id}`, { method: "DELETE", headers: { "x-tenant-slug": tenantSlug } }),

  // ─── Tipos e atributos ───────────────────────────────────────────────────
  createTipoImovel: (tenantSlug, payload) =>
    request("/api/properties/tipos", { method: "POST", headers: { "x-tenant-slug": tenantSlug }, body: JSON.stringify(payload) }),

  updateTipoImovel: (tenantSlug, id, payload) =>
    request(`/api/properties/tipos/${id}`, { method: "PUT", headers: { "x-tenant-slug": tenantSlug }, body: JSON.stringify(payload) }),

  deleteTipoImovel: (tenantSlug, id) =>
    request(`/api/properties/tipos/${id}`, { method: "DELETE", headers: { "x-tenant-slug": tenantSlug } }),

  createAtributo: (tenantSlug, tipoId, payload) =>
    request(`/api/properties/tipos/${tipoId}/atributos`, { method: "POST", headers: { "x-tenant-slug": tenantSlug }, body: JSON.stringify(payload) }),

  updateAtributo: (tenantSlug, id, payload) =>
    request(`/api/properties/atributos/${id}`, { method: "PUT", headers: { "x-tenant-slug": tenantSlug }, body: JSON.stringify(payload) }),

  deleteAtributo: (tenantSlug, id) =>
    request(`/api/properties/atributos/${id}`, { method: "DELETE", headers: { "x-tenant-slug": tenantSlug } }),

  // ─── Redes Sociais ───────────────────────────────────────────────────────
  getSocialOAuthUrl: (tenantSlug) =>
    request("/api/social/oauth/url", { headers: { "x-tenant-slug": tenantSlug } }),

  getSocialStatus: (tenantSlug) =>
    request("/api/social/status", { headers: { "x-tenant-slug": tenantSlug } }),

  disconnectSocial: (tenantSlug) =>
    request("/api/social/disconnect", { method: "DELETE", headers: { "x-tenant-slug": tenantSlug } }),

  publishProperty: (tenantSlug, propertyId, payload) =>
    request(`/api/social/publish/${propertyId}`, {
      method: "POST",
      headers: { "x-tenant-slug": tenantSlug },
      body: JSON.stringify(payload),
    }),

  removePublication: (tenantSlug, propertyId, channel) =>
    request(`/api/social/publish/${propertyId}/${channel}`, {
      method: "DELETE",
      headers: { "x-tenant-slug": tenantSlug },
    }),

  reconcileProperty: (tenantSlug, propertyId) =>
    request(`/api/social/reconcile/${propertyId}`, {
      method: "POST",
      headers: { "x-tenant-slug": tenantSlug },
    }),

  reconcileAllSocial: (tenantSlug) =>
    request("/api/social/reconcile", {
      method: "POST",
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

// ─── Super-admin (painel da Domus) — usa token próprio ─────────────────────────
async function adminRequest(path, options = {}) {
  const { headers: customHeaders = {}, ...restOptions } = options;
  const headers = { "Content-Type": "application/json", ...customHeaders };
  if (adminToken) headers["Authorization"] = `Bearer ${adminToken}`;

  const response = await fetch(`${API_URL}${path}`, { ...restOptions, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(normalizeErrorMessage(body));
  }
  if (response.status === 204) return null;
  return response.json();
}

export const adminApi = {
  login: (payload) => adminRequest("/api/admin/login", { method: "POST", body: JSON.stringify(payload) }),
  listTenants: () => adminRequest("/api/admin/tenants"),
  getTenant: (id) => adminRequest(`/api/admin/tenants/${id}`),
  createTenant: (payload) => adminRequest("/api/admin/tenants", { method: "POST", body: JSON.stringify(payload) }),
  updateTenant: (id, payload) => adminRequest(`/api/admin/tenants/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteTenant: (id) => adminRequest(`/api/admin/tenants/${id}`, { method: "DELETE" }),
};
