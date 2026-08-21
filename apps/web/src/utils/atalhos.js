/* ────────────────────────────────────────────────────────────────────────────
   Atalhos de teclado.

   ── A IDEIA ──

   Em cada tela, os destinos e as ações principais recebem uma tecla. Estando na
   tela, apertar a tecla faz o mesmo que clicar no botão. A tecla aparece
   desenhada ao lado do botão, então ninguém precisa decorar nada — aprende
   usando.

   ── TRÊS CAMADAS, NESTA ORDEM ──

     1. o PADRÃO daqui (números, na ordem em que os botões aparecem)
     2. o padrão da IMOBILIÁRIA, que o administrador define em Configurações
     3. a escolha da PESSOA, em Configurações do perfil

   A pessoa vence a imobiliária, e a imobiliária vence o padrão. É a mesma
   hierarquia do tema do painel, e pela mesma razão: a imobiliária estabelece a
   convenção da casa, e quem trabalha o dia inteiro na ferramenta pode discordar
   dela.

   ── O QUE NÃO É ATALHO ──

   Nada destrutivo. Não existe tecla para excluir, cancelar assinatura ou
   remover usuário: um atalho é disparado por engano com muito mais facilidade
   que um clique, e as duas confirmações que protegem essas ações existem
   justamente porque errar ali é caro.

   ── ESC ──

   Volta para a tela anterior, de qualquer lugar. Ele não está nesta tabela
   porque não é configurável: é o gesto de "sair daqui" que o sistema inteiro
   respeita, e trocá-lo por outra tecla quebraria a única coisa que a pessoa já
   sabe antes de aprender o resto. Ver `useAtalhos`.
   ──────────────────────────────────────────────────────────────────────────── */

/* Onde cada conjunto vale. A chave casa com o `pathname` — `telaDosAtalhos`
   traduz a rota para uma delas. */
export const TELAS_COM_ATALHOS = ["dashboard", "inicio", "imoveis", "relatorios", "configuracoes"];

/**
 * O catálogo. Cada ação tem:
 *   `id`        — estável, é a chave da configuração gravada
 *   `tela`      — onde a tecla vale
 *   `rotulo`    — o que a tela de configuração mostra
 *   `padrao`    — a tecla de fábrica
 *   `exige`     — permissão do cargo, quando houver
 *   `destino`   — rota para onde ir (as ações sem rota são tratadas na tela)
 */
export const ACOES = [
  // ── Dashboard ────────────────────────────────────────────────────────────
  { id: "dashboard.imoveis",    tela: "dashboard", rotulo: "Gerenciar imóveis",     padrao: "1", exige: "gerenciarImoveis",  destino: "/imoveis" },
  { id: "dashboard.portfolio",  tela: "dashboard", rotulo: "Portfólio ativo",       padrao: "2", exige: "gerenciarImoveis",  destino: "/imoveis/portfolio" },
  { id: "dashboard.relatorios", tela: "dashboard", rotulo: "Relatórios",            padrao: "3", exige: "verRelatorios",     destino: "/relatorios" },
  { id: "dashboard.clientes",   tela: "dashboard", rotulo: "Clientes",              padrao: "4", exige: "gerenciarClientes", destino: "/clientes" },
  { id: "dashboard.usuarios",   tela: "dashboard", rotulo: "Usuários",              padrao: "5", exige: "gerenciarUsuarios", destino: "/usuarios" },
  { id: "dashboard.cargos",     tela: "dashboard", rotulo: "Cargos",                padrao: "6", exige: "gerenciarCargos",   destino: "/cargos" },
  { id: "dashboard.auditoria",  tela: "dashboard", rotulo: "Registro de atividade", padrao: "7", exige: "verAuditoria",      destino: "/auditoria" },
  { id: "dashboard.config",     tela: "dashboard", rotulo: "Configurações",         padrao: "8", exige: "verConfiguracoes",  destino: "/configuracoes" },

  // ── Início (painel do gestor) ────────────────────────────────────────────
  { id: "inicio.leads",     tela: "inicio", rotulo: "Ir para os leads", padrao: "1", exige: "verRelatorios",    destino: "/relatorios?ver=leads" },
  { id: "inicio.portfolio", tela: "inicio", rotulo: "Ver o acervo",     padrao: "2", exige: "gerenciarImoveis", destino: "/imoveis/portfolio" },

  // ── Gerenciar imóveis ────────────────────────────────────────────────────
  { id: "imoveis.novo",      tela: "imoveis", rotulo: "Novo imóvel",     padrao: "1", exige: "gerenciarImoveis", destino: "/imoveis/novo" },
  { id: "imoveis.categorias", tela: "imoveis", rotulo: "Categorias",     padrao: "2", exige: "gerenciarImoveis", destino: "/tipos-imovel" },

  // ── Relatórios ───────────────────────────────────────────────────────────
  { id: "relatorios.leads",     tela: "relatorios", rotulo: "Leads",            padrao: "1", exige: "verRelatorios", destino: "/relatorios?ver=leads" },
  { id: "relatorios.mensal",    tela: "relatorios", rotulo: "Relatório mensal", padrao: "2", exige: "verRelatorios", destino: "/relatorios?ver=mensal" },
  { id: "relatorios.funil",     tela: "relatorios", rotulo: "Funil de vendas",  padrao: "3", exige: "verRelatorios", destino: "/relatorios?ver=funil" },
  { id: "relatorios.comissoes", tela: "relatorios", rotulo: "Comissões",        padrao: "4", exige: "verRelatorios", destino: "/relatorios?ver=comissoes" },

  /* ── Global: "novo alguma coisa" ────────────────────────────────────────
     Uma tecla só para todas as telas de cadastro, e não uma por tela. O gesto
     é o mesmo em todas — "criar o que esta tela cria" — e uma tecla por tela
     seria uma tabela de decorar em vez de um hábito.

     `tela: null` = vale em qualquer lugar; quem responde é a tela aberta. */
  { id: "global.novo", tela: null, rotulo: "Novo registro (na tela em que você está)", padrao: "n" },
];

