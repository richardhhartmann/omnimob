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
    const jaEmUso = erro.codigo === "domain_already_in_use" || erro.status === 409;
    if (!jaEmUso) throw erro;

    /* "Já em uso" tem dois significados bem diferentes, e a Vercel usa o mesmo
       código para os dois:

         a) já está NESTE projeto — tentativa anterior que ficou pela metade.
            É o caso bom: consultamos e seguimos do ponto em que parou.

         b) está em OUTRO projeto ou outra conta Vercel. Aí a consulta abaixo
            devolve "Project Domain not found", que é a pior mensagem possível
            — ela diz que não achou, quando o problema é justamente ter achado
            no lugar errado.

       Um domínio só pode servir um projeto por vez, então (b) não é algo que
       resolvemos daqui: alguém precisa soltá-lo lá primeiro. */
    try {
      info = await vercel(`/v9/projects/${PROJETO}/domains/${encodeURIComponent(dominio)}`);
    } catch {
      throw new Error(
        `O domínio ${dominio} já está cadastrado em outro projeto da Vercel — um domínio ` +
          `só pode apontar para um projeto por vez. Remova-o lá (Vercel → Domains → ` +
          `${dominio} → Remove) e tente de novo aqui.`,
      );
    }
  }

  const registros = instrucoes(dominio, info);
  const verificado = Boolean(info?.verified);

  /* Para onde este domínio aponta HOJE.

     Cadastrar não é provar posse: a Vercel aceita qualquer nome e marca como
     não verificado — quem prova é o registro DNS, que só quem tem a senha do
     registrador consegue criar. Ou seja, digitar o domínio de outra empresa
     "passa", e por isso nada acontece com ele.

     O que faltava era dizer isso. Sem aviso, o cadastro parece ter funcionado
     e a pessoa fica esperando uma vitrine que nunca vai aparecer — ou, pior,
     descobre tarde demais que o endereço já era de um site no ar e que
     concluir a configuração vai derrubá-lo. */
  let aviso = null;
  if (!verificado) {
    try {
      const dns = await import("node:dns/promises");
      const [ips, cnames] = await Promise.all([
        dns.resolve4(dominio).catch(() => []),
        dns.resolveCname(dominio).catch(() => []),
      ]);
      if (ips.length || cnames.length) {
        aviso =
          `Atenção: ${dominio} já aponta para outro servidor hoje` +
          `${ips.length ? ` (${ips[0]})` : ""}. Se existe um site nesse endereço, ` +
          `ele sai do ar quando você trocar o DNS para cá.`;
      }
    } catch {
      /* Falha de DNS aqui é só a perda do aviso — o cadastro continua válido. */
    }
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      dominioProprio: dominio,
      dominioStatus: verificado ? "ATIVO" : "PENDENTE",
      dominioAlvo: registros,
      dominioVerificadoEm: verificado ? new Date() : null,
    },
  });

  return { dominio, status: verificado ? "ATIVO" : "PENDENTE", registros, aviso };
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

/* ─── Subdomínio da casa: <slug>.omnimob.app ─────────────────────────────────
   O caminho óbvio seria cadastrar `*.omnimob.app` como domínio curinga do
   projeto. A Vercel aceita cadastrar, mas marca "Invalid Configuration" e exige
   que o domínio use os nameservers DELA — e os nossos estão na Hostinger, onde
   vivem os MX, o SPF, os três DKIM e, principalmente, o CNAME de
   `api.omnimob.app` que aponta para o Render. Migrar nameserver por causa de um
   endereço bonito arriscaria derrubar e-mail e API juntos.

   O contorno tem duas partes:

     1. UM registro DNS curinga na Hostinger (`*` → CNAME da Vercel), feito uma
        vez, que faz qualquer subdomínio resolver para lá;

     2. cada `<slug>.omnimob.app` cadastrado individualmente no projeto — que é
        a mesma operação do domínio do cliente, e essa a Vercel faz com DNS
        externo sem reclamar.

   Como o DNS já resolve pelo curinga, a verificação passa na hora: não há
   espera de propagação como no domínio do cliente.

   Custo a vigiar: cada tenant ocupa um slot de domínio do projeto. Com curinga
   seria um só — vale conferir o limite do plano antes de escalar.
   ────────────────────────────────────────────────────────────────────────── */

const RAIZ = process.env.VITRINE_DOMINIO_RAIZ || "omnimob.app";

/**
 * Garante que `<slug>.omnimob.app` esteja cadastrado no projeto da Vercel.
 *
 * Idempotente de propósito: é chamada no provisionamento e pode ser rodada de
 * novo em lote sobre tenants antigos sem quebrar. Nunca lança — falhar aqui não
 * pode impedir a criação da imobiliária, que é a operação importante. O
 * endereço de caminho (`/vitrine/<slug>`) continua funcionando de qualquer
 * forma, então o pior caso é o subdomínio não existir ainda.
 */
