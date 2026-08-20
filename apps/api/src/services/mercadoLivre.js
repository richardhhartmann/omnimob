import { prisma } from "../db.js";
import { cifrar, decifrar } from "./cofre.js";

/* ────────────────────────────────────────────────────────────────────────────
   Mercado Livre — o primeiro portal EMPURRADO.

   ── POR QUE ELE É DIFERENTE DE TODOS OS OUTROS ──

   ZAP, VivaReal e OLX Imóveis trabalham por carga agendada: publicamos um XML
   e o robô deles vem buscar. Não guardamos credencial, não tratamos erro de
   rede, e um portal fora do ar hoje lê amanhã.

   O Mercado Livre é o oposto. Cada anúncio é criado, atualizado e encerrado por
   chamada nossa, EM NOME DO VENDEDOR — o que exige token por imobiliária,
   renovação, e tratar cada falha individualmente. É por isso que este arquivo
   existe e o dos portais é um gerador de XML.

   ── O PRÉ-REQUISITO QUE NÃO É TÉCNICO ──

   Publicar imóvel no Mercado Livre exige um PACOTE DE ANÚNCIOS contratado pelo
   vendedor com o time comercial deles. Sem o pacote, o OAuth funciona, o token
   é válido, e a criação do anúncio é recusada.

   Isso não é um detalhe de implementação: é a diferença entre "conectei e não
   funciona" e "conectei, falta contratar o pacote". A tela avisa antes, e o
   erro daqui repete o motivo — porque o suporte que a imobiliária vai acionar é
   o nosso, não o deles.

   ── ESTADO DESTA INTEGRAÇÃO ──

   Escrita contra a documentação pública, NÃO verificada contra a API real:
   testar exige uma aplicação registrada no Mercado Livre, uma conta de vendedor
   e um pacote contratado — três coisas que não se simulam. Os pontos onde a
   documentação deixa margem estão marcados com `REVISAR` abaixo.
   ──────────────────────────────────────────────────────────────────────────── */

const BASE = "https://api.mercadolibre.com";
const AUTORIZACAO = "https://auth.mercadolivre.com.br/authorization";

const APP_ID = process.env.MERCADOLIVRE_APP_ID || "";
const APP_SECRET = process.env.MERCADOLIVRE_APP_SECRET || "";
const CALLBACK = process.env.MERCADOLIVRE_CALLBACK_URL || "";

export const mercadoLivreConfigurado = Boolean(APP_ID && APP_SECRET && CALLBACK);

export class ErroMercadoLivre extends Error {
  constructor(mensagem, { codigo = null, status = null } = {}) {
    super(mensagem);
    this.codigo = codigo;
    this.status = status;
  }
}

/* O endereço para onde mandamos a imobiliária autorizar. O `state` carrega o
   tenant: o callback chega sem sessão nossa, e sem ele não haveria como saber
   de quem é o token que acabou de voltar. */
export function urlDeAutorizacao(tenantId) {
  const p = new URLSearchParams({
    response_type: "code",
    client_id: APP_ID,
    redirect_uri: CALLBACK,
    state: tenantId,
  });
  return `${AUTORIZACAO}?${p}`;
}

