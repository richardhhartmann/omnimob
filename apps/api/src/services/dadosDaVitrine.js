import { prisma } from "../db.js";

/* ────────────────────────────────────────────────────────────────────────────
   O que a vitrine sabe sobre a imobiliária de verdade.

   Antes deste arquivo, cada widget carregava o próprio conteúdo digitado à mão
   e mais nada. O bloco "Nossos Números" dizia `200+ imóveis vendidos · 15 anos
   de experiência` — a mesma frase, para toda imobiliária que arrastasse a peça,
   inclusive a que abriu ontem com quatro imóveis. A equipe eram três pessoas
   inventadas no código. As regiões eram Moema e Pinheiros para uma imobiliária
   de Curitiba.

   Nada disso é defeito de texto. É que não havia de onde tirar o dado certo: a
   vitrine pública recebia o tenant e a lista de imóveis, e nada mais. Este
   serviço é essa fonte.

   ── Três regras que este arquivo segue ────────────────────────────────────

   1. SÓ O QUE JÁ É PÚBLICO. Tudo aqui sai numa página sem autenticação. Imóvel
      só entra se estiver ACTIVE; pessoa só entra se tiver marcado
      `exibirNaVitrine`. Nenhum e-mail de usuário, nenhum valor de venda
      individual, nenhum token de rede social.

   2. NÚMERO QUE NÃO EXISTE NÃO É ZERO, É AUSÊNCIA. Uma imobiliária sem vendas
      registradas não deve anunciar "0 imóveis vendidos" — deve não mostrar
      aquele número. Quem chama recebe `null` e decide; ver `numerosDaVitrine`.

   3. UMA CONSULTA POR PERGUNTA, EM PARALELO. A vitrine pública é a página mais
      quente do produto: consultas em série custariam uma viagem ao banco atrás
      da outra em cada visita.
   ──────────────────────────────────────────────────────────────────────────── */

/* Quanto tempo o resultado vale. A vitrine é lida muito mais do que a
   imobiliária muda de acervo — e as agregações abaixo varrem imóveis, vendas e
   usuários. Sessenta segundos deixam a página barata sem que "publiquei um
   imóvel e ele não apareceu" vire suporte: o visitante seguinte já vê. */
const VALIDADE_MS = 60_000;
const cache = new Map(); // tenantId → { em, dados }

export function limparCacheDaVitrine(tenantId) {
  if (tenantId) cache.delete(tenantId);
  else cache.clear();
}

/* ── Endereço ────────────────────────────────────────────────────────────────
   O mapa é um embed do Google, e o embed aceita o endereço como TEXTO — não
   precisamos de latitude e longitude, nem de chave de API, nem de uma coluna de
   coordenadas que ficaria desatualizada em silêncio quando a imobiliária
   mudasse de sala.

   A linha completa é montada uma vez, aqui, porque o pino do mapa, o texto do
   cartão e o link "como chegar" precisam dela idêntica. */
function enderecoDoTenant(tenant) {
  const partes = [
    String(tenant.endereco || "").trim(),
    String(tenant.cidade || "").trim(),
    String(tenant.estado || "").trim(),
  ].filter(Boolean);
  if (!partes.length) return null;

  const cep = String(tenant.cep || "").replace(/\D/g, "");
  return {
    logradouro: String(tenant.endereco || "").trim(),
    cidade: String(tenant.cidade || "").trim(),
    estado: String(tenant.estado || "").trim(),
    cep: cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : "",
    /* O que vai para a busca do mapa e para a linha do cartão. O CEP entra no
       fim porque é ele que desempata rua de mesmo nome em cidade grande, e é
       assim que o Google resolve o endereço. */
    completo: [partes.join(", "), cep].filter(Boolean).join(" — "),
  };
}

/* ── Horário de atendimento ──────────────────────────────────────────────────
   Guardado como lista de faixas no Tenant. Aqui só peneiramos: faixa sem dia
   descrito não tem o que mostrar, e faixa sem horário só faz sentido quando é
   um "fechado" explícito — que é como se diz "domingo não abrimos". */
function horariosDoTenant(tenant) {
  const bruto = tenant.horarioAtendimento;
  if (!Array.isArray(bruto)) return [];
  return bruto
    .map((faixa) => ({
      dias: String(faixa?.dias || "").trim(),
      abre: String(faixa?.abre || "").trim(),
      fecha: String(faixa?.fecha || "").trim(),
      fechado: Boolean(faixa?.fechado),
    }))
    .filter((faixa) => faixa.dias && (faixa.fechado || (faixa.abre && faixa.fecha)))
    .slice(0, 8);
}

