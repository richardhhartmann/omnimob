import { decifrar } from "./cofre.js";

/* ────────────────────────────────────────────────────────────────────────────
   A ponte não oficial de WhatsApp — e o que ela deliberadamente NÃO é.

   ── O PROBLEMA ──

   Não existe API oficial para publicar status. O WhatsApp Business Cloud API
   entrega mensagens; status é recurso de consumidor, e a Meta nunca expôs
   endpoint para ele. O caminho padrão do produto é outro: montamos a arte
   vertical e a pessoa publica com um toque (ver `utils/arteParaStatus.js` no
   front). Seguro, e funciona hoje.

   Quem quer automação de verdade precisa de uma ponte: um serviço que mantém
   uma sessão do WhatsApp Web aberta e posta por ela. Isso viola os Termos da
   Meta e pode fazer o número ser banido — o número que costuma ser o principal
   canal de vendas da imobiliária.

   ── A DECISÃO DE DESENHO ──

   Nós NÃO hospedamos a sessão. Não embarcamos Baileys, não guardamos QR code,
   não mantemos socket nenhum.

   O que fazemos é falar com uma ponte que a PRÓPRIA imobiliária contrata ou
   sobe (Whapi.Cloud, Evolution API, WPPConnect — todas expõem um POST parecido).
   Ela informa o endereço e o token; nós enviamos.

   A diferença não é técnica, é de responsabilidade. Hospedando a sessão, a
   Omnimob passaria a operar a violação dos termos em nome de centenas de
   clientes, com o nosso IP e a nossa infraestrutura no meio — e um banimento em
   massa seria um incidente nosso. Assim, a decisão, o contrato e o risco ficam
   com quem escolheu correr atrás deles.

   Ser agnóstico de fornecedor é consequência disso: como não somos donos da
   ponte, mandamos um corpo simples e deixamos o endereço configurável.
   ──────────────────────────────────────────────────────────────────────────── */

const TEMPO_LIMITE_MS = 30_000;

export class ErroDaPonte extends Error {}

/* ── Cada fornecedor tem endereço E corpo próprios ───────────────────────────
   A primeira versão pedia que a pessoa colasse o ENDPOINT completo e mandava um
   corpo genérico. As duas coisas estavam erradas para o caso real.

   Quem contrata o Whapi recebe do painel deles a URL BASE — `https://gate.whapi.cloud`
   — e um token. Foi isso que foi colado, e o POST caiu na raiz: a ponte
   respondeu `404 "/ not found"`. Pedir que o cliente descubra e monte o caminho
   certo é transferir a ele um trabalho que é nosso: nós sabemos qual é o
   endpoint, ele não.

   Então montamos o endereço a partir da base, e o corpo a partir do fornecedor.

   ── OS DOIS QUE IMPORTAM ──

     Whapi      `POST <base>/messages/media/image`, com o corpo de mensagem de
                mídia. O status é o destinatário especial `status@broadcast` —
                a convenção do próprio WhatsApp, que o Whapi respeita.
                Reconhecido pelo HOST, porque é serviço hospedado.

     Evolution  `POST <base>/message/sendStatus/<instância>`. Auto-hospedado, em
                qualquer domínio, então o que identifica é o CAMINHO. Aqui o
                endereço vem inteiro do cliente: a instância faz parte dele e
                nós não temos como adivinhá-la.

   Qualquer outro endereço é usado como veio, com o corpo genérico. */
/* O endpoint de STORY do Whapi, e não o de mensagem.

   Duas tentativas erradas antes desta, e as duas ensinam algo:

     `/` (a base colada pelo cliente)  → 404 "/ not found"
     `/messages/media/image`           → 400 "must have required property 'SendParams'"

   O segundo erro foi o revelador: `/messages/media/...` é a variante de UPLOAD
   BINÁRIO, que espera os parâmetros na query. O caminho JSON de imagem é
   `/messages/image` — mas ele também não serve, porque o `to` dele exige um
   número (`^[\d-]{9,31}...`) e status não tem destinatário.

   O certo é a família própria de stories: `POST /messages/story/media`. Sem
   `to`, porque um status não é enviado A alguém. */
const CAMINHO_WHAPI = "/messages/story/media";

function ehWhapi(endereco) {
  return /(^|\.)whapi\.cloud$/i.test(endereco.hostname);
}

function ehEvolution(endereco) {
  return /\/message\/sendstatus/i.test(endereco.pathname);
}

