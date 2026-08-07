import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermissao } from "../middlewares/permissaoMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { createTenantSchema, updateTenantProfileSchema, updateTenantConfiguracaoSchema } from "../validators/propertyValidators.js";
import { criarAssinatura, precosDosPlanos } from "../services/pagamentoService.js";
import { fidelizarTrial } from "../services/trialService.js";
import { sendEmail } from "../services/notificationService.js";
import { emailAssinaturaConfirmada } from "../services/emailTemplates.js";
import { planoInfo } from "../middlewares/planoMiddleware.js";

export const tenantRouter = Router();

tenantRouter.get("/", requireAuth, async (req, res) => {
  try {
    const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: "asc" } });
    return res.json(tenants);
  } catch {
    return res.status(500).json({ error: "Erro ao listar tenants." });
  }
});

tenantRouter.post("/", requireAuth, async (req, res) => {
  try {
    if (req.authRole !== "ADMIN") {
      return res.status(403).json({ error: "Apenas administradores podem criar tenants." });
    }

    const parsed = createTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados invalidos para tenant.", details: parsed.error.flatten() });
    }

    const tenant = await prisma.tenant.create({ data: parsed.data });
    return res.status(201).json(tenant);
  } catch (error) {
    return res.status(409).json({
      error: "Nao foi possivel criar tenant. Verifique slug unico.",
      details: error instanceof Error ? error.message : "Conflito",
    });
  }
});

tenantRouter.get("/me", requireTenant, async (req, res) => {
  try {
    return res.json(req.tenant);
  } catch {
    return res.status(500).json({ error: "Erro ao buscar perfil do tenant." });
  }
});

tenantRouter.put("/me/configuracao", requireAuth, requireTenant, requirePermissao("editarPagina", "gerenciarUsuarios"), async (req, res) => {
  try {
    const parsed = updateTenantConfiguracaoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos para configuração.", details: parsed.error.flatten() });
    }
    const tenant = await prisma.tenant.update({
      where: { id: req.tenant.id },
      data: parsed.data,
    });
    return res.json(tenant);
  } catch {
    return res.status(500).json({ error: "Erro ao salvar configurações." });
  }
});

tenantRouter.put("/me", requireAuth, requireTenant, requirePermissao("editarPagina"), async (req, res) => {
  try {
    const parsed = updateTenantProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados invalidos para atualizar tenant.", details: parsed.error.flatten() });
    }

    const tenant = await prisma.tenant.update({
      where: { id: req.tenant.id },
      data: parsed.data,
    });

    return res.json(tenant);
  } catch {
    return res.status(500).json({ error: "Erro ao atualizar perfil do tenant." });
  }
});

/* ── Trial: situação e conversão ─────────────────────────────────────────────
   Alimenta o aviso de trial no painel e executa a assinatura.

   COMO SEPARAMOS O QUE É DEMONSTRAÇÃO DO QUE O CLIENTE FEZ: o povoamento de
   demonstração acontece na criação do tenant, em segundos. Então tudo que
   nasceu depois de uma janela curta a partir de `tenant.createdAt` é obra do
   próprio cliente. É heurística, mas não exige coluna nova (nem migração) e
   não quebra se ele editar um registro de exemplo — `createdAt` não muda.

   Cargos ficam de fora da conta de propósito: no schema atual `Cargo` não tem
   `tenantId`, é global. Contar como perda do cliente seria mentira. */
const JANELA_DEMO_MS = 90 * 1000;