export async function garantirSubdominioDaCasa(slug) {
  if (!dominioConfigurado() || !slug) {
    return { ok: false, host: slug ? `${slug}.${RAIZ}` : null, motivo: "VERCEL_TOKEN/VERCEL_PROJECT_ID não configurados" };
  }

  const host = `${slug}.${RAIZ}`;
  try {
    await vercel(`/v10/projects/${PROJETO}/domains`, { method: "POST", corpo: { name: host } });
    return { ok: true, host, criado: true };
  } catch (erro) {
    const jaEmUso = erro.codigo === "domain_already_in_use" || erro.status === 409;
    if (!jaEmUso) {
      console.warn(`[dominio] não consegui cadastrar ${host} na Vercel: ${erro.message}`);
      return { ok: false, host, motivo: erro.message };
    }

    /* "Já em uso" tem dois significados, e a Vercel usa o mesmo código para os
       dois — a mesma armadilha que `cadastrarDominio` já tratava, e que aqui
       estava sendo lida como sucesso puro e simples:

         a) já está NESTE projeto — o caso bom, e o esperado ao reexecutar.
         b) está em OUTRO projeto ou outra conta. Aí o endereço NUNCA vai
            responder por aqui, e devolver `ok: true` fazia o painel anunciar
            para o cliente uma vitrine que não abre.

       A consulta abaixo separa os dois: ela só encontra o domínio se ele
       estiver neste projeto. */
    try {
      const info = await vercel(`/v9/projects/${PROJETO}/domains/${encodeURIComponent(host)}`);
      return { ok: true, host, criado: false, verificado: info?.verified !== false };
    } catch {
      const motivo =
        `${host} está cadastrado em OUTRO projeto da Vercel — um domínio só serve um projeto ` +
        `por vez. Remova-o lá (Vercel → Domains) e rode 'npm run subdominios -- --aplicar'.`;
      console.warn(`[dominio] ${motivo}`);
      return { ok: false, host, motivo };
    }
  }
}

/**
 * O subdomínio da casa está mesmo de pé?
 *
 * Consulta a Vercel em vez de tentar abrir o endereço: um GET no host devolve
 * erro de TLS enquanto o certificado não sai, e isso é indistinguível de
 * "domínio não existe" para quem lê o resultado. A Vercel sabe a diferença.
 *
 * @returns {{ host, registrado: boolean, verificado: boolean, motivo?: string }}
 */
export async function conferirSubdominioDaCasa(slug) {
  const host = `${slug}.${RAIZ}`;
  if (!dominioConfigurado() || !slug) {
    return { host, registrado: false, verificado: false, motivo: "não configurado" };
  }
  try {
    const info = await vercel(`/v9/projects/${PROJETO}/domains/${encodeURIComponent(host)}`);
    return { host, registrado: true, verificado: info?.verified !== false };
  } catch (erro) {
    return { host, registrado: false, verificado: false, motivo: erro.message };
  }
}

/* ─── Endereço público da vitrine ────────────────────────────────────────────
   Mesma decisão que o front toma em `enderecoVitrine.js`, e ela precisa existir
   aqui também porque o servidor manda e-mail: "Ver minha vitrine", o aviso de
   assinatura, o resumo que vai para o time. Um link de e-mail com o endereço
   antigo é pior que um link errado na tela — a pessoa guarda o e-mail, encaminha
   para o corretor, cola no WhatsApp.

   A ordem é a mesma dos dois lados:
     1. domínio da imobiliária, se estiver ATIVO
     2. subdomínio da casa, se o recurso estiver ligado
     3. caminho `<APP_URL>/vitrine/<slug>`

   `VITRINE_SUBDOMINIO` é separado do `VITE_VITRINE_SUBDOMINIO` do front por
   necessidade — são processos diferentes, em hospedagens diferentes. Ligue os
   dois juntos, ou o e-mail e a tela vão divulgar endereços diferentes. */
const SUBDOMINIO_LIGADO = process.env.VITRINE_SUBDOMINIO === "true";

/**
 * @param {{ slug: string, dominioProprio?: string|null, dominioStatus?: string }} tenant
 * @param {string} base — APP_URL, usada só no formato de caminho
 */
export function enderecoDaVitrine(tenant, base = "") {
  if (!tenant?.slug) return "";
  if (tenant.dominioProprio && tenant.dominioStatus === "ATIVO") {
    return `https://${tenant.dominioProprio}`;
  }
  if (SUBDOMINIO_LIGADO) return `https://${tenant.slug}.${RAIZ}`;
  return `${String(base).replace(/\/+$/, "")}/vitrine/${tenant.slug}`;
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
