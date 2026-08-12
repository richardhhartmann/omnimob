import { prisma } from "../db.js";

/* ────────────────────────────────────────────────────────────────────────────
   Domínio próprio da imobiliária.

   A vitrine nasce no endereço da Omnimob. Quem já tem domínio pode apontá-lo
   para cá, e é o caminho recomendado: o SEO passa a somar para o domínio da
   imobiliária, não para o nosso.

   ─── O QUE DÁ E O QUE NÃO DÁ PARA AUTOMATIZAR ───────────────────────────────
   Damos conta de tudo menos de um passo, e ele é intransponível: escrever no
   DNS do cliente. Só quem tem a credencial do registrador dele pode. Então o
   fluxo é:

     1. cadastramos o domínio no projeto da Vercel            (automático)
     2. a Vercel diz QUAIS registros o cliente precisa criar  (automático)
     3. o cliente cola esses registros no registrador dele    ← manual
     4. perguntamos à Vercel se já resolveu                   (automático)
     5. a Vercel emite o certificado sozinha                  (automático)

   ─── POR QUE NÃO CRAVAMOS OS VALORES DE DNS ─────────────────────────────────
   Todo tutorial na internet manda apontar o A para `76.76.21.21`. O próprio
   omnimob.app hoje aponta para `216.198.79.1`, e o www vai para um CNAME
   específico do projeto. Ou seja: os valores mudam e variam por projeto.
   Guardamos o que a API respondeu, no momento em que respondeu.
   ──────────────────────────────────────────────────────────────────────────── */

const TOKEN = process.env.VERCEL_TOKEN || "";
const PROJETO = process.env.VERCEL_PROJECT_ID || "";
const TIME = process.env.VERCEL_TEAM_ID || ""; // projetos de time exigem este parâmetro
const BASE = "https://api.vercel.com";
const TIMEOUT_MS = 15_000;

export function dominioConfigurado() {
  return Boolean(TOKEN && PROJETO);
}

/** Aceita "https://x.com.br/", "X.COM.BR" e devolve "x.com.br". */
export function normalizarDominio(bruto) {
  const limpo = String(bruto || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");

  // Não valida a existência (isso é com o DNS), só a forma: rótulos separados
  // por ponto, com pelo menos um ponto. Rejeita espaço, barra, arroba e afins.
  if (!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(limpo)) {
    return null;
  }
  return limpo;
}

async function vercel(caminho, { method = "GET", corpo } = {}) {
  const controlador = new AbortController();
  const relogio = setTimeout(() => controlador.abort(), TIMEOUT_MS);
  try {
    const url = new URL(`${BASE}${caminho}`);
    if (TIME) url.searchParams.set("teamId", TIME);

    const r = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        ...(corpo ? { "Content-Type": "application/json" } : {}),
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: controlador.signal,
    });

    const dados = await r.json().catch(() => ({}));
    if (!r.ok) {
      const e = new Error(dados?.error?.message || `Vercel respondeu ${r.status}`);
      e.codigo = dados?.error?.code || null;
      e.status = r.status;
      throw e;
    }
    return dados;
  } finally {
    clearTimeout(relogio);
  }
}

/* A Vercel devolve as instruções em dois formatos: `verification[]` quando o
   domínio precisa provar posse, e a ausência de `verified` quando falta só
   apontar o DNS. Traduzimos os dois para uma lista única, no vocabulário do
   registrador ("tipo, nome, valor"), que é o que a pessoa vê no Registro.br. */
function instrucoes(dominio, info) {
  const registros = [];

  for (const v of info?.verification || []) {
    registros.push({ tipo: v.type, nome: v.domain, valor: v.value, motivo: "posse" });
  }

  // Apex não aceita CNAME (regra do DNS, não da Vercel) — vai registro A.
  const ehApex = dominio.split(".").length <= 2 || /^[^.]+\.(com|net|org)\.br$/.test(dominio);
  if (!registros.some((r) => r.motivo === "apontamento")) {
    registros.push(
      ehApex
        ? { tipo: "A", nome: "@", valor: "76.76.21.21", motivo: "apontamento", conferir: true }
        : { tipo: "CNAME", nome: dominio.split(".")[0], valor: "cname.vercel-dns.com", motivo: "apontamento", conferir: true },
    );
  }

  return registros;
}