tenantRouter.get("/me/trial", requireAuth, requireTenant, async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenant.id },
      select: {
        id: true, name: true, plano: true, statusPagamento: true, valorMensal: true,
        proximoVencimento: true, createdAt: true, showcaseConfig: true,
      },
    });
    if (!tenant) return res.status(404).json({ error: "Tenant não encontrado." });

    const emTrial = tenant.statusPagamento === "TRIAL";
    const corte = new Date(tenant.createdAt.getTime() + JANELA_DEMO_MS);
    const depoisDoCorte = { tenantId: tenant.id, createdAt: { gt: corte } };

    const [imoveis, clientes, usuarios, leads, fotos] = await Promise.all([
      prisma.property.count({ where: depoisDoCorte }),
      prisma.cliente.count({ where: depoisDoCorte }),
      prisma.usuario.count({ where: depoisDoCorte }),
      prisma.propertyLead.count({ where: depoisDoCorte }),
      prisma.propertyImage.count({ where: depoisDoCorte }),
    ]);

    // Quais planos dá para assinar agora, com o preço que está valendo no
    // provedor. Sem isso a tela ofereceria plano que a cobrança recusa.
    const precos = await precosDosPlanos();

    const expiraEm = tenant.proximoVencimento;
    const diasRestantes = expiraEm
      ? Math.max(0, Math.ceil((expiraEm.getTime() - Date.now()) / 86400000))
      : null;

    /* Gatilho das boas-vindas no painel. Só diz que a assinatura está ativa —
       QUANDO ela começou o schema não guarda, e quem "assina" pode ter testado
       antes por semanas, então a idade do tenant não serve de pista.

       Quem garante que o modal aparece uma vez só é o cliente, com uma marca no
       navegador. É deliberado: gravar isso no servidor pediria coluna nova (e
       migração) para um detalhe de interface. O preço é que um cliente antigo
       abrindo em outra máquina veria uma boas-vindas fora de hora — some assim
       que existir um `assinadoEm` de verdade. */
    const assinaturaAtiva = tenant.statusPagamento === "EM_DIA";

    return res.json({
      emTrial,
      assinaturaAtiva,
      nomeTenant: tenant.name,
      valorMensal: tenant.valorMensal ? Number(tenant.valorMensal) : null,
      plano: tenant.plano,
      expiraEm,
      diasRestantes,
      precos,
      inventario: {
        imoveis, clientes, usuarios, leads, fotos,
        vitrinePersonalizada: Boolean(tenant.showcaseConfig),
      },
    });
  } catch (err) {
    console.error("[GET /tenants/me/trial]", err);
    return res.status(500).json({ error: "Erro ao carregar situação do teste." });
  }
});

/* Troca de plano de quem JÁ É CLIENTE — o upgrade/downgrade das Configurações.

   Rota separada de `/me/assinar` por uma razão concreta: aquela cria uma
   assinatura NOVA no provedor (`POST /subscriptions`), o que para um tenant já
   pagante significaria uma segunda cobrança mensal rodando em paralelo. Por
   isso o trial é recusado aqui e o cliente pagante é recusado lá.

   ATENÇÃO — O QUE ESTA ROTA NÃO FAZ: ela muda o que o cliente USA, não o que
   ele PAGA. Ajustar a assinatura no Stripe exige o id dela, e o schema não o
   guarda em lugar nenhum (`criarAssinatura` devolve `assinaturaId` e ninguém
   persiste). Enquanto essa coluna não existir, o valor da próxima fatura é
   acertado pelo time — e a resposta diz isso em `cobrancaAjustada: false` para
   a tela não prometer o que não aconteceu. */
tenantRouter.post(
  "/me/plano",
  requireAuth,
  requireTenant,
  requirePermissao("gerenciarUsuarios"),
  async (req, res) => {
    const { plano } = req.body || {};
    if (!["BASICO", "PROFISSIONAL", "PREMIUM"].includes(plano)) {
      return res.status(400).json({ error: "Plano inválido." });
    }

    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenant.id },
        select: { id: true, plano: true, statusPagamento: true },
      });
      if (!tenant) return res.status(404).json({ error: "Tenant não encontrado." });

      // Em teste não se troca de plano: se assina. O caminho é o outro, e ele
      // cobra — mandar o trial por aqui daria produto de graça.
      if (tenant.statusPagamento === "TRIAL") {
        return res.status(409).json({
          error: "Sua conta ainda está em teste. Assine para escolher um plano.",
          code: "EM_TRIAL",
        });
      }
      if ((tenant.plano || "BASICO") === plano) {
        return res.status(400).json({ error: "Este já é o seu plano atual." });
      }

      const atualizado = await prisma.tenant.update({
        where: { id: tenant.id },
        data: { plano },
        select: { id: true, plano: true, statusPagamento: true, valorMensal: true, proximoVencimento: true },
      });

      return res.json({ tenant: atualizado, cobrancaAjustada: false });
    } catch (err) {
      console.error("[POST /tenants/me/plano]", err);
      return res.status(500).json({ error: "Erro ao trocar o plano." });
    }
  },
);

