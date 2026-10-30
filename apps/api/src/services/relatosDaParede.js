import { coerenciaDaAvaliacao } from "./aiService.js";

/* ────────────────────────────────────────────────────────────────────────────
   A AVALIAÇÃO QUE VIRA DEPOIMENTO — a parede "Por que Omnimob" da landing.

   Uma regra só para as três telas que tocam nela: o pedido de avaliação no
   painel (pode oferecer a caixa?), a aba Avaliações do super-admin (pode
   publicar?) e a landing (o que está no ar).

   Três chaves, e as três precisam abrir:
     1. a pessoa CONSENTIU — e só pode consentir com 4 ou 5 estrelas, com
        comentário escrito (sem texto não há o que mostrar) e fora do trial;
     2. a IA não marcou o texto como incoerente com a nota;
     3. alguém da Omnimob PUBLICOU.

   A parede tem LIMITE_DA_PAREDE cartões. Os depoimentos de exemplo completam
   as vagas que as reais não ocupam, e quem monta isso é a tela
   (`web/src/data/relatosDemo.js`): aqui só se garante que as reais sozinhas
   não passem do limite.
   ──────────────────────────────────────────────────────────────────────────── */

export const LIMITE_DA_PAREDE = 24;
export const NOTA_MINIMA_PARA_PUBLICAR = 4;

/** Pode oferecer (e aceitar) o "pode publicar"? */
export function podeConsentir({ nota, comentario, trial }) {
  return !trial && nota >= NOTA_MINIMA_PARA_PUBLICAR && Boolean(String(comentario || "").trim());
}

/** Consentiu e a IA não barrou: o botão de publicar fica liberado. */
export function publicavel(a) {
  return Boolean(a?.permitePublicar) && podeConsentir({ nota: a.nota, comentario: a.comentario }) && a.coerencia !== "NAO_CONDIZ";
}

/** O que cabe no cartão: a primeira frase, ou o começo do texto cortado na palavra. */
export function fraseDoCartao(texto, max = 140) {
  const limpo = String(texto || "").replace(/\s+/g, " ").trim();
  const primeira = limpo.match(/^.+?[.!?](?=\s|$)/)?.[0] || limpo;
  if (primeira.length <= max) return primeira;
  return `${primeira.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

/* Disparado e esquecido depois de gravar: a pessoa não espera a IA para ver o
   "obrigado". Se a IA estiver fora, a coerência fica nula ("não conferida") e
   quem publica lê o texto — a marca é ajuda, não a trava principal. */
export function conferirCoerencia(prisma, avaliacao) {
  coerenciaDaAvaliacao(avaliacao)
    .then((coerencia) => prisma.avaliacao.update({ where: { id: avaliacao.id }, data: { coerencia } }))
    .catch((e) => console.warn(`[avaliacoes] coerência de ${avaliacao.id} não conferida: ${e.message}`));
}

/** O que a landing desenha: as reais no ar, mais recentes primeiro, e os exemplos tirados do ar. */
export async function relatosNoAr(prisma) {
  const [publicadas, ocultos] = await Promise.all([
    prisma.avaliacao.findMany({
      where: { publicadaEm: { not: null }, permitePublicar: true, tenant: { ativo: true } },
      orderBy: { publicadaEm: "desc" },
      take: LIMITE_DA_PAREDE,
      select: {
        id: true, nota: true, comentario: true, coerencia: true, permitePublicar: true,
        usuarioNome: true, usuarioCargo: true,
        tenant: { select: { name: true, cidade: true, estado: true } },
      },
    }),
    prisma.relatoDemoOculto.findMany({ select: { chave: true } }),
  ]);
  return {
    // Segunda tranca: o que foi publicado e depois deixou de ser publicável não sai.
    reais: publicadas.filter(publicavel).map((a) => ({
      chave: a.id,
      nome: a.usuarioNome,
      cargo: a.usuarioCargo || "",
      imobiliaria: a.tenant?.name || "",
      cidade: a.tenant?.cidade || "",
      uf: a.tenant?.estado || "",
      frase: fraseDoCartao(a.comentario),
      relato: String(a.comentario || "").trim(),
    })),
    ocultos: ocultos.map((o) => o.chave),
  };
}
