import { prisma } from "../db.js";
import { IDS_PORTAIS, portaisDoImovel } from "./portais.js";

/* ────────────────────────────────────────────────────────────────────────────
   O disparo da publicação automática.

   ── O QUE ELE FAZ, E O QUE DELIBERADAMENTE NÃO FAZ ──

   Ele publica nos canais que a imobiliária ligou, e registra cada tentativa em
   `PropertyPublication` — a mesma tabela da publicação manual. Uma segunda
   tabela para "publicação automática" daria dois históricos do mesmo fato, e a
   tela de divulgação teria de somar os dois para saber o que está no ar.

   Ele NÃO derruba o cadastro. Quem chama solta a promessa (`void`) e segue: o
   imóvel já está salvo quando chegamos aqui, e um Mercado Livre fora do ar não
   pode virar erro de cadastro. Falha vira linha `FAILED` com o motivo, que é o
   que a tela lê para explicar depois.

   ── OS PORTAIS SÃO OUTRA COISA ──

   `portais` não publica nada: ele marca o imóvel para entrar no XML que ZAP,
   VivaReal e OLX Imóveis vêm buscar. Quem publica é a carga deles, uma vez por
   dia. Tratar isso como "publicação" na mesma prateleira dos outros faria a
   tela prometer um anúncio que só aparece amanhã.

   ── POR QUE EM SÉRIE, E NÃO EM PARALELO ──

   São no máximo três chamadas a três serviços diferentes, e uma delas é uma
   sessão de rede social. Rajada é o que esses serviços tratam como suspeito, e
   o ganho de meio segundo não vale — ninguém está esperando esta função.
   ──────────────────────────────────────────────────────────────────────────── */

async function registrar(tenantId, propertyId, channel, { ok, ref, erro }) {
  await prisma.propertyPublication.create({
    data: {
      tenantId,
      propertyId,
      channel,
      status: ok ? "PUBLISHED" : "FAILED",
      externalRef: ref || null,
      errorMessage: erro ? String(erro).slice(0, 500) : null,
      lastAttemptAt: new Date(),
    },
  }).catch((e) => console.error("[automacao] não registrei:", e.message));
}

const SEPARADOR = `

`;

export async function dispararPublicacaoAutomatica({ tenant, imovel, canais }) {
  /* Portais: nada é publicado aqui. O que a automação faz é MARCAR o imóvel
     para entrar no arquivo que cada portal vem buscar.

     Não há o que registrar: inventar uma linha `PUBLISHED` faria a tela dizer
     que o anúncio está no ar horas antes de o portal ter vindo buscá-lo.

     A união com o que o imóvel já tem é de propósito: quem cadastrou por
     integração marcando só o ZAP não pode ver a automação acrescentar OLX por
     baixo — a automação preenche o que faltou, não substitui a escolha. */
  const portaisAutomaticos = IDS_PORTAIS.filter((id) => canais[`portais:${id}`]);
  if (portaisAutomaticos.length) {
    const jaTem = portaisDoImovel(imovel);
    const alvo = IDS_PORTAIS.filter((id) => jaTem.includes(id) || portaisAutomaticos.includes(id));
    const mudou = !imovel.publicarPortais || alvo.length !== jaTem.length;
    if (mudou) {
      await prisma.property.update({
        where: { id: imovel.id },
        data: { publicarPortais: true, portais: alvo },
      }).catch((e) => console.error("[automacao] portais:", e.message));
    }
  }

  if (canais.mercadoLivre) {
    try {
      const { publicar } = await import("./mercadoLivre.js");
      const r = await publicar(tenant, imovel);
      await registrar(tenant.id, imovel.id, "MERCADO_LIVRE", { ok: true, ref: r?.id || r?.anuncioId });
    } catch (erro) {
      await registrar(tenant.id, imovel.id, "MERCADO_LIVRE", { ok: false, erro: erro.message });
    }
  }

  /* ── Redes sociais ─────────────────────────────────────────────────────
     Numa chamada só, porque `publicarNasRedes` já publica nas duas e devolve
     o resultado por rede. Duas chamadas fariam o Facebook subir a mesma foto
     duas vezes — o Instagram reaproveita o contêiner criado ali dentro.

     A legenda é a descrição do imóvel. Quem publica pela tela pode escrevê-la
     à mão ou gerar por IA; aqui não há ninguém para escrever, e inventar um
     texto genérico seria pior que usar o que o cadastro já tem. */
  const redes = [
    canais.facebook ? "facebook" : null,
    canais.instagram ? "instagram" : null,
  ].filter(Boolean);

  if (redes.length) {
    const { publicarNasRedes } = await import("./publicacaoSocial.js");
    const legenda = [imovel.title, imovel.description].filter(Boolean).join(SEPARADOR).slice(0, 2000);
    try {
      const r = await publicarNasRedes({
        tenant,
        property: imovel,
        platforms: redes,
        caption: legenda,
      });
      /* `publicarNasRedes` já grava `PropertyPublication` no sucesso. Aqui só
         registramos o que ELE não registra: as falhas por rede, com o motivo
         que a Graph API devolveu. */
      for (const [rede, coluna] of [["facebook", "FACEBOOK"], ["instagram", "INSTAGRAM"]]) {
        if (!redes.includes(rede)) continue;
        const resultado = r?.[rede];
        if (resultado && !resultado.success) {
          await registrar(tenant.id, imovel.id, coluna, { ok: false, erro: resultado.error });
        }
      }
    } catch (erro) {
      for (const rede of redes) {
        await registrar(tenant.id, imovel.id, rede.toUpperCase(), { ok: false, erro: erro.message });
      }
    }
  }
}
