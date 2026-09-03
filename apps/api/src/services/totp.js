import crypto from "node:crypto";

/* ────────────────────────────────────────────────────────────────────────────
   Segundo fator por aplicativo autenticador (TOTP, RFC 6238).

   ── O QUE ISTO PROTEGE ──

   A senha do super-admin já é hash (bcrypt, ver `adminRoutes`). O que hash não
   resolve é a senha CERTA nas mãos erradas: phishing, reuso em outro site que
   vazou, alguém olhando o teclado. O código do aplicativo é a única parte que
   não viaja e não se reusa — ele muda a cada 30 segundos e vale uma vez.

   E aqui o alvo justifica: quem entra neste painel vê e edita TODAS as
   imobiliárias, entra na conta de qualquer cliente e mexe em cobrança. É a
   única porta do produto cujo dono é uma pessoa só.

   ── SEM DEPENDÊNCIA NOVA ──

   TOTP é HMAC-SHA1 sobre o contador de 30 em 30 segundos, mais uma truncagem
   de nove linhas. O `node:crypto` faz o HMAC; o base32 são vinte linhas. Uma
   biblioteca traria a mesma coisa mais uma superfície para confiar — e este é
   código de autenticação, onde cada dependência é um lugar a mais de onde um
   comprometimento pode vir. Mesmo raciocínio do `services/google.js`.

   ── AS ESCOLHAS QUE NÃO SÃO NEGOCIÁVEIS ──

   1. **SHA-1, 6 dígitos, 30 segundos.** Não é descuido: é o que Google
      Authenticator, Authy, 1Password e Microsoft Authenticator implementam de
      verdade. O parâmetro `algorithm` do `otpauth://` é IGNORADO por vários
      deles — quem gera SHA-256 acaba com um app que mostra códigos que nunca
      batem, e não há mensagem de erro que explique isso ao usuário.

   2. **Uma janela de tolerância para cada lado.** O relógio do celular e o do
      servidor divergem; sem tolerância, quem digita no segundo 29 falha. Mais
      de um passo para cada lado começa a alargar demais o que um código
      capturado ainda abre.

   3. **Comparação em tempo constante.** `===` em string vaza, pelo tempo, o
      tamanho do prefixo acertado. São seis dígitos e um milhão de
      possibilidades — pouco o bastante para o vazamento importar.

   4. **Anti-reuso pelo PASSO.** Um código vale 30 segundos, e nesse intervalo
      ele funciona quantas vezes for tentado. Quem o interceptar (ombro, tela
      compartilhada, um proxy) o reapresenta na mesma janela. Por isso quem
      chama guarda o último passo aceito e o passa em `depoisDe`: o mesmo código
      não entra duas vezes.

   ── OS CÓDIGOS DE RECUPERAÇÃO ──

   Perder o celular não pode significar perder a plataforma. Os códigos são
   gerados uma vez, mostrados uma vez, e guardados em HASH — pelo mesmo motivo e
   com o mesmo algoritmo das chaves de API (ver o cabeçalho de `chavesApi.js`):
   são aleatoriedade do sistema, não senha escolhida por gente, então SHA-256
   basta e bcrypt só custaria caro à toa.
   ──────────────────────────────────────────────────────────────────────────── */

const PERIODO = 30;
const DIGITOS = 6;
const JANELA = 1;

// RFC 4648, sem padding: é o que o otpauth:// espera.
const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/* `[0-9]` e não `\d`: a expressão é montada a partir de `DIGITOS`, e numa
   string de template `\d` perde a barra e vira a letra "d" — o padrão passaria
   a exigir "dddddd" e nenhum código entraria. Classe explícita não tem escape
   para se perder. */
const SO_DIGITOS = new RegExp(`^[0-9]{${DIGITOS}}$`);

function base32Codificar(buffer) {
  let bits = 0;
  let valor = 0;
  let saida = "";
  for (const byte of buffer) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      saida += ALFABETO[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) saida += ALFABETO[(valor << (5 - bits)) & 31];
  return saida;
}

