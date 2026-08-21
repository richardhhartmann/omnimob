/* ────────────────────────────────────────────────────────────────────────────
   Os portais, do lado da tela.

   Espelho de `apps/api/src/services/portais.js` — a mesma lista, os mesmos ids,
   os mesmos nomes. Duas listas divergiriam no primeiro portal novo, e o sintoma
   seria uma caixa que a tela oferece e o servidor descarta em silêncio.

   Fica em `utils/` e não em `components/` porque quem lê isto não é só o
   formulário do imóvel: a central de canais, o modal de exclusão e a tela de
   automação leem os mesmos nomes.

   ── POR QUE ELES SE SEPARARAM ──

   ZAP, VivaReal e OLX são do mesmo grupo e leem o mesmo formato, então o
   produto os tratava como um interruptor só. Tecnicamente cabia; comercialmente
   não — a imobiliária tem contrato com um e não com outro, ou o proprietário
   não autorizou um portal específico. Ver o cabeçalho do arquivo da API para a
   exceção importante (o endereço antigo do feed).
   ──────────────────────────────────────────────────────────────────────────── */

export const PORTAIS = [
  { id: "ZAP",      nome: "ZAP Imóveis", caminho: "zap",      cor: "#ff6600" },
  { id: "VIVAREAL", nome: "VivaReal",    caminho: "vivareal", cor: "#0f9d58" },
  { id: "OLX",      nome: "OLX Imóveis", caminho: "olx",      cor: "#6e0ad6" },
];

export const IDS_PORTAIS = PORTAIS.map((p) => p.id);

/**
 * Os portais de um imóvel, tolerando o acervo anterior à separação.
 *
 * Lista vazia com o mestre ligado significa TODOS — é como o imóvel se
 * comportava antes de a escolha existir. Ler isso como "nenhum" faria a tela
 * mostrar tudo desmarcado num acervo que está publicado.
 */
export function portaisDoImovel(imovel) {
  if (!imovel?.publicarPortais) return [];
  const lista = Array.isArray(imovel.portais)
    ? IDS_PORTAIS.filter((id) => imovel.portais.includes(id))
    : [];
  return lista.length ? lista : IDS_PORTAIS;
}

/** `["ZAP","OLX"]` → `"ZAP Imóveis e OLX Imóveis"`. */
export function nomesDosPortais(ids = []) {
  const nomes = PORTAIS.filter((p) => ids.includes(p.id)).map((p) => p.nome);
  if (nomes.length <= 1) return nomes[0] || "";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

/** O endereço que a imobiliária cadastra no painel daquele portal. */
export function enderecoDoFeed(baseApi, slug, caminho) {
  const base = String(baseApi || "").replace(/\/+$/, "");
  return `${base}/public/${slug}/feed/${caminho}.xml`;
}
