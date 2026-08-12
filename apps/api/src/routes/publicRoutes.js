import { Router } from "express";
import rateLimit from "express-rate-limit";
import prismaPkg from "@prisma/client";
import { prisma } from "../db.js";
import { planoPermiteTour360 } from "../middlewares/planoMiddleware.js";
import { sendEmail } from "../services/notificationService.js";
import {
  emailInteresseComercial,
  emailConviteTrial,
  emailTrialNoAr,
  emailAvisoNovoTrial,
} from "../services/emailTemplates.js";
import { interesseSchema, trialSchema } from "../validators/interesseValidators.js";
import { precosDosPlanos } from "../services/pagamentoService.js";
import { tenantPorDominio, enderecoDaVitrine } from "../services/dominioService.js";
import {
  criarTrial,
  assinarConvite,
  lerConvite,
  trialExistenteParaEmail,
  verificarSlug,
  MOTIVO_SLUG,
} from "../services/trialService.js";

const { PropertyStatus, MetricEventType } = prismaPkg;

// Tour 360° é recurso do Profissional+. Se o plano do tenant não libera, zeramos
// o flag `is360` das imagens para que a vitrine pública exiba a foto normalmente,
// sem o viewer panorâmico. O valor real permanece no banco.
function gate360(properties, plano) {
  if (planoPermiteTour360(plano)) return properties;
  const zerar = (imgs) => (imgs || []).map((img) => (img.is360 ? { ...img, is360: false } : img));
  return Array.isArray(properties)
    ? properties.map((p) => ({ ...p, images: zerar(p.images) }))
    : { ...properties, images: zerar(properties.images) };
}

function publicTenantShape(tenant) {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    whatsapp: tenant.whatsapp,
    email: tenant.email,
    description: tenant.description,
    slogan: tenant.slogan,
    logoUrl: tenant.logoUrl,
    primaryColor: tenant.primaryColor,
    secondaryColor: tenant.secondaryColor,
    showcaseHeadline: tenant.showcaseHeadline,
    showcaseSubheadline: tenant.showcaseSubheadline,
    showcaseConfig: tenant.showcaseConfig,
  };
}

export const publicRouter = Router();

publicRouter.get("/:tenantSlug/properties", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.tenantSlug },
    });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant nao encontrado." });
    }

    const properties = await prisma.property.findMany({
      where: { tenantId: tenant.id, status: PropertyStatus.ACTIVE },
      orderBy: { createdAt: "desc" },
      include: { images: { orderBy: { position: "asc" } } },
    });

    if (properties.length > 0) {
      const now = new Date();
      await prisma.$transaction([
        ...properties.map((property) =>
          prisma.property.update({
            where: { id: property.id },
            data: { viewCount: { increment: 1 } },
          })
        ),
        prisma.propertyMetricEvent.createMany({
          data: properties.map((property) => ({
            tenantId: tenant.id,
            propertyId: property.id,
            type: MetricEventType.VIEW,
            createdAt: now,
          })),
        }),
      ]);
    }

    return res.json({ tenant: publicTenantShape(tenant), properties: gate360(properties, tenant.plano) });
  } catch {
    return res.status(500).json({ error: "Erro ao carregar vitrine." });
  }
});

publicRouter.get("/:tenantSlug/properties/:propertyId", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.tenantSlug },
    });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant nao encontrado." });
    }

    const property = await prisma.property.findFirst({
      where: {
        id: req.params.propertyId,
        tenantId: tenant.id,
        status: PropertyStatus.ACTIVE,
      },
      include: { images: { orderBy: { position: "asc" } } },
    });

    if (!property) {
      return res.status(404).json({ error: "Imovel nao encontrado na vitrine." });
    }

    await prisma.$transaction([
      prisma.property.update({
        where: { id: property.id },
        data: { viewCount: { increment: 1 } },
      }),
      prisma.propertyMetricEvent.create({
        data: { tenantId: tenant.id, propertyId: property.id, type: MetricEventType.VIEW },
      }),
    ]);

    return res.json({
      tenant: publicTenantShape(tenant),
      property: gate360({ ...property, viewCount: property.viewCount + 1 }, tenant.plano),
    });
  } catch {
    return res.status(500).json({ error: "Erro ao carregar imovel." });
  }
});