function base32Decodificar(texto) {
  /* Espaço e hífen entram porque a pessoa digita o segredo à mão no aplicativo
     e nós o mostramos em grupos de quatro; recusar o que nós mesmos formatamos
     seria armadilha. */
  const limpo = String(texto || "").toUpperCase().replace(/[\s=-]/g, "");
  if (!limpo) throw new Error("Segredo vazio.");
  let bits = 0;
  let valor = 0;
  const bytes = [];
  for (const caractere of limpo) {
    const indice = ALFABETO.indexOf(caractere);
    if (indice === -1) throw new Error("Segredo inválido.");
    valor = (valor << 5) | indice;
    bits += 5;
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Um segredo novo, em base32. 20 bytes é o tamanho da chave do HMAC-SHA1. */
export function gerarSegredo(bytes = 20) {
  return base32Codificar(crypto.randomBytes(bytes));
}

/** O passo do relógio — o contador que os dois lados calculam sozinhos. */
export function passoAgora(agora = Date.now()) {
  return Math.floor(agora / 1000 / PERIODO);
}

function codigoDoPasso(segredoBuffer, passo) {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(passo));
  const mac = crypto.createHmac("sha1", segredoBuffer).update(contador).digest();
  // Truncagem dinâmica do RFC 4226: o último nibble escolhe de onde ler.
  const deslocamento = mac[mac.length - 1] & 0x0f;
  const truncado = mac.readUInt32BE(deslocamento) & 0x7fffffff;
  return String(truncado % 10 ** DIGITOS).padStart(DIGITOS, "0");
}

function iguais(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

/**
 * Confere um código de seis dígitos.
 *
 * @param {string} segredo   em base32
 * @param {string} codigo    o que a pessoa digitou
 * @param {{ janela?: number, agora?: number, depoisDe?: number|null }} opcoes
 *   `depoisDe` é o último passo já aceito por esta conta — passos até ele são
 *   recusados mesmo com o código certo. Ver o item 4 do cabeçalho.
 * @returns {{ ok: boolean, passo: number|null }}
 */
export function conferir(segredo, codigo, { janela = JANELA, agora = Date.now(), depoisDe = null } = {}) {
  /* Espaço e hífen saem porque há aplicativo que mostra "050 471", e recusar o
     que a pessoa vê na tela seria armadilha. Só eles: tirar TODO caractere não
     numérico fazia "0a5b0c4d7e1" virar um código válido — frouxidão que não
     ajuda ninguém e alarga o que a rota aceita. */
  const limpo = String(codigo || "").replace(/[\s-]/g, "");
  if (!SO_DIGITOS.test(limpo)) return { ok: false, passo: null };

  let segredoBuffer;
  try {
    segredoBuffer = base32Decodificar(segredo);
  } catch {
    return { ok: false, passo: null };
  }

  const atual = passoAgora(agora);
  for (let desvio = -janela; desvio <= janela; desvio += 1) {
    const passo = atual + desvio;
    if (depoisDe != null && passo <= depoisDe) continue;
    if (iguais(codigoDoPasso(segredoBuffer, passo), limpo)) return { ok: true, passo };
  }
  return { ok: false, passo: null };
}

/**
 * O endereço `otpauth://` que vira QR ou entrada manual no aplicativo.
 *
 * O rótulo leva emissor E conta ("Omnimob:super@…") porque é assim que o app
 * agrupa: sem o emissor no rótulo, quem administra duas contas vê duas linhas
 * iguais e não sabe qual é qual.
 */
export function uriDeProvisionamento({ segredo, conta, emissor = "Omnimob" }) {
  const rotulo = encodeURIComponent(`${emissor}:${conta}`);
  const parametros = new URLSearchParams({
    secret: segredo,
    issuer: emissor,
    algorithm: "SHA1",
    digits: String(DIGITOS),
    period: String(PERIODO),
  });
  return `otpauth://totp/${rotulo}?${parametros}`;
}

/** O segredo em grupos de quatro, para quem for digitar à mão sem se perder. */
export function formatarSegredo(segredo) {
  return String(segredo).replace(/(.{4})/g, "$1 ").trim();
}

// ─── Códigos de recuperação ─────────────────────────────────────────────────

/* Sem I, O, 0 e 1: estes códigos são lidos de um papel ou de um gerenciador de
   senhas e digitados à mão, e o par que se confunde na leitura custa uma
   tentativa perdida no pior momento possível — quando a pessoa já está sem o
   celular. */
const ALFABETO_RECUPERACAO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TAMANHO_RECUPERACAO = 10;
const QUANTOS_RECUPERACAO = 10;

export function hashDeRecuperacao(texto) {
  const limpo = String(texto || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return crypto.createHash("sha256").update(limpo).digest("hex");
}

/**
 * Gera os códigos de uso único.
 * @returns {{ textos: string[], hashes: string[] }} — `textos` aparece uma vez
 *   na resposta e some; só `hashes` vai para o banco.
 */
export function gerarCodigosDeRecuperacao(quantos = QUANTOS_RECUPERACAO) {
  const textos = [];
  for (let i = 0; i < quantos; i += 1) {
    let bruto = "";
    /* `randomInt` e não `Math.random`: são credenciais, e o gerador padrão do
       JavaScript é previsível a partir de saídas observadas. */
    for (let c = 0; c < TAMANHO_RECUPERACAO; c += 1) {
      bruto += ALFABETO_RECUPERACAO[crypto.randomInt(ALFABETO_RECUPERACAO.length)];
    }
    textos.push(`${bruto.slice(0, 5)}-${bruto.slice(5)}`);
  }
  return { textos, hashes: textos.map(hashDeRecuperacao) };
}

/** Um código de recuperação tem hífen e letras; o do aplicativo, seis dígitos. */
export function pareceCodigoDeRecuperacao(texto) {
  return /[A-Za-z-]/.test(String(texto || ""));
}
