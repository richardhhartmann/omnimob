import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermissao } from "../middlewares/permissaoMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { cifrar } from "../services/cofre.js";
import {
  ErroMercadoLivre, concluirConexao, desconectar, encerrar,
  mercadoLivreConfigurado, publicar, urlDeAutorizacao,
} from "../services/mercadoLivre.js";
import { ErroDaPonte, ponteConfigurada, publicarSequenciaDeStatus } from "../services/pontewhatsapp.js";

/* ────────────────────────────────────────────────────────────────────────────
   A central de canais.

   ── O PROBLEMA QUE ELA RESOLVE ──

   O feed VRSync já servia ZAP, VivaReal e OLX Imóveis desde sempre. E a
   imobiliária não sabia — não havia tela nenhuma dizendo que o canal existia,
   qual endereço cadastrar no painel do portal, nem se alguém já tinha vindo
   buscar o arquivo. A integração mais completa do produto era invisível, e o
   suporte recebia "vocês não têm integração com o ZAP?".

   Esta rota é a resposta: um retrato de cada canal, o que falta em cada um, e o
   endereço pronto para copiar.

   ── OS TRÊS TIPOS DE CANAL, E POR QUE ELES NÃO SE PARECEM ──

     PUXADO     ZAP, VivaReal, OLX. Publicamos um XML e o robô vem buscar. Não
                há credencial, não há erro de rede, não há o que "conectar" —
                só um endereço para cadastrar lá.
     EMPURRADO  Facebook, Instagram, Mercado Livre. Cada publicação é uma
                chamada nossa, com token do cliente e falha individual.
     MANUAL     Status do WhatsApp. Sem API oficial; entregamos a arte pronta.

   Misturar os três numa tela só é o ponto: para quem divulga, são todos
   "lugares onde meu imóvel aparece", e a diferença de mecânica é problema
   nosso, não dela.
   ──────────────────────────────────────────────────────────────────────────── */

export const canaisRouter = Router();

/* O OAuth do Mercado Livre volta SEM sessão nossa — o navegador vem do domínio
   deles. Por isso o callback fica antes dos middlewares de autenticação, e o
   tenant é identificado pelo `state` que mandamos na ida. */
canaisRouter.get("/mercadolivre/callback", async (req, res) => {
  const { code, state, error } = req.query;
  const frente = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");
  const voltar = (params) => res.redirect(`${frente}/configuracoes?ver=redes&${new URLSearchParams(params)}`);

  if (error) return voltar({ ml: "erro", msg: String(req.query.error_description || error).slice(0, 200) });
  if (!code || !state) return voltar({ ml: "erro", msg: "Autorização incompleta." });

  try {
    const { nick } = await concluirConexao(String(state), String(code));
    return voltar({ ml: "ok", conta: nick || "" });
  } catch (erro) {
    console.error("[mercadolivre] callback:", erro);
    return voltar({ ml: "erro", msg: String(erro.message || "Falha ao conectar.").slice(0, 200) });
  }
});

canaisRouter.use(requireAuth);
canaisRouter.use(requireTenant);

/* ── O retrato ───────────────────────────────────────────────────────────────
   Só leitura, e por isso `editarPagina` OU `verConfiguracoes`: quem divulga
   imóvel precisa ver onde ele aparece, mesmo sem poder mexer na configuração. */