publicRouter.post("/:tenantSlug/properties/:propertyId/interest", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.tenantSlug },
    });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant nao encontrado." });
    }

    const { name, email, phone, message } = req.body || {};

    const property = await prisma.property.findFirst({
      where: { id: req.params.propertyId, tenantId: tenant.id, status: PropertyStatus.ACTIVE },
    });

    if (!property) {
      return res.status(404).json({ error: "Imovel nao encontrado na vitrine." });
    }

    const updated = await prisma.property.update({
      where: { id: property.id },
      data: { leadCount: { increment: 1 } },
      select: { id: true, leadCount: true },
    });

    await prisma.propertyMetricEvent.create({
      data: { tenantId: tenant.id, propertyId: property.id, type: MetricEventType.LEAD },
    });

    await prisma.propertyLead.create({
      data: {
        tenantId: tenant.id,
        propertyId: property.id,
        name: typeof name === "string" ? name : null,
        email: typeof email === "string" ? email : null,
        phone: typeof phone === "string" ? phone : null,
        message: typeof message === "string" ? message : null,
        source: "showcase",
      },
    });

    return res.json({ message: "Interesse registrado com sucesso.", property: updated });
  } catch {
    return res.status(500).json({ error: "Erro ao registrar interesse." });
  }
});

/* ── Interesse comercial vindo da landing ────────────────────────────────────
   Formulário público: quem clica em "Quero este plano" ou "Assinar Omnimob" cai
   aqui. Não há tenant ainda — é alguém querendo virar um. O destino é só um
   e-mail para o time comercial; nada é gravado no banco (não existe modelo
   para isso e criar um pede migração).

   Limite próprio e apertado: é rota pública sem autenticação, e o limite geral
   de 300/min deixaria a caixa de entrada à mercê de qualquer script. */
const interesseLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { error: "Muitos envios seguidos. Tente novamente em alguns minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

publicRouter.post("/interesse", interesseLimiter, async (req, res) => {
  const parsed = interesseSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      error: "Dados inválidos.",
      details: parsed.error.flatten(),
    });
  }

  const { imobiliaria, email, telefone, plano, temWhatsapp, website } = parsed.data;

  // Isca preenchida = robô. Responde como se tivesse dado certo, para o robô não
  // aprender a contornar, mas não manda nada.
  if (website) {
    return res.json({ message: "Interesse registrado." });
  }

  const destino = process.env.CONTATO_EMAIL;
  if (!destino) {
    console.error(
      "[interesse] CONTATO_EMAIL não configurada — interesse recebido e NÃO entregue:",
      JSON.stringify(parsed.data),
    );
    return res.status(503).json({
      error: "Canal de contato indisponível no momento. Tente novamente mais tarde.",
    });
  }

  const modelo = emailInteresseComercial({ imobiliaria, email, telefone, plano, temWhatsapp });
  const envio = await sendEmail({
    to: destino,
    subject: modelo.subject,
    body: modelo.body,
    html: modelo.html,
    replyTo: email, // responder no cliente de e-mail já cai no interessado
  });

  if (envio.status === "failed") {
    console.error("[interesse] envio falhou, interesse perdido:", JSON.stringify(parsed.data));
    return res.status(502).json({ error: "Não foi possível enviar agora. Tente novamente." });
  }

  return res.json({ message: "Interesse registrado." });
});


/* ── Teste grátis (auto-atendimento em duas etapas) ──────────────────────────
   1. POST /public/trial            → valida, manda link mágico, NÃO cria nada
   2. POST /public/trial/confirmar  → confere o link e cria o tenant

   O ambiente só nasce depois do clique no e-mail, o que prova a posse do
   endereço. Sem essa prova, qualquer um cria ambientes em nome de terceiros.

   Limite bem mais apertado que o do formulário de interesse: a etapa 2 ESCREVE
   no banco (tenant, usuário, imóveis, métricas). */
const trialLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "Muitas tentativas a partir deste acesso. Tente novamente mais tarde." },
  standardHeaders: true,
  legacyHeaders: false,
});

/* Base pública do site para montar os links dos e-mails.

   APP_URL manda. Sem ela, cai na Origin da requisição — que é o endereço do
   FRONT (o host da API não serve: são origens diferentes neste projeto). A
   Origin só é aceita se estiver na lista do CORS: como ela vem no cabeçalho e
   cabeçalho se forja, aceitá-la de qualquer um deixaria um estranho fazer a
   Omnimob enviar e-mail com link para o domínio dele.

   Devolve null quando não há base confiável — melhor recusar o envio do que
   mandar um e-mail com "/comecar?token=..." solto, que não é clicável. */
const ORIGENS_OK = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : [];

