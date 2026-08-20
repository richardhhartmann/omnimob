import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermissao } from "../middlewares/permissaoMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { createTenantSchema, updateTenantProfileSchema, updateTenantConfiguracaoSchema } from "../validators/propertyValidators.js";
import {
  criarAssinatura,
  precosDosPlanos,
  agendarCancelamentoDoSlug,
  normalizarPeriodo,
} from "../services/pagamentoService.js";
import {
  fidelizarTrial,
  estenderTrial,
  registrarPesquisa,
  DIAS_DE_EXTENSAO,
} from "../services/trialService.js";
import { sendEmail } from "../services/notificationService.js";
import {
  emailAssinaturaConfirmada,
  emailRelatorioMensal,
  emailPesquisaTrial,
} from "../services/emailTemplates.js";
import { montarRelatorioMensal, mesFechadoAnterior } from "../services/relatorioService.js";
import {
  enderecoDaVitrine,
  cadastrarDominio,
  verificarDominio,
  removerDominio,
  dominioConfigurado,
} from "../services/dominioService.js";
import { planoInfo, requirePlano, requirePlanoDominio } from "../middlewares/planoMiddleware.js";
import { limparCacheDaVitrine } from "../services/dadosDaVitrine.js";
import { exportarTudo } from "../services/exportacaoCompleta.js";

/* A linha do tenant sem o que não é da conta do navegador.
 *
 * `res.json(tenant)` devolvia a linha inteira do banco — e ali dentro vai o
 * token da página do Facebook. Ele saía em texto puro para o front a cada
 * gravação de Configurações, ficava no cache do navegador e em qualquer
 * ferramenta de rede aberta na máquina do cliente. Cifrar em repouso resolveu o
 * dump do banco; isto resolve o outro caminho.
 *
 * Lista do que sai, e não do que fica: campo novo no schema entra na resposta
 * sozinho, que é o comportamento certo para dado comum. Segredo é a exceção e
 * merece ser nomeado. */
/* Tudo que é credencial de terceiro e nunca sai numa resposta. A lista cresceu
   junto com os canais: o token da página do Facebook, os do Mercado Livre (que
   publicam anúncio em nome do vendedor) e o da ponte de WhatsApp — este último
   é a credencial de uma sessão inteira do WhatsApp da imobiliária. */
const SEGREDOS_DO_TENANT = [
  "facebookPageToken",
  "mercadoLivreToken",
  "mercadoLivreRefresh",
  "whatsappPonteToken",
];

function semSegredos(tenant) {
  if (!tenant) return tenant;
  const saida = { ...tenant };
  for (const campo of SEGREDOS_DO_TENANT) delete saida[campo];
  return saida;
}

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
    return res.status(201).json(semSegredos(tenant));
  } catch (error) {
    return res.status(409).json({
      error: "Nao foi possivel criar tenant. Verifique slug unico.",
      details: error instanceof Error ? error.message : "Conflito",
    });
  }
});

/* ── Levar tudo embora ───────────────────────────────────────────────────────
   Um botão, um JSON. A API já permite tirar cada coisa em separado, mas exige
   chave, cliente HTTP e alguém que saiba paginar — o que responde ao
   integrador e não responde à imobiliária que está saindo, nem ao titular que
   exerce portabilidade.

   `verConfiguracoes` porque o arquivo traz a carteira inteira com CPF e
   telefone: é a permissão de quem responde pela conta, não a de quem opera. */
