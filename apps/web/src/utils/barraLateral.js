/* ────────────────────────────────────────────────────────────────────────────
   A BARRA LATERAL PERSONALIZADA — as seções de cada pessoa (31/10/2026). Porte
   do VYA (`lib/barraLateral.ts`), no molde das seções da barra do Notion.

   ── A IDEIA ──

   A pessoa cria SEÇÕES ("Favoritos", "Fechamento do mês") e escolhe, entre as
   telas que o cargo dela já alcança, quais entram em cada uma. Um seletor no
   topo da barra alterna entre a barra INTEIRA e uma seção; na seção, a barra
   mostra só o que foi escolhido, com os grupos e os pais de sempre
   ("Relatórios" com só "Relatório mensal" dentro). É da PESSOA, não da
   imobiliária.

   ── O QUE SE ESCOLHE SÃO FOLHAS ──

   A seção guarda as chaves das telas de verdade: os subitens, e os itens que
   não têm subitem (Portfólio Ativo, Clientes). O pai não é escolhido — ele
   aparece sozinho quando algum filho entra, porque é ele que dá o contexto.
   Marcar o pai no editor marca os filhos dele que existem hoje.

   Diferença em relação ao VYA: aqui o pai também é um destino (Gerenciar
   Imóveis abre a lista; Relatórios abre o índice). Por isso o pai entra como
   FOLHA também — marcar só "Gerenciar Imóveis" é escolher a tela dele.

   ── OS DOIS MÓDULOS ──

   A mesma seção vale no Omnimob e no Omniflow: as chaves dos dois não se
   repetem (as do Flow começam por `flow-`), com uma exceção desejada —
   Configurações é o MESMO item nos dois, e marcá-lo num marca no outro. Cada
   módulo mostra só o que tem dele na seção.

   ── PERMISSÃO NÃO MORA AQUI ──

   O filtro roda sobre os grupos que `navegacaoDoPainel.jsx` já devolveu
   filtrados pelo cargo e pelo plano. Uma chave gravada que o cargo deixou de
   alcançar simplesmente não acha nada — a seção nunca reabre o que o cargo
   fechou.

   ── ONDE FICA ──

   `Usuario.barraLateral` no servidor (`PUT /api/auth/minha-barra`, validado em
   `apps/api/src/services/barraLateral.js`), de volta na sessão como
   `usuario.barraLateral`: vale em qualquer máquina, e a seção escolhida
   continua escolhida depois de trocar de tela ou de entrar de novo.

   ── ESTE ARQUIVO É DADO PURO ──

   Sem React: `apps/web/test/barraLateral.test.js` o carrega direto no Node.
   ──────────────────────────────────────────────────────────────────────────── */

/* Os mesmos tetos do servidor. */
export const MAXIMO_SECOES = 12;
export const MAXIMO_NOME = 40;

export const BARRA_VAZIA = Object.freeze({ secoes: [], ativa: null });

/** O que veio da sessão, sempre numa forma usável. */
export function barraDe(bruto) {
  if (!bruto || typeof bruto !== "object") return BARRA_VAZIA;
  const secoes = Array.isArray(bruto.secoes)
    ? bruto.secoes.filter((s) => s && typeof s.id === "string" && typeof s.nome === "string" && Array.isArray(s.itens))
    : [];
  const ativa = typeof bruto.ativa === "string" && secoes.some((s) => s.id === bruto.ativa) ? bruto.ativa : null;
  return { secoes, ativa };
}

export function secaoAtiva(barra) {
  return barra.secoes.find((s) => s.id === barra.ativa) ?? null;
}

/** As folhas de um item: ele mesmo (é um destino) e os subitens dele. */
export function folhasDe(item) {
  return [item.key, ...(item.subitens || []).map((s) => s.key)];
}

