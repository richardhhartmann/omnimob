import { notificarRequisicao } from "./utils/pulsoTrial";

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

  /* Um cadastro/edição que deu certo é o gatilho da pesquisa do teste (ver
     utils/pulsoTrial.js). Fica aqui, no único ponto por onde toda requisição
     passa, e não espalhado pelas telas: assim rota nova entra na conta sozinha
     e nenhuma tela reescrita esquece de avisar. Só o caminho feliz — requisição
     que falhou não é ação concluída, e por isso vem depois do `throw`. */
  notificarRequisicao(path, restOptions.method);

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

  /* Público: traduz o host acessado no slug do tenant. Usado só quando a aba
     abre num domínio que não é o da Omnimob. */
  slugPorDominio: (host) =>
    request(`/public/dominio?host=${encodeURIComponent(host)}`),

  // ── Domínio próprio da vitrine ──────────────────────────────────────────
  getDominio: (tenantSlug) =>
    request("/api/tenants/me/dominio", { headers: { "x-tenant-slug": tenantSlug } }),

  definirDominio: (tenantSlug, dominio) =>
    request("/api/tenants/me/dominio", {
      method: "POST",
      headers: { "x-tenant-slug": tenantSlug },
      body: JSON.stringify({ dominio }),
    }),

  verificarDominio: (tenantSlug) =>
    request("/api/tenants/me/dominio/verificar", {
      method: "POST",
      headers: { "x-tenant-slug": tenantSlug },
    }),

  removerDominio: (tenantSlug) =>
    request("/api/tenants/me/dominio", {
      method: "DELETE",
      headers: { "x-tenant-slug": tenantSlug },
    }),

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

  listLeads: (tenantSlug, { page = 1, limit = 20, propertyId, estagio, responsavelId } = {}) => {
    const params = new URLSearchParams({ page, limit });
    if (propertyId) params.set("propertyId", propertyId);
    if (estagio) params.set("estagio", estagio);
    if (responsavelId) params.set("responsavelId", responsavelId);
    return request(`/api/leads?${params}`, {
      headers: { "x-tenant-slug": tenantSlug },
    });
  },

  // Estágio do funil e/ou responsável. Os dois na mesma chamada porque na tela
  // são o mesmo gesto: "assumi e comecei a atender".
  atualizarLead: (tenantSlug, leadId, payload) =>
    request(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "x-tenant-slug": tenantSlug },
      body: JSON.stringify(payload),
    }),

  anotarLead: (tenantSlug, leadId, texto) =>
    request(`/api/leads/${leadId}/nota`, {
      method: "POST",
      headers: { "x-tenant-slug": tenantSlug },
      body: JSON.stringify({ texto }),
    }),

  obterLead: (tenantSlug, leadId) =>
    request(`/api/leads/${leadId}`, { headers: { "x-tenant-slug": tenantSlug } }),

  /* ── Trilha de auditoria ── */
  listarAuditoria: (tenantSlug, filtros = {}) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filtros)) {
      if (v !== "" && v !== null && v !== undefined) params.set(k, v);
    }
    return request(`/api/auditoria?${params}`, { headers: { "x-tenant-slug": tenantSlug } });
  },

  filtrosDaAuditoria: (tenantSlug) =>
    request("/api/auditoria/filtros", { headers: { "x-tenant-slug": tenantSlug } }),

  /* ── Perfis de busca e cruzamento ── */
  listarPerfisBusca: (tenantSlug, clienteId) => {
    const params = new URLSearchParams();
    if (clienteId) params.set("clienteId", clienteId);
    return request(`/api/perfis-busca?${params}`, { headers: { "x-tenant-slug": tenantSlug } });
  },

  criarPerfilBusca: (tenantSlug, payload) =>
    request("/api/perfis-busca", {
      method: "POST",
      headers: { "x-tenant-slug": tenantSlug },
      body: JSON.stringify(payload),
    }),

  salvarPerfilBusca: (tenantSlug, id, payload) =>
    request(`/api/perfis-busca/${id}`, {
      method: "PUT",
      headers: { "x-tenant-slug": tenantSlug },
      body: JSON.stringify(payload),
    }),

  removerPerfilBusca: (tenantSlug, id) =>
    request(`/api/perfis-busca/${id}`, {
      method: "DELETE",
      headers: { "x-tenant-slug": tenantSlug },
    }),

  // O que o acervo tem para este cliente.
  imoveisDoPerfil: (tenantSlug, id) =>
    request(`/api/perfis-busca/${id}/imoveis`, { headers: { "x-tenant-slug": tenantSlug } }),

  // A direção inversa: quem da carteira estava esperando por este imóvel.
  interessadosNoImovel: (tenantSlug, propertyId) =>
    request(`/api/perfis-busca/imovel/${propertyId}`, { headers: { "x-tenant-slug": tenantSlug } }),

  deleteLead: (tenantSlug, leadId) =>
    request(`/api/leads/${leadId}`, {
      method: "DELETE",
      headers: { "x-tenant-slug": tenantSlug },
    }),

  /* Assistente de vitrine (Premium): o pedido em português vira uma lista de
     operações que o editor executa passo a passo. Ver `services/vitrineIA.js`
     na API para por que não volta um showcaseConfig pronto. */
  planejarVitrineIA: (tenantSlug, payload) =>
    request("/api/ai/vitrine", {
      method: "POST",
      headers: { "x-tenant-slug": tenantSlug },
      body: JSON.stringify(payload),
    }),

  // Resumo, temperatura, resposta pronta e imóveis do acervo para este lead.
  // Só no Premium — a API responde 403 nos demais planos.
  analisarLeadIA: (tenantSlug, leadId) =>
    request(`/api/leads/${leadId}/ia`, {
      method: "POST",
      headers: { "x-tenant-slug": tenantSlug },
    }),

  /* ── Reescrita em massa (Premium) ──
     Dois passos de propósito: o POST só GERA e devolve antes/depois, o PUT
     salva o que a pessoa aprovou. Ver o comentário em aiRoutes.js. */
  reescreverEmMassa: (tenantSlug, ids) =>
    request(`/api/ai/imovel/massa`, {
      method: "POST",
      headers: { "x-tenant-slug": tenantSlug },
      body: JSON.stringify({ ids }),
    }),

  salvarReescritaEmMassa: (tenantSlug, itens) =>
    request(`/api/ai/imovel/massa`, {
      method: "PUT",
      headers: { "x-tenant-slug": tenantSlug },
      body: JSON.stringify({ itens }),
    }),

  /* ── Funil de vendas e comissões (Profissional+) ── */
  listVendas: (tenantSlug, filtros = {}) => {
    const p = new URLSearchParams();
    Object.entries(filtros).forEach(([k, v]) => { if (v) p.set(k, v); });
    const qs = p.toString();
    return request(`/api/vendas${qs ? `?${qs}` : ""}`, {
      headers: { "x-tenant-slug": tenantSlug },
    });
  },

  resumoVendas: (tenantSlug, filtros = {}) => {
    const p = new URLSearchParams();
    Object.entries(filtros).forEach(([k, v]) => { if (v) p.set(k, v); });
    const qs = p.toString();
    return request(`/api/vendas/resumo${qs ? `?${qs}` : ""}`, {
      headers: { "x-tenant-slug": tenantSlug },
    });
  },

  criarVenda: (tenantSlug, dados) =>
    request(`/api/vendas`, {
      method: "POST",
      headers: { "x-tenant-slug": tenantSlug },
      body: JSON.stringify(dados),
    }),

  removerVenda: (tenantSlug, id) =>
    request(`/api/vendas/${id}`, {
      method: "DELETE",
      headers: { "x-tenant-slug": tenantSlug },
    }),

  // ── Relatório mensal (Profissional+) ──
  relatorioMensal: (tenantSlug, { ano, mes } = {}) => {
    const p = new URLSearchParams();
    if (ano && mes) { p.set("ano", ano); p.set("mes", mes); }
    const qs = p.toString();
    return request(`/api/tenants/me/relatorio-mensal${qs ? `?${qs}` : ""}`, {
      headers: { "x-tenant-slug": tenantSlug },
    });
  },

  enviarRelatorioMensal: (tenantSlug, { ano, mes } = {}) =>
    request(`/api/tenants/me/relatorio-mensal/enviar`, {
      method: "POST",
      headers: { "x-tenant-slug": tenantSlug },
      body: JSON.stringify({ ano, mes }),
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

  /* Encerra o lembrete de "você disse que traria dados de outro sistema" —
     tanto para quem foi importar quanto para quem deixou para depois. */
  migracaoResolvida: (tenantSlug) =>
    request("/api/tenants/me/migracao/resolvida", {
      method: "POST",
      headers: { "x-tenant-slug": tenantSlug },
    }),

  // ─── Importação de outra plataforma ──────────────────────────────────────
  // Os tipos de imóvel e cargos DESTA imobiliária, para a tela avisar antes o
  // que da fonte não vai casar com o que existe aqui.
  importacaoReferencias: (tenantSlug) =>
    request("/api/importacao/referencias", { headers: { "x-tenant-slug": tenantSlug } }),

  /* Lê a fonte e devolve as primeiras linhas SEM gravar nada. É o único momento
     em que dá para perceber que o feed aponta para a filial errada antes de
     quinhentos imóveis entrarem. */
  importacaoPrevia: (tenantSlug, payload) =>
    request("/api/importacao/fonte/previa", {
      method: "POST",
      headers: { "x-tenant-slug": tenantSlug },
      body: JSON.stringify(payload),
    }),

  /* O trabalho. O servidor relê a fonte e fatia em lotes por dentro — o
     conteúdo já está lá, e devolver o controle para a tela só para ela pedir de
     volta em pedaços seria uma viagem de rede por lote sem nada em troca. */
  importacaoExecutar: (tenantSlug, payload) =>
    request("/api/importacao/fonte/importar", {
      method: "POST",
      headers: { "x-tenant-slug": tenantSlug },
      body: JSON.stringify(payload),
    }),

  /* Tema do painel desta pessoa. `null` desfaz a escolha e devolve ao tema da
     imobiliária — o caminho de volta precisa existir. */
  salvarMeuTema: (tema) =>
    request("/api/auth/meu-tema", { method: "PUT", body: JSON.stringify({ tema }) }),

  // ─── Canais de divulgação ────────────────────────────────────────────────
  // O retrato de cada canal: o que está no ar, quantos imóveis recebe e o que
  // falta configurar. Existe porque o feed dos portais funcionava desde sempre
  // e ninguém sabia — a integração mais completa do produto era invisível.
  listarCanais: (tenantSlug) =>
    request("/api/canais", { headers: { "x-tenant-slug": tenantSlug } }),

  conectarMercadoLivre: (tenantSlug) =>
    request("/api/canais/mercadolivre/conectar", { headers: { "x-tenant-slug": tenantSlug } }),

  desconectarMercadoLivre: (tenantSlug) =>
    request("/api/canais/mercadolivre", { method: "DELETE", headers: { "x-tenant-slug": tenantSlug } }),

  publicarMercadoLivre: (tenantSlug, propertyId, payload = {}) =>
    request(`/api/canais/mercadolivre/publicar/${propertyId}`, {
      method: "POST", headers: { "x-tenant-slug": tenantSlug }, body: JSON.stringify(payload),
    }),

  encerrarMercadoLivre: (tenantSlug, propertyId) =>
    request(`/api/canais/mercadolivre/publicar/${propertyId}`, {
      method: "DELETE", headers: { "x-tenant-slug": tenantSlug },
    }),

  /* A ponte não oficial de WhatsApp. Corpo vazio DESLIGA — é o caminho de saída,
     e ele precisa ser tão fácil quanto o de entrada. */
  salvarPonteWhatsapp: (tenantSlug, payload) =>
    request("/api/canais/whatsapp-ponte", {
      method: "PUT", headers: { "x-tenant-slug": tenantSlug }, body: JSON.stringify(payload),
    }),

  publicarStatusPelaPonte: (tenantSlug, propertyId, payload) =>
    request(`/api/canais/whatsapp-ponte/publicar/${propertyId}`, {
      method: "POST", headers: { "x-tenant-slug": tenantSlug }, body: JSON.stringify(payload),
    }),

  // ─── Chaves da API da imobiliária ────────────────────────────────────────
  // O catálogo de escopos vem do servidor: uma segunda lista aqui desencontraria
  // da que o validador usa na primeira permissão nova.
  listarEscoposApi: (tenantSlug) =>
    request("/api/chaves-api/escopos", { headers: { "x-tenant-slug": tenantSlug } }),

  listarChavesApi: (tenantSlug) =>
    request("/api/chaves-api", { headers: { "x-tenant-slug": tenantSlug } }),

  /* A resposta traz `texto` com a chave INTEGRAL, e é a única vez que ela
     existe fora do navegador de quem pediu. O banco guarda só o hash. */
  criarChaveApi: (tenantSlug, payload) =>
    request("/api/chaves-api", {
      method: "POST",
      headers: { "x-tenant-slug": tenantSlug },
      body: JSON.stringify(payload),
    }),

  revogarChaveApi: (tenantSlug, id) =>
    request(`/api/chaves-api/${id}`, {
      method: "DELETE",
      headers: { "x-tenant-slug": tenantSlug },
    }),

  /* ── Baixar tudo ──────────────────────────────────────────────────────────
     Não passa pelo `request`: a resposta é um arquivo, não JSON, e lê-la como
     objeto para depois reserializar dobraria na memória um conteúdo que pode ter
     dezenas de megabytes. Aqui o corpo vira `blob` e o navegador salva. */
  async exportarTudo(tenantSlug) {
    const r = await fetch(`${API_URL}/api/tenants/me/exportar`, {
      headers: { Authorization: `Bearer ${authToken}`, "x-tenant-slug": tenantSlug },
    });
    if (!r.ok) {
      const corpo = await r.json().catch(() => ({}));
      throw new Error(corpo.error || "Não consegui gerar a exportação.");
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `omnimob-${tenantSlug}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Sem o revoke, cada clique deixa o arquivo inteiro preso na memória da aba.
    URL.revokeObjectURL(url);
    return blob.size;
  },

  // ─── Fontes de importação guardadas ──────────────────────────────────────
  // O endereço do feed, salvo para ser lido DE NOVO. É o que separa "importei
  // uma vez" de "está integrado".
  listarFontes: (tenantSlug) =>
    request("/api/importacao/fontes", { headers: { "x-tenant-slug": tenantSlug } }),

  criarFonte: (tenantSlug, payload) =>
    request("/api/importacao/fontes", {
      method: "POST", headers: { "x-tenant-slug": tenantSlug }, body: JSON.stringify(payload),
    }),

  atualizarFonte: (tenantSlug, id, payload) =>
    request(`/api/importacao/fontes/${id}`, {
      method: "PUT", headers: { "x-tenant-slug": tenantSlug }, body: JSON.stringify(payload),
    }),

  removerFonte: (tenantSlug, id) =>
    request(`/api/importacao/fontes/${id}`, { method: "DELETE", headers: { "x-tenant-slug": tenantSlug } }),

  sincronizarFonte: (tenantSlug, id) =>
    request(`/api/importacao/fontes/${id}/sincronizar`, {
      method: "POST", headers: { "x-tenant-slug": tenantSlug },
    }),

  // ─── Webhooks de saída ───────────────────────────────────────────────────
  listarEventosWebhook: (tenantSlug) =>
    request("/api/webhooks-saida/eventos", { headers: { "x-tenant-slug": tenantSlug } }),

  listarWebhooks: (tenantSlug) =>
    request("/api/webhooks-saida", { headers: { "x-tenant-slug": tenantSlug } }),

  criarWebhook: (tenantSlug, payload) =>
    request("/api/webhooks-saida", {
      method: "POST", headers: { "x-tenant-slug": tenantSlug }, body: JSON.stringify(payload),
    }),

  atualizarWebhook: (tenantSlug, id, payload) =>
    request(`/api/webhooks-saida/${id}`, {
      method: "PUT", headers: { "x-tenant-slug": tenantSlug }, body: JSON.stringify(payload),
    }),

  removerWebhook: (tenantSlug, id) =>
    request(`/api/webhooks-saida/${id}`, { method: "DELETE", headers: { "x-tenant-slug": tenantSlug } }),

  testarWebhook: (tenantSlug, id) =>
    request(`/api/webhooks-saida/${id}/testar`, { method: "POST", headers: { "x-tenant-slug": tenantSlug } }),

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

  /* Resposta da pesquisa que aparece durante o teste. Quando `escolha` for
     "ESTENDER", a mesma chamada empurra o vencimento — uma vez por
     imobiliária; a resposta diz em `estendido` se o prazo foi dado. */
  responderPesquisaTrial: (tenantSlug, payload = {}) =>
    request("/api/tenants/me/trial/pesquisa", {
      method: "POST",
      headers: { "x-tenant-slug": tenantSlug },
      body: JSON.stringify(payload),
    }),

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

  /* Cancela a assinatura no fim do período já pago.

     Sem `confirmar`, a rota responde 409 com `code: "CONFIRMAR_CANCELAMENTO"` e
     a data até quando o acesso vale — é assim que a tela sabe o que dizer no
     aviso antes de perguntar. Com `confirmar: true`, agenda de verdade. */
  cancelarAssinatura: (tenantSlug, confirmar = false) =>
    request("/api/tenants/me/cancelar-assinatura", {
      method: "POST",
      headers: { "x-tenant-slug": tenantSlug },
      body: JSON.stringify({ confirmar }),
    }),

  /* ─── Recuperação de senha ────────────────────────────────────────────────
     Nenhuma delas exige sessão: quem esqueceu a senha, por definição, não tem.

     `pedirRecuperacaoSenha` responde sempre 200 com a mesma mensagem, exista a
     conta ou não — não trate um "sucesso" aqui como prova de que o e-mail saiu. */
  pedirRecuperacaoSenha: (identificador) =>
    request("/api/auth/recuperar-senha", {
      method: "POST",
      body: JSON.stringify({ identificador }),
    }),

  // Confere o link antes de a pessoa digitar a senha nova.
  validarTokenSenha: (token) =>
    request(`/api/auth/redefinir-senha/${encodeURIComponent(token)}`),

  // Devolve a sessão pronta: quem redefine entra direto, sem passar pelo login.
  redefinirSenha: (token, novaSenha) =>
    request("/api/auth/redefinir-senha", {
      method: "POST",
      body: JSON.stringify({ token, novaSenha }),
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

  // As vitrines que estão no ar, para a página /vitrines. Público e sem sessão.
  listarVitrinesPublicas: () => request("/public/vitrines"),

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