tenantRouter.get(
  "/me/exportar",
  requireAuth,
  requireTenant,
  requirePermissao("verConfiguracoes"),
  async (req, res) => {
    try {
      const dados = await exportarTudo(req.tenant.id);
      const data = new Date().toISOString().slice(0, 10);
      /* `Content-Disposition` para o navegador BAIXAR em vez de desenhar. Sem
         ele, um JSON de dezenas de megabytes abre numa aba e trava a máquina de
         quem clicou. */
      res.setHeader("Content-Disposition", `attachment; filename="omnimob-${req.tenant.slug}-${data}.json"`);
      res.type("application/json");
      return res.send(JSON.stringify(dados, null, 2));
    } catch (erro) {
      console.error("[tenant] exportar:", erro);
      return res.status(500).json({ error: "Erro ao gerar a exportação." });
    }
  },
);

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
    /* Endereço e horário alimentam os widgets da vitrine, que guardam o
       resultado apurado por um minuto. Sem isto, quem corrige o endereço e vai
       conferir no editor vê o antigo e conclui que não salvou. */
    limparCacheDaVitrine(req.tenant.id);
    return res.json(semSegredos(tenant));
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

    return res.json(semSegredos(tenant));
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

   Cargos continuam fora da conta. O motivo mudou: eram globais (sem `tenantId`)
   e contá-los seria mentira; hoje são da imobiliária, mas todo tenant nasce com
   o mesmo conjunto padrão — então o que existe ali é povoamento, não obra do
   cliente. Passariam a contar se um dia a origem de cada cargo for distinguida
   (criado no provisionamento × criado por gente). */
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

/* ── Relatório mensal (Profissional+) ────────────────────────────────────────
   Duas rotas para o mesmo relatório: uma MOSTRA na tela, outra MANDA por
   e-mail. A separação existe porque o e-mail chega uma vez por mês e some na
   caixa de entrada; a tela é onde alguém confere um mês específico quando
   precisa. E porque, sem pré-visualização, a primeira vez que se descobre que o
   relatório está errado é depois de ele ter ido para o cliente.

   `?ano=&mes=` opcionais: sem eles, vale o último mês FECHADO. O mês corrente
   dá um número que muda a cada visita e não se compara com nada. */
const requirePlanoRelatorio = requirePlano(1, "Profissional");

function periodoDaQuery(query) {
  const ano = Number(query.ano);
  const mes = Number(query.mes);
  const valido =
    Number.isInteger(ano) && ano >= 2000 && ano <= 2100 && Number.isInteger(mes) && mes >= 1 && mes <= 12;
  return valido ? { ano, mes } : mesFechadoAnterior();
}

tenantRouter.get(
  "/me/relatorio-mensal",
  requireAuth,
  requireTenant,
  requirePlanoRelatorio,
  requirePermissao("verRelatorios"),
  async (req, res) => {
    try {
      const relatorio = await montarRelatorioMensal(req.tenant.id, periodoDaQuery(req.query));
      return res.json(relatorio);
    } catch (err) {
      console.error("[GET /tenants/me/relatorio-mensal]", err);
      return res.status(500).json({ error: "Erro ao montar o relatório." });
    }
  },
);

