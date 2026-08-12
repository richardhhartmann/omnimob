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
import {
  enderecoDaVitrine,
  cadastrarDominio,
  verificarDominio,
  removerDominio,
  dominioConfigurado,
} from "../services/dominioService.js";
import { planoInfo, requirePlanoDominio } from "../middlewares/planoMiddleware.js";

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

/**
 * O que a imobiliária perde ao sair de um plano para outro.
 *
 * Só lista o que ela REALMENTE está usando: avisar que vai perder tour 360°
 * quem nunca subiu uma foto 360° é ruído, e ruído faz a pessoa parar de ler
 * justamente o aviso que importava.
 *
 * Devolve lista vazia quando o novo plano é maior ou igual — subir de plano
 * não tira nada de ninguém.
 */
async function consequenciasDaTroca(tenantId, planoAtual, planoNovo) {
  const antes = planoInfo(planoAtual);
  const depois = planoInfo(planoNovo);
  if (depois.nivel >= antes.nivel) return [];

  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { dominioProprio: true, dominioStatus: true, facebookPageName: true, instagramBusinessId: true, slug: true },
  });

  const perdas = [];

  if (antes.dominio && !depois.dominio && t?.dominioProprio) {
    perdas.push({
      recurso: "dominio",
      titulo: "Domínio próprio da vitrine",
      detalhe:
        `A vitrine sai de ${t.dominioProprio} e volta para o endereço da Omnimob. ` +
        `Quem acessar o domínio antigo não encontra mais o site, até você apontar ` +
        `o DNS para outro lugar.`,
      irreversivel: false,
    });
  }

  if (antes.redes && !depois.redes && (t?.facebookPageName || t?.instagramBusinessId)) {
    perdas.push({
      recurso: "redes",
      titulo: "Divulgação em redes sociais",
      detalhe: "As contas conectadas continuam vinculadas, mas novas publicações deixam de ser possíveis.",
      irreversivel: false,
    });
  }

  if (antes.tour360 && !depois.tour360) {
    const com360 = await prisma.propertyImage.count({ where: { property: { tenantId }, is360: true } });
    if (com360 > 0) {
      perdas.push({
        recurso: "tour360",
        titulo: "Tour virtual 360°",
        detalhe: `${com360} foto(s) 360° deixam de girar na vitrine e passam a aparecer como imagem comum.`,
        irreversivel: false,
      });
    }
  }

  if (antes.ia && !depois.ia) {
    perdas.push({
      recurso: "ia",
      titulo: "Geração de conteúdo por IA",
      detalhe: "Textos já gerados continuam salvos; a geração de novos deixa de estar disponível.",
      irreversivel: false,
    });
  }

  return perdas;
}

/* ─── Domínio próprio da vitrine ─────────────────────────────────────────────
   Quatro rotas, todas exigindo a mesma permissão que editar a página: mudar o
   endereço da vitrine é decisão de quem cuida da presença digital, não de quem
   cadastra imóvel.

   `editarPagina` OU `gerenciarUsuarios` porque em imobiliária pequena quem
   manda no site costuma ser o dono, e o dono nem sempre tem o cargo de editor.
   ────────────────────────────────────────────────────────────────────────── */

/* Leitura sem gate de plano: quem está no Básico precisa VER o recurso para
   saber que ele existe, e a resposta já diz que não está liberado. */
tenantRouter.get("/me/dominio", requireAuth, requireTenant, async (req, res) => {
  const t = await prisma.tenant.findUnique({
    where: { id: req.tenant.id },
    select: { slug: true, plano: true, dominioProprio: true, dominioStatus: true, dominioAlvo: true, dominioVerificadoEm: true },
  });
  return res.json({
    disponivel: dominioConfigurado(),
    liberadoNoPlano: planoInfo(t.plano).dominio,
    planoMinimo: "PROFISSIONAL",
    slug: t.slug,
    dominio: t.dominioProprio,
    status: t.dominioStatus,
    registros: t.dominioAlvo || [],
    verificadoEm: t.dominioVerificadoEm,
  });
});

tenantRouter.post(
  "/me/dominio",
  requireAuth,
  requireTenant,
  requirePermissao("editarPagina", "gerenciarUsuarios"),
  requirePlanoDominio,
  async (req, res) => {
    try {
      const r = await cadastrarDominio(req.tenant.id, req.body?.dominio);
      return res.status(201).json(r);
    } catch (erro) {
      console.error("[dominio] cadastro falhou:", erro.message);
      return res.status(400).json({ error: erro.message });
    }
  },
);

