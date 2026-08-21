import { prisma } from "../db.js";
import { portaisDoImovel, nomesDosPortais } from "./portais.js";

/* ────────────────────────────────────────────────────────────────────────────
   Tirar o imóvel do ar nos outros lugares, antes de apagá-lo aqui.

   ── A PERGUNTA QUE ISTO RESPONDE ──

   Excluir um imóvel na Omnimob não apaga o anúncio no Facebook nem no Mercado
   Livre. Sem tratar isso, a imobiliária apaga o imóvel, some com o registro, e
   fica com anúncios órfãos que ninguém consegue mais alcançar pelo painel —
   porque o painel esqueceu que eles existem.

   ── CADA CANAL PERMITE UMA COISA DIFERENTE, E A TELA PRECISA DIZER QUAL ──

   FACEBOOK      apaga de verdade, pela Graph API.
   INSTAGRAM     NÃO apaga. A Meta nunca expôs exclusão de post por API — o
                 máximo é parar de rastrear, e o anúncio continua no perfil.
   MERCADO LIVRE encerra o anúncio (`status: closed`). Não é exclusão: o ML não
                 apaga histórico de anúncio, e encerrado é o estado final que
                 ele oferece.
   PORTAIS       saem sozinhos. ZAP, VivaReal e OLX leem um XML que é gerado do
                 acervo atual; imóvel apagado não aparece na próxima carga. Não
                 há o que chamar — e há o que AVISAR: some na próxima carga, não
                 agora.

   Prometer "removemos de tudo" seria mentira em três dos quatro. A função
   devolve o que conseguiu e o que não, e a tela mostra os dois.
   ──────────────────────────────────────────────────────────────────────────── */

/** O que dá para fazer com este imóvel, por canal. Alimenta a tela de exclusão. */
export async function opcoesDeRemocao(tenant, propertyId) {
  const publicacoes = await prisma.propertyPublication.findMany({
    where: { propertyId, tenantId: tenant.id, status: "PUBLISHED" },
    select: { id: true, channel: true, externalRef: true },
  });

  const porCanal = (c) => publicacoes.filter((p) => p.channel === c);
  const opcoes = [];

  if (porCanal("FACEBOOK").length) {
    opcoes.push({
      canal: "FACEBOOK",
      nome: "Facebook",
      quantidade: porCanal("FACEBOOK").length,
      /* `podeRemover` decide se a caixa vem marcada E se ela pode ser marcada.
         Um canal que não remove aparece desmarcado e travado, com o motivo — a
         alternativa seria não mostrá-lo, e aí ninguém descobre que o anúncio
         ficou no ar. */
      podeRemover: true,
      nota: "O post é apagado da página.",
    });
  }

  if (porCanal("INSTAGRAM").length) {
    opcoes.push({
      canal: "INSTAGRAM",
      nome: "Instagram",
      quantidade: porCanal("INSTAGRAM").length,
      podeRemover: false,
      nota: "A Meta não permite apagar post do Instagram por API. Apague pelo aplicativo.",
    });
  }

  if (porCanal("MERCADO_LIVRE").length) {
    opcoes.push({
      canal: "MERCADO_LIVRE",
      nome: "Mercado Livre",
      quantidade: porCanal("MERCADO_LIVRE").length,
      podeRemover: Boolean(tenant.mercadoLivreToken),
      nota: tenant.mercadoLivreToken
        ? "O anúncio é encerrado. O Mercado Livre não apaga anúncios, encerrar é o estado final."
        : "Conta do Mercado Livre desconectada — não dá para encerrar por aqui.",
    });
  }

  /* Os portais entram na lista mesmo sem publicação registrada: não existe
     registro para eles, porque ninguém publica — eles leem o XML. O que
     importa é o imóvel estar marcado para o feed. */
  const imovel = await prisma.property.findFirst({
    where: { id: propertyId, tenantId: tenant.id },
    select: { publicarPortais: true, portais: true },
  });
  const portais = portaisDoImovel(imovel);
  if (portais.length) {
    opcoes.push({
      canal: "PORTAIS",
      /* Nomeia os portais em que este imóvel REALMENTE está. Listar os três
         quando ele só ia para o ZAP faria a pessoa procurar o anúncio em dois
         lugares onde ele nunca esteve. */
      nome: nomesDosPortais(portais),
      quantidade: portais.length,
      /* Sem caixa, e não é limitação nossa: portal não recebe exclusão, ele
         relê o arquivo. Apagar o imóvel já o tira dos três de uma vez, então
         não existe "excluir do ZAP e manter no VivaReal" — para isso a pessoa
         desmarca o portal no imóvel, que é edição e não exclusão.

         O que ela precisa saber aqui é QUANDO a ausência chega no portal. */
      automatico: true,
      podeRemover: false,
      nota: portais.length > 1
        ? "Saem sozinhos na próxima carga de cada portal, até 24h depois."
        : "Sai sozinho na próxima carga do portal, até 24h depois.",
    });
  }

  return opcoes;
}

/**
 * Remove nos canais escolhidos. Devolve o que aconteceu em cada um.
 *
 * Roda ANTES de apagar o imóvel: depois, os `externalRef` já teriam ido embora
 * junto com as linhas de publicação (cascade), e não haveria como alcançar os
 * anúncios.
 */
export async function removerDosCanais(tenant, propertyId, canais = []) {
  const resultados = [];
  const escolhidos = new Set(canais);

  const publicacoes = await prisma.propertyPublication.findMany({
    where: { propertyId, tenantId: tenant.id, status: "PUBLISHED" },
  });

  for (const pub of publicacoes) {
    if (!escolhidos.has(pub.channel)) continue;

    try {
      if (pub.channel === "FACEBOOK") {
        const { deleteOnePublication } = await import("./publicacaoSocial.js");
        const r = await deleteOnePublication(pub, tenant);
        resultados.push({ canal: pub.channel, ok: r.ok, erro: r.error, nota: r.note });
        continue;
      }

      if (pub.channel === "MERCADO_LIVRE") {
        const { encerrar } = await import("./mercadoLivre.js");
        await encerrar(tenant, pub.externalRef);
        resultados.push({ canal: pub.channel, ok: true, nota: "Anúncio encerrado." });
        continue;
      }

      /* Chegou aqui um canal que não sabemos remover. Registrar em vez de
         ignorar: silêncio aqui viraria "removi" na tela. */
      resultados.push({
        canal: pub.channel,
        ok: false,
        erro: "Este canal não permite remoção automática.",
      });
    } catch (erro) {
      resultados.push({ canal: pub.channel, ok: false, erro: erro.message });
    }
  }

  return resultados;
}
