/* ────────────────────────────────────────────────────────────────────────────
   A barra lateral personalizada de cada pessoa — a validação do servidor
   (31/10/2026, porte do VYA: `core/helpers/barra_lateral.py`).

   A pessoa cria SEÇÕES ("Favoritos", "Fechamento do mês") com as telas da
   barra que ela mais usa, e alterna entre elas e a barra inteira. Quem desenha
   e filtra é o cliente (`apps/web/src/utils/barraLateral.js`); aqui só se cobra
   o FORMATO, pelo mesmo motivo dos atalhos (ver `atalhos.js`): validar as
   chaves contra a navegação exigiria uma cópia de `navegacaoDoPainel.jsx`, que
   divergiria no primeiro item novo. Chave órfã (uma tela que saiu do produto,
   ou que o cargo deixou de alcançar) a tela ignora, porque só desenha o que a
   navegação da pessoa já traz.

   Formato gravado em `Usuario.barraLateral`:

     { secoes: [{ id: "s-k3f9", nome: "Favoritos", itens: ["imoveis-lista", …] }],
       ativa: "s-k3f9" }        // ou null = a barra inteira
   ──────────────────────────────────────────────────────────────────────────── */

const ID_VALIDO = /^[a-z0-9][a-z0-9-]{0,39}$/;
const CHAVE_VALIDA = /^[A-Za-z0-9_.:-]{1,80}$/;

/* Tetos. Não são defesa contra o cliente — são contra um JSON crescendo sem
   limite numa coluna que ninguém olha. Os mesmos da tela. */
export const MAXIMO_SECOES = 12;
export const MAXIMO_ITENS = 300;
export const MAXIMO_NOME = 40;

/**
 * O objeto pronto para gravar, ou `null` quando o corpo não presta.
 * `null` é recusa; `{ secoes: [], ativa: null }` é "sem seção nenhuma", que é
 * válido e é como se apaga tudo.
 */
export function normalizarBarra(bruto) {
  if (bruto === null || bruto === undefined) return { secoes: [], ativa: null };
  if (typeof bruto !== "object" || Array.isArray(bruto)) return null;
  const secoesBrutas = bruto.secoes ?? [];
  if (!Array.isArray(secoesBrutas) || secoesBrutas.length > MAXIMO_SECOES) return null;

  const secoes = [];
  const ids = new Set();
  for (const s of secoesBrutas) {
    if (!s || typeof s !== "object" || Array.isArray(s)) return null;
    if (typeof s.id !== "string" || !ID_VALIDO.test(s.id) || ids.has(s.id)) return null;
    if (typeof s.nome !== "string") return null;
    const nome = s.nome.replace(/\s+/g, " ").trim().slice(0, MAXIMO_NOME);
    if (!nome) return null;
    const itensBrutos = s.itens ?? [];
    if (!Array.isArray(itensBrutos) || itensBrutos.length > MAXIMO_ITENS) return null;
    const itens = [];
    for (const chave of itensBrutos) {
      if (typeof chave !== "string" || !CHAVE_VALIDA.test(chave)) return null;
      if (!itens.includes(chave)) itens.push(chave);
    }
    ids.add(s.id);
    secoes.push({ id: s.id, nome, itens });
  }
  /* Seção ativa que não existe (apagada noutra aba) volta para a barra inteira,
     em vez de recusar a gravação inteira. */
  const ativa = typeof bruto.ativa === "string" && ids.has(bruto.ativa) ? bruto.ativa : null;
  return { secoes, ativa };
}

/** O que está gravado, para a sessão. Tolerante: um JSON estragado vira `null`
 *  ("nunca personalizou") e a tela mostra a barra inteira. */
export function barraGravada(bruto) {
  if (bruto === null || bruto === undefined) return null;
  const barra = normalizarBarra(bruto);
  return barra && barra.secoes.length ? barra : null;
}
