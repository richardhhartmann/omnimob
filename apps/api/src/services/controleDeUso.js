/* ────────────────────────────────────────────────────────────────────────────
   CONTROLE DE USO — quem usa a Omnimob, quem esfriou e quem parou.

   Porte da aba do VYA, sem rastreamento novo: a trilha de auditoria já guarda
   cada escrita com imobiliária, pessoa e data, e é dela que sai o "uso". Ler
   não deixa rastro, então uma conta que só consulta aparece mais fria do que
   está — e é a pergunta certa para o comercial: quem não cadastra nem muda
   nada há um mês não está tirando proveito do produto.

   shortcut: o suporte dentro da conta ("Entrar") escreve com o nome do
   Administrador e conta como uso; separar exige marcar a sessão na trilha.
   ──────────────────────────────────────────────────────────────────────────── */

const DIA = 864e5;

/** A régua: ativa (≤ 7 dias), esfriando (≤ 30), parada (> 30) e nunca usou. */
export function situacaoDeUso(ultimaAtividade, agora = Date.now()) {
  if (!ultimaAtividade) return "nunca";
  const dias = (agora - new Date(ultimaAtividade).getTime()) / DIA;
  if (dias <= 7) return "ativa";
  if (dias <= 30) return "esfriando";
  return "parada";
}

export async function controleDeUso(prisma, agora = Date.now()) {
  const desde = new Date(agora - 30 * DIA);
  const comTenant = { tenantId: { not: null } };
  const [tenants, ultima, escritas, pessoas, leads, usuarios, imoveis] = await Promise.all([
    prisma.tenant.findMany({
      select: { id: true, name: true, slug: true, plano: true, statusPagamento: true, ativo: true, createdAt: true },
    }),
    prisma.auditoria.groupBy({ by: ["tenantId"], where: comTenant, _max: { createdAt: true } }),
    prisma.auditoria.groupBy({ by: ["tenantId"], where: { ...comTenant, createdAt: { gte: desde } }, _count: { _all: true } }),
    prisma.auditoria.groupBy({ by: ["tenantId", "usuarioId"], where: { ...comTenant, usuarioId: { not: null }, createdAt: { gte: desde } } }),
    prisma.propertyLead.groupBy({ by: ["tenantId"], where: { createdAt: { gte: desde } }, _count: { _all: true } }),
    prisma.usuario.groupBy({ by: ["tenantId"], where: { ativo: true }, _count: { _all: true } }),
    prisma.property.groupBy({ by: ["tenantId"], where: { status: "ACTIVE" }, _count: { _all: true } }),
  ]);

  const mapa = (linhas, valor) => new Map(linhas.map((l) => [l.tenantId, valor(l)]));
  const ultimaDe = mapa(ultima, (l) => l._max.createdAt);
  const escritasDe = mapa(escritas, (l) => l._count._all);
  const leadsDe = mapa(leads, (l) => l._count._all);
  const usuariosDe = mapa(usuarios, (l) => l._count._all);
  const imoveisDe = mapa(imoveis, (l) => l._count._all);
  const pessoasDe = new Map();
  for (const p of pessoas) pessoasDe.set(p.tenantId, (pessoasDe.get(p.tenantId) || 0) + 1);

  const linhas = tenants
    .map((t) => ({
      ...t,
      ultimaAtividade: ultimaDe.get(t.id) || null,
      situacao: situacaoDeUso(ultimaDe.get(t.id), agora),
      escritas30: escritasDe.get(t.id) || 0,
      pessoas30: pessoasDe.get(t.id) || 0,
      usuarios: usuariosDe.get(t.id) || 0,
      leads30: leadsDe.get(t.id) || 0,
      imoveisAtivos: imoveisDe.get(t.id) || 0,
    }))
    // Mais recente primeiro; quem nunca usou vai para o fim.
    .sort((a, b) => (b.ultimaAtividade ? +new Date(b.ultimaAtividade) : 0) - (a.ultimaAtividade ? +new Date(a.ultimaAtividade) : 0));

  const resumo = { total: linhas.length, ativa: 0, esfriando: 0, parada: 0, nunca: 0 };
  for (const l of linhas) if (l.ativo) resumo[l.situacao] += 1;
  return { resumo, tenants: linhas };
}