/* ── Equipe ──────────────────────────────────────────────────────────────────
   Quem a imobiliária decidiu mostrar, e nada além. O `select` é explícito e
   curto de propósito: um `include` traria senha e e-mail para dentro de um
   payload público, e a distância entre "trouxe" e "vazou" é uma linha de JSON. */
async function equipeDaVitrine(tenantId) {
  const pessoas = await prisma.usuario.findMany({
    where: { tenantId, ativo: true, exibirNaVitrine: true },
    orderBy: { nome: "asc" },
    take: 12,
    select: {
      id: true,
      nome: true,
      foto: true,
      creci: true,
      whatsapp: true,
      cargoVitrine: true,
      cargo: { select: { descricao: true } },
    },
  });

  return pessoas.map((p) => ({
    id: p.id,
    nome: p.nome,
    /* O rótulo público, com uma escolha e um fallback. `cargoVitrine` existe
       porque o cargo do PAINEL é uma peça de permissão ("Administrador"), e
       apresentar alguém ao cliente como "Administrador" não diz nada sobre o
       que essa pessoa faz por ele. Sem preenchimento, cai no cargo mesmo — é
       melhor que um espaço em branco embaixo do nome. */
    cargo: String(p.cargoVitrine || "").trim() || p.cargo?.descricao || "Corretor",
    creci: String(p.creci || "").trim(),
    whatsapp: String(p.whatsapp || "").replace(/\D/g, ""),
    foto: String(p.foto || "").trim(),
  }));
}

/* ── Números ─────────────────────────────────────────────────────────────────
   Cada um devolve `null` quando não há o que contar, e é o widget que decide
   não desenhar o cartão. É a regra 2 lá de cima, e ela importa mais aqui do que
   em qualquer outro lugar do arquivo: "0 imóveis vendidos" numa página que
   existe para vender é pior do que não falar de vendas. */
async function numerosDaVitrine(tenant) {
  const [imoveisAtivos, vendas, cidades] = await Promise.all([
    prisma.property.count({ where: { tenantId: tenant.id, status: "ACTIVE" } }),
    prisma.venda.count({ where: { tenantId: tenant.id } }),
    prisma.property.findMany({
      where: { tenantId: tenant.id, status: "ACTIVE", city: { not: "" } },
      distinct: ["city"],
      select: { city: true },
    }),
  ]);

  /* Anos de mercado saem de `fundadaEm`, que a imobiliária preenche — e NÃO de
     `createdAt`, que é quando ela assinou a Omnimob. A tentação de usar a data
     da conta é grande porque ela sempre existe; o resultado seria uma
     imobiliária de trinta anos anunciando "1 ano de experiência" na própria
     vitrine. Sem o ano de fundação, este número não existe, e o cartão some. */
  const anoAtual = new Date().getFullYear();
  const fundacao = Number(tenant.fundadaEm);
  const anos =
    Number.isInteger(fundacao) && fundacao >= 1900 && fundacao <= anoAtual
      ? anoAtual - fundacao
      : null;

  return {
    imoveisAtivos: imoveisAtivos || null,
    vendas: vendas || null,
    cidadesAtendidas: cidades.length || null,
    // Fundada este ano: `0` é verdade, mas "0 anos de mercado" não é um
    // argumento de venda. A partir de um ano completo.
    anosDeMercado: anos && anos >= 1 ? anos : null,
  };
}

/* ── Regiões e filtros ───────────────────────────────────────────────────────
   Uma varredura só serve às duas perguntas. São os mesmos imóveis, e consultas
   separadas fariam o banco ler a mesma tabela duas vezes para montar duas
   listas da mesma coluna.

   Regiões saem ORDENADAS POR VOLUME, não em ordem alfabética: a lista existe
   para dizer "é aqui que temos imóvel", e o bairro com um imóvel só não deve
   abrir a fila. */