/**
 * Os grupos que a barra desenha com a seção ligada: só o que foi escolhido,
 * com o pai em volta dos subitens escolhidos. Item sem nada escolhido sai;
 * grupo vazio sai. A ordem é a da barra inteira — a seção escolhe, não
 * reordena.
 */
export function filtrarPorSecao(grupos, secao) {
  if (!secao) return grupos;
  const escolhidas = new Set(secao.itens);
  const saida = [];
  for (const grupo of grupos) {
    const itens = [];
    for (const item of grupo.itens) {
      const subitens = (item.subitens || []).filter((s) => escolhidas.has(s.key));
      if (subitens.length) itens.push({ ...item, subitens });
      else if (escolhidas.has(item.key)) itens.push(item.subitens?.length ? { ...item, subitens: [] } : item);
    }
    if (itens.length) saida.push({ ...grupo, itens });
  }
  return saida;
}

/** Marca ou desmarca chaves numa seção (o pai no editor marca todas as dele). */
export function marcar(barra, secaoId, chaves, marcado) {
  return {
    ...barra,
    secoes: barra.secoes.map((s) => {
      if (s.id !== secaoId) return s;
      const conjunto = new Set(s.itens);
      for (const c of chaves) { if (marcado) conjunto.add(c); else conjunto.delete(c); }
      return { ...s, itens: [...conjunto] };
    }),
  };
}

/** O nome como o servidor vai gravar: espaços colapsados e cortado no teto. */
export function nomeLimpo(nome) {
  return String(nome || "").replace(/\s+/g, " ").trim().slice(0, MAXIMO_NOME);
}

/** Um id que ainda não existe nesta barra (minúsculas, dígitos e hífen). */
export function novoId(barra, sorteio = Math.random) {
  const usados = new Set(barra.secoes.map((s) => s.id));
  for (;;) {
    const id = `s-${Math.floor(sorteio() * 36 ** 6).toString(36)}`;
    if (!usados.has(id)) return id;
  }
}

/** Uma seção nova, com um nome que não repete ("Nova seção 2"). `null` no teto. */
export function adicionarSecao(barra, nomeBase = "Nova seção", sorteio) {
  if (barra.secoes.length >= MAXIMO_SECOES) return null;
  const nomes = new Set(barra.secoes.map((s) => s.nome.toLowerCase()));
  let nome = nomeBase;
  for (let n = 2; nomes.has(nome.toLowerCase()); n++) nome = `${nomeBase} ${n}`;
  const id = novoId(barra, sorteio);
  return { barra: { ...barra, secoes: [...barra.secoes, { id, nome, itens: [] }] }, id };
}

export function renomearSecao(barra, id, nome) {
  const limpo = nomeLimpo(nome);
  if (!limpo) return barra;
  return { ...barra, secoes: barra.secoes.map((s) => (s.id === id ? { ...s, nome: limpo } : s)) };
}

/** Apagar a seção ativa devolve a pessoa à barra inteira. */
export function removerSecao(barra, id) {
  return { secoes: barra.secoes.filter((s) => s.id !== id), ativa: barra.ativa === id ? null : barra.ativa };
}

/** Sobe ou desce uma seção na lista (a ordem do seletor). */
export function moverSecao(barra, id, passo) {
  const i = barra.secoes.findIndex((s) => s.id === id);
  const j = i + passo;
  if (i < 0 || j < 0 || j >= barra.secoes.length) return barra;
  const secoes = [...barra.secoes];
  [secoes[i], secoes[j]] = [secoes[j], secoes[i]];
  return { ...barra, secoes };
}

/** Quantas telas da seção existem nestes grupos (o contador do editor). */
export function contarNaSecao(grupos, secao) {
  if (!secao) return 0;
  const escolhidas = new Set(secao.itens);
  const vistas = new Set();
  for (const g of grupos) for (const item of g.itens) for (const k of folhasDe(item)) if (escolhidas.has(k)) vistas.add(k);
  return vistas.size;
}
