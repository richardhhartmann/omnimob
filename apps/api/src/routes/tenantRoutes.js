import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth, requireAuthOuReativacao } from "../middlewares/authMiddleware.js";
import { requirePermissao } from "../middlewares/permissaoMiddleware.js";
import { requireTenant, requireTenantMesmoSuspenso } from "../middlewares/tenantMiddleware.js";
import { createTenantSchema, updateTenantProfileSchema, updateTenantConfiguracaoSchema } from "../validators/propertyValidators.js";
import {
  criarAssinatura,
  criarAssinaturaPix,
  criarAssinaturaBoleto,
  meiosDisponiveis,
  marcaDaConta,
  cobrancaEmAberto,
  ajustarAssinatura,
  normalizarPacote,
  modulosDoPacote,
  precosDosPlanos,
  agendarCancelamentoDoSlug,
  normalizarPeriodo,
} from "../services/pagamentoService.js";
import {
  fidelizarTrial,
  situacaoDeGraca,
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
import { montarPainelGestor } from "../services/painelGestor.js";
import { normalizarAtalhos } from "../services/atalhos.js";
import {
  enderecoDaVitrine,
  cadastrarDominio,
  verificarDominio,
  removerDominio,
  dominioConfigurado,
} from "../services/dominioService.js";
import { planoInfo, requirePlano, requirePlanoDominio } from "../middlewares/planoMiddleware.js";
import { limparCacheDaVitrine } from "../services/dadosDaVitrine.js";
import { cifrar } from "../services/cofre.js";
import { modulosDoTenant } from "../services/modulos.js";
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
  /* O token do provedor de assinatura (Clicksign/DocuSign). É a credencial que
     ASSINA CONTRATO em nome da imobiliária — a mais sensível desta lista. Ver
     `services/flow/assinatura.js`. */
  "assinaturaToken",
  /* Este NÃO é credencial, e está aqui por outro motivo: é a referência da
     assinatura dentro da conta Stripe da Omnimob. Ninguém no navegador do
     cliente tem uso para ela, e um id de cobrança circulando na resposta é o
     tipo de detalhe interno que acaba num print de suporte ou num relato de
     bug público. O filtro se chama SEGREDOS, mas o que ele garante é "não sai
     na resposta" — e é isso que este campo precisa. */
  "assinaturaId",
];

