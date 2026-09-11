import { CHAVES, gravarNoUsuario, lerDoUsuario } from "./chaveDoTenant";

/* ────────────────────────────────────────────────────────────────────────────
   Por onde a pessoa andou — as sugestões iniciais da paleta de busca.

   Com o campo vazio, a paleta mostrava os oito primeiros destinos da barra, na
   ordem em que a barra os desenha. É uma ordem de APRENDIZADO (Dashboard,
   Imóveis, Leads…), e ela nunca muda: para quem passa o dia em "Portfólio
   Ativo" e "Funil", abrir a paleta e ver sempre a mesma lista genérica é abrir
   uma paleta que não conhece você.

   ── O QUE SE GUARDA É A CHAVE DO ITEM ──

   `imoveis-lista`, `config-cobranca` — nunca o rótulo, nunca o caminho. A
   chave é resolvida contra a lista da barra na hora de desenhar, e essa lista
   já passou pelos três filtros (cargo, plano, módulo). Guardar o caminho faria
   o histórico virar um atalho para "acesso negado" no dia em que a permissão
   mudasse; guardar o rótulo o faria envelhecer no dia em que a tela mudasse de
   nome. Chave que não resolve simplesmente não aparece.

   É também o que separa os módulos de graça: as chaves do Hub não existem na
   lista do Flow, então cada paleta sugere só o que é dela.

   ── O TAMANHO ──

   Cinco. A lista de sugestões tem oito linhas, e um histórico que as ocupasse
   todas apagaria os destinos que a pessoa ainda não conhece — que é o motivo
   original de a paleta existir.
   ──────────────────────────────────────────────────────────────────────────── */

const MAXIMO = 5;

/** As chaves visitadas, da mais recente para a mais antiga. */
export function lerHistorico(tenantId, usuarioId) {
  const guardado = lerDoUsuario(CHAVES.historicoDeTelas, tenantId, usuarioId);
  return Array.isArray(guardado) ? guardado.filter((c) => typeof c === "string") : [];
}

/**
 * Anota uma visita. Repetir a tela em que já se está não muda nada — sem esta
 * saída, cada re-render do layout reescreveria o armazenamento, e uma tela
 * aberta por muito tempo empurraria as outras quatro para fora sozinha.
 */
export function registrarTela(tenantId, usuarioId, chave) {
  if (!chave || !usuarioId) return;
  const atual = lerHistorico(tenantId, usuarioId);
  if (atual[0] === chave) return;
  // Sem repetição: revisitar promove a tela em vez de duplicá-la.
  const novo = [chave, ...atual.filter((c) => c !== chave)].slice(0, MAXIMO);
  gravarNoUsuario(CHAVES.historicoDeTelas, tenantId, usuarioId, novo);
}
