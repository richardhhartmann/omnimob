import crypto from "node:crypto";
import jwt from "jsonwebtoken";

/* ────────────────────────────────────────────────────────────────────────────
   Conta Google — verificação do token de identidade.

   ── O QUE CHEGA AQUI ──

   O navegador usa o Google Identity Services e recebe um JWT assinado pelo
   Google (o "ID token"). Ele vem para nós, e este arquivo responde uma pergunta
   só: **este token é mesmo do Google, e mesmo para a nossa aplicação?**

   ── POR QUE VERIFICAR A ASSINATURA, E NÃO SÓ LER ──

   O token é legível por qualquer um — é base64, não criptografia. Confiar no
   conteúdo sem conferir a assinatura seria aceitar qualquer JSON que alguém
   digitasse: bastaria mandar `{"sub": "o-id-de-outra-pessoa"}` para entrar como
   ela. A assinatura é a única parte que não dá para forjar.

   ── SEM DEPENDÊNCIA NOVA ──

   O Node converte JWK em chave pública nativamente (`format: "jwk"`), e o
   `jsonwebtoken` já estava aqui. Uma biblioteca de JWKS resolveria o mesmo com
   mais uma dependência para acompanhar — e esta é código de autenticação, onde
   cada dependência é uma superfície a mais para confiar.

   ── AS TRÊS CONFERÊNCIAS QUE IMPORTAM ──

   1. ASSINATURA, contra as chaves públicas do Google.
   2. `aud` igual ao NOSSO client id. Sem isso, um token emitido para outro
      aplicativo qualquer — e há milhões — serviria para entrar aqui.
   3. `iss` sendo o Google. Barato, e fecha a porta para um token de outro
      emissor que por acaso passasse nas outras duas.

   `email_verified` entra junto: o Google permite conta com e-mail não
   confirmado, e um e-mail não confirmado não prova nada sobre quem é a pessoa.
   ──────────────────────────────────────────────────────────────────────────── */

/* O endereço das chaves públicas do Google.

   Configurável por variável de ambiente só para o TESTE poder servir um JWKS
   próprio, de um servidor local. A alternativa era substituir o `fetch` global
   na suíte — e isso, além de frágil, travou o processo inteiro quando tentei.

   Costura explícita é melhor que global trocado: aqui está escrito o que muda e
   por quê, e o caminho exercitado no teste é o MESMO de produção, com a mesma
   escolha de chave, a mesma verificação de assinatura e o mesmo cache. */
function enderecoDosCertificados() {
  return process.env.GOOGLE_JWKS_URL || "https://www.googleapis.com/oauth2/v3/certs";
}
const EMISSORES = ["https://accounts.google.com", "accounts.google.com"];

export function googleConfigurado() {
  return Boolean(process.env.GOOGLE_CLIENT_ID);
}

/* As chaves públicas do Google, em cache.

   Elas giram de tempos em tempos, e o cabeçalho da resposta diz por quanto
   tempo valem. Buscar a cada login seria uma ida à rede em todo acesso; guardar
   para sempre quebraria calado no dia em que o Google trocasse as chaves. */
let chavesEmCache = null;
let chavesValidasAte = 0;
/* O cache guarda DE ONDE as chaves vieram.

   Sem isso ele responderia com as chaves de um endereço para um pedido de
   outro — e foi exatamente o que aconteceu: o endereço era lido na carga do
   módulo, o teste o definia depois, e a verificação ia buscar as chaves reais
   do Google para conferir um token assinado localmente. Todo token válido era
   recusado, e os dois testes que ESPERAVAM recusa passavam por acidente. */
let chavesDeOnde = null;

async function chavesDoGoogle() {
  const endereco = enderecoDosCertificados();
  if (chavesEmCache && chavesDeOnde === endereco && Date.now() < chavesValidasAte) {
    return chavesEmCache;
  }

  const resposta = await fetch(endereco);
  if (!resposta.ok) throw new Error("Não consegui buscar as chaves do Google.");
  const { keys } = await resposta.json();

  /* O `max-age` do cabeçalho é a validade que o próprio Google anuncia. Sem
     ele, uma hora — curto o bastante para acompanhar uma troca, longo o
     bastante para não pesar. */
  const cacheControl = resposta.headers.get("cache-control") || "";
  const segundos = Number(cacheControl.match(/max-age=(\d+)/)?.[1] || 3600);
  chavesEmCache = keys;
  chavesDeOnde = endereco;
  chavesValidasAte = Date.now() + segundos * 1000;
  return keys;
}

/**
 * Verifica o ID token e devolve a identidade, ou lança.
 *
 * @returns {Promise<{ googleId, email, emailVerificado, nome, foto }>}
 */
export async function verificarTokenDoGoogle(idToken) {
  if (!googleConfigurado()) {
    const err = new Error("Entrar com Google não está configurado neste ambiente.");
    err.code = "GOOGLE_NAO_CONFIGURADO";
    throw err;
  }
  if (!idToken) {
    const err = new Error("Token do Google não recebido.");
    err.code = "TOKEN_AUSENTE";
    throw err;
  }

  /* O `kid` do cabeçalho diz QUAL das chaves assinou. O Google publica mais de
     uma ao mesmo tempo justamente para poder girar sem derrubar tokens ainda
     válidos — tentar todas seria mais lento e esconderia um token com `kid`
     inventado. */
  const cabecalho = jwt.decode(idToken, { complete: true })?.header;
  if (!cabecalho?.kid) {
    const err = new Error("Token do Google malformado.");
    err.code = "TOKEN_INVALIDO";
    throw err;
  }

  const chaves = await chavesDoGoogle();
  const jwk = chaves.find((k) => k.kid === cabecalho.kid);
  if (!jwk) {
    /* Chave desconhecida pode ser giro recente: descarta o cache e tenta uma
       vez mais antes de recusar. */
    chavesEmCache = null;
    const novas = await chavesDoGoogle();
    const outra = novas.find((k) => k.kid === cabecalho.kid);
    if (!outra) {
      const err = new Error("Token do Google assinado por uma chave desconhecida.");
      err.code = "TOKEN_INVALIDO";
      throw err;
    }
    return conferir(idToken, outra);
  }

  return conferir(idToken, jwk);
}

function conferir(idToken, jwk) {
  const chavePublica = crypto.createPublicKey({ key: jwk, format: "jwk" });

  let dados;
  try {
    dados = jwt.verify(idToken, chavePublica, {
      algorithms: ["RS256"],
      audience: process.env.GOOGLE_CLIENT_ID,
      issuer: EMISSORES,
    });
  } catch (erro) {
    const err = new Error("O token do Google não é válido para esta aplicação.");
    err.code = "TOKEN_INVALIDO";
    err.detalhe = erro.message;
    throw err;
  }

  if (!dados.email_verified) {
    const err = new Error("Esta conta do Google está com o e-mail não confirmado.");
    err.code = "EMAIL_NAO_VERIFICADO";
    throw err;
  }

  return {
    googleId: String(dados.sub),
    email: dados.email || null,
    emailVerificado: Boolean(dados.email_verified),
    nome: dados.name || null,
    foto: dados.picture || null,
  };
}