function baseDoApp(req) {
  const configurada = (process.env.APP_URL || "").trim().replace(/\/+$/, "");
  if (configurada) return configurada;

  const origem = (req.get("origin") || "").replace(/\/+$/, "");
  if (origem && (ORIGENS_OK.includes(origem) || /^http:\/\/localhost(:\d+)?$/.test(origem))) {
    console.warn("[trial] APP_URL não configurada; usando a Origin da requisição:", origem);
    return origem;
  }
  return null;
}

/* Conferência do endereço da vitrine, enquanto a pessoa ainda está digitando o
   nome da imobiliária. Só lê, e é chamada a cada pausa na digitação, então tem
   limite próprio — bem mais folgado que o do teste, que escreve no banco.

   Não expõe nada de quem já existe: a resposta é um sim ou um não sobre um
   slug que o próprio visitante acabou de compor. */
const slugLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: "Muitas verificações. Aguarde um instante." },
  standardHeaders: true,
  legacyHeaders: false,
});

publicRouter.get("/slug", slugLimiter, async (req, res) => {
  const nome = typeof req.query?.nome === "string" ? req.query.nome.slice(0, 120) : "";
  try {
    const resultado = await verificarSlug(nome);
    return res.json({ ...resultado, mensagem: resultado.motivo ? MOTIVO_SLUG[resultado.motivo] : null });
  } catch (erro) {
    console.error("[slug] falha ao verificar:", erro);
    return res.status(500).json({ error: "Não foi possível verificar o endereço agora." });
  }
});

publicRouter.post("/trial", trialLimiter, async (req, res) => {
  const parsed = trialSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
  }

  const { imobiliaria, email, telefone, website, perfil, planoDesejado, migracao } = parsed.data;

  // Isca preenchida = robô. Responde como se tivesse dado certo e não faz nada.
  if (website) return res.json({ message: "Link enviado." });

  try {
    const jaTem = await trialExistenteParaEmail(email);
    if (jaTem) {
      return res.status(409).json({
        error: "Já existe um teste ativo para este e-mail. Verifique sua caixa de entrada.",
        slug: jaTem.slug,
      });
    }

    /* O endereço da vitrine é conferido de novo aqui, e não só na digitação: o
       aviso no formulário é conveniência, esta é a regra. Sem isto, bastaria
       enviar o formulário sem passar pelo campo (ou dois cadastros simultâneos
       com o mesmo nome) para o conflito voltar. */
    const endereco = await verificarSlug(imobiliaria);
    if (!endereco.disponivel) {
      return res.status(409).json({
        error: MOTIVO_SLUG[endereco.motivo] || "Escolha outro nome para a imobiliária.",
        code: "SLUG_INDISPONIVEL",
        motivo: endereco.motivo,
        slug: endereco.slug,
      });
    }

    const base = baseDoApp(req);
    if (!base) {
      console.error(
        "[trial] APP_URL não configurada e Origin não confiável — convite NÃO enviado para",
        email,
      );
      return res.status(503).json({
        error: "Cadastro indisponível no momento. Tente novamente mais tarde.",
      });
    }

    /* Perfil e migração viajam DENTRO do convite, e não numa tabela: entre
       pedir o teste e confirmar o e-mail não existe registro nenhum — o tenant
       só nasce no clique do link. Guardar isso em banco exigiria uma tabela de
       convites pendentes (e a faxina dela) para um dado que só interessa se a
       pessoa confirmar. No token, ele chega junto de quem confirmou. */
    const token = assinarConvite({
      imobiliaria,
      email,
      telefone,
      perfil,
      planoDesejado,
      migracao,
      // O endereço já mostrado na landing viaja junto para o ambiente nascer
      // onde foi prometido, e não num slug recalculado meia hora depois.
      slug: endereco.slug,
    });
    const link = `${base}/comecar?token=${encodeURIComponent(token)}`;

    const modelo = emailConviteTrial({ imobiliaria, link });
    const envio = await sendEmail({
      to: email,
      subject: modelo.subject,
      body: modelo.body,
      html: modelo.html,
    });

    // Em desenvolvimento o link vai para o log: sem domínio verificado no
    // provedor, o e-mail para terceiros não é entregue e o fluxo travaria aqui.
    if (envio.status !== "sent") {
      console.warn(`[trial] convite NÃO entregue a ${email}. Link para teste manual:\n${link}`);
    }

    return res.status(202).json({ message: "Link de confirmação enviado.", email });
  } catch (erro) {
    console.error("[trial] falha ao enviar convite:", erro);
    return res.status(500).json({ error: "Erro ao enviar o link de confirmação." });
  }
});