function semSegredos(tenant) {
  if (!tenant) return tenant;
  const saida = { ...tenant };
  /* ── EXISTE, sem dizer QUAL ────────────────────────────────────────────────
     A tela de Configurações → Flow precisa mostrar "conectado à Clicksign" e
     oferecer substituir o token. Devolver o valor mascarado seria a saída fácil
     e é uma armadilha: um campo que volta com asteriscos convida a "salvar sem
     mexer", e o salvamento gravaria os asteriscos por cima da chave boa. O
     sintoma seria "os contratos pararam de sair", no dia seguinte, sem pista.

     Um booleano responde a pergunta da tela e não carrega segredo nenhum. */
  saida.assinaturaConfigurada = Boolean(tenant.assinaturaToken);
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
    /* ── `semSegredos`, e não `req.tenant` cru ────────────────────────────
       Esta rota devolvia a linha inteira do banco. O `tenantMiddleware` põe em
       `req.tenant` o resultado de um `findUnique` sem `select`, ou seja, TODAS
       as colunas — inclusive o token da página do Facebook, os do Mercado Livre,
       o da ponte de WhatsApp e o do provedor de assinatura.

       Eles são cifrados em repouso (`services/cofre.js`), então o que saía era
       texto cifrado e não a credencial em claro. Ainda assim não devia sair: o
       filtro existe exatamente para isso e esta rota era a única que não passava
       por ele — as outras seis já passavam.

       Foi um teste do ajuste de cobrança que encontrou, ao conferir que o
       `assinaturaId` (esse sim em claro) não vazava. */
    return res.json(semSegredos(req.tenant));
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

    const dados = { ...parsed.data };

    /* ── OS CAMPOS DO FLOW SÃO DE QUEM ADMINISTRA A CONTA ────────────────────
       Esta rota abre para `editarPagina || gerenciarUsuarios` — o editor de
       vitrine e o gerente de equipe. Nenhum dos dois tem por que trocar a
       credencial que assina contrato nem a política de comissão da casa.

       Removidos em vez de recusados: quem tem só `editarPagina` está salvando
       cores e logo, e derrubar a requisição inteira por causa de um campo que
       ele nem viu na tela seria um 403 sem sintoma. O que ele não pode mexer,
       ele não mexe. */
    const CAMPOS_DO_FLOW = [
      "assinaturaProvedor", "assinaturaToken", "assinaturaConta", "assinaturaSandbox",
      "comissaoPercentual", "comissaoCorretorPerc",
    ];
    if (!req.authCargo?.verConfiguracoes) {
      for (const campo of CAMPOS_DO_FLOW) delete dados[campo];
    }

    /* ── O TOKEN É CIFRADO ANTES DE ENCOSTAR NO BANCO ────────────────────────
       Ele chega em claro (é o que a pessoa colou) e nunca é gravado assim: é a
       mesma regra do token da página do Facebook e do Mercado Livre. Um dump do
       banco não pode virar a capacidade de assinar contrato em nome de
       centenas de imobiliárias. Ver `services/cofre.js`. */
    if (dados.assinaturaToken) dados.assinaturaToken = cifrar(dados.assinaturaToken);

    const tenant = await prisma.tenant.update({
      where: { id: req.tenant.id },
      data: dados,
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

/* ── Atalhos padrão da imobiliária ───────────────────────────────────────────
   O administrador define a convenção da casa; cada pessoa ainda pode discordar
   dela em `PUT /auth/meus-atalhos`. `verConfiguracoes` porque é uma decisão que
   vale para todo mundo que entra no painel. */
tenantRouter.put(
  "/me/atalhos",
  requireAuth,
  requireTenant,
  requirePermissao("verConfiguracoes"),
  async (req, res) => {
    try {
      const dados = {};

      /* As duas coisas viajam na mesma rota, e cada uma é opcional: a tela do
         interruptor manda só `ativos`, e o editor manda só o mapa. Um PUT que
         exigisse as duas faria cada tela apagar o que a outra acabou de gravar. */
      if (req.body?.atalhos !== undefined) {
        const atalhos = normalizarAtalhos(req.body.atalhos);
        if (atalhos === null) return res.status(400).json({ error: "Atalhos inválidos." });
        dados.atalhos = atalhos;
      }
      if (req.body?.ativos !== undefined) {
        dados.atalhosAtivos = Boolean(req.body.ativos);
      }
      if (!Object.keys(dados).length) {
        return res.status(400).json({ error: "Nada a alterar." });
      }

      const t = await prisma.tenant.update({ where: { id: req.tenant.id }, data: dados });
      return res.json({ atalhos: t.atalhos, ativos: t.atalhosAtivos });
    } catch (err) {
      console.error("[PUT /tenants/me/atalhos]", err);
      return res.status(500).json({ error: "Erro ao salvar os atalhos." });
    }
  },
);

/* ── Painel do Gestor ────────────────────────────────────────────────────────
   A tela "/". Faturamento do mês, interessados de hoje, imóvel em destaque e
   desempenho por corretor — ver `services/painelGestor.js`.

   `verPainelGestor`, e não `acessarPainel`: é o único lugar do produto que
   mostra quanto entrou e quanto cada pessoa da equipe fechou, pelo nome. Um
   corretor precisa do painel para trabalhar; não precisa do faturamento da
   casa nem da comissão do colega.

   Sem trava de PLANO: gerir a própria imobiliária não é recurso premium, e os
   números saem de dado que o Básico já produz. O que a tela faz com plano é
   OUTRA coisa — ela esconde os blocos de canais que o Básico não tem. */
tenantRouter.get(
  "/me/painel-gestor",
  requireAuth,
  requireTenant,
  requirePermissao("verPainelGestor"),
  async (req, res) => {
    try {
      return res.json(await montarPainelGestor(req.tenant.id));
    } catch (err) {
      console.error("[GET /tenants/me/painel-gestor]", err);
      return res.status(500).json({ error: "Erro ao montar o painel." });
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
   dá um número que muda a cada visita e não se compara com nada.

   ── SÓ O ENVIO É PAGO ──

   As duas rotas exigiam Profissional, e não é isso que o produto vende. A
   tabela de recursos põe "Relatórios e métricas de desempenho" no BÁSICO; a
   linha do Profissional é "Relatório mensal de desempenho POR E-MAIL".

   Ver na tela é do Básico. Mandar por e-mail é que sobe de plano — e o custo
   real está no envio, não na consulta. */
const requirePlanoEnvioRelatorio = requirePlano(1, "Profissional");

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
  requirePlanoEnvioRelatorio,
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

/* As duas rotas de reativação (esta e `/me/assinar`) usam a dupla tolerante a
   conta suspensa. É a exceção que fecha o círculo: sem ela, quem venceu não
   consegue nem VER que venceu, nem pagar para voltar. */
tenantRouter.get("/me/trial", requireAuthOuReativacao, requireTenantMesmoSuspenso, async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenant.id },
      select: {
        id: true, name: true, plano: true, statusPagamento: true, valorMensal: true,
        proximoVencimento: true, createdAt: true, showcaseConfig: true,
        // Para pré-preencher o pagador do boleto, que exige endereço completo.
        email: true, cnpj: true, cep: true, endereco: true, cidade: true, estado: true,
        migracaoIntencao: true, migracaoResolvidaEm: true, trialEstendidoEm: true,
        boasVindasVistas: true, modulos: true,
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
    /* O que a CONTA consegue cobrar. Vai junto porque a tela precisa decidir
       quais meios oferecer — ela chegou a mostrar Pix num ambiente onde ele
       nunca funcionaria, e o cliente só descobria no clique. */
    const meios = await meiosDisponiveis();
    const contaStripe = await marcaDaConta();
    // "Gerei um boleto — ele foi pago?" O painel não sabia responder.
    const cobranca = await cobrancaEmAberto(tenant.id);

    const expiraEm = tenant.proximoVencimento;
    const diasRestantes = expiraEm
      ? Math.max(0, Math.ceil((expiraEm.getTime() - Date.now()) / 86400000))
      : null;

    /* Gatilho das boas-vindas no painel. Só diz que a assinatura está ativa —
       QUANDO ela começou o schema não guarda, e quem "assina" pode ter testado
       antes por semanas, então a idade do tenant não serve de pista.

       Quem garante que o modal aparece uma vez só é `boasVindasVistas`, logo
       abaixo, e ela vem do BANCO. Era uma marca no navegador, e o preço disso
       aparecia em toda guia anônima e em toda máquina nova: o assistente de
       primeiro acesso recomeçava para quem já o tinha concluído. */
    const assinaturaAtiva = tenant.statusPagamento === "EM_DIA";

    return res.json({
      emTrial,
      assinaturaAtiva,
      /* O que acontece DEPOIS do vencimento. `diasRestantes` acima é cortado em
         zero — ele responde "quanto falta para vencer", e passada essa data a
         pergunta vira outra: "quanto falta para os dados sumirem". A conta sai
         da mesma constante que a faxina usa para apagar. */
      graca: situacaoDeGraca({
        statusPagamento: tenant.statusPagamento,
        proximoVencimento: tenant.proximoVencimento,
        suspensoEm: req.tenant.suspensoEm,
        ativo: req.tenant.ativo,
      }),
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
      meios,
      contaStripe,
      cobranca,
      /* Quem paga já se cadastrou. Pedir de novo endereço e documento na hora
         de fechar o plano é a forma mais fácil de perder alguém no último
         passo — e a informação está a uma coluna de distância. */
      email: tenant.email || null,
      documento: tenant.cnpj || null,
      endereco: {
        linha: tenant.endereco || "",
        cidade: tenant.cidade || "",
        estado: tenant.estado || "",
        cep: tenant.cep || "",
      },
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
      /* Quais recepções esta conta já teve ("teste", "assinante"). Viaja junto
         porque quem pergunta é o mesmo modal que já espera por esta resposta —
         um endpoint separado o faria esperar duas idas ao banco em série,
         justamente na montagem do painel. */
      boasVindasVistas: tenant.boasVindasVistas || [],
      /* Os módulos contratados. A aba de Plano lê daqui para saber se oferece
         "contratar o Flow" ou "desativar" — e não da sessão, que pode estar de
         antes da última mudança. */
      modulos: modulosDoTenant(tenant),
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

/* ─── "Esta conta já foi recebida" ───────────────────────────────────────────

   O desfecho do assistente de primeiro acesso (`BoasVindasModal`, no web).

   MORA NO BANCO, e não no navegador, porque a pergunta é sobre a CONTA e não
   sobre a máquina. Enquanto foi uma marca de `localStorage`, toda guia anônima,
   todo navegador novo e todo computador diferente reabriam o assistente inteiro
   — ficha da imobiliária, endereço da vitrine, importação da base — para quem
   já tinha respondido tudo.

   `verConfiguracoes` porque é exatamente quem VÊ o modal: as decisões que ele
   toma (domínio, migração, plano) são de quem administra a conta, e o painel já
   o esconde de todo mundo mais.

   Idempotente e só ADITIVO: marcar duas vezes não muda nada, e uma recepção
   nunca apaga a outra. Quem viu as do teste e depois assina continua tendo a de
   assinante pela frente. */
const MODOS_BOAS_VINDAS = ["teste", "assinante"];

tenantRouter.post(
  "/me/boas-vindas",
  requireAuth,
  requireTenant,
  requirePermissao("verConfiguracoes"),
  async (req, res) => {
    const modo = String(req.body?.modo || "").trim();
    if (!MODOS_BOAS_VINDAS.includes(modo)) {
      return res.status(400).json({ error: "Modo de boas-vindas inválido." });
    }

    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenant.id },
        select: { boasVindasVistas: true },
      });
      if (!tenant) return res.status(404).json({ error: "Tenant não encontrado." });

      const vistas = tenant.boasVindasVistas || [];
      if (vistas.includes(modo)) return res.json({ boasVindasVistas: vistas });

      const atualizado = await prisma.tenant.update({
        where: { id: req.tenant.id },
        data: { boasVindasVistas: [...vistas, modo] },
        select: { boasVindasVistas: true },
      });
      return res.json({ boasVindasVistas: atualizado.boasVindasVistas });
    } catch (err) {
      console.error("[POST /tenants/me/boas-vindas]", err);
      return res.status(500).json({ error: "Erro ao registrar as boas-vindas." });
    }
  },
);

/* A frase que a tela mostra depois de contratar ou dispensar o Flow.

   Mora aqui, e não na tela, porque ela é CONSEQUÊNCIA da operação: o que dizer
   depende de a cobrança ter sido ajustada ou não, e de por que não. Escrevê-la
   no navegador exigiria repetir lá esta mesma árvore de decisão — e ela mudaria
   sozinha, do jeito errado, no dia em que um caso novo aparecesse aqui. */
function montarAvisoDoAjuste(querFlow, ajuste) {
  const oQueMudou = querFlow
    ? "O Omnimob Flow já está disponível."
    : "O Omnimob Flow foi desativado. Seus negócios e contratos continuam guardados, e voltam se você contratar de novo.";

  if (ajuste.ajustada) {
    /* O proporcional entra na PRÓXIMA fatura, e dizer isso é metade do
       recado: sem a frase, quem contrata no dia 3 espera uma cobrança que não
       vem, e quem cancela no dia 28 acha que não foi creditado. */
    return querFlow
      ? `${oQueMudou} A diferença proporcional aos dias que faltam entra na sua próxima fatura.`
      : `${oQueMudou} O crédito proporcional aos dias já pagos entra na sua próxima fatura.`;
  }
  /* semMudanca não é falha: é o preço já sendo o certo (o cliente já estava
     nessa combinação). Anunciar "o time vai acertar" aí criaria uma expectativa
     de cobrança que não existe. */
  if (ajuste.semMudanca) return oQueMudou;
  return `${oQueMudou} ${ajuste.motivo}`;
}

/* ─── Contratar (ou dispensar) o Omnimob Flow ────────────────────────────────

   O par de `/me/plano`, e com a MESMA honestidade sobre o que ele não faz.

   Ele muda o que a imobiliária USA — `Tenant.modulos` —, e não o que ela PAGA.
   Ajustar a assinatura no Stripe exigiria o id dela, que o schema não guarda em
   lugar nenhum; enquanto essa coluna não existir, o valor da próxima fatura é
   acertado pelo time.

   ⚠ ISSO MUDOU: a coluna existe (`Tenant.assinaturaId`) e o ajuste é
   automático. `ajustarAssinatura` aponta a assinatura para o preço do novo
   pacote e deixa o Stripe calcular o proporcional, que entra na próxima
   fatura. `cobrancaAjustada` continua no corpo e continua podendo vir
   `false` — conta sem assinatura no provedor, preço não cadastrado, provedor
   fora do ar —, e aí `aviso` diz o motivo em português.

   ── POR QUE LIGAR NA HORA, EM VEZ DE SÓ ABRIR UM CHAMADO ──

   Porque o contrário é pior nos dois sentidos. Quem quer o módulo hoje não
   deveria esperar um dia útil por um interruptor que leva um segundo; e quem
   quer SAIR dele muito menos — deixar alguém preso pagando por um módulo até
   alguém responder o e-mail é o tipo de atrito que vira reclamação pública.

   ── DESLIGAR NÃO APAGA NADA ──

   Negócios, contratos e comissões continuam no banco. O que se fecha é o
   acesso, e a resposta diz isso: quem volta a contratar reencontra o que
   deixou. Apagar seria irreversível e ninguém pediu isso. */
tenantRouter.post(
  "/me/modulos",
  requireAuth,
  requireTenant,
  requirePermissao("verConfiguracoes"),
  async (req, res) => {
    const querFlow = req.body?.flow === true;

    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenant.id },
        select: { id: true, modulos: true, statusPagamento: true, assinaturaId: true },
      });
      if (!tenant) return res.status(404).json({ error: "Tenant não encontrado." });

      /* Em teste, o módulo vem junto do que a landing ofereceu e a troca é a
         assinatura. Deixar o trial ligar o Flow por aqui daria produto de graça
         — mesma guarda de `/me/plano`. */
      if (tenant.statusPagamento === "TRIAL") {
        return res.status(409).json({
          error: "Sua conta ainda está em teste. Escolha o pacote ao assinar.",
          code: "EM_TRIAL",
        });
      }

      const atuais = modulosDoTenant(tenant);
      const jaTem = atuais.includes("FLOW");
      if (jaTem === querFlow) {
        return res.status(400).json({
          error: querFlow ? "O Flow já está ativo nesta conta." : "O Flow já não está ativo.",
        });
      }

      const novos = querFlow
        ? [...atuais, "FLOW"]
        : atuais.filter((m) => m !== "FLOW");

      const atualizado = await prisma.tenant.update({
        where: { id: tenant.id },
        data: { modulos: novos },
        select: { id: true, modulos: true, plano: true },
      });

      /* ── A COBRANÇA, DEPOIS DO ACESSO ────────────────────────────────────
         A ordem importa e é deliberada: o módulo é liberado PRIMEIRO, e o
         ajuste da fatura vem em seguida.

         Se o provedor recusar, o cliente fica com o que pediu e o valor é
         acertado à mão — que é o pior desfecho aceitável. Na ordem inversa, uma
         falha no Stripe deixaria alguém que clicou em "contratar" sem o módulo
         e sem saber por quê.

         `ajustarAssinatura` nunca lança: ela devolve o motivo em português. */
      const ajuste = await ajustarAssinatura({
        tenant: { id: tenant.id, assinaturaId: tenant.assinaturaId },
        plano: atualizado.plano || "BASICO",
        pacote: querFlow ? "HUB_FLOW" : "HUB",
      });

      /* Conta antiga não tinha o id guardado; a busca achou e agora ele fica.
         É o que faz o próximo ajuste ser instantâneo, sem backfill. */
      if (ajuste.assinaturaId && ajuste.assinaturaId !== tenant.assinaturaId) {
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { assinaturaId: ajuste.assinaturaId },
        }).catch(() => {});
      }
      if (ajuste.ajustada && ajuste.valorMensal != null) {
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { valorMensal: ajuste.valorMensal },
        }).catch(() => {});
      }

      return res.json({
        modulos: atualizado.modulos,
        cobrancaAjustada: ajuste.ajustada,
        /* O que a tela diz depois de gravar. Vem do servidor porque é
           consequência da operação: a frase muda conforme a cobrança tenha sido
           ajustada ou não, e escrevê-la na tela exigiria repetir lá a mesma
           árvore de decisão. */
        aviso: montarAvisoDoAjuste(querFlow, ajuste),
      });
    } catch (err) {
      console.error("[POST /tenants/me/modulos]", err);
      return res.status(500).json({ error: "Erro ao alterar os módulos." });
    }
  },
);

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
   persiste).

   ⚠ ISSO MUDOU: a coluna existe (`Tenant.assinaturaId`) e a fatura é ajustada
   aqui também. O pacote NÃO muda numa troca de plano — quem tinha o Flow
   continua com ele —, então o preço-alvo é o do mesmo pacote no plano novo.
   `cobrancaAjustada` segue no corpo, e `motivoCobranca` explica quando ele
   vem `false`. */
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
        select: { id: true, plano: true, statusPagamento: true, valorMensal: true, proximoVencimento: true, modulos: true, assinaturaId: true },
      });

      /* ── E A FATURA ACOMPANHA ────────────────────────────────────────────
         Era aqui que o comentário no alto desta rota dizia "enquanto essa
         coluna não existir, o valor é acertado pelo time". A coluna existe.

         O pacote é o que a conta JÁ TEM — trocar de plano não mexe nos módulos,
         então quem tinha o Flow continua com ele e o preço-alvo é o do pacote
         completo no plano novo. */
      const temFlow = modulosDoTenant(atualizado).includes("FLOW");
      const ajuste = await ajustarAssinatura({
        tenant: { id: tenant.id, assinaturaId: atualizado.assinaturaId },
        plano,
        pacote: temFlow ? "HUB_FLOW" : "HUB",
      });

      const remendo = {};
      if (ajuste.assinaturaId && ajuste.assinaturaId !== atualizado.assinaturaId) {
        remendo.assinaturaId = ajuste.assinaturaId;
      }
      if (ajuste.ajustada && ajuste.valorMensal != null) remendo.valorMensal = ajuste.valorMensal;
      if (Object.keys(remendo).length) {
        await prisma.tenant.update({ where: { id: tenant.id }, data: remendo }).catch(() => {});
        Object.assign(atualizado, remendo);
      }

      return res.json({
        tenant: atualizado,
        cobrancaAjustada: ajuste.ajustada,
        /* O motivo quando NÃO ajustou. A tela precisa dele: "a cobrança será
           acertada pelo time" e "ainda não há preço para esta combinação" pedem
           reações diferentes de quem lê. */
        motivoCobranca: ajuste.ajustada ? null : ajuste.motivo,
        perdasAplicadas: perdas,
      });
    } catch (err) {
      console.error("[POST /tenants/me/plano]", err);
      return res.status(500).json({ error: "Erro ao trocar o plano." });
    }
  },
);

