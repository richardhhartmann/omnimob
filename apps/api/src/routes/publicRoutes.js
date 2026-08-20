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
import { montarFeedVRSync } from "../services/feedPortais.js";
import { proximoResponsavel } from "../services/distribuicaoLeads.js";
import { dadosDaVitrine } from "../services/dadosDaVitrine.js";
import { emitir } from "../services/webhooks.js";
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

/* ── O endereço só sai se a imobiliária mandou ───────────────────────────────
   Esconder na tela não é esconder. A vitrine e a página do imóvel recebem o
   registro inteiro em JSON, e um `display: none` no navegador deixa a rua e o
   número a um clique de distância no painel de rede — visíveis para exatamente
   quem tem interesse em procurá-los.

   Então o corte é AQUI, antes de a resposta sair. Bairro, cidade e estado
   ficam: são o que o visitante precisa para se situar, e não levam ninguém à
   porta de quem ainda mora no imóvel.

   O CEP sai junto. Sozinho ele parece inofensivo, e não é: um CEP brasileiro de
   rua identifica o logradouro inteiro, e alguns identificam um único prédio —
   devolver o CEP escondendo a rua seria publicar a mesma informação em outro
   formato. */
function semEnderecoOculto(imovel) {
  if (!imovel || imovel.exibirEnderecoCompleto) return imovel;
  return { ...imovel, address: "", cep: null };
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

    /* ── A contagem de visitas NÃO segura a página ─────────────────────────
       Aqui estava a lentidão da vitrine.

       Era um `$transaction` com UM UPDATE POR IMÓVEL. Uma imobiliária com
       trinta anúncios fazia trinta e uma idas ao banco — em transação, e com
       `await` — antes de o primeiro byte da resposta sair. Contra o Supabase,
       cada ida custa dezenas de milissegundos, e o visitante pagava a soma
       inteira para ver a página.

       Duas mudanças, e as duas importam:

       1. `updateMany` no lugar de N `update`. O incremento é a mesma operação
          para todos os imóveis da lista, e o banco resolve em UMA instrução.

       2. Sem `await`. O visitante não precisa que o contador esteja gravado
          para ver a vitrine — a contagem é para o relatório da imobiliária, e
          uma escrita que falhe não pode derrubar a página de ninguém. Se o
          processo morrer entre a resposta e a gravação, perde-se uma visita
          num relatório; segurar a página para evitar isso é trocar o problema
          de alguém pelo de todo mundo.

       O `$transaction` continua porque as duas escritas descrevem o mesmo
       fato: contador e evento não podem divergir. */
    if (properties.length > 0) {
      const agora = new Date();
      const ids = properties.map((p) => p.id);
      prisma
        .$transaction([
          prisma.property.updateMany({
            where: { id: { in: ids } },
            data: { viewCount: { increment: 1 } },
          }),
          prisma.propertyMetricEvent.createMany({
            data: ids.map((propertyId) => ({
              tenantId: tenant.id,
              propertyId,
              type: MetricEventType.VIEW,
              createdAt: agora,
            })),
          }),
        ])
        .catch((erro) => console.warn(`[vitrine] não contei as visitas de ${tenant.slug}: ${erro.message}`));
    }

    /* Os dados reais dos widgets viajam JUNTO, no mesmo payload.

       Podia ser um endpoint próprio, e não é de propósito: esta resposta é o
       que a vitrine pública e o editor já buscam (os dois chamam
       `getPublicShowcase`), e uma segunda requisição significaria a página
       desenhar uma vez com a equipe vazia e de novo com ela preenchida — o
       reflow que a engine de layout existe para evitar. Como bônus, o editor
       recebe exatamente o que o visitante recebe, que é a regra WYSIWYG.

       A apuração falhar não pode derrubar a vitrine: sem o bloco, cada widget
       cai no conteúdo digitado à mão, que é o comportamento de antes. */
    let vitrine = null;
    try {
      vitrine = await dadosDaVitrine(tenant);
    } catch (erro) {
      console.warn(`[vitrine] não apurei os dados reais de ${tenant.slug}: ${erro.message}`);
    }

    return res.json({
      tenant: publicTenantShape(tenant),
      properties: gate360(properties, tenant.plano).map(semEnderecoOculto),
      vitrine,
    });
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
      property: semEnderecoOculto(gate360({ ...property, viewCount: property.viewCount + 1 }, tenant.plano)),
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

    /* O lead nasce com dono e com histórico.
       A distribuição não bloqueia nada: `proximoResponsavel` nunca lança e
       devolve `null` quando não há corretor elegível — nesse caso o lead cai na
       caixa comum, que é o certo para imobiliária de uma pessoa só. */
    const responsavel = await proximoResponsavel(tenant.id);
    const responsavelId = responsavel?.id || null;

    const lead = await prisma.propertyLead.create({
      data: {
        tenantId: tenant.id,
        propertyId: property.id,
        name: typeof name === "string" ? name : null,
        email: typeof email === "string" ? email : null,
        phone: typeof phone === "string" ? phone : null,
        message: typeof message === "string" ? message : null,
        source: "showcase",
        responsavelId,
        eventos: {
          create: [
            {
              tenantId: tenant.id,
              tipo: "CRIADO",
              texto: `Contato recebido pela vitrine, no imóvel "${property.title}".`,
            },
            ...(responsavel
              ? [{ tenantId: tenant.id, tipo: "RESPONSAVEL", para: responsavel.nome, texto: "Distribuído automaticamente." }]
              : []),
          ],
        },
      },
    });

    /* Avisa quem estiver ouvindo. NÃO é esperado: o `emitir` dispara e retorna
       na mesma linha. Um CRM lento faria o formulário da vitrine demorar, e um
       CRM fora do ar o faria falhar — para um visitante que não tem nada a ver
       com isso. O lead já está gravado; o aviso é consequência, não condição. */
    emitir(tenant.id, "lead.criado", {
      id: lead.id,
      nome: lead.name,
      email: lead.email,
      telefone: lead.phone,
      mensagem: lead.message,
      origem: lead.source,
      imovel: { id: property.id, title: property.title },
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

// Quebra de linha do XML. Constante porque escrevê-la dentro de um template
// aninhado vira escape dentro de escape, e ninguém mais lê a linha.
const BR = "\n";

/** Escapa o que a XML não aceita cru. Slug é validado no cadastro, mas o
    endereço é montado por concatenação e um dia pode receber outra coisa. */
function xml(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ── Vitrines publicadas ─────────────────────────────────────────────────────
   Alimenta a página `/vitrines` da Omnimob: as vitrines que estão de fato no
   ar, com quantos imóveis cada uma tem e uma foto de capa.

   É prova, não promessa — e é o único conteúdo da landing que nenhuma outra
   plataforma consegue inventar. Por isso os dados vêm do banco, e não de uma
   lista escrita à mão: uma lista fixa envelhece, e no dia em que um cliente
   sair a página continuaria exibindo a vitrine dele.

   ── O QUE NÃO SAI DAQUI ──

   Nada de e-mail, telefone, CNPJ ou dado de contato: a página mostra o
   TRABALHO da imobiliária, não a ficha dela. E só entra quem tem imóvel ativo
   com foto — vitrine vazia como vitrine de exemplo é propaganda contra si
   mesma.
   ────────────────────────────────────────────────────────────────────────── */
publicRouter.get("/vitrines", async (req, res) => {
  try {
    const tenants = await prisma.tenant.findMany({
      where: { ativo: true, statusPagamento: { not: "CANCELADO" } },
      select: {
        name: true, slug: true, cidade: true, estado: true, logoUrl: true,
        primaryColor: true, slogan: true, description: true,
        dominioProprio: true, dominioStatus: true,
        _count: { select: { properties: { where: { status: "ACTIVE" } } } },
        properties: {
          where: { status: "ACTIVE", images: { some: {} } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            city: true,
            images: { orderBy: { position: "asc" }, where: { is360: false }, take: 1, select: { url: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 60,
    });

    const base = (baseDoApp(req) || "https://omnimob.app").replace(/\/+$/, "");

    const vitrines = tenants
      .filter((t) => t.properties.length > 0 && t.properties[0].images.length > 0)
      .map((t) => ({
        nome: t.name,
        slug: t.slug,
        cidade: t.cidade || t.properties[0].city || "",
        estado: t.estado || "",
        logoUrl: t.logoUrl || "",
        cor: t.primaryColor || "#6366f1",
        // Slogan primeiro; a descrição entra recortada quando ele não existe.
        frase: t.slogan || (t.description ? `${t.description.slice(0, 120)}${t.description.length > 120 ? "…" : ""}` : ""),
        imoveis: t._count.properties,
        capa: t.properties[0].images[0].url,
        endereco: enderecoDaVitrine(t, base),
      }));

    res.set("Cache-Control", "public, max-age=600, s-maxage=600");
    return res.json({ vitrines, total: vitrines.length });
  } catch (erro) {
    console.error("[GET /public/vitrines]", erro);
    return res.status(500).json({ error: "Erro ao listar as vitrines." });
  }
});


/* ── Feed dos portais ────────────────────────────────────────────────────────
   `GET /public/:slug/feed.xml` — o endereço que a imobiliária cadastra no
   painel do ZAP, do VivaReal ou do OLX Imóveis. O robô do portal vem buscar; a
   Omnimob não empurra nada. Ver `services/feedPortais.js` para o formato e o
   porquê.

   Público e sem autenticação de propósito: é o robô do portal que lê, e ele não
   tem como se autenticar. O que protege é o conteúdo — só imóvel que a própria
   imobiliária marcou para publicar, os mesmos que já estão na vitrine aberta.

   Sem `res.status(500)` no erro: portal que recebe 500 marca a carga como
   falha e, dependendo do provedor, DESATIVA os anúncios já publicados. Um feed
   vazio diz "nada mudou" e é infinitamente menos destrutivo do que isso.
   ────────────────────────────────────────────────────────────────────────── */
publicRouter.get("/:slug/feed.xml", async (req, res) => {
  const slug = String(req.params.slug || "");
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, email: true, ativo: true, statusPagamento: true, dominioProprio: true, dominioStatus: true },
    });

    /* Conta desligada ou cancelada não alimenta portal. Não é rigor: anúncio
       que continua no ar depois de a imobiliária sair leva o cliente a um
       telefone que ninguém atende, e a reclamação chega no portal. */
    if (!tenant || !tenant.ativo || tenant.statusPagamento === "CANCELADO") {
      res.type("application/xml");
      return res.send(montarFeedVRSync({ name: "Omnimob" }, [], null));
    }

    /* Carimba QUANDO o portal veio buscar. É a única evidência que a
       imobiliária tem de que a integração com o ZAP está viva — não recebemos
       confirmação de carga, e "cadastrei a URL, e agora?" era uma pergunta sem
       resposta possível. Fora do caminho da resposta: o feed não pode esperar
       uma escrita, e um erro aqui não pode derrubar a carga do portal. */
    prisma.tenant
      .update({ where: { id: tenant.id }, data: { feedLidoEm: new Date() } })
      .catch(() => {});

    const imoveis = await prisma.property.findMany({
      where: { tenantId: tenant.id, status: "ACTIVE", publicarPortais: true },
      orderBy: { updatedAt: "desc" },
      include: {
        images: { orderBy: { position: "asc" }, where: { is360: false } },
        tipoImovel: { select: { descricao: true } },
      },
    });

    /* Sem foto, fora. O portal recusa o anúncio na importação e conta como
       erro no relatório de carga da imobiliária — ficar de fora é mais limpo. */
    const publicaveis = imoveis.filter((i) => i.images.length > 0);

    const base = (baseDoApp(req) || "https://omnimob.app").replace(/\/+$/, "");
    const vitrine = enderecoDaVitrine(tenant, base).replace(/\/+$/, "");

    const corpo = montarFeedVRSync(tenant, publicaveis, (i) => `${vitrine}/imovel/${i.id}`);

    res.type("application/xml");
    /* Meia hora. O robô do portal passa algumas vezes por dia; sem cache, uma
       varredura curiosa varreria o acervo inteiro a cada visita. */
    res.set("Cache-Control", "public, max-age=1800, s-maxage=1800");
    return res.send(corpo);
  } catch (erro) {
    console.error(`[feed.xml] ${slug}:`, erro.message);
    res.type("application/xml");
    return res.send(montarFeedVRSync({ name: "Omnimob" }, [], null));
  }
});

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

    /* A home e as páginas institucionais. Antes o sitemap tinha um endereço só
       para a Omnimob — a landing — e tudo mais eram vitrines de cliente. Termos,
       Privacidade, Sobre, Contato e a galeria de vitrines são páginas próprias e
       precisam ser indexadas como tal. */
    const PAGINAS_DA_OMNIMOB = [
      { caminho: "/", prioridade: "1.0", frequencia: "weekly" },
      { caminho: "/vitrines", prioridade: "0.8", frequencia: "weekly" },
      { caminho: "/sobre", prioridade: "0.6", frequencia: "monthly" },
      { caminho: "/contato", prioridade: "0.6", frequencia: "monthly" },
      { caminho: "/termos", prioridade: "0.3", frequencia: "yearly" },
      { caminho: "/privacidade", prioridade: "0.3", frequencia: "yearly" },
    ];

    const urls = PAGINAS_DA_OMNIMOB.map(
      (pagina) =>
        `  <url>` + BR + `    <loc>${xml(site)}${pagina.caminho}</loc>` + BR +
        `    <changefreq>${pagina.frequencia}</changefreq>` + BR +
        `    <priority>${pagina.prioridade}</priority>` + BR + `  </url>`
    );

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