export const ACOES_POR_ID = Object.fromEntries(ACOES.map((a) => [a.id, a]));

/** A rota atual → a tela dos atalhos. `null` quando a tela não tem nenhum. */
export function telaDosAtalhos(pathname) {
  if (pathname === "/") return "dashboard";
  if (pathname === "/inicio") return "inicio";
  if (pathname === "/imoveis") return "imoveis";
  if (pathname === "/relatorios") return "relatorios";
  if (pathname === "/configuracoes") return "configuracoes";
  return null;
}

/** Tecla legível para desenhar na tela: `"1"`, `"N"`, `"Esc"`. */
export function rotuloDaTecla(tecla) {
  if (!tecla) return "";
  return tecla.length === 1 ? tecla.toUpperCase() : tecla;
}

/* O que conta como tecla válida. Uma letra ou um dígito, e nada mais.
   Combinações com Ctrl/Alt colidem com o navegador (Ctrl+N abre janela), e
   teclas mortas como F5 têm dono. Deixar a pessoa escolher `F5` é deixá-la
   quebrar o próprio painel sem entender por quê. */
export function teclaValida(tecla) {
  return typeof tecla === "string" && /^[a-zA-Z0-9]$/.test(tecla);
}

/**
 * O mapa final de `tecla → ação`, já com as três camadas resolvidas e filtrado
 * pelo cargo.
 *
 * Devolve por TELA porque a mesma tecla pode significar coisas diferentes em
 * lugares diferentes — `1` é "Gerenciar imóveis" no Dashboard e "Leads" em
 * Relatórios. Um mapa global obrigaria uma tecla única por ação em todo o
 * sistema, e aí não haveria números suficientes.
 */
export function mapaDeAtalhos({ tela, cargo, doTenant = {}, doUsuario = {} }) {
  const mapa = new Map();

  for (const acao of ACOES) {
    // A ação vale nesta tela? (`tela: null` vale em todas.)
    if (acao.tela !== null && acao.tela !== tela) continue;
    // O cargo alcança o destino? Atalho para tela proibida é atalho quebrado.
    if (acao.exige && !cargo?.[acao.exige]) continue;

    const escolhida = doUsuario[acao.id] ?? doTenant[acao.id] ?? acao.padrao;
    /* String vazia é uma escolha: "não quero atalho para isto". `??` deixa
       passar, então o vazio é tratado aqui e não vira o padrão de volta. */
    if (!escolhida) continue;
    if (!teclaValida(escolhida)) continue;

    const chave = escolhida.toLowerCase();
    /* Primeira ação a reivindicar a tecla fica com ela. Duas ações na mesma
       tecla é configuração inválida, e a tela de configuração avisa antes de
       gravar — mas o mapa não pode explodir se chegar assim mesmo. */
    if (!mapa.has(chave)) mapa.set(chave, acao);
  }

  return mapa;
}