/* Separado do cadastro porque é o botão que a pessoa aperta VÁRIAS vezes,
   enquanto espera o DNS propagar — e propagação leva de minutos a horas. */
tenantRouter.post(
  "/me/dominio/verificar",
  requireAuth,
  requireTenant,
  requirePermissao("editarPagina", "gerenciarUsuarios"),
  requirePlanoDominio,
  async (req, res) => {
    try {
      return res.json(await verificarDominio(req.tenant.id));
    } catch (erro) {
      console.error("[dominio] verificação falhou:", erro.message);
      return res.status(400).json({ error: erro.message });
    }
  },
);

tenantRouter.delete(
  "/me/dominio",
  requireAuth,
  requireTenant,
  requirePermissao("editarPagina", "gerenciarUsuarios"),
  async (req, res) => {
    try {
      return res.json(await removerDominio(req.tenant.id));
    } catch (erro) {
      console.error("[dominio] remoção falhou:", erro.message);
      return res.status(400).json({ error: erro.message });
    }
  },
);

tenantRouter.get("/me/trial", requireAuth, requireTenant, async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenant.id },
      select: {
        id: true, name: true, plano: true, statusPagamento: true, valorMensal: true,
        proximoVencimento: true, createdAt: true, showcaseConfig: true,
        migracaoIntencao: true, migracaoResolvidaEm: true,
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
      /* Só vai quando ainda está PENDENTE. Quem já importou (ou já disse que
         faz depois) não precisa ver a oferta de novo, e resolver isso aqui
         evita que cada tela que consome esta resposta refaça a mesma conta. */
      migracao: tenant.migracaoIntencao && !tenant.migracaoResolvidaEm
        ? tenant.migracaoIntencao
        : null,
    });
  } catch (err) {
    console.error("[GET /tenants/me/trial]", err);
    return res.status(500).json({ error: "Erro ao carregar situação do teste." });
  }
});

/* Encerra o assunto "você disse que traria dados de outro sistema".

   Vale tanto para quem foi importar quanto para quem respondeu "depois": nos
   dois casos a pergunta já foi feita e respondida, e repeti-la a cada acesso
   seria cobrança. Quem mudar de ideia acha a importação em Configurações.

   Sem permissão especial de propósito: quem está vendo o boas-vindas é quem
   acabou de receber o ambiente, e dispensar um lembrete não desfaz nada. */
tenantRouter.post("/me/migracao/resolvida", requireAuth, requireTenant, async (req, res) => {
  try {
    await prisma.tenant.update({
      where: { id: req.tenant.id },
      data: { migracaoResolvidaEm: new Date() },
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[POST /tenants/me/migracao/resolvida]", err);
    return res.status(500).json({ error: "Erro ao registrar." });
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

      /* ─── Descida de plano desliga coisas que já estão em uso ──────────────
         Trocar de plano não é só mudar um rótulo: recursos que a imobiliária
         já configurou param de valer. O caso mais grave é o domínio próprio —
         o site dela sai do ar no endereço que os clientes conhecem e volta
         para o endereço da Omnimob.

         Por isso a primeira chamada não executa: ela devolve 409 com a lista
         do que será perdido, e só a segunda (com `confirmar: true`) aplica. É
         o mesmo desenho do ensaio da faxina — operação irreversível não
         acontece por acidente. */
      const perdas = await consequenciasDaTroca(tenant.id, tenant.plano, plano);

      if (perdas.length && !req.body?.confirmar) {
        return res.status(409).json({
          error: "Esta troca desliga recursos que você já está usando.",
          code: "CONFIRMAR_PERDAS",
          perdas,
          planoAtual: tenant.plano || "BASICO",
          planoNovo: plano,
        });
      }

      /* O domínio sai ANTES da troca: se a remoção falhar, o plano não muda e
         a imobiliária continua com o site no ar. O contrário deixaria o tenant
         no Básico com um domínio pendurado que ele não tem mais permissão para
         remover — preso dos dois lados. */
      const removeuDominio = perdas.some((p) => p.recurso === "dominio");
      if (removeuDominio) await removerDominio(tenant.id);

      const atualizado = await prisma.tenant.update({
        where: { id: tenant.id },
        data: { plano },
        select: { id: true, plano: true, statusPagamento: true, valorMensal: true, proximoVencimento: true },
      });

      return res.json({ tenant: atualizado, cobrancaAjustada: false, perdasAplicadas: perdas });
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
          urlVitrine: enderecoDaVitrine(tenant, (process.env.APP_URL || "").replace(/\/+$/, "")),
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
