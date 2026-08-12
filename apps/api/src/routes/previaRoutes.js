import { Router } from "express";
import prismaPkg from "@prisma/client";
import { prisma } from "../db.js";

const { PropertyStatus } = prismaPkg;

/* ─── Prévia de link para robôs de rede social ───────────────────────────────
   O problema: a vitrine é um SPA. Título, descrição e imagem de cada página são
   escritos por JavaScript, depois da renderização (ver `utils/seo.js` no front).
   O Googlebot executa JS e enxerga; os robôs de PRÉVIA não. WhatsApp, Facebook,
   Instagram, LinkedIn e Telegram leem o HTML cru e vão embora.

   Na prática: o corretor cola o link do imóvel no WhatsApp do cliente e sai o
   cartão genérico da Omnimob — mesmo título, mesma descrição e mesma imagem para
   todos os imóveis de todas as imobiliárias. Justamente no canal em que
   imobiliária mais trabalha.

   A solução é servir HTML pronto SÓ para esses robôs. A Vercel reescreve
   `/vitrine/*` para cá quando o user-agent é de robô (ver `apps/web/vercel.json`),
   e o visitante de verdade continua recebendo o SPA, intocado.

   Por que não renderizar para todo mundo: o SPA é a aplicação. Devolver este
   HTML para uma pessoa entregaria uma página morta — sem navegação, sem busca e
   sem os outros imóveis.

   Estas rotas NÃO contam VIEW, de propósito: robô de prévia não é visita, e
   somar um acesso a cada vez que o link é colado num grupo estragaria a métrica
   que a imobiliária usa para saber o que está funcionando.
   ────────────────────────────────────────────────────────────────────────── */

export const previaRouter = Router();

/* A base sai de `APP_URL`, e não da requisição: o endereço que vai no cartão é
   o que a pessoa vai abrir ao tocar nele. Deduzir do host desta requisição
   devolveria `api.omnimob.app`, que não serve a vitrine. */
const BASE = (process.env.APP_URL || "").trim().replace(/\/+$/, "") || "https://omnimob.app";

