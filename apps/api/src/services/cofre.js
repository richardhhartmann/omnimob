import crypto from "node:crypto";

/* ────────────────────────────────────────────────────────────────────────────
   Cofre: segredo de terceiro cifrado antes de encostar no banco.

   Existe por causa de um caso concreto — o token da página do Facebook, que a
   imobiliária nos entrega ao conectar as redes. Ele ficava em texto puro em
   `tb_tenants`, e isso muda a natureza de um vazamento: um dump da tabela não
   expõe o NOSSO dado, expõe o acesso que o cliente confiou a nós. Quem lesse a
   coluna publicaria no Facebook e no Instagram de todos os clientes.

   ── POR QUE AES-256-GCM ──

   GCM é cifra autenticada: além de esconder, ele DETECTA adulteração. Sem isso
   alguém com escrita no banco poderia trocar bytes do texto cifrado e nós
   entregaríamos o resultado à Graph API sem perceber. A etiqueta de autenticação
   faz a decifragem falhar em vez de devolver lixo.

   ── COMPATIBILIDADE COM O QUE JÁ ESTÁ GRAVADO ──

   `decifrar` devolve a entrada inalterada quando ela não tem o envelope `v1:`.
   Isso não é preguiça: os tokens que já existem no banco estão em texto puro, e
   uma migração que tentasse cifrá-los teria de ler a chave de dentro do SQL. Do
   jeito que está, o que já existe continua funcionando e passa a ser cifrado na
   próxima escrita — que acontece a cada reconexão do OAuth, e é rotina.

   ── A CHAVE ──

   `CRYPTO_SECRET` quando existir; senão, derivada do `JWT_SECRET`. O segundo
   caso é uma rede de segurança para o ambiente de desenvolvimento, não uma
   recomendação: em produção as duas devem ser distintas, porque vazar o segredo
   de sessão e vazar o cofre de credenciais são incidentes de tamanhos
   diferentes. `scrypt` no meio para que uma senha curta vire uma chave de 32
   bytes de verdade.
   ──────────────────────────────────────────────────────────────────────────── */

const PREFIXO = "v1";
const SAL = "omnimob-cofre-v1";

let chaveCache = null;

function chave() {
  if (chaveCache) return chaveCache;
  const bruta = process.env.CRYPTO_SECRET || process.env.JWT_SECRET || "omnimob-dev-secret";
  chaveCache = crypto.scryptSync(bruta, SAL, 32);
  return chaveCache;
}

/** Cifra um texto. Devolve `null`/`""` como veio — não há segredo a guardar. */
export function cifrar(texto) {
  if (texto === null || texto === undefined || texto === "") return texto;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", chave(), iv);
  const cifrado = Buffer.concat([cipher.update(String(texto), "utf8"), cipher.final()]);
  const etiqueta = cipher.getAuthTag();
  return [PREFIXO, iv.toString("base64"), etiqueta.toString("base64"), cifrado.toString("base64")].join(":");
}

/**
 * Decifra. Valor sem envelope volta como está (texto puro gravado antes desta
 * mudança); valor com envelope quebrado devolve `null` — melhor a publicação
 * falhar dizendo "reconecte sua conta" do que mandarmos lixo à Graph API.
 */
export function decifrar(valor) {
  if (valor === null || valor === undefined || valor === "") return valor;
  const texto = String(valor);
  if (!texto.startsWith(`${PREFIXO}:`)) return texto;

  const [, ivB64, etiquetaB64, cifradoB64] = texto.split(":");
  if (!ivB64 || !etiquetaB64 || !cifradoB64) return null;

  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", chave(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(etiquetaB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(cifradoB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Já está cifrado? Usado para não cifrar duas vezes o mesmo valor. */
export function estaCifrado(valor) {
  return typeof valor === "string" && valor.startsWith(`${PREFIXO}:`);
}