/** O endereço para onde o POST realmente vai. */
export function enderecoDeEnvio(url) {
  const endereco = new URL(url);
  if (!ehWhapi(endereco)) return endereco.href;

  /* Base colada sem caminho — o caso comum, e o que dava 404. Montamos o
     endpoint. Se a pessoa já tiver colado um caminho, respeitamos: ela pode
     estar apontando para outro recurso de propósito. */
  const semCaminho = endereco.pathname === "/" || endereco.pathname === "";
  if (semCaminho) endereco.pathname = CAMINHO_WHAPI;
  return endereco.href;
}

/* Um número da agenda no formato que a API exige. Guardamos só dígitos; o
   sufixo é detalhe do protocolo e não deve aparecer na tela de ninguém. */
function comoContato(numero) {
  const digitos = String(numero || "").replace(/\D/g, "");
  return digitos ? `${digitos}@s.whatsapp.net` : null;
}

export function corpoDaPonte(url, { imagemUrl, legenda, contatos = [] }) {
  const endereco = new URL(url);
  const publico = contatos.map(comoContato).filter(Boolean);

  if (ehWhapi(endereco)) {
    return {
      media: imagemUrl,
      caption: legenda || "",
      /* ── O CAMPO QUE FALTAVA ────────────────────────────────────────────
         A documentação do Whapi é explícita: sem `contacts`, ele busca a
         agenda inteira e manda para todos. Era o que acontecia — e a
         privacidade configurada no APARELHO não corrige isso, porque a ponte
         é uma sessão vinculada e publica com a lista dela.

         Lista vazia continua sendo "todos", porque é o que a API faz e
         inventar outro padrão aqui esconderia o fato. Quem avisa é a tela. */
      ...(publico.length ? { contacts: publico } : {}),
      /* O padrão da API é `true`: qualquer pessoa que vir o status pode
         reencaminhá-lo. Para um anúncio de imóvel isso multiplica o alcance
         de algo que a imobiliária escolheu mostrar a um público — e o dono do
         alcance deixa de ser ela. Quem quiser espalhar compartilha o link da
         vitrine, que é para isso que ele existe. */
      allow_reshare: false,
    };
  }

  if (ehEvolution(endereco)) {
    return {
      type: "image",
      content: imagemUrl,
      caption: legenda || "",
      /* `allContacts` só quando não há lista — antes era `true` cravado, o que
         mandava para a agenda inteira mesmo com público escolhido. */
      ...(publico.length
        ? { allContacts: false, statusJidList: publico }
        : { allContacts: true }),
    };
  }

  return {
    tipo: "status",
    media: imagemUrl,
    caption: legenda || "",
    ...(publico.length ? { contacts: publico } : {}),
  };
}

export function ponteConfigurada(tenant) {
  return Boolean(tenant?.whatsappPonteUrl && tenant?.whatsappPonteToken);
}

/* Intervalo entre um status e o próximo.

   Publicar cinco fotos em rajada é o padrão que qualquer serviço de mensageria
   trata como suspeito — e o serviço aqui é uma sessão de WhatsApp Web, o
   caminho mais fácil de a conta ser sinalizada. Um segundo entre cada envio não
   muda nada para quem publica (a pessoa já saiu da tela) e tira o comportamento
   da faixa que chama atenção. */
const INTERVALO_ENTRE_STATUS_MS = 1200;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Publica UM status pela ponte do tenant.
 *
 * @param {object} tenant
 * @param {object} conteudo { imagemUrl, legenda }
 */