canaisRouter.get("/", requirePermissao("editarPagina", "verConfiguracoes", "gerenciarImoveis"), async (req, res) => {
  try {
    const t = req.tenant;
    const api = (process.env.APP_URL || "").includes("localhost")
      ? `http://localhost:${process.env.PORT || 4000}`
      : "https://api.omnimob.app";

    const [noFeed, publicados] = await Promise.all([
      prisma.property.count({
        where: { tenantId: t.id, status: "ACTIVE", publicarPortais: true },
      }),
      prisma.propertyPublication.groupBy({
        by: ["channel"],
        where: { tenantId: t.id, status: "PUBLISHED" },
        _count: { _all: true },
      }),
    ]);
    const porCanal = Object.fromEntries(publicados.map((p) => [p.channel, p._count._all]));

    return res.json({
      canais: [
        {
          id: "portais",
          nome: "ZAP, VivaReal e OLX Imóveis",
          tipo: "puxado",
          conectado: noFeed > 0,
          /* "Conectado" aqui não é uma conexão: é ter o que entregar. O feed
             existe sempre; o que muda é haver imóvel marcado para publicar. */
          feedUrl: `${api}/public/${t.slug}/feed.xml`,
          imoveis: noFeed,
          ultimaLeitura: t.feedLidoEm,
          instrucao:
            "Cadastre este endereço no painel do portal, em integração por XML/VRSync. Eles vêm buscar sozinhos, algumas vezes por dia.",
        },
        {
          id: "facebook",
          nome: "Facebook",
          tipo: "empurrado",
          conectado: Boolean(t.facebookPageId),
          conta: t.facebookPageName || null,
          publicados: porCanal.FACEBOOK || 0,
        },
        {
          id: "instagram",
          nome: "Instagram",
          tipo: "empurrado",
          conectado: Boolean(t.instagramBusinessId),
          publicados: porCanal.INSTAGRAM || 0,
        },
        {
          id: "mercadolivre",
          nome: "Mercado Livre",
          tipo: "empurrado",
          conectado: Boolean(t.mercadoLivreUserId),
          conta: t.mercadoLivreNick || null,
          publicados: porCanal.MERCADO_LIVRE || 0,
          disponivel: mercadoLivreConfigurado,
          /* O aviso vem no payload e não só na tela: é a causa mais comum de
             "conectei e não publica", e precisa aparecer ANTES da primeira
             tentativa. */
          aviso:
            "Publicar imóvel no Mercado Livre exige um pacote de anúncios contratado com o comercial deles. Sem o pacote, a conexão funciona e a publicação é recusada.",
        },
        {
          id: "whatsapp-status",
          nome: "Status do WhatsApp",
          tipo: "manual",
          conectado: true,
          ponte: ponteConfigurada(t),
          instrucao:
            "Não existe API oficial para status. Geramos a arte vertical pronta e você publica com um toque, na tela de divulgação do imóvel.",
        },
      ],
    });
  } catch (erro) {
    console.error("[canais] retrato:", erro);
    return res.status(500).json({ error: "Erro ao montar o painel de canais." });
  }
});

// ─── Mercado Livre ───────────────────────────────────────────────────────────

canaisRouter.get("/mercadolivre/conectar", requirePermissao("verConfiguracoes"), (req, res) => {
  if (!mercadoLivreConfigurado) {
    return res.status(503).json({ error: "A integração com o Mercado Livre não está configurada neste ambiente." });
  }
  return res.json({ url: urlDeAutorizacao(req.tenant.id) });
});

canaisRouter.delete("/mercadolivre", requirePermissao("verConfiguracoes"), async (req, res) => {
  try {
    await desconectar(req.tenant.id);
    return res.json({ ok: true });
  } catch (erro) {
    console.error("[mercadolivre] desconectar:", erro);
    return res.status(500).json({ error: "Erro ao desconectar." });
  }
});

canaisRouter.post("/mercadolivre/publicar/:propertyId", requirePermissao("publicarRedes"), async (req, res) => {
  try {
    const imovel = await prisma.property.findFirst({
      where: { id: req.params.propertyId, tenantId: req.tenant.id },
      include: { images: { orderBy: { position: "asc" }, where: { is360: false } } },
    });
    if (!imovel) return res.status(404).json({ error: "Imóvel não encontrado." });

    const { id, url } = await publicar(req.tenant, imovel, {
      categoria: req.body?.categoria,
      tipoDeAnuncio: req.body?.tipoDeAnuncio,
    });

    const publicacao = await prisma.propertyPublication.create({
      data: {
        tenantId: req.tenant.id, propertyId: imovel.id, channel: "MERCADO_LIVRE",
        status: "PUBLISHED", externalRef: id, lastAttemptAt: new Date(),
      },
    });
    return res.json({ publicacao, url });
  } catch (erro) {
    if (erro instanceof ErroMercadoLivre) {
      /* Guardamos a falha como publicação FAILED. Sem isso, a tentativa some e
         a tela não tem como mostrar "tentou e o Mercado Livre recusou por
         isto" — que é a informação de que a pessoa precisa. */
      await prisma.propertyPublication
        .create({
          data: {
            tenantId: req.tenant.id, propertyId: req.params.propertyId, channel: "MERCADO_LIVRE",
            status: "FAILED", errorMessage: erro.message.slice(0, 500), lastAttemptAt: new Date(),
          },
        })
        .catch(() => {});
      return res.status(400).json({ error: erro.message, code: erro.codigo });
    }
    console.error("[mercadolivre] publicar:", erro);
    return res.status(500).json({ error: "Erro ao publicar no Mercado Livre." });
  }
});