/** Cadastra o domínio no projeto e devolve o que o cliente precisa configurar. */
export async function cadastrarDominio(tenantId, bruto) {
  if (!dominioConfigurado()) {
    throw new Error("Domínio próprio indisponível: VERCEL_TOKEN/VERCEL_PROJECT_ID não configurados.");
  }

  const dominio = normalizarDominio(bruto);
  if (!dominio) throw new Error("Domínio inválido. Use o formato imobiliaria.com.br.");

  // Um domínio não pode servir duas vitrines: o host é a única pista que a
  // requisição carrega para saber de quem é a página.
  const ocupado = await prisma.tenant.findFirst({
    where: { dominioProprio: dominio, NOT: { id: tenantId } },
    select: { slug: true },
  });
  if (ocupado) throw new Error("Este domínio já está em uso por outra imobiliária.");

  let info;
  try {
    info = await vercel(`/v10/projects/${PROJETO}/domains`, {
      method: "POST",
      corpo: { name: dominio },
    });
  } catch (erro) {
    // Já cadastrado neste projeto (ex.: tentativa anterior) não é erro: seguimos
    // para a consulta e devolvemos o estado atual.
    if (erro.codigo === "domain_already_in_use" || erro.status === 409) {
      info = await vercel(`/v9/projects/${PROJETO}/domains/${encodeURIComponent(dominio)}`);
    } else {
      throw erro;
    }
  }

  const registros = instrucoes(dominio, info);
  const verificado = Boolean(info?.verified);

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      dominioProprio: dominio,
      dominioStatus: verificado ? "ATIVO" : "PENDENTE",
      dominioAlvo: registros,
      dominioVerificadoEm: verificado ? new Date() : null,
    },
  });

  return { dominio, status: verificado ? "ATIVO" : "PENDENTE", registros };
}

/** Pergunta à Vercel se o DNS já aponta, e atualiza o tenant. */
export async function verificarDominio(tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { dominioProprio: true, dominioAlvo: true },
  });
  if (!tenant?.dominioProprio) return { status: "OMNIMOB", registros: [] };

  const dominio = tenant.dominioProprio;

  // `verify` empurra a Vercel a checar agora, em vez de esperar o ciclo dela.
  try {
    await vercel(`/v9/projects/${PROJETO}/domains/${encodeURIComponent(dominio)}/verify`, { method: "POST" });
  } catch {
    /* Falhar aqui é rotina enquanto o DNS não propagou — o estado real vem da
       consulta abaixo, que é quem manda. */
  }

  const info = await vercel(`/v9/projects/${PROJETO}/domains/${encodeURIComponent(dominio)}`);
  const verificado = Boolean(info?.verified);
  const registros = verificado ? [] : instrucoes(dominio, info);

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      dominioStatus: verificado ? "ATIVO" : "PENDENTE",
      dominioAlvo: registros,
      ...(verificado ? { dominioVerificadoEm: new Date() } : {}),
    },
  });

  return { dominio, status: verificado ? "ATIVO" : "PENDENTE", registros };
}

/** Desfaz: tira da Vercel e devolve a vitrine para o endereço da Omnimob. */
export async function removerDominio(tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { dominioProprio: true },
  });

  if (tenant?.dominioProprio && dominioConfigurado()) {
    try {
      await vercel(`/v9/projects/${PROJETO}/domains/${encodeURIComponent(tenant.dominioProprio)}`, {
        method: "DELETE",
      });
    } catch (erro) {
      /* Se a Vercel recusar, ainda assim soltamos o registro do nosso lado: o
         cliente pediu para sair, e prender o domínio aqui impediria ele de
         cadastrar em outro lugar. O órfão na Vercel é resolvido no painel. */
      console.warn(`[dominio] não consegui remover ${tenant.dominioProprio} da Vercel: ${erro.message}`);
    }
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      dominioProprio: null,
      dominioStatus: "OMNIMOB",
      dominioAlvo: null,
      dominioVerificadoEm: null,
    },
  });

  return { status: "OMNIMOB" };
}

/** Resolve o tenant a partir do host da requisição (vitrine em domínio próprio). */
export async function tenantPorDominio(host) {
  const dominio = normalizarDominio(host);
  if (!dominio) return null;
  return prisma.tenant.findFirst({
    where: { dominioProprio: dominio, dominioStatus: "ATIVO", ativo: true },
    select: { id: true, slug: true, name: true },
  });
}