publicRouter.post("/trial/confirmar", trialLimiter, async (req, res) => {
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  if (!token) return res.status(400).json({ error: "Link inválido." });

  let convite;
  try {
    convite = lerConvite(token);
  } catch (erro) {
    return res.status(400).json({ error: erro.message, code: erro.code });
  }

  try {
    // Clicar duas vezes no mesmo link não pode gerar dois ambientes.
    const jaTem = await trialExistenteParaEmail(convite.email);
    if (jaTem) {
      return res.status(409).json({
        error: "Este teste já foi criado. Confira o e-mail com o acesso.",
        slug: jaTem.slug,
      });
    }

    /* O TESTE NASCE NO PLANO ESCOLHIDO NA LANDING, não mais sempre no Premium.

       Testar o produto inteiro e assinar um plano menor depois era a receita
       para a pior conversa possível: a pessoa passa 14 dias usando IA e
       publicação em redes, assina o Básico e descobre que perdeu as duas.
       Testando o que vai contratar, o que ela vê é o que ela compra.

       O `|| "PREMIUM"` cobre convites emitidos antes desta mudança, que estão
       no e-mail de alguém e ainda valem 30 minutos — sem ele, o link deles
       quebraria no meio do caminho. */
    const { tenant, login, senha, expiraEm, imoveis, aviso } = await criarTrial({
      imobiliaria: convite.imobiliaria,
      email: convite.email,
      telefone: convite.telefone || "",
      plano: convite.planoDesejado || "PREMIUM",
      // Convites emitidos antes desta mudança não trazem o campo; sem ele o
      // slug volta a ser calculado na hora, como era antes.
      slugEscolhido: convite.slug || "",
    });
    if (aviso) console.warn("[trial]", aviso);

    /* A intenção de migrar sai do convite e passa a morar no tenant.

       Aqui é a única passagem em que ela existe: o convite acaba de ser
       consumido e some, e quem vai responder a ela é o primeiro acesso, dias
       depois. Gravar falhando não pode derrubar a criação do ambiente — o
       teste vale mais que o lembrete —, então o erro só é registrado. */
    if (convite.migracao) {
      try {
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { migracaoIntencao: convite.migracao },
        });
      } catch (erro) {
        console.warn(`[trial] não gravei a intenção de migração de ${tenant.slug}: ${erro.message}`);
      }
    }

    const validade = expiraEm.toLocaleDateString("pt-BR");
    const base = baseDoApp(req) || "";

    const acesso = emailTrialNoAr({
      imobiliaria: convite.imobiliaria,
      login,
      senha,
      slug: tenant.slug,
      imoveis,
      validade,
      base,
      urlVitrine: enderecoDaVitrine(tenant, base),
    });
    await sendEmail({
      to: convite.email,
      subject: acesso.subject,
      body: acesso.body,
      html: acesso.html,
    });

    if (process.env.CONTATO_EMAIL) {
      const interno = emailAvisoNovoTrial({
        imobiliaria: convite.imobiliaria,
        email: convite.email,
        telefone: convite.telefone,
        slug: tenant.slug,
        validade,
        base,
        // Quem já opera e quer trazer a base é outro tipo de conversa: o aviso
        // interno precisa dizer isso na primeira linha, não no rodapé.
        perfil: convite.perfil,
        planoDesejado: convite.planoDesejado,
        migracao: convite.migracao,
      });
      await sendEmail({
        to: process.env.CONTATO_EMAIL,
        subject: interno.subject,
        body: interno.body,
        html: interno.html,
        replyTo: convite.email,
      });
    }

    return res.status(201).json({
      message: "Teste criado.",
      imobiliaria: convite.imobiliaria,
      slug: tenant.slug,
      login,
      senha,
      expiraEm: expiraEm.toISOString(),
      imoveis,
    });
  } catch (erro) {
    console.error("[trial] falha ao criar:", erro);
    if (erro.code === "SEM_ADMIN") {
      return res.status(503).json({ error: "Não foi possível preparar o ambiente agora. Tente novamente." });
    }
    return res.status(500).json({ error: "Erro ao criar o teste." });
  }
});

/* ── Planos e preços (público) ───────────────────────────────────────────────
   A landing lê os valores daqui em vez de trazê-los fixos no código: o que
   aparece na página é o mesmo que o Stripe vai cobrar, e mudar o preço lá
   reflete aqui sem deploy. Sem provedor configurado devolve vazio, e a landing
   cai nos rótulos de reserva dela. */