canaisRouter.delete("/mercadolivre/publicar/:propertyId", requirePermissao("publicarRedes"), async (req, res) => {
  try {
    const publicacao = await prisma.propertyPublication.findFirst({
      where: { propertyId: req.params.propertyId, tenantId: req.tenant.id, channel: "MERCADO_LIVRE", status: "PUBLISHED" },
    });
    if (!publicacao) return res.status(404).json({ error: "Não há anúncio publicado para este imóvel." });

    await encerrar(req.tenant, publicacao.externalRef);
    await prisma.propertyPublication.delete({ where: { id: publicacao.id } });
    return res.json({ ok: true });
  } catch (erro) {
    if (erro instanceof ErroMercadoLivre) return res.status(400).json({ error: erro.message });
    console.error("[mercadolivre] encerrar:", erro);
    return res.status(500).json({ error: "Erro ao encerrar o anúncio." });
  }
});

// ─── Ponte de WhatsApp ───────────────────────────────────────────────────────

/* Guardar o endereço de uma ponte é assumir um risco que é da imobiliária, e
   por isso pede a permissão de quem responde pela conta — não a de quem
   publica imóvel. */
canaisRouter.put("/whatsapp-ponte", requirePermissao("verConfiguracoes"), async (req, res) => {
  try {
    const url = String(req.body?.url || "").trim();
    const token = String(req.body?.token || "").trim();

    if (!url) {
      await prisma.tenant.update({
        where: { id: req.tenant.id },
        data: { whatsappPonteUrl: null, whatsappPonteToken: null },
      });
      return res.json({ ponte: false });
    }
    /* HTTPS obrigatório: o token da ponte trafega no cabeçalho, e ele é a
       credencial de uma sessão de WhatsApp inteira. */
    if (!/^https:\/\//i.test(url)) {
      return res.status(400).json({ error: "O endereço da ponte precisa começar com https://." });
    }
    if (!token) return res.status(400).json({ error: "Informe o token da ponte." });

    await prisma.tenant.update({
      where: { id: req.tenant.id },
      // Cifrado em repouso, como o token da página do Facebook.
      data: { whatsappPonteUrl: url, whatsappPonteToken: cifrar(token) },
    });
    return res.json({ ponte: true });
  } catch (erro) {
    console.error("[ponte] salvar:", erro);
    return res.status(500).json({ error: "Erro ao salvar a ponte." });
  }
});

/* Teto de status por imóvel.

   Um anúncio com vinte fotos viraria vinte publicações seguidas no status de
   quem segue a imobiliária — que é o caminho mais rápido para as pessoas
   silenciarem o contato. Oito já conta a história do imóvel, e é o que cabe sem
   ocupar a fila de quem assiste.

   Também vale como proteção da conta: rajada longa é o que uma sessão de
   WhatsApp Web faz de mais suspeito. */
const LIMITE_DE_STATUS = 8;

canaisRouter.post("/whatsapp-ponte/publicar/:propertyId", requirePermissao("publicarRedes"), async (req, res) => {
  try {
    const imovel = await prisma.property.findFirst({
      where: { id: req.params.propertyId, tenantId: req.tenant.id },
      /* Todas as fotos, não só a primeira: cada uma vira um status. As
         panorâmicas ficam de fora — uma 360° achatada num quadro vertical vira
         uma imagem esticada que não se lê. */
      include: { images: { orderBy: { position: "asc" }, where: { is360: false } } },
    });
    if (!imovel) return res.status(404).json({ error: "Imóvel não encontrado." });

    /* A ARTE é montada no navegador (canvas) e chega aqui como URL já
       hospedada — o mesmo caminho das fotos. Gerar de novo no servidor exigiria
       uma biblioteca de imagem e duplicaria o desenho em dois lugares, que é
       como o editor de vitrine quase se perdeu.

       Depois dela vêm as DEMAIS fotos do imóvel, uma por status. Status não tem
       carrossel: cada imagem é uma publicação. A tela manda a lista já na ordem
       que quer — arte primeiro, fotos cruas depois. */
    const arte = String(req.body?.imagemUrl || "").trim();
    const extras = Array.isArray(req.body?.imagensExtras) ? req.body.imagensExtras : [];
    /* Sem arte (chamada direta pela API, sem passar pela tela), as fotos do
       próprio imóvel valem — melhor publicar o que existe do que recusar. */
    const imagens = [arte, ...extras].filter(Boolean);
    const lista = imagens.length ? imagens : imovel.images.map((i) => i.url);

    const r = await publicarSequenciaDeStatus(req.tenant, {
      imagens: lista.slice(0, LIMITE_DE_STATUS),
      legenda: req.body?.legenda,
    });
    return res.json(r);
  } catch (erro) {
    if (erro instanceof ErroDaPonte) return res.status(400).json({ error: erro.message });
    console.error("[ponte] publicar:", erro);
    return res.status(500).json({ error: "Erro ao publicar pela ponte." });
  }
});