/**
 * As ações que a tela de configuração deve oferecer, agrupadas por tela e já
 * sem o que o cargo não alcança. Oferecer atalho para uma tela que a pessoa não
 * abre é pedir que ela configure algo que nunca vai funcionar.
 */
export function acoesConfiguraveis(cargo) {
  const grupos = new Map();
  for (const acao of ACOES) {
    if (acao.exige && !cargo?.[acao.exige]) continue;
    const grupo = acao.tela || "global";
    if (!grupos.has(grupo)) grupos.set(grupo, []);
    grupos.get(grupo).push(acao);
  }
  return grupos;
}

/** Os conflitos de uma configuração, para a tela avisar ANTES de gravar. */
export function conflitosDe(config = {}, cargo) {
  const porTela = new Map();
  const conflitos = [];

  for (const acao of ACOES) {
    if (acao.exige && !cargo?.[acao.exige]) continue;
    const tecla = (config[acao.id] ?? acao.padrao ?? "").toLowerCase();
    if (!tecla) continue;

    /* Uma ação global colide com TODAS as telas; uma de tela colide só com a
       dela e com as globais. */
    const escopos = acao.tela === null ? [...TELAS_COM_ATALHOS] : [acao.tela];
    for (const escopo of escopos) {
      const chave = `${escopo}|${tecla}`;
      if (porTela.has(chave)) {
        conflitos.push({ tecla, tela: escopo, acoes: [porTela.get(chave), acao.id] });
      } else {
        porTela.set(chave, acao.id);
      }
    }
  }
  return conflitos;
}

/** Só o que difere do padrão vai para o banco. */
export function apenasMudancas(config = {}) {
  const saida = {};
  for (const acao of ACOES) {
    const v = config[acao.id];
    if (v === undefined) continue;
    if (v === acao.padrao) continue;
    saida[acao.id] = v;
  }
  return saida;
}

/* ── Atribuir uma tecla, resolvendo o conflito ────────────────────────────────

   Sem botão de salvar, uma configuração ambígua não pode existir nem por um
   instante: ela seria gravada. Então escolher uma tecla que já tem dono TIRA
   dela o dono anterior, em vez de recusar a escolha.

   É a decisão certa porque a intenção é inequívoca: quem aperta `2` em
   "Portfólio ativo" está dizendo que quer `2` ali. Recusar obrigaria a pessoa a
   descobrir sozinha quem estava com a tecla e a limpar antes — e trocar duas
   teclas de lugar viraria três passos.

   O que a tela deve fazer é DIZER de quem saiu, e é para isso que
   `roubadaDe` existe. Um atalho que some sem aviso é o mesmo que um bug.

   O escopo do roubo segue a regra do conflito: uma ação global disputa com
   todas as telas; uma de tela, só com a dela e com as globais.
   ────────────────────────────────────────────────────────────────────────── */
export function atribuirTecla(valor = {}, herdados = {}, cargo, acaoId, tecla) {
  const alvo = ACOES_POR_ID[acaoId];
  if (!alvo) return { proximo: valor, roubadaDe: null };

  const proximo = { ...valor, [acaoId]: tecla };
  if (!tecla) return { proximo, roubadaDe: null }; // desligar não rouba de ninguém

  const chave = String(tecla).toLowerCase();
  const disputa = (outra) =>
    alvo.tela === null || outra.tela === null || outra.tela === alvo.tela;

  let roubadaDe = null;
  for (const outra of ACOES) {
    if (outra.id === acaoId) continue;
    if (outra.exige && !cargo?.[outra.exige]) continue;
    if (!disputa(outra)) continue;

    const atual = (proximo[outra.id] ?? herdados[outra.id] ?? outra.padrao ?? "").toLowerCase();
    if (atual !== chave) continue;

    /* Desliga explicitamente, e não `delete`: apagar a chave faria a ação cair
       de volta no herdado — que é justamente a tecla que acabou de ser tomada. */
    proximo[outra.id] = "";
    roubadaDe = outra.rotulo;
  }

  return { proximo, roubadaDe };
}
