/* ────────────────────────────────────────────────────────────────────────────
   Os portais, um a um.

   ── POR QUE ELES DEIXARAM DE SER UMA COISA SÓ ──

   ZAP, VivaReal e OLX Imóveis são do mesmo grupo e leem o MESMO formato
   (VRSync). Por isso o produto tratava os três como um interruptor:
   `publicarPortais`, ligado ou desligado.

   Tecnicamente cabia. Comercialmente não: a imobiliária tem contrato com um e
   não com outro, ou saiu de um deles, ou não quer o imóvel de um proprietário
   específico num portal que ele não aprovou. Marcar "portais" e ver o imóvel
   sair nos três é uma decisão que o sistema tomava pela imobiliária.

   ── COMO A SEPARAÇÃO FUNCIONA DE VERDADE ──

   Portal não recebe empurrão: ele VEM BUSCAR um endereço que a imobiliária
   cadastrou no painel dele. Então separar não é uma opção no XML — é um
   endereço por portal:

     /public/<slug>/feed/zap.xml
     /public/<slug>/feed/vivareal.xml
     /public/<slug>/feed/olx.xml

   Cada um leva só os imóveis marcados para aquele portal. O conteúdo continua
   sendo VRSync nos três; o que muda é a LISTA.

   ── A EXCEÇÃO QUE PRECISA ESTAR ESCRITA ──

   Quem manda no que cada portal lê é o endereço cadastrado LÁ, não nós. O
   endereço antigo (`/feed.xml`) continua existindo porque imobiliárias já o
   cadastraram nos três painéis, e trocá-lo por baixo derrubaria a carga delas.
   Ele leva TUDO que tem portal marcado, sem distinguir.

   Ou seja: a separação por portal só vale depois que a imobiliária trocar o
   endereço em cada painel. A tela precisa dizer isso — separação que depende de
   uma ação externa e não avisa é pior que separação nenhuma.
   ──────────────────────────────────────────────────────────────────────────── */

export const PORTAIS = [
  { id: "ZAP",      nome: "ZAP Imóveis", caminho: "zap",      cor: "#ff6600" },
  { id: "VIVAREAL", nome: "VivaReal",    caminho: "vivareal", cor: "#0f9d58" },
  { id: "OLX",      nome: "OLX Imóveis", caminho: "olx",      cor: "#6e0ad6" },
];

export const IDS_PORTAIS = PORTAIS.map((p) => p.id);

/** O portal pelo pedaço da URL (`zap`, `vivareal`, `olx`). */
export function portalPorCaminho(caminho) {
  const alvo = String(caminho || "").toLowerCase();
  return PORTAIS.find((p) => p.caminho === alvo) || null;
}

/**
 * A lista de portais que vale gravar, vinda de qualquer coisa que o cliente
 * mande. Descarta o que não conhecemos em vez de recusar o pedido inteiro: um
 * portal a mais no corpo não é motivo para o cadastro do imóvel falhar.
 */
export function normalizarPortais(valor) {
  if (!Array.isArray(valor)) return null;
  const vistos = new Set();
  for (const item of valor) {
    const id = String(item || "").toUpperCase();
    if (IDS_PORTAIS.includes(id)) vistos.add(id);
  }
  return IDS_PORTAIS.filter((id) => vistos.has(id));
}

/**
 * Os portais de um imóvel, tolerando o mundo anterior a esta separação.
 *
 * Registro antigo tem `portais` vazio e só o booleano — e ali "ligado" queria
 * dizer os três, que é como ele se comportava. Tratar vazio como "nenhum"
 * tiraria do ar, em silêncio, todo o acervo já publicado.
 */
export function portaisDoImovel(imovel) {
  if (!imovel?.publicarPortais) return [];
  const lista = normalizarPortais(imovel.portais);
  return lista && lista.length ? lista : IDS_PORTAIS;
}

/** Os nomes, para uma frase. `["ZAP","OLX"]` → `"ZAP Imóveis e OLX Imóveis"`. */
export function nomesDosPortais(ids = []) {
  const nomes = PORTAIS.filter((p) => ids.includes(p.id)).map((p) => p.nome);
  if (nomes.length <= 1) return nomes[0] || "";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}
