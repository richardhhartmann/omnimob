/* Base da API. A barra do fim é removida de propósito: todo `path` daqui já
   começa com "/", então uma env terminada em barra produziria "//api/...", que
   o Express não casa com rota nenhuma — a resposta vira 404 em TODA requisição,
   sem erro de CORS nem nada que aponte a causa. Normalizar aqui deixa a
   variável de ambiente à prova de barra sobrando. */
const API_URL = (import.meta.env.VITE_API_URL || "https://api.omnimob.app").replace(/\/+$/, "");

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
    const error = new Error(normalizeErrorMessage(body));
    error.body = body; // permite ler flags como forcaAlterarSenha
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  login: (payload) =>
    request("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),

  definirSenha: (payload) =>
    request("/api/auth/definir-senha", { method: "POST", body: JSON.stringify(payload) }),

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

  // Tipos de contrato liberados no cadastro (parametrização da imobiliária).
  updateTiposContrato: (tenantSlug, tiposContrato) =>
    request("/api/properties/tipos-contrato", {
      method: "PUT",
      headers: { "x-tenant-slug": tenantSlug },
      body: JSON.stringify({ tiposContrato }),
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

  setPropertyImage360: (tenantSlug, propertyId, imageId, is360) =>
    request(`/api/properties/${propertyId}/images/${imageId}`, {
      method: "PATCH",
      headers: { "x-tenant-slug": tenantSlug },
      body: JSON.stringify({ is360 }),
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

  // Apaga a linha. Sem volta — ver a confirmação em UsuariosPage.
  excluirUsuario: (tenantSlug, id) =>
    request(`/api/usuarios/${id}/permanente`, { method: "DELETE", headers: { "x-tenant-slug": tenantSlug } }),

  // ─── Tutorial guiado ─────────────────────────────────────────────────────
  getTutorial: (tenantSlug) =>
    request("/api/tutorial", { headers: { "x-tenant-slug": tenantSlug } }),

  marcarTutorial: (tenantSlug, payload) =>
    request("/api/tutorial/marcar", { method: "POST", headers: { "x-tenant-slug": tenantSlug }, body: JSON.stringify(payload) }),

  pularTutorialTodo: (tenantSlug, payload) =>
    request("/api/tutorial/pular-tudo", { method: "POST", headers: { "x-tenant-slug": tenantSlug }, body: JSON.stringify(payload) }),

  reiniciarTutorial: (tenantSlug) =>
    request("/api/tutorial/reiniciar", { method: "POST", headers: { "x-tenant-slug": tenantSlug } }),

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

  // Apaga a linha. Sem volta — ver a confirmação em ClientesPage.
  excluirCliente: (tenantSlug, id) =>
    request(`/api/clientes/${id}/permanente`, { method: "DELETE", headers: { "x-tenant-slug": tenantSlug } }),

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

  // Remove UM post específico (por id) — usado quando o imóvel tem vários posts na mesma rede.
  removePublicationById: (tenantSlug, publicationId) =>
    request(`/api/social/publish/publication/${publicationId}`, {
      method: "DELETE",
      headers: { "x-tenant-slug": tenantSlug },
    }),

  // Lista todas as publicações (posts) de um imóvel, em todas as redes.
  listPublications: (tenantSlug, propertyId) =>
    request(`/api/properties/${propertyId}/publications`, {
      headers: { "x-tenant-slug": tenantSlug },
    }),

  // Métricas reais (curtidas/comentários/compartilhamentos) de um post na rede.
  getPublicationInsights: (tenantSlug, publicationId) =>
    request(`/api/social/publish/publication/${publicationId}/insights`, {
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

  // ─── IA ──────────────────────────────────────────────────────────────────
  // Sugere título + descrição a partir das fotos + dados do imóvel (multimodal).
  sugerirImovelIA: (tenantSlug, payload) =>
    request("/api/ai/imovel/sugerir", {
      method: "POST",
      headers: { "x-tenant-slug": tenantSlug },
      body: JSON.stringify(payload),
    }),

  // Infere as comodidades da região a partir do endereço/CEP (Gemini).
  inferirComodidadesIA: (tenantSlug, payload) =>
    request("/api/properties/ai/comodidades", {
      method: "POST",
      headers: { "x-tenant-slug": tenantSlug },
      body: JSON.stringify(payload),
    }),

  // Gera conteúdo (legenda, hashtags, etc.) para um imóvel já salvo.
  gerarConteudoPropertyIA: (tenantSlug, propertyId, tipos) =>
    request(`/api/properties/${propertyId}/ai/gerar`, {
      method: "POST",
      headers: { "x-tenant-slug": tenantSlug },
      body: JSON.stringify({ tipos }),
    }),

  // Melhora/reescreve uma descrição existente (usa dados do imóvel como contexto).
  melhorarDescricaoIA: (tenantSlug, payload) =>
    request("/api/ai/imovel/melhorar-descricao", {
      method: "POST",
      headers: { "x-tenant-slug": tenantSlug },
      body: JSON.stringify(payload),
    }),

  getPublicShowcase: (tenantSlug) => request(`/public/${tenantSlug}/properties`),

  getPublicPropertyById: (tenantSlug, propertyId) =>
    request(`/public/${tenantSlug}/properties/${propertyId}`),

  registerPublicInterest: (tenantSlug, propertyId, payload = {}) =>
    request(`/public/${tenantSlug}/properties/${propertyId}/interest`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Situação do teste do tenant logado (dias restantes + o que ele já criou).
  getTrialStatus: (tenantSlug) =>
    request("/api/tenants/me/trial", { headers: { "x-tenant-slug": tenantSlug } }),

  // Converte o teste em assinatura. `tokenPagamento` vem do provedor, gerado
  // no navegador — o número do cartão nunca passa pela nossa API.
  assinarPlano: (tenantSlug, payload = {}) =>
    request("/api/tenants/me/assinar", {
      method: "POST",
      headers: { "x-tenant-slug": tenantSlug },
      body: JSON.stringify(payload),
    }),

  // Upgrade/downgrade de quem já é cliente. Muda o que o tenant USA; o valor da
  // próxima fatura ainda é acertado pelo time (ver a rota /me/plano).
  trocarPlano: (tenantSlug, plano) =>
    request("/api/tenants/me/plano", {
      method: "POST",
      headers: { "x-tenant-slug": tenantSlug },
      body: JSON.stringify({ plano }),
    }),

  // Interesse comercial pela própria Omnimob (landing), antes de existir tenant.
  enviarInteresseOmnimob: (payload = {}) =>
    request("/public/interesse", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Preços vigentes dos planos, lidos do provedor de pagamento. Público: a
  // landing precisa deles antes de existir qualquer sessão.
  getPlanosPublicos: () => request("/public/planos"),

  /* O endereço da vitrine (slug) que sai deste nome está livre? Consultado
     enquanto a pessoa digita, para o conflito aparecer com o nome ainda em
     aberto — e não depois do ambiente criado. */
  verificarSlugOmnimob: (nome, { signal } = {}) =>
    request(`/public/slug?nome=${encodeURIComponent(nome)}`, { signal }),

  // Teste grátis, etapa 1: dispara o link mágico de confirmação por e-mail.
  criarTrialOmnimob: (payload = {}) =>
    request("/public/trial", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // ─── Chamados de suporte (lado da imobiliária) ───────────────────────────
  abrirChamado: (tenantSlug, payload) =>
    request("/api/chamados", {
      method: "POST",
      headers: { "x-tenant-slug": tenantSlug },
      body: JSON.stringify(payload),
    }),

  listarChamados: (tenantSlug) =>
    request("/api/chamados", { headers: { "x-tenant-slug": tenantSlug } }),

  // Teste grátis, etapa 2: o token do e-mail vira um tenant de verdade.
  confirmarTrialOmnimob: (payload = {}) =>
    request("/public/trial/confirmar", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

// ─── Super-admin (painel da Omnimob) — usa token próprio ─────────────────────────
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

  // Caixa de entrada do suporte — todos os tenants.
  listChamados: (filtros = {}) => {
    const q = new URLSearchParams();
    if (filtros.resolvido != null) q.set("resolvido", String(filtros.resolvido));
    if (filtros.tenantId) q.set("tenantId", filtros.tenantId);
    const sufixo = q.toString() ? `?${q}` : "";
    return adminRequest(`/api/admin/chamados${sufixo}`);
  },
  atualizarChamado: (numero, payload) =>
    adminRequest(`/api/admin/chamados/${numero}`, { method: "PATCH", body: JSON.stringify(payload) }),

  // Progresso bruto dos tutoriais por tenant e usuário; a porcentagem é
  // calculada na tela, que é quem conhece o fluxo.
  listTutoriais: () => adminRequest("/api/admin/tutoriais"),
};
