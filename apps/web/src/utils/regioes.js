/* ────────────────────────────────────────────────────────────────────────────
   Páginas de região — "imóveis em <bairro>, <cidade>" — e as variações por
   tipo ("apartamentos em <bairro>").

   É a resposta a "apartamento 2 quartos no Jardins" na busca: uma página por
   bairro (e por bairro × tipo) com endereço próprio, título próprio e a lista
   de imóveis de lá. A vitrine já filtrava a grade por bairro, mas um filtro em
   memória não tem URL, não vai para o sitemap e o Google não indexa — e o
   objetivo destas páginas é justamente tirar lead do portal pago.

   Espelho de `apps/api/src/services/paginasDeRegiao.js`: a MESMA regra existe
   dos dois lados de propósito, como `slug.js`. Aqui ela monta os links e
   resolve a rota; lá ela alimenta o sitemap. Se divergirem, o sitemap anuncia
   um endereço que a página não reconhece — qualquer mexida aqui pede a mesma
   lá, e o teste de cada lado cobra os mesmos casos.

   ── A REGIÃO É O BAIRRO, OU A CIDADE ──
   A mesma regra de `dadosDaVitrine.js`: sem bairro, a região é a cidade. O
   slug leva os dois ("jardins-sao-paulo") porque "Centro" existe em toda
   cidade, e uma imobiliária que atende duas precisa de duas páginas.
   ──────────────────────────────────────────────────────────────────────────── */

export function slugDeTexto(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** A região de um imóvel: `{ nome, cidade, slug }`, ou null sem endereço. */
export function regiaoDoImovel(p) {
  const cidade = String(p?.city || "").trim();
  const bairro = String(p?.neighborhood || "").trim();
  const nome = bairro || cidade;
  if (!nome) return null;
  const slug = slugDeTexto(bairro && cidade && bairro !== cidade ? `${bairro} ${cidade}` : nome);
  return slug ? { nome, cidade, slug } : null;
}

/** Slug do tipo de imóvel ("Apartamento" → "apartamento"). */
export function slugDeTipo(propertyType) {
  return slugDeTexto(propertyType);
}

/** Plural simples para o título: "Apartamento" → "Apartamentos". */
export function pluralDoTipo(tipo) {
  const t = String(tipo || "").trim();
  if (!t) return "Imóveis";
  if (/[sS]$/.test(t)) return t;
  if (/ão$/i.test(t)) return t.replace(/ão$/i, "ões");
  if (/[rlz]$/i.test(t)) return `${t}es`;
  return `${t}s`;
}

/**
 * As páginas que existem para este acervo: uma por região com ≥1 imóvel, cada
 * uma com os tipos que aparecem nela. Ordenadas por volume, como a lista de
 * regiões da vitrine — a página com um imóvel só não deve abrir a fila.
 */
export function paginasDeRegiao(properties) {
  const mapa = new Map();
  for (const p of properties || []) {
    const r = regiaoDoImovel(p);
    if (!r) continue;
    const atual = mapa.get(r.slug) || { ...r, total: 0, tipos: new Map() };
    atual.total += 1;
    const tipo = String(p.propertyType || "").trim();
    const ts = slugDeTipo(tipo);
    if (ts) {
      const t = atual.tipos.get(ts) || { slug: ts, nome: tipo, total: 0 };
      t.total += 1;
      atual.tipos.set(ts, t);
    }
    mapa.set(r.slug, atual);
  }
  return [...mapa.values()]
    .map((r) => ({ ...r, tipos: [...r.tipos.values()].sort((a, b) => b.total - a.total) }))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Os imóveis de uma página, pelo slug da região e, opcionalmente, do tipo. */
export function filtrarPorRegiao(properties, regiaoSlug, tipoSlug) {
  return (properties || []).filter((p) => {
    const r = regiaoDoImovel(p);
    if (!r || r.slug !== regiaoSlug) return false;
    return !tipoSlug || slugDeTipo(p.propertyType) === tipoSlug;
  });
}

/** O caminho da página, nos dois hosts (Omnimob ou domínio próprio). */
export function caminhoDaRegiao({ tenantSlug, slugFixo, regiao, tipo }) {
  const base = slugFixo ? "" : `/vitrine/${tenantSlug}`;
  return `${base}/imoveis/${regiao}${tipo ? `/${tipo}` : ""}`;
}

/** Título e descrição da página — o que aparece na busca. */
export function textosDaRegiao({ regiao, tipo, total, imobiliaria }) {
  const oQue = tipo ? pluralDoTipo(tipo.nome) : "Imóveis";
  const onde = regiao.cidade && regiao.cidade !== regiao.nome ? `${regiao.nome}, ${regiao.cidade}` : regiao.nome;
  const titulo = `${oQue} em ${onde}${imobiliaria ? ` — ${imobiliaria}` : ""}`;
  const n = total === 1 ? "1 imóvel disponível" : `${total} imóveis disponíveis`;
  const descricao = `${oQue} à venda e para locação em ${onde}: ${n}, com fotos, preços e contato direto${imobiliaria ? ` com a ${imobiliaria}` : ""}.`;
  return { titulo, descricao, h1: `${oQue} em ${onde}`, onde };
}
