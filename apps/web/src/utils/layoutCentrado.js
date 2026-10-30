/* ────────────────────────────────────────────────────────────────────────────
   TELAS CENTRADAS — preferência de cada pessoa (não da imobiliária).

   Porte do VYA (`lib/shell/layoutCentrado.ts`), com a mesma regra e os mesmos
   números. Desligado, a tela ocupa a largura toda; ligado, a barra do topo, o
   cabeçalho e o conteúdo ganham margem dos dois lados (coluna de até 1320px —
   ver o bloco do layout centrado no CSS do AdminLayout). Quem nunca escolheu
   cai no automático: fica centrado só em monitor largo, onde a linha de texto
   atravessando a tela inteira fica cansativa de ler.

   ── ONDE MORA ──

   O atributo fica no <html> (`data-layout="centrado"`), e não no .ds-shell,
   para o script do index.html conseguir aplicá-lo ANTES da primeira pintura
   — sem ele, o painel abriria em largura total e pularia para o centro um
   instante depois. O CSS só olha para ele dentro do .ds-shell, então a
   vitrine e a landing nunca são afetadas.

   ── QUEM DECIDE, NESTA ORDEM ──

   1. A escolha gravada no servidor (`Usuario.layoutCentrado`), que viaja na
      sessão: é o que faz a escolha valer nas outras máquinas.
   2. A cópia no navegador (`localStorage`), que o script do <head> lê antes de
      a sessão existir.
   3. O automático, pela largura da janela.
   ──────────────────────────────────────────────────────────────────────────── */

import { api } from "../api";

/** A partir desta largura de janela o automático liga o centrado. */
export const LARGURA_DE_MONITOR_LARGO = 1800;

/** A chave no navegador. O script do index.html usa a MESMA string. */
export const CHAVE_LAYOUT = "layoutCentrado";

/** O automático: só monitor largo nasce centrado. */
export function centradoNoAutomatico(largura) {
  return largura >= LARGURA_DE_MONITOR_LARGO;
}

/** Aplica (ou tira) o centrado agora, sem recarregar. */
export function aplicarLayoutCentrado(centrado) {
  const raiz = document.documentElement;
  if (centrado) raiz.setAttribute("data-layout", "centrado");
  else raiz.removeAttribute("data-layout");
}

/** O que a tela está mostrando neste instante. */
export function layoutCentradoAtual() {
  return document.documentElement.getAttribute("data-layout") === "centrado";
}

function guardarNoNavegador(centrado) {
  try { localStorage.setItem(CHAVE_LAYOUT, centrado ? "1" : "0"); } catch { /* navegação privada */ }
}

/** Guarda a escolha: no navegador para valer já, e no servidor para valer nas outras máquinas. */
export function salvarLayoutCentrado(centrado) {
  guardarNoNavegador(centrado);
  return api.salvarMeuLayout(centrado).catch(() => {});
}

/**
 * A escolha que veio do servidor, na sessão. Só ela pode contrariar o que o
 * script do <head> decidiu: nula ("nunca escolhi") não mexe em nada, e o
 * automático (ou a cópia do navegador) continua valendo.
 */
export function sincronizarComOServidor(doServidor) {
  if (doServidor !== true && doServidor !== false) return;
  aplicarLayoutCentrado(doServidor);
  guardarNoNavegador(doServidor);
}