async function pedirToken(corpo) {
  const resposta = await fetch(`${BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(corpo),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new ErroMercadoLivre(
      dados.message || dados.error_description || "O Mercado Livre recusou a autenticação.",
      { codigo: dados.error, status: resposta.status },
    );
  }
  return dados;
}

/** Troca o código do callback pelo par de tokens e guarda cifrado. */
export async function concluirConexao(tenantId, code) {
  const dados = await pedirToken({
    grant_type: "authorization_code",
    client_id: APP_ID,
    client_secret: APP_SECRET,
    code,
    redirect_uri: CALLBACK,
  });

  /* `user_id` vem no corpo do token e é o vendedor. Guardamos porque toda
     consulta de anúncio é por vendedor, e pedi-lo de novo a cada chamada seria
     uma viagem à API para saber algo que já soubemos uma vez. */
  const tenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      mercadoLivreUserId: String(dados.user_id || ""),
      mercadoLivreToken: cifrar(dados.access_token),
      mercadoLivreRefresh: cifrar(dados.refresh_token),
      mercadoLivreExpiraEm: new Date(Date.now() + (Number(dados.expires_in) || 21600) * 1000),
    },
  });

  // O apelido do vendedor é só para a tela mostrar "conectado como fulano".
  try {
    const eu = await chamar(tenant, "/users/me");
    await prisma.tenant.update({ where: { id: tenantId }, data: { mercadoLivreNick: eu.nickname || null } });
    return { nick: eu.nickname || null };
  } catch {
    return { nick: null };
  }
}

export async function desconectar(tenantId) {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      mercadoLivreUserId: null, mercadoLivreToken: null, mercadoLivreRefresh: null,
      mercadoLivreExpiraEm: null, mercadoLivreNick: null,
    },
  });
}

/* Renova ANTES de expirar, não depois.

   O token vale seis horas. Esperar o 401 para renovar transformaria uma em cada
   tantas publicações numa falha visível — e pior, numa falha intermitente, do
   tipo que a imobiliária reporta como "às vezes não funciona". A margem de dois
   minutos cobre a requisição em voo. */
const MARGEM_MS = 2 * 60 * 1000;

async function tokenValido(tenant) {
  if (!tenant.mercadoLivreToken) {
    throw new ErroMercadoLivre("Esta imobiliária não conectou o Mercado Livre.", { codigo: "SEM_CONEXAO" });
  }
  const expira = tenant.mercadoLivreExpiraEm ? new Date(tenant.mercadoLivreExpiraEm).getTime() : 0;
  if (expira - MARGEM_MS > Date.now()) return decifrar(tenant.mercadoLivreToken);

  const dados = await pedirToken({
    grant_type: "refresh_token",
    client_id: APP_ID,
    client_secret: APP_SECRET,
    refresh_token: decifrar(tenant.mercadoLivreRefresh),
  });
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      mercadoLivreToken: cifrar(dados.access_token),
      /* O refresh também é rotacionado a cada renovação. Guardar só o novo
         access_token deixaria o refresh velho no banco, e a renovação seguinte
         falharia — seis horas depois, sem ninguém ligando uma coisa à outra. */
      mercadoLivreRefresh: cifrar(dados.refresh_token || decifrar(tenant.mercadoLivreRefresh)),
      mercadoLivreExpiraEm: new Date(Date.now() + (Number(dados.expires_in) || 21600) * 1000),
    },
  });
  return dados.access_token;
}

async function chamar(tenant, caminho, { metodo = "GET", corpo } = {}) {
  const token = await tokenValido(tenant);
  const resposta = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new ErroMercadoLivre(traduzirErro(dados, resposta.status), {
      codigo: dados.error,
      status: resposta.status,
    });
  }
  return dados;
}

/* A mensagem que a imobiliária vai ler.

   O Mercado Livre responde em inglês e em vocabulário de API. "Item can not be
   listed: no available listing quota" é preciso e não diz a quem lê que falta
   contratar um pacote — e é essa a causa mais comum de tudo dar errado depois
   de uma conexão bem-sucedida. */
function traduzirErro(dados, status) {
  const bruto = String(dados?.message || dados?.error || "").toLowerCase();
  if (/quota|listing_type|not allowed to list|package/.test(bruto)) {
    return "O Mercado Livre recusou: esta conta não tem pacote de anúncios de imóveis disponível. Fale com o comercial do Mercado Livre para contratar antes de publicar.";
  }
  if (status === 401 || status === 403) {
    return "O Mercado Livre recusou a credencial. Reconecte a conta em Configurações › Redes Sociais.";
  }
  if (Array.isArray(dados?.cause) && dados.cause.length) {
    return `O Mercado Livre recusou o anúncio: ${dados.cause.map((c) => c.message || c.code).join("; ")}`;
  }
  return dados?.message || `O Mercado Livre respondeu ${status}.`;
}

/* ── Imóvel → anúncio ────────────────────────────────────────────────────────
   REVISAR contra a conta real: `category_id` e `listing_type_id` dependem do
   país e do pacote contratado, e a documentação lista várias combinações. Os
   valores abaixo são os mais comuns em MLB (Brasil); a rota expõe os dois como
   parâmetro justamente porque não dá para cravá-los daqui. */
const CATEGORIA_PADRAO = { VENDA: "MLB1459", LOCACAO: "MLB1466" }; // Imóveis: venda | aluguel

function atributos(imovel) {
  /* `value_name` e não `value_id` de propósito: os ids do catálogo mudam por
     categoria, e um id errado é recusado sem dizer qual atributo era. O nome é
     aceito e o Mercado Livre resolve para o id dele. */
  const lista = [];
  const area = Number(imovel.areaPrivativa) || Number(imovel.squareFootage) || 0;
  if (area > 0) lista.push({ id: "TOTAL_AREA", value_name: `${Math.round(area)} m²` });
  if (imovel.bedrooms > 0) lista.push({ id: "BEDROOMS", value_name: String(imovel.bedrooms) });
  if (imovel.banheiros > 0 || imovel.suites > 0) {
    lista.push({ id: "FULL_BATHROOMS", value_name: String(imovel.banheiros || imovel.suites) });
  }
  if (imovel.parkingSpots > 0) lista.push({ id: "PARKING_LOTS", value_name: String(imovel.parkingSpots) });
  return lista;
}

export function anuncioDoImovel(imovel, { categoria, tipoDeAnuncio }) {
  const fotos = (imovel.images || []).slice(0, 12).map((i) => ({ source: i.url }));
  return {
    title: String(imovel.title || "").slice(0, 60),
    category_id: categoria || CATEGORIA_PADRAO[imovel.tipoContrato === "LOCACAO" ? "LOCACAO" : "VENDA"],
    price: Number(imovel.price) || 0,
    currency_id: "BRL",
    available_quantity: 1,
    buying_mode: "classified",
    listing_type_id: tipoDeAnuncio || "silver",
    condition: "not_specified",
    pictures: fotos,
    attributes: atributos(imovel),
    location: {
      address_line: imovel.address || "",
      zip_code: String(imovel.cep || "").replace(/\D/g, ""),
      neighborhood: { name: imovel.neighborhood || "" },
      city: { name: imovel.city || "" },
      state: { name: imovel.state || "" },
    },
    description: { plain_text: String(imovel.description || "").slice(0, 50000) },
  };
}

/** Cria o anúncio. Devolve o id (`MLB...`) e o link público. */
export async function publicar(tenant, imovel, opcoes = {}) {
  if (!mercadoLivreConfigurado) {
    throw new ErroMercadoLivre("A integração com o Mercado Livre não está configurada neste ambiente.", {
      codigo: "SEM_APP",
    });
  }
  if (!(imovel.images || []).length) {
    /* Recusado aqui e não lá: anúncio sem foto é rejeitado pelo Mercado Livre
       com um erro genérico, e a pessoa passa a tarde procurando o que está
       errado no cadastro. */
    throw new ErroMercadoLivre("Este imóvel não tem foto. O Mercado Livre não aceita anúncio sem imagem.", {
      codigo: "SEM_FOTO",
    });
  }
  const criado = await chamar(tenant, "/items", { metodo: "POST", corpo: anuncioDoImovel(imovel, opcoes) });
  return { id: criado.id, url: criado.permalink || "" };
}

/** Atualiza preço e status de um anúncio existente. */
export async function atualizar(tenant, anuncioId, imovel) {
  return chamar(tenant, `/items/${anuncioId}`, {
    metodo: "PUT",
    corpo: { price: Number(imovel.price) || 0, available_quantity: imovel.status === "ACTIVE" ? 1 : 0 },
  });
}

/* Encerrar é em DOIS passos, e a ordem importa: o Mercado Livre só aceita
   `closed` num anúncio pausado. Mandar direto devolve um erro de transição
   inválida que não explica nada. */
export async function encerrar(tenant, anuncioId) {
  await chamar(tenant, `/items/${anuncioId}`, { metodo: "PUT", corpo: { status: "paused" } });
  return chamar(tenant, `/items/${anuncioId}`, { metodo: "PUT", corpo: { status: "closed" } });
}

export async function situacao(tenant, anuncioId) {
  return chamar(tenant, `/items/${anuncioId}`);
}
