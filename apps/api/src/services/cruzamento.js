import { prisma } from "../db.js";

/* ────────────────────────────────────────────────────────────────────────────
   Cruzamento entre o que o cliente procura e o que a imobiliária tem.

   É o recurso que os sistemas grandes vendem como "inteligência de matching". O
   que ele é de fato: a imobiliária já tem a carteira de clientes e já tem o
   acervo, e faltava a ligação entre os dois. Com o perfil gravado
   (`PerfilBusca`), cadastrar um imóvel passa a responder sozinho a pergunta que
   hoje só existe na cabeça do corretor — "quem da minha carteira estava
   esperando por isto?".

   ── AS DUAS DIREÇÕES ──

   `imoveisParaPerfil` — abri o cliente, o que tenho para ele?
   `perfisParaImovel`  — cadastrei um imóvel, quem estava esperando?

   São a mesma regra lida de dois lados, e é por isso que ela mora aqui e não
   dentro de uma rota: escrita duas vezes, ela divergiria na primeira mudança de
   critério, e o corretor veria o imóvel na tela do cliente sem ver o cliente na
   tela do imóvel.

   ── CRITÉRIO ELÁSTICO, DE PROPÓSITO ──

   Preço vai até 10% acima do teto declarado, e quartos aceitam um a menos. Não
   é descuido: quem diz "até 600 mil" compra por 640 se o imóvel for o certo, e
   quem pede três quartos visita o de dois com suíte grande. Filtro literal
   devolve pouco e ensina o corretor a não confiar na ferramenta — que é o pior
   resultado possível para um recurso de sugestão.

   Os que passam pela margem vêm marcados (`aproximado`), para a tela poder
   dizer "um pouco acima do orçamento" em vez de mentir que bate exatamente.
   ──────────────────────────────────────────────────────────────────────────── */

/** Quanto o preço pode passar do teto e ainda ser sugerido. */
export const FOLGA_DE_PRECO = 0.1;

const num = (v) => (v === null || v === undefined ? null : Number(v));

/* Filtro de banco: só o que corta MUITO e é barato de indexar.
   O resto da regra roda em memória — o acervo de uma imobiliária cabe
   folgadamente, e escrever elasticidade em SQL deixaria a consulta ilegível
   para economizar milissegundos que ninguém sente. */
function filtroBase(perfil) {
  return {
    tenantId: perfil.tenantId,
    status: "ACTIVE",
    ...(perfil.tipoContrato ? { tipoContrato: perfil.tipoContrato } : {}),
    ...(perfil.tipoImovelId ? { tipoImovelId: perfil.tipoImovelId } : {}),
    ...(perfil.finalidade ? { finalidade: perfil.finalidade } : {}),
    ...(perfil.cidade ? { city: { equals: perfil.cidade, mode: "insensitive" } } : {}),
  };
}

/**
 * O imóvel serve para o perfil?
 * @returns {{serve: boolean, aproximado: boolean, motivos: string[]}}
 */
export function avaliar(perfil, imovel) {
  const motivos = [];
  let aproximado = false;

  const preco = num(imovel.price);
  const min = num(perfil.precoMin);
  const max = num(perfil.precoMax);

  if (min !== null && preco !== null && preco < min) {
    return { serve: false, aproximado: false, motivos: [] };
  }
  if (max !== null && preco !== null && preco > max) {
    if (preco > max * (1 + FOLGA_DE_PRECO)) return { serve: false, aproximado: false, motivos: [] };
    aproximado = true;
    motivos.push("um pouco acima do orçamento");
  }

  if (perfil.quartosMin) {
    const q = Number(imovel.bedrooms || 0);
    if (q < perfil.quartosMin - 1) return { serve: false, aproximado: false, motivos: [] };
    if (q < perfil.quartosMin) {
      aproximado = true;
      motivos.push("um quarto a menos");
    }
  }

  /* Vagas e área não têm folga: quem precisa de duas vagas não resolve com uma,
     e metragem mínima costuma vir de família ou de móvel que já existe. */
  if (perfil.vagasMin && Number(imovel.parkingSpots || 0) < perfil.vagasMin) {
    return { serve: false, aproximado: false, motivos: [] };
  }
  if (perfil.areaMin) {
    const area = Number(imovel.areaPrivativa || imovel.areaConstruida || imovel.squareFootage || 0);
    if (area && area < perfil.areaMin) return { serve: false, aproximado: false, motivos: [] };
  }

  /* Lista de bairros vazia significa "qualquer um da cidade", e não "nenhum" —
     essa inversão é o erro clássico de quem implementa filtro por lista. */
  if (Array.isArray(perfil.bairros) && perfil.bairros.length > 0) {
    const alvo = String(imovel.neighborhood || "").trim().toLowerCase();
    const aceitos = perfil.bairros.map((b) => String(b).trim().toLowerCase()).filter(Boolean);
    if (aceitos.length && !aceitos.includes(alvo)) {
      return { serve: false, aproximado: false, motivos: [] };
    }
  }

  return { serve: true, aproximado, motivos };
}

/** Imóveis do acervo que servem para este perfil, os que batem exato primeiro. */
export async function imoveisParaPerfil(perfil, { limite = 24 } = {}) {
  const candidatos = await prisma.property.findMany({
    where: filtroBase(perfil),
    orderBy: { createdAt: "desc" },
    include: { images: { orderBy: { position: "asc" }, take: 1 }, tipoImovel: { select: { descricao: true } } },
    // Teto de leitura: o acervo cabe, mas não faz sentido puxar 5.000 linhas
    // para escolher 24.
    take: 400,
  });

  return candidatos
    .map((imovel) => ({ imovel, ...avaliar(perfil, imovel) }))
    .filter((r) => r.serve)
    .sort((a, b) => Number(a.aproximado) - Number(b.aproximado))
    .slice(0, limite)
    .map((r) => ({ ...r.imovel, aproximado: r.aproximado, motivos: r.motivos }));
}

/** Perfis (e clientes) que estavam esperando por este imóvel. */
export async function perfisParaImovel(imovel, { limite = 30 } = {}) {
  const perfis = await prisma.perfilBusca.findMany({
    where: {
      tenantId: imovel.tenantId,
      ativo: true,
      ...(imovel.tipoContrato ? { OR: [{ tipoContrato: null }, { tipoContrato: imovel.tipoContrato }] } : {}),
    },
    include: { cliente: { select: { id: true, nome: true, email: true, telefone: true, whatsapp: true, ativo: true } } },
    take: 500,
  });

  return perfis
    .filter((p) => p.cliente?.ativo)
    .map((perfil) => ({ perfil, ...avaliar(perfil, imovel) }))
    .filter((r) => r.serve)
    .sort((a, b) => Number(a.aproximado) - Number(b.aproximado))
    .slice(0, limite)
    .map((r) => ({
      perfilId: r.perfil.id,
      titulo: r.perfil.titulo,
      cliente: r.perfil.cliente,
      aproximado: r.aproximado,
      motivos: r.motivos,
    }));
}