export async function publicarStatus(tenant, { imagemUrl, legenda }) {
  if (!ponteConfigurada(tenant)) {
    throw new ErroDaPonte("Esta imobiliária não conectou uma ponte de WhatsApp.");
  }
  if (!imagemUrl) throw new ErroDaPonte("Sem imagem para publicar.");

  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
  try {
    const resposta = await fetch(enderecoDeEnvio(tenant.whatsappPonteUrl), {
      method: "POST",
      signal: controle.signal,
      headers: {
        "Content-Type": "application/json",
        /* Os dois cabeçalhos, porque as pontes divergem: Whapi usa `Bearer`,
           Evolution usa `apikey`. Mandar ambos custa nada e evita um campo de
           configuração a mais numa tela que já é técnica demais para o
           público dela. */
        Authorization: `Bearer ${decifrar(tenant.whatsappPonteToken)}`,
        apikey: decifrar(tenant.whatsappPonteToken),
      },
      body: JSON.stringify(
        corpoDaPonte(tenant.whatsappPonteUrl, {
          imagemUrl,
          legenda,
          contatos: tenant.whatsappPonteContatos || [],
        }),
      ),
    });

    const texto = await resposta.text().catch(() => "");
    if (!resposta.ok) {
      /* A resposta CRUA do fornecedor vai junto, e isso é deliberado. Cada
         ponte tem o próprio contrato, e nenhuma documentação pública basta para
         acertar todos os campos de primeira. Um "a ponte recusou" sem o corpo
         transforma um ajuste de trinta segundos numa investigação às cegas —
         com o corpo, quem configurou lê o que faltou e corrige. */
      throw new ErroDaPonte(
        `A ponte respondeu ${resposta.status}${texto ? `: ${texto.slice(0, 400)}` : "."}`,
      );
    }
    /* ── O ID DA MENSAGEM ────────────────────────────────────────────────
       Antes esta resposta era lida só para dizer "deu certo" e jogada fora, e o
       preço apareceu no dia em que foi preciso saber o que estava no ar: não
       havia registro de nada. Descobrir os status publicados virou uma consulta
       manual à ponte, por script.

       Cada ponte guarda o id num lugar diferente e nenhuma promete estabilidade
       — por isso procuramos nos três formatos conhecidos e aceitamos não achar.
       Publicação sem id continua sendo publicação; ela só entra no histórico
       sem a referência externa. */
    let corpo = null;
    try { corpo = JSON.parse(texto); } catch { corpo = null; }
    const id = corpo?.message?.id || corpo?.id || corpo?.key?.id || null;

    return { ok: true, id, resposta: texto.slice(0, 400) };
  } catch (erro) {
    if (erro instanceof ErroDaPonte) throw erro;
    if (erro.name === "AbortError") throw new ErroDaPonte("A ponte não respondeu a tempo.");
    throw new ErroDaPonte(`Não consegui falar com a ponte: ${erro.message}`);
  } finally {
    clearTimeout(relogio);
  }
}

/* Quanto tempo um status fica no ar.

   Não é escolha nossa nem configurável: é o comportamento do WhatsApp. Está
   aqui porque o produto precisa DIZER isso na tela — apagar não é possível (o
   Whapi não suporta remover status pela API), então "quando some" é a única
   resposta honesta para "como tiro isso do ar". */
export const HORAS_NO_AR = 24;

export function expiraEm(publicadoEm) {
  return new Date(new Date(publicadoEm).getTime() + HORAS_NO_AR * 3600000);
}

/**
 * Publica uma SEQUÊNCIA de status — um por imagem.
 *
 * ── POR QUE UM STATUS POR FOTO, E NÃO UM SÓ ──
 *
 * Status do WhatsApp não tem carrossel: cada imagem é uma publicação. Mandar só
 * a arte deixaria de fora as outras fotos do imóvel, que são o que faz alguém
 * parar de rolar — quem vende imóvel vende ambiente, e um cartão com preço não
 * mostra a sala.
 *
 * ── A ORDEM IMPORTA ──
 *
 * A primeira é a ARTE, com preço, ficha e endereço da vitrine: é ela que precisa
 * carregar a informação, porque é a que aparece primeiro na fila de quem
 * assiste. As demais vão CRUAS (já com a marca d'água que o cadastro aplicou),
 * porque repetir a faixa de preço em cinco fotos transforma o anúncio em
 * panfleto.
 *
 * ── A LEGENDA VAI SÓ NA PRIMEIRA ──
 *
 * Pelo mesmo motivo. Cinco status com o mesmo texto embaixo lê como erro de
 * envio, não como anúncio.
 *
 * @returns {Promise<{publicados: number, falhas: Array<{imagemUrl, motivo}>}>}
 */
export async function publicarSequenciaDeStatus(tenant, { imagens = [], legenda }) {
  const lista = imagens.filter((u) => /^https?:\/\//i.test(String(u || "")));
  if (!lista.length) throw new ErroDaPonte("Nenhuma imagem para publicar.");

  const falhas = [];
  const publicacoes = [];
  let publicados = 0;

  for (const [i, imagemUrl] of lista.entries()) {
    if (i > 0) await espera(INTERVALO_ENTRE_STATUS_MS);
    try {
      const r = await publicarStatus(tenant, { imagemUrl, legenda: i === 0 ? legenda : "" });
      publicados += 1;
      publicacoes.push({ imagemUrl, id: r.id || null, primeira: i === 0 });
    } catch (erro) {
      /* Uma foto que falha não cancela as outras. O caso real é uma URL que o
         Whapi não conseguiu baixar; abortar tudo por causa dela deixaria o
         anúncio pela metade sem o resto ter sequer sido tentado. */
      falhas.push({ imagemUrl, motivo: erro.message });
    }
  }

  /* Nenhuma passou: aí é problema de configuração, não de uma imagem. Levantar
     faz a tela mostrar o motivo em vez de dizer "0 publicados" em silêncio. */
  if (!publicados) throw new ErroDaPonte(falhas[0]?.motivo || "Nenhum status foi publicado.");

  return { publicados, falhas, publicacoes };
}