tenantRouter.post(
  "/me/assinar",
  requireAuth,
  requireTenant,
  requirePermissao("gerenciarUsuarios"),
  async (req, res) => {
    const { plano, tokenPagamento } = req.body || {};
    if (!["BASICO", "PROFISSIONAL", "PREMIUM"].includes(plano)) {
      return res.status(400).json({ error: "Plano inválido." });
    }

    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: req.tenant.id } });
      if (!tenant) return res.status(404).json({ error: "Tenant não encontrado." });

      const assinatura = await criarAssinatura({ tenant, plano, tokenPagamento });

      const atualizado = await fidelizarTrial(tenant.id, {
        plano,
        valorMensal: assinatura.valorMensal,
        proximoVencimento: assinatura.proximoVencimento,
      });

      /* Confirmação por escrito: a tela de comemoração some quando a pessoa
         fecha, e ela precisa ter em algum lugar o que contratou e quando cai a
         próxima cobrança. Falha de envio não desfaz a assinatura — já foi
         cobrada —, então só registramos. */
      if (tenant.email) {
        const corte = new Date(tenant.createdAt.getTime() + JANELA_DEMO_MS);
        const depois = { tenantId: tenant.id, createdAt: { gt: corte } };
        const [imoveis, clientes, usuarios, leads, fotos] = await Promise.all([
          prisma.property.count({ where: depois }),
          prisma.cliente.count({ where: depois }),
          prisma.usuario.count({ where: depois }),
          prisma.propertyLead.count({ where: depois }),
          prisma.propertyImage.count({ where: depois }),
        ]);
        const info = planoInfo(plano);
        const modelo = emailAssinaturaConfirmada({
          imobiliaria: tenant.name,
          plano: info?.nome || plano,
          valorRotulo: assinatura.valorMensal
            ? `R$ ${assinatura.valorMensal.toFixed(2).replace(".", ",")}/mês`
            : "conforme contratado",
          proximaCobranca: assinatura.proximoVencimento
            ? assinatura.proximoVencimento.toLocaleDateString("pt-BR")
            : "",
          inventario: { imoveis, clientes, usuarios, leads, fotos },
          recursos: [
            "Imóveis, vitrine, leads, clientes e equipe sem limite de uso",
            info?.redes && "Publicação em Facebook, Instagram e WhatsApp",
            info?.tour360 && "Tour virtual 360° nos imóveis",
            info?.ia && "Descrição, título e legendas gerados por IA",
          ].filter(Boolean),
          base: (process.env.APP_URL || "").replace(/\/+$/, ""),
          slug: tenant.slug,
        });
        await sendEmail({
          to: tenant.email,
          subject: modelo.subject,
          body: modelo.body,
          html: modelo.html,
        }).catch((e) => console.error("[assinar] e-mail de confirmação falhou:", e.message));
      }

      return res.json({ tenant: atualizado, assinaturaId: assinatura.assinaturaId });
    } catch (err) {
      // Falta de provedor e plano sob consulta não são erro do cliente: são
      // caminhos previstos, e a interface oferece falar com o time.
      if (err.code === "PROVEDOR_NAO_CONFIGURADO" || err.code === "PLANO_SOB_CONSULTA") {
        return res.status(503).json({ error: err.message, code: err.code });
      }
      if (err.code === "TOKEN_AUSENTE" || err.code === "RECUSADO") {
        return res.status(402).json({ error: err.message, code: err.code });
      }
      console.error("[POST /tenants/me/assinar]", err);
      return res.status(500).json({ error: "Erro ao processar a assinatura." });
    }
  },
);
