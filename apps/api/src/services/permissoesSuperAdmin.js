/* ────────────────────────────────────────────────────────────────────────────
   As permissões de quem opera a PLATAFORMA.

   É o `cargosPadrao.js` do super-admin: a lista canônica que a rota percorre
   ao gravar, que o middleware confere a cada requisição e que a migração usou
   para criar o primeiro Administrador. Não existe uma segunda lista — a tela
   recebe esta pelo `GET /api/admin/eu` e desenha a partir dela.

   ── DOIS NÍVEIS ──

   `ver*` abre uma ABA do painel. As outras liberam uma AÇÃO dentro de uma aba,
   e cada uma sabe de qual (`aba`): a tela usa isso para desenhar a caixa da
   ação debaixo da aba certa, e a regra `acao exige a aba` mora aqui
   (`normalizarPermissoes`) e não em cada lugar que grava.

   Um cargo "Suporte" — vê Tenants e Chamados, não entra em conta nenhuma, não
   edita nem exclui — é o exemplo que esta divisão existe para permitir. Só
   por aba, ele teria de escolher entre "não vê os tenants" e "pode excluí-los".
   ──────────────────────────────────────────────────────────────────────────── */

export const CARGO_ADMIN_PLATAFORMA = "Administrador";

/** As abas do painel, na ordem em que aparecem no menu. */
export const ABAS = [
  { chave: "verTenants", aba: "tenants", rotulo: "Tenants" },
  { chave: "verChamados", aba: "chamados", rotulo: "Chamados" },
  { chave: "verTutoriais", aba: "tutoriais", rotulo: "Tutoriais" },
  { chave: "verAvaliacoes", aba: "avaliacoes", rotulo: "Avaliações" },
  { chave: "verNovidades", aba: "novidades", rotulo: "Novidades" },
  { chave: "verUso", aba: "uso", rotulo: "Controle de Uso" },
  { chave: "verInteressados", aba: "interessados", rotulo: "Interessados" },
  { chave: "verUsuarios", aba: "usuarios", rotulo: "Usuários" },
  { chave: "verCargos", aba: "cargos", rotulo: "Cargos" },
  { chave: "verAuditoria", aba: "auditoria", rotulo: "Auditoria" },
  { chave: "verSeguranca", aba: "seguranca", rotulo: "Segurança" },
];

/** As ações, cada uma presa à aba em que acontece. */
export const ACOES = [
  { chave: "entrarNoTenant", exige: "verTenants", rotulo: "Entrar na conta do cliente" },
  { chave: "editarTenant", exige: "verTenants", rotulo: "Criar e editar tenants" },
  { chave: "excluirTenant", exige: "verTenants", rotulo: "Excluir tenants" },
  { chave: "resolverChamado", exige: "verChamados", rotulo: "Resolver e repriorizar chamados" },
  { chave: "gerenciarUsuarios", exige: "verUsuarios", rotulo: "Criar, editar e desativar usuários" },
  { chave: "publicarNovidades", exige: "verNovidades", rotulo: "Publicar as Novidades para os clientes" },
];

export const PERMISSOES_SUPER_ADMIN = [...ABAS, ...ACOES].map((p) => p.chave);

/* ── AS CHAVES DA CASA ──────────────────────────────────────────────────────

   O Administrador não abre mão destas três — a mesma trava de `CHAVES_DA_CASA`
   do Hub, pelo mesmo motivo: sem elas a plataforma fica sem ninguém capaz de
   reabrir a porta, nem quem a fechou. `verCargos` e `verUsuarios` são o que a
   tarefa pediu; `gerenciarUsuarios` entra porque ver a lista de usuários sem
   poder mexer nela não reabre porta nenhuma. */
export const CHAVES_DA_PLATAFORMA = ["verUsuarios", "verCargos", "gerenciarUsuarios"];

export const ehAdministradorDaPlataforma = (cargo) => cargo?.nome === CARGO_ADMIN_PLATAFORMA;

/** Tudo ligado — o que o Administrador tem e o que o seed cria. */
export function permissoesCompletas() {
  return Object.fromEntries(PERMISSOES_SUPER_ADMIN.map((p) => [p, true]));
}

/** Nada ligado — o que um super-admin SEM cargo alcança. */
export function permissoesVazias() {
  return Object.fromEntries(PERMISSOES_SUPER_ADMIN.map((p) => [p, false]));
}

/**
 * Lê o que veio no corpo e devolve só as colunas conhecidas, já com as duas
 * derivadas aplicadas:
 *
 *   · ação sem a aba é desligada — "pode excluir tenants" sem "vê Tenants" é
 *     um estado que nenhuma tela consegue mostrar, então não se grava;
 *   · o Administrador recebe as chaves da casa de volta, ignorando o corpo —
 *     DERIVAR em vez de recusar, como `cargoRoutes` faz: toda gravação conserta
 *     a linha sozinha e a tela nunca mostra marcado o que o banco tem
 *     desmarcado.
 *
 * `base` é o cargo como está no banco, para o PUT parcial: a regra da ação
 * olha o cargo INTEIRO, não só o que veio no corpo.
 */
export function normalizarPermissoes(corpo = {}, { nome, base = {} } = {}) {
  const data = {};
  for (const p of PERMISSOES_SUPER_ADMIN) {
    if (corpo[p] !== undefined) data[p] = Boolean(corpo[p]);
  }
  const resultante = { ...permissoesVazias(), ...base, ...data };

  if (ehAdministradorDaPlataforma({ nome })) {
    for (const chave of CHAVES_DA_PLATAFORMA) data[chave] = true;
    Object.assign(resultante, Object.fromEntries(CHAVES_DA_PLATAFORMA.map((c) => [c, true])));
  }

  for (const acao of ACOES) {
    if (resultante[acao.chave] && !resultante[acao.exige]) data[acao.chave] = false;
  }
  return data;
}

/**
 * O que a tela precisa para desenhar a grade e o menu: a lista de abas com as
 * ações de cada uma. Vai na resposta de `GET /api/admin/eu` e de `/cargos`,
 * para a tela não carregar uma cópia.
 */
export function catalogoDePermissoes() {
  return ABAS.map((aba) => ({
    ...aba,
    acoes: ACOES.filter((a) => a.exige === aba.chave).map(({ chave, rotulo }) => ({ chave, rotulo })),
  }));
}