/* Descobre de quem é a vitrine a partir do endereço acessado.

   Quando a imobiliária traz o domínio dela, a requisição chega em
   `imobiliaria.com.br` e o front não tem slug nenhum na URL — o host é a única
   pista. Esta rota traduz host → slug, e daí em diante tudo segue igual.

   Pública e sem limite próprio porque responde uma pergunta que qualquer
   visitante já responde só de abrir o site, e devolve um único campo. */
publicRouter.get("/dominio", async (req, res) => {
  const t = await tenantPorDominio(req.query.host || req.get("host"));
  if (!t) return res.status(404).json({ error: "Nenhuma vitrine neste endereço." });
  return res.json({ slug: t.slug, nome: t.name });
});

publicRouter.get("/planos", async (_req, res) => {
  try {
    return res.json({ precos: await precosDosPlanos() });
  } catch (erro) {
    console.error("[planos] falha ao ler preços:", erro.message);
    return res.json({ precos: {} });
  }
});

/* ─── Sitemap ────────────────────────────────────────────────────────────────
   Lista a home e a vitrine de cada imobiliária ativa. Substitui o arquivo fixo
   que havia em `apps/web/public/`, e que só continha a home: as vitrines são o
   conteúdo que cresce, e um arquivo estático nunca saberia de uma imobiliária
   que entrou ontem.

   REGRA QUE GOVERNA O RESTO DESTA FUNÇÃO: um sitemap só pode listar URLs do
   MESMO host em que ele é servido. É por isso que existe o filtro lá embaixo,
   e é por isso que o endereço aqui é montado com `/vitrine/<slug>` em vez de
   sair do `enderecoDaVitrine()` — a vitrine que vive em domínio próprio, ou num
   subdomínio, está noutro host, e listá-la aqui faria o Google descartar a
   entrada. Quem tem domínio próprio precisa do sitemap dele, no domínio dele;
   é trabalho separado e ainda não existe.

   Servido a partir de `omnimob.app/sitemap.xml` por reescrita da Vercel (ver
   `apps/web/vercel.json`) — precisa ser servido de lá, e não de
   `api.omnimob.app`, exatamente pela regra do parágrafo acima. */

/** Escapa o que a XML não aceita cru. Slug é validado no cadastro, mas o
    endereço é montado por concatenação e um dia pode receber outra coisa. */
function xml(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

publicRouter.get("/sitemap.xml", async (req, res) => {
  try {
    const base = baseDoApp(req);
    if (!base) {
      console.warn("[sitemap] sem APP_URL nem Origin confiável; devolvendo só a home");
    }
    const site = (base || "https://omnimob.app").replace(/\/+$/, "");

    /* `ativo` é o interruptor da conta. CANCELADO fica de fora por decência com
       quem cancelou: continuar anunciando a vitrine dela na busca é divulgar um
       endereço que ela não quer mais no ar. TRIAL e ATRASADO entram — a vitrine
       responde nos dois casos, e sumir do índice a cada atraso de boleto seria
       pior para a imobiliária do que o próprio atraso. */
    const tenants = await prisma.tenant.findMany({
      where: { ativo: true, statusPagamento: { not: "CANCELADO" } },
      select: { slug: true, updatedAt: true, dominioProprio: true, dominioStatus: true },
      orderBy: { createdAt: "asc" },
    });

    const urls = [
      `  <url>\n    <loc>${xml(site)}/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>`,
    ];

    for (const t of tenants) {
      // Domínio próprio ATIVO = outro host. Ver a regra no topo do bloco.
      if (t.dominioProprio && t.dominioStatus === "ATIVO") continue;
      if (!t.slug) continue;
      const loc = `${site}/vitrine/${encodeURIComponent(t.slug)}`;
      const lastmod = t.updatedAt ? t.updatedAt.toISOString().slice(0, 10) : null;
      urls.push(
        `  <url>\n    <loc>${xml(loc)}</loc>\n` +
          (lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : "") +
          `    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>`
      );
    }

    const corpo = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;

    res.type("application/xml");
    // Uma hora de cache: o robô não volta com pressa, e isso protege o banco de
    // uma varredura repetida. `s-maxage` é o que a borda da Vercel respeita.
    res.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
    return res.send(corpo);
  } catch (erro) {
    console.error("[sitemap] falha ao montar:", erro.message);
    /* Devolver 500 faria o Google marcar o sitemap como quebrado e parar de
       buscá-lo por um tempo. Um sitemap válido só com a home é degradação
       melhor: nada some do índice por causa de uma falha momentânea de banco. */
    const site = (baseDoApp(req) || "https://omnimob.app").replace(/\/+$/, "");
    res.type("application/xml");
    return res.send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${xml(site)}/</loc>\n  </url>\n</urlset>\n`
    );
  }
});