/** Escapa para uso dentro de atributo HTML. */
function attr(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* Corta no limite sem partir palavra. A descrição é truncada pelos robôs de
   qualquer jeito, e um corte no meio de uma palavra parece defeito do sistema. */
function resumir(texto, limite = 200) {
  const limpo = String(texto || "").replace(/\s+/g, " ").trim();
  if (limpo.length <= limite) return limpo;
  const corte = limpo.slice(0, limite);
  const espaco = corte.lastIndexOf(" ");
  return `${(espaco > 60 ? corte.slice(0, espaco) : corte).trim()}…`;
}

function brl(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return "";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function paginaDePrevia({ titulo, descricao, imagem, url, siteName }) {
  /* O `<meta http-equiv="refresh">` existe para o caso de uma PESSOA cair aqui —
     um user-agent que casou com o filtro por engano, ou alguém abrindo o
     endereço na mão. Ela vai para a página real em vez de encarar uma tela em
     branco. Robôs de prévia não seguem refresh: leem as tags e vão embora. */
  const tagsImagem = imagem
    ? `<meta property="og:image" content="${attr(imagem)}" />\n` +
      `<meta property="og:image:alt" content="${attr(titulo)}" />\n` +
      `<meta name="twitter:image" content="${attr(imagem)}" />`
    : "";

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${attr(titulo)}</title>
<meta name="description" content="${attr(descricao)}" />
<link rel="canonical" href="${attr(url)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${attr(siteName)}" />
<meta property="og:locale" content="pt_BR" />
<meta property="og:url" content="${attr(url)}" />
<meta property="og:title" content="${attr(titulo)}" />
<meta property="og:description" content="${attr(descricao)}" />
<meta name="twitter:card" content="${imagem ? "summary_large_image" : "summary"}" />
<meta name="twitter:title" content="${attr(titulo)}" />
<meta name="twitter:description" content="${attr(descricao)}" />
${tagsImagem}
<meta http-equiv="refresh" content="0; url=${attr(url)}" />
</head>
<body><p><a href="${attr(url)}">${attr(titulo)}</a></p></body>
</html>
`;
}

function enviar(res, html) {
  res.type("html");
  // O robô do WhatsApp recolhe a prévia a cada envio do link; uma hora na borda
  // evita uma consulta ao banco por mensagem encaminhada.
  res.set("Cache-Control", "public, max-age=600, s-maxage=3600");
  return res.send(html);
}

// ─── Vitrine da imobiliária ─────────────────────────────────────────────────
previaRouter.get("/vitrine/:tenantSlug", async (req, res) => {
  const url = `${BASE}/vitrine/${encodeURIComponent(req.params.tenantSlug)}`;
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.tenantSlug },
      select: {
        name: true, description: true, slogan: true, logoUrl: true,
        showcaseHeadline: true, showcaseSubheadline: true, cidade: true, estado: true,
      },
    });

    if (!tenant) {
      return enviar(res, paginaDePrevia({
        titulo: "Vitrine não encontrada",
        descricao: "Esta vitrine não está disponível.",
        url, siteName: "Omnimob",
      }));
    }

    const local = [tenant.cidade, tenant.estado].filter(Boolean).join(" · ");
    return enviar(res, paginaDePrevia({
      titulo: tenant.showcaseHeadline
        ? `${tenant.name} — ${resumir(tenant.showcaseHeadline, 70)}`
        : `${tenant.name} — Imóveis à venda e para locação`,
      descricao: resumir(
        tenant.showcaseSubheadline || tenant.description || tenant.slogan ||
        `Imóveis à venda e para locação${local ? ` em ${local}` : ""}. Confira a vitrine da ${tenant.name}.`,
      ),
      // O logo é o que a imobiliária tem de próprio; sem ele, a arte da Omnimob.
      imagem: tenant.logoUrl || `${BASE}/og-image.png`,
      url,
      siteName: tenant.name,
    }));
  } catch (erro) {
    console.error("[previa:vitrine]", erro.message);
    /* Erro não pode virar 500: o robô guardaria a falha e o link ficaria sem
       prévia por horas. Um cartão genérico é pior que o certo e melhor que nada. */
    return enviar(res, paginaDePrevia({
      titulo: "Omnimob", descricao: "Vitrine de imóveis.", url, siteName: "Omnimob",
    }));
  }
});

// ─── Imóvel: é o link que o corretor manda ──────────────────────────────────
previaRouter.get("/imovel/:tenantSlug/:propertyId", async (req, res) => {
  const url = `${BASE}/vitrine/${encodeURIComponent(req.params.tenantSlug)}/imovel/${encodeURIComponent(req.params.propertyId)}`;
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.tenantSlug },
      select: { id: true, name: true, logoUrl: true },
    });

    const property = tenant && await prisma.property.findFirst({
      where: { id: req.params.propertyId, tenantId: tenant.id, status: PropertyStatus.ACTIVE },
      include: { images: { orderBy: { position: "asc" }, take: 1 } },
    });

    if (!property) {
      return enviar(res, paginaDePrevia({
        titulo: tenant ? `${tenant.name} — Imóvel indisponível` : "Imóvel não encontrado",
        descricao: "Este imóvel não está mais disponível na vitrine.",
        url, siteName: tenant?.name || "Omnimob",
      }));
    }

    /* Preço no título, ficha na descrição. A prévia aparece no meio de uma
       conversa, entre outras mensagens: o que não couber nas primeiras palavras
       não vai ser lido, e preço é o que decide se a pessoa abre. */
    const preco = brl(property.price);
    const local = [property.neighborhood, property.city].filter(Boolean).join(", ");
    const ficha = [
      property.bedrooms ? `${property.bedrooms} quarto${property.bedrooms > 1 ? "s" : ""}` : "",
      property.parkingSpots ? `${property.parkingSpots} vaga${property.parkingSpots > 1 ? "s" : ""}` : "",
      property.squareFootage ? `${property.squareFootage} m²` : "",
    ].filter(Boolean).join(" · ");

    return enviar(res, paginaDePrevia({
      titulo: [property.title, preco].filter(Boolean).join(" — ") || "Imóvel",
      descricao: resumir(
        [local, ficha].filter(Boolean).join(" — ") ||
        property.description ||
        `Imóvel disponível na vitrine da ${tenant.name}.`,
      ),
      /* A foto do imóvel — é o ponto todo desta rota. Sem ela a prévia continua
         sendo um cartão genérico, mesmo com o texto certo. */
      imagem: property.images?.[0]?.url || tenant.logoUrl || `${BASE}/og-image.png`,
      url,
      siteName: tenant.name,
    }));
  } catch (erro) {
    console.error("[previa:imovel]", erro.message);
    return enviar(res, paginaDePrevia({
      titulo: "Imóvel — Omnimob", descricao: "Confira este imóvel.", url, siteName: "Omnimob",
    }));
  }
});