/* ─── Assinar por Pix ────────────────────────────────────────────────────────
   Irmã de `/me/assinar`, e separada dela de propósito: o cartão resolve tudo
   numa requisição, e o Pix não pode — ele devolve um segredo para a tela
   terminar o trabalho com o cliente no app do banco.

   Enfiar os dois na mesma rota daria uma resposta que às vezes é "assinado" e
   às vezes é "continue aí"; quem chama teria de adivinhar qual. Duas rotas
   dizem o que cada uma faz.

   Aqui NÃO se toca no tenant. Quem vira a chave é o webhook `invoice.paid`,
   depois de o dinheiro entrar — marcar EM_DIA agora liberaria o plano a quem
   só abriu o app do banco e desistiu. */
tenantRouter.post(
  "/me/assinar-assincrono",
  requireAuthOuReativacao,
  requireTenantMesmoSuspenso,
  requirePermissao("verConfiguracoes"),
  async (req, res) => {
    const { plano, periodo, pacote, meio, tokenPagamento } = req.body || {};
    if (!["BASICO", "PROFISSIONAL", "PREMIUM"].includes(plano)) {
      return res.status(400).json({ error: "Plano inválido." });
    }
    if (!["pix", "boleto"].includes(meio)) {
      return res.status(400).json({ error: "Meio de pagamento inválido." });
    }
    /* Recusa aqui, e não no provedor. Sem esta guarda a tela poderia pedir um
       meio que a conta não tem e o cliente receberia o erro cru da Stripe —
       que fala de capabilities e não quer dizer nada para quem só quer pagar. */
    const disponiveis = await meiosDisponiveis();
    if (!disponiveis[meio]) {
      return res.status(503).json({
        error: "Este meio de pagamento não está disponível nesta conta.",
        code: "MEIO_INDISPONIVEL",
      });
    }
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: req.tenant.id } });
      if (!tenant) return res.status(404).json({ error: "Tenant não encontrado." });

      const r = meio === "boleto"
        ? await criarAssinaturaBoleto({ tenant, plano, periodo, pacote, tokenPagamento })
        : await criarAssinaturaPix({ tenant, plano, periodo, pacote });
      return res.json(r);
    } catch (err) {
      if (
        err.code === "PROVEDOR_NAO_CONFIGURADO" ||
        err.code === "PLANO_SOB_CONSULTA" ||
        err.code === "PERIODO_INDISPONIVEL"
      ) {
        return res.status(503).json({ error: err.message, code: err.code });
      }
      console.error("[POST /tenants/me/assinar-assincrono]", err);
      return res.status(500).json({ error: "Erro ao preparar o pagamento." });
    }
  },
);