tenantRouter.post(
  "/me/relatorio-mensal/enviar",
  requireAuth,
  requireTenant,
  requirePlanoRelatorio,
  requirePermissao("verRelatorios"),
  async (req, res) => {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenant.id },
        select: { name: true, email: true },
      });
      if (!tenant?.email) {
        return res.status(400).json({ error: "Esta imobiliária não tem e-mail cadastrado." });
      }

      const periodo = periodoDaQuery(req.body || {});
      const relatorio = await montarRelatorioMensal(req.tenant.id, periodo);
      const { subject, body, html } = emailRelatorioMensal({
        imobiliaria: tenant.name,
        relatorio,
        base: (process.env.APP_URL || "").replace(/\/+$/, ""),
      });

      await sendEmail({ to: tenant.email, subject, body, html });
      return res.json({ enviado: true, para: tenant.email, periodo: relatorio.periodo });
    } catch (err) {
      console.error("[POST /tenants/me/relatorio-mensal/enviar]", err);
      return res.status(500).json({ error: "Erro ao enviar o relatório.", detail: err.message });
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
        migracaoIntencao: true, migracaoResolvidaEm: true, trialEstendidoEm: true,
      },
    });
    if (!tenant) return res.status(404).json({ error: "Tenant não encontrado." });

    const emTrial = tenant.statusPagamento === "TRIAL";
    const corte = new Date(tenant.createdAt.getTime() + JANELA_DEMO_MS);
    const depoisDoCorte = { tenantId: tenant.id, createdAt: { gt: corte } };

    /* A última resposta da pesquisa entra na mesma leva das contagens de
       propósito: em produção cada ida ao banco custa perto de um segundo, e
       esta rota é pedida na montagem do painel. Em paralelo ela é de graça. */
    const [imoveis, clientes, usuarios, leads, fotos, ultimaPesquisa, respostas] = await Promise.all([
      prisma.property.count({ where: depoisDoCorte }),
      prisma.cliente.count({ where: depoisDoCorte }),
      prisma.usuario.count({ where: depoisDoCorte }),
      prisma.propertyLead.count({ where: depoisDoCorte }),
      prisma.propertyImage.count({ where: depoisDoCorte }),
      prisma.pesquisaTrial.findFirst({
        where: { tenantId: tenant.id },
        orderBy: { criadoEm: "desc" },
        select: { criadoEm: true, escolha: true },
      }),
      prisma.pesquisaTrial.count({ where: { tenantId: tenant.id } }),
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
      /* Quando a conta nasceu. O pulso da pesquisa usa para não perguntar nada
         na primeira meia hora, e a barra de progresso do teste sai da distância
         entre esta data e `expiraEm`. */
      criadoEm: tenant.createdAt,
      precos,
      inventario: {
        imoveis, clientes, usuarios, leads, fotos,
        vitrinePersonalizada: Boolean(tenant.showcaseConfig),
      },
      /* Tudo que o pulso da pesquisa precisa para decidir se hoje é dia de
         perguntar. Vem do SERVIDOR, e não só da marca no navegador, porque a
         conta é da imobiliária: quem dispensou a pergunta no computador do
         escritório não pode reencontrá-la no celular dez minutos depois. */
      pesquisa: {
        ultimaEm: ultimaPesquisa?.criadoEm || null,
        ultimaEscolha: ultimaPesquisa?.escolha || null,
        respostas,
        podeEstender: emTrial && !tenant.trialEstendidoEm,
        diasExtensao: DIAS_DE_EXTENSAO,
        estendidoEm: tenant.trialEstendidoEm,
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

/* ─── Pesquisa espontânea do teste ───────────────────────────────────────────
   Resposta do modal que aparece sozinho depois de a pessoa cadastrar ou editar
   algo durante o teste (`PulsoTrialModal`, no web).

   SEM PERMISSÃO ESPECIAL, ao contrário de `/me/assinar`: aqui ninguém compra
   nada nem troca o plano. Quem responde é quem estava trabalhando na tela —
   pode ser o corretor —, e exigir `gerenciarUsuarios` faria a pergunta aparecer
   para ele e o botão falhar com 403. Assinar continua exigindo permissão, no
   outro caminho: este modal só ABRE a tela de assinatura.

   O prazo extra é o único efeito real, e ele é limitado no serviço: uma vez por
   imobiliária, sete dias. Um "não" ali não é erro — é resposta —, então a rota
   devolve 200 com `estendido: false` e o motivo, e a tela diz o que der. */
const SENTIMENTOS = ["AMANDO", "NEUTRO", "DIFICIL"];
const ESCOLHAS = ["ASSINAR", "ESTENDER", "DEPOIS", "FECHOU"];

tenantRouter.post("/me/trial/pesquisa", requireAuth, requireTenant, async (req, res) => {
  const { sentimento, escolha, comentario, origem } = req.body || {};

  if (!ESCOLHAS.includes(escolha)) {
    return res.status(400).json({ error: "Escolha inválida." });
  }
  const sentimentoLimpo = SENTIMENTOS.includes(sentimento) ? sentimento : null;

  try {
    /* O nome de quem respondeu vai COPIADO para a linha da pesquisa (ver o
       modelo `PesquisaTrial`), então é preciso buscá-lo — o token só carrega o
       id. Em paralelo com o tenant para não somar mais uma ida ao banco. */
    const [tenant, usuario] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: req.tenant.id },
        select: { id: true, name: true, slug: true, email: true, statusPagamento: true, proximoVencimento: true },
      }),
      prisma.usuario.findFirst({
        where: { id: req.authUserId, tenantId: req.tenant.id },
        select: { nome: true, login: true },
      }),
    ]);
    if (!tenant) return res.status(404).json({ error: "Tenant não encontrado." });

    /* Só o esticão é recusado fora do teste; a resposta continua sendo gravada.
       Um tenant que assinou entre a abertura do modal e o clique respondeu de
       verdade, e jogar isso fora perderia justamente a opinião de quem converteu. */
    let extensao = { estendido: false, motivo: "NAO_ESTA_EM_TESTE" };
    if (escolha === "ESTENDER") {
      extensao = await estenderTrial(tenant.id);
    }

    const autor = usuario ? `${usuario.nome} (${usuario.login})` : "";
    await registrarPesquisa({
      tenantId: tenant.id,
      autor,
      sentimento: sentimentoLimpo,
      escolha,
      comentario,
      origem,
    });

    /* O aviso interno sai só quando há o que fazer com ele. "Estou amando" +
       "deixo para depois" é ótimo de saber no relatório e péssimo de receber
       por e-mail: some no meio da caixa e leva junto os que importavam. */
    const texto = String(comentario || "").trim();
    const vale = sentimentoLimpo === "DIFICIL" || escolha === "ESTENDER" || texto.length > 0;
    if (vale && process.env.CONTATO_EMAIL) {
      const diasRestantes = tenant.proximoVencimento
        ? Math.max(0, Math.ceil((tenant.proximoVencimento.getTime() - Date.now()) / 86400000))
        : null;
      const modelo = emailPesquisaTrial({
        imobiliaria: tenant.name,
        slug: tenant.slug,
        autor,
        sentimento: sentimentoLimpo,
        escolha,
        comentario: texto,
        diasRestantes,
        base: (process.env.APP_URL || "").replace(/\/+$/, ""),
        emailContato: tenant.email,
      });
      /* Sem `await`: a pessoa está olhando para um modal esperando o "pronto,
         seu teste vai até tal dia". O e-mail leva segundos no Resend e uma
         falha dele não muda nada do que já foi gravado. */
      sendEmail({
        to: process.env.CONTATO_EMAIL,
        subject: modelo.subject,
        body: modelo.body,
        html: modelo.html,
        ...(tenant.email ? { replyTo: tenant.email } : {}),
      }).catch((e) => console.error("[pesquisa-trial] aviso interno falhou:", e.message));
    }

    return res.json({
      ok: true,
      estendido: Boolean(extensao.estendido),
      motivo: extensao.estendido ? null : extensao.motivo,
      expiraEm: extensao.estendido ? extensao.expiraEm : tenant.proximoVencimento,
      diasGanhos: extensao.estendido ? extensao.dias : 0,
    });
  } catch (err) {
    console.error("[POST /tenants/me/trial/pesquisa]", err);
    return res.status(500).json({ error: "Erro ao registrar a resposta." });
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
    const { plano, periodo, tokenPagamento } = req.body || {};
    if (!["BASICO", "PROFISSIONAL", "PREMIUM"].includes(plano)) {
      return res.status(400).json({ error: "Plano inválido." });
    }
    // Período desconhecido não é erro: cai no mensal, que é o que sempre houve.
    const periodoEscolhido = normalizarPeriodo(periodo);

    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: req.tenant.id } });
      if (!tenant) return res.status(404).json({ error: "Tenant não encontrado." });

      const assinatura = await criarAssinatura({ tenant, plano, periodo: periodoEscolhido, tokenPagamento });

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
          /* No anual o que foi cobrado é o ano inteiro; anunciar o valor
             mensal aqui faria o e-mail contradizer a fatura do cartão. */
          valorRotulo: assinatura.valorCobrado
            ? `R$ ${assinatura.valorCobrado.toFixed(2).replace(".", ",")}/${
                assinatura.periodo === "anual" ? "ano" : "mês"
              }`
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
      if (
        err.code === "PROVEDOR_NAO_CONFIGURADO" ||
        err.code === "PLANO_SOB_CONSULTA" ||
        err.code === "PERIODO_INDISPONIVEL"
      ) {
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

/* ─── Cancelamento da assinatura, pedido pelo próprio cliente ────────────────
   O cancelamento é AGENDADO para o fim do período já pago, nunca imediato:
   quem pagou o mês tem direito ao mês. Até lá nada muda no painel — o tenant
   segue `EM_DIA`, com o plano que tem.

   Quem vira a chave para `CANCELADO` é o webhook do Stripe, ao receber
   `customer.subscription.deleted` na data do corte (ver stripeWebhookRoutes).
   Marcar aqui tiraria na hora o acesso de quem ainda tem período pago — e, se o
   cancelamento falhasse no provedor, deixaria o banco dizendo uma coisa e a
   cobrança fazendo outra.

   Duas etapas, como a troca de plano: sem `confirmar: true` a rota só relata o
   que vai acontecer. Cancelar assinatura não acontece por acidente. */
tenantRouter.post(
  "/me/cancelar-assinatura",
  requireAuth,
  requireTenant,
  requirePermissao("verConfiguracoes"),
  async (req, res) => {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenant.id },
        select: { id: true, slug: true, plano: true, statusPagamento: true, proximoVencimento: true },
      });
      if (!tenant) return res.status(404).json({ error: "Tenant não encontrado." });

      if (tenant.statusPagamento === "CANCELADO") {
        return res.status(409).json({
          error: "A assinatura desta conta já está cancelada.",
          code: "JA_CANCELADO",
        });
      }

      /* Teste não tem assinatura para cancelar — não há cobrança correndo. Ele
         expira sozinho na data, e o serviço de trial cuida disso. Oferecer um
         "cancelar" aqui só criaria a dúvida de estar perdendo algo agora. */
      if (tenant.statusPagamento === "TRIAL") {
        return res.status(409).json({
          error: "Sua conta está em teste e não há cobrança ativa. O teste termina sozinho na data — não é preciso cancelar nada.",
          code: "EM_TRIAL",
          terminaEm: tenant.proximoVencimento,
        });
      }

      if (!req.body?.confirmar) {
        return res.status(409).json({
          code: "CONFIRMAR_CANCELAMENTO",
          planoAtual: tenant.plano || "BASICO",
          validoAte: tenant.proximoVencimento,
        });
      }

      const resultado = await agendarCancelamentoDoSlug(tenant.slug);

      /* Sem provedor configurado o cancelamento não tem como acontecer de
         verdade. Responder "ok" aqui seria o pior desfecho possível: o cliente
         sai certo de que cancelou e a cobrança continua vindo. */
      if (!resultado.configurado) {
        return res.status(503).json({
          error: "O provedor de pagamento não está configurado. Fale com o time para cancelar.",
          code: "PROVEDOR_NAO_CONFIGURADO",
        });
      }

      /* Nenhuma assinatura ativa com este slug. Acontece quando a cobrança foi
         acertada por fora, ou já cancelada antes. Não é erro do cliente, mas
         também não podemos afirmar que cancelamos algo. */
      if (resultado.encontradas === 0) {
        return res.status(404).json({
          error: "Não encontrei uma assinatura ativa para esta conta. Fale com o time para confirmar o cancelamento.",
          code: "SEM_ASSINATURA",
        });
      }

      if (resultado.falhas.length && !resultado.agendadas.length) {
        return res.status(502).json({
          error: "O provedor recusou o cancelamento. Tente de novo em alguns minutos ou fale com o time.",
          code: "PROVEDOR_FALHOU",
        });
      }

      // A mais distante: com mais de uma assinatura (não deveria acontecer, mas
      // acontece), o acesso vale até a última acabar.
      const validoAte = resultado.agendadas
        .map((a) => a.terminaEm)
        .filter(Boolean)
        .sort((a, b) => b - a)[0] || tenant.proximoVencimento;

      return res.json({
        cancelado: true,
        validoAte,
        assinaturas: resultado.agendadas.length,
        // Uma falha parcial com outra agendada: a tela precisa poder dizer isso.
        falhasParciais: resultado.falhas.length,
      });
    } catch (err) {
      console.error("[POST /tenants/me/cancelar-assinatura]", err);
      return res.status(500).json({ error: "Erro ao cancelar a assinatura." });
    }
  },
);