async function acervoDaVitrine(tenantId) {
  const imoveis = await prisma.property.findMany({
    where: { tenantId, status: "ACTIVE" },
    select: {
      city: true,
      neighborhood: true,
      price: true,
      tipoContrato: true,
      tipoImovel: { select: { descricao: true } },
    },
  });

  const porRegiao = new Map(); // "Bairro|Cidade" → total
  const tipos = new Set();
  const cidades = new Set();
  const contratos = new Set();
  let precoMin = null;
  let precoMax = null;

  for (const imovel of imoveis) {
    const cidade = String(imovel.city || "").trim();
    const bairro = String(imovel.neighborhood || "").trim();
    /* A região é o BAIRRO quando existe, senão a cidade. Misturar os dois numa
       lista só é intencional: para quem procura, "Centro" e "Campinas" são a
       mesma pergunta — onde? — e separar em duas listas obrigaria a escolher
       duas vezes para chegar no mesmo lugar. */
    const nome = bairro || cidade;
    if (nome) {
      const chave = `${nome}|${cidade}`;
      porRegiao.set(chave, (porRegiao.get(chave) || 0) + 1);
    }
    if (cidade) cidades.add(cidade);
    if (imovel.tipoImovel?.descricao) tipos.add(imovel.tipoImovel.descricao);
    if (imovel.tipoContrato) contratos.add(imovel.tipoContrato);

    const preco = Number(imovel.price);
    if (Number.isFinite(preco) && preco > 0) {
      precoMin = precoMin === null ? preco : Math.min(precoMin, preco);
      precoMax = precoMax === null ? preco : Math.max(precoMax, preco);
    }
  }

  const regioes = [...porRegiao.entries()]
    .map(([chave, total]) => {
      const [nome, cidade] = chave.split("|");
      return { nome, cidade, total };
    })
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"))
    .slice(0, 16);

  return {
    regioes,
    filtros: {
      tipos: [...tipos].sort((a, b) => a.localeCompare(b, "pt-BR")),
      cidades: [...cidades].sort((a, b) => a.localeCompare(b, "pt-BR")),
      /* Bairros com a cidade junto: dois "Centro" em cidades diferentes são
         lugares diferentes, e uma lista que os funde manda o visitante para o
         imóvel errado. */
      bairros: regioes
        .filter((r) => r.nome !== r.cidade)
        .map((r) => ({ nome: r.nome, cidade: r.cidade })),
      contratos: [...contratos],
      precoMin,
      precoMax,
    },
  };
}

/* ── Redes ───────────────────────────────────────────────────────────────────
   O WhatsApp é o do cadastro; a página do Facebook vem da conexão OAuth que a
   imobiliária já fez em Configurações › Redes Sociais. Nunca o TOKEN — só o
   identificador público da página, que é o que monta o endereço.

   Instagram fica de fora mesmo estando conectado: a Graph API nos dá o id da
   conta business, e `instagram.com/<id>` não é um endereço que abre. O @ da
   conta não é guardado em lugar nenhum, então não há link honesto a montar —
   e um link quebrado na vitrine é pior que a ausência do ícone. */
function redesDoTenant(tenant) {
  const whatsapp = String(tenant.whatsapp || "").replace(/\D/g, "");
  return {
    whatsapp: whatsapp ? `https://wa.me/${whatsapp}` : "",
    facebook: tenant.facebookPageId ? `https://facebook.com/${tenant.facebookPageId}` : "",
    facebookNome: tenant.facebookPageName || "",
    instagram: "",
  };
}

/**
 * O bloco de dados reais da vitrine de um tenant.
 * @param {object} tenant registro completo do tenant (já carregado pela rota)
 * @returns {Promise<object|null>}
 */
export async function dadosDaVitrine(tenant) {
  if (!tenant?.id) return null;

  const emCache = cache.get(tenant.id);
  if (emCache && Date.now() - emCache.em < VALIDADE_MS) return emCache.dados;

  const [equipe, numeros, acervo] = await Promise.all([
    equipeDaVitrine(tenant.id),
    numerosDaVitrine(tenant),
    acervoDaVitrine(tenant.id),
  ]);

  const dados = {
    endereco: enderecoDoTenant(tenant),
    contato: {
      whatsapp: String(tenant.whatsapp || ""),
      telefone: String(tenant.telefone || ""),
      email: String(tenant.email || ""),
      creci: String(tenant.creci || ""),
    },
    horarios: horariosDoTenant(tenant),
    equipe,
    numeros,
    regioes: acervo.regioes,
    filtros: acervo.filtros,
    redes: redesDoTenant(tenant),
  };

  cache.set(tenant.id, { em: Date.now(), dados });
  return dados;
}