tenantRouter.post(
  "/me/assinar",
  requireAuthOuReativacao,
  requireTenantMesmoSuspenso,
  /* `verConfiguracoes`, e não `gerenciarUsuarios`.

     A barra lateral já oferecia o botão por `verConfiguracoes` (assinar é
     decisão de quem responde pela conta, não de quem administra gente), mas a
     rota continuou exigindo a permissão antiga. Um cargo com uma e sem a outra
     via o botão e levava 403 — e agora seria pior: a parede de reativação é
     liberada por `verConfiguracoes`, então a pessoa entraria nela sem conseguir
     concluir a compra. */
  requirePermissao("verConfiguracoes"),
  async (req, res) => {
    const { plano, periodo, pacote, tokenPagamento } = req.body || {};
    if (!["BASICO", "PROFISSIONAL", "PREMIUM"].includes(plano)) {
      return res.status(400).json({ error: "Plano inválido." });
    }
    // Período desconhecido não é erro: cai no mensal, que é o que sempre houve.
    const periodoEscolhido = normalizarPeriodo(periodo);
    /* Pacote desconhecido cai no HUB — o padrão seguro é o que a conta sempre
       teve, e nunca o que custa mais caro. Ver `normalizarPacote`. */
    const pacoteEscolhido = normalizarPacote(pacote);

    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: req.tenant.id } });
      if (!tenant) return res.status(404).json({ error: "Tenant não encontrado." });

      const assinatura = await criarAssinatura({ tenant, plano, periodo: periodoEscolhido, pacote: pacoteEscolhido, tokenPagamento });

      const atualizado = await fidelizarTrial(tenant.id, {
        plano,
        valorMensal: assinatura.valorMensal,
        proximoVencimento: assinatura.proximoVencimento,
        /* É AQUI que o Flow é entregue. O pacote escolhido vira a lista de
           módulos da conta, e é ela que abre o seletor na barra lateral e as
           rotas `/flow/*`. Sem esta linha, a pessoa pagaria pelo pacote com
           Flow e continuaria vendo só o Hub. */
        modulos: modulosDoPacote(pacoteEscolhido),
        /* Guardado agora, e não numa varredura depois: é a única vez em que
           temos o id na mão sem precisar procurar no provedor. */
        assinaturaId: assinatura.assinaturaId,
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
          /* O pacote escolhido, para o e-mail confirmar por escrito que o Flow
             veio junto. Sai da mesma fonte que gravou `Tenant.modulos` — e não
             de uma releitura do tenant, que ainda pode estar em cache. */
          modulos: modulosDoPacote(pacoteEscolhido),
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
