/* ────────────────────────────────────────────────────────────────────────────
   Os cargos com que uma imobiliária nasce.

   Vive num módulo próprio porque tem DOIS consumidores — o seed e o
   provisionamento de tenant novo — e eles precisam concordar. Enquanto a lista
   estava só no seed, o provisionamento se virava com um
   `findFirst({ descricao: "Administrador" })`: pegava o cargo de OUTRA
   imobiliária (a tabela era global) e pendurava o admin do cliente novo nele.
   Era a origem prática do vazamento de permissões entre empresas.

   Cada imobiliária recebe a sua própria cópia desta lista. Depois ela edita,
   renomeia e apaga o que quiser sem tocar em ninguém.
   ──────────────────────────────────────────────────────────────────────────── */

export const CARGO_ADMIN = "Administrador";

export const PERMISSOES = [
  "acessarPainel",
  "editarPagina",
  "gerenciarImoveis",
  "gerenciarLeads",
  "gerenciarUsuarios",
  "gerenciarClientes",
  "gerenciarCargos",
  "verConfiguracoes",
  "verRelatorios",
  "publicarRedes",
];

/* `verConfiguracoes` e `gerenciarCargos` aparecem SÓ no Administrador, e é
   deliberado: são as chaves da casa. Configurações guarda plano, cobrança,
   domínio e o cancelamento da assinatura; Gerenciar Cargos permite reescrever
   as permissões de todo mundo — inclusive conceder a si mesmo o que faltava. */
export const CARGOS_PADRAO = [
  { descricao: CARGO_ADMIN, permite: PERMISSOES },
  {
    descricao: "Gerente",
    permite: ["acessarPainel", "editarPagina", "gerenciarImoveis", "gerenciarLeads", "gerenciarUsuarios", "gerenciarClientes", "verRelatorios", "publicarRedes"],
  },
  {
    descricao: "Corretor",
    permite: ["acessarPainel", "gerenciarImoveis", "gerenciarLeads", "gerenciarClientes", "verRelatorios", "publicarRedes"],
  },
  {
    descricao: "Assistente Comercial",
    permite: ["acessarPainel", "gerenciarLeads", "gerenciarClientes"],
  },
  {
    descricao: "Marketing",
    permite: ["acessarPainel", "editarPagina", "verRelatorios", "publicarRedes"],
  },
  {
    descricao: "Editor de Vitrine",
    permite: ["editarPagina"],
  },
  {
    descricao: "Consulta (Somente Leitura)",
    permite: ["acessarPainel", "verRelatorios"],
  },
];

/** Monta o `data` de um cargo a partir de um item do catálogo. */
export function dadosDoCargo({ descricao, permite }, tenantId) {
  const data = { tenantId, descricao };
  for (const p of PERMISSOES) data[p] = permite.includes(p);
  return data;
}

/**
 * Cria o conjunto inicial de cargos de uma imobiliária e devolve o
 * Administrador — que é sempre o próximo passo de quem chama (o usuário
 * inicial precisa de um cargo).
 *
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {string} tenantId
 * @returns {Promise<{ id: number, descricao: string }>} o cargo Administrador
 */
export async function criarCargosPadrao(prisma, tenantId) {
  await prisma.cargo.createMany({
    data: CARGOS_PADRAO.map((c) => dadosDoCargo(c, tenantId)),
  });
  /* Relido em vez de deduzido do createMany: o Postgres não devolve os ids
     criados em lote, e inventar um "o primeiro é o Administrador" a partir da
     ordem da lista amarraria esta função à ordenação do array acima. */
  return prisma.cargo.findFirst({
    where: { tenantId, descricao: CARGO_ADMIN },
    select: { id: true, descricao: true },
  });
}
