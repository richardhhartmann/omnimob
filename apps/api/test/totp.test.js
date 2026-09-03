import crypto from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import {
  conferir,
  formatarSegredo,
  gerarCodigosDeRecuperacao,
  gerarSegredo,
  hashDeRecuperacao,
  passoAgora,
  pareceCodigoDeRecuperacao,
  uriDeProvisionamento,
} from "../src/services/totp.js";

/* ── O que esta suíte guarda ─────────────────────────────────────────────────

   A geração do código, e nada mais. É função pura sobre um segredo e um
   relógio, então não toca no banco — como `mercadoPago.test.js` e
   `avisoVencimento.test.js`.

   O risco aqui não é vazamento, é INTEROPERABILIDADE, e ele é assimétrico nos
   dois sentidos:

     · gerar diferente do que o Google Authenticator gera → o segundo fator
       nunca aceita nada, e quem o ligou fica trancado fora da plataforma. Não
       há mensagem de erro que explique isso, porque do ponto de vista do
       servidor o código está simplesmente errado;
     · aceitar de menos ou de mais → ou a pessoa não entra com o código certo,
       ou um código já usado entra de novo.

   Por isso o coração da suíte são os VETORES DO RFC 6238. Eles são a definição
   de "igual ao que o aplicativo faz": se estes passam, qualquer autenticador de
   TOTP conversa com a gente.
   ────────────────────────────────────────────────────────────────────────── */

/* O segredo dos vetores do RFC é o ASCII "12345678901234567890"; em base32,
   isto. Escrito à mão de propósito — derivá-lo com a nossa própria função
   deixaria o teste concordar consigo mesmo em vez de com o RFC. */
const SEGREDO_RFC = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

/* Apêndice B do RFC 6238, na coluna SHA-1. Lá os códigos têm oito dígitos;
   os nossos têm seis, que são os seis ÚLTIMOS — truncar por `% 10^6` é o mesmo
   que tomar os últimos seis dígitos do `% 10^8`. */
const VETORES = [
  { segundos: 59, oito: "94287082" },
  { segundos: 1111111109, oito: "07081804" },
  { segundos: 1111111111, oito: "14050471" },
  { segundos: 1234567890, oito: "89005924" },
  { segundos: 2000000000, oito: "69279037" },
  { segundos: 20000000000, oito: "65353130" },
];

test("gera exatamente o código do RFC 6238 (é o que o aplicativo espera)", () => {
  for (const { segundos, oito } of VETORES) {
    const esperado = oito.slice(-6);
    const { ok } = conferir(SEGREDO_RFC, esperado, { agora: segundos * 1000, janela: 0 });
    assert.equal(ok, true, `vetor de ${segundos}s deveria gerar ${esperado}`);
  }
});

test("a tolerância cobre um passo para cada lado, e não mais", () => {
  // 1111111109 e 1111111111 caem em passos vizinhos (37037036 e 37037037).
  const agora = 1111111111 * 1000;

  const anterior = conferir(SEGREDO_RFC, "081804", { agora });
  assert.equal(anterior.ok, true, "o código do passo anterior ainda entra");

  const atual = conferir(SEGREDO_RFC, "050471", { agora });
  assert.equal(atual.ok, true);

  /* Dois passos atrás (60s) está fora. Sem este limite, um código visto por
     cima do ombro continuaria valendo por minutos. */
  const doisAtras = conferir(SEGREDO_RFC, "287082", { agora: (1111111111 + 90) * 1000 });
  assert.equal(doisAtras.ok, false);
});

test("o mesmo código não entra duas vezes", () => {
  const agora = 1111111111 * 1000;
  const primeira = conferir(SEGREDO_RFC, "050471", { agora });
  assert.equal(primeira.ok, true);

  /* É isto que a rota grava em `totpUltimoPasso`. Sem o `depoisDe`, o mesmo
     código funcionaria por 30 segundos inteiros, quantas vezes fosse
     apresentado — e quem o interceptasse o reusaria dentro da janela. */
  const repetida = conferir(SEGREDO_RFC, "050471", { agora, depoisDe: primeira.passo });
  assert.equal(repetida.ok, false);

  // E o passo seguinte continua entrando: a trava é do código usado, não da conta.
  const seguinte = conferir(SEGREDO_RFC, "050471", { agora, depoisDe: primeira.passo - 1 });
  assert.equal(seguinte.ok, true);
});

test("recusa o que não é código de seis dígitos, sem explodir", () => {
  const agora = 1111111111 * 1000;
  for (const lixo of ["", null, undefined, "abc", "12345", "1234567", "0a5b0c4d7e1", {}]) {
    assert.equal(conferir(SEGREDO_RFC, lixo, { agora }).ok, false, `${lixo} não deveria passar`);
  }

  /* Espaço e hífen, porém, SÃO tolerados: há aplicativo que mostra "050 471", e
     recusar o que a pessoa lê na tela seria armadilha. */
  assert.equal(conferir(SEGREDO_RFC, "050 471", { agora }).ok, true);
  assert.equal(conferir(SEGREDO_RFC, "050-471", { agora }).ok, true);
  // Segredo corrompido no banco não pode derrubar a rota de login.
  assert.equal(conferir("isto não é base32 !!!", "050471", { agora }).ok, false);
  assert.equal(conferir(null, "050471", { agora }).ok, false);
});

test("o segredo gerado é base32 e serve para gerar código", () => {
  const segredo = gerarSegredo();
  assert.match(segredo, /^[A-Z2-7]+$/, "só o alfabeto do RFC 4648");
  assert.equal(segredo.length, 32, "20 bytes viram 32 caracteres");

  /* A prova que importa: o segredo que geramos passa pela nossa própria
     verificação. Um erro de base32 só apareceria aqui. */
  const agora = Date.now();
  const passo = passoAgora(agora);
  assert.ok(passo > 0);
  const { ok } = conferir(segredo, codigoDeReferencia(segredo, passo), { agora, janela: 0 });
  assert.equal(ok, true);
});

test("o segredo formatado continua sendo aceito", () => {
  const segredo = gerarSegredo();
  const agora = Date.now();
  const codigo = codigoDeReferencia(segredo, passoAgora(agora));
  /* A tela mostra o segredo em grupos de quatro para quem digita à mão; se a
     verificação recusasse o que nós mesmos exibimos, seria armadilha. */
  assert.equal(conferir(formatarSegredo(segredo), codigo, { agora, janela: 0 }).ok, true);
});

test("o otpauth:// leva o que o aplicativo precisa", () => {
  const uri = uriDeProvisionamento({ segredo: SEGREDO_RFC, conta: "super@omnimob.app" });
  assert.ok(uri.startsWith("otpauth://totp/"));
  assert.ok(uri.includes(`secret=${SEGREDO_RFC}`));
  assert.ok(uri.includes("issuer=Omnimob"));
  // SHA1/6/30 são o que os aplicativos realmente implementam — ver o serviço.
  assert.ok(uri.includes("algorithm=SHA1"));
  assert.ok(uri.includes("digits=6"));
  assert.ok(uri.includes("period=30"));
  // O rótulo agrupa por emissor, senão duas contas viram duas linhas iguais.
  assert.ok(decodeURIComponent(uri).includes("Omnimob:super@omnimob.app"));
});

test("os códigos de recuperação são únicos, sem letra ambígua, e só o hash sobra", () => {
  const { textos, hashes } = gerarCodigosDeRecuperacao();
  assert.equal(textos.length, 10);
  assert.equal(new Set(textos).size, 10, "dois códigos iguais dariam um uso a menos");
  assert.equal(new Set(hashes).size, 10);

  for (const texto of textos) {
    assert.match(texto, /^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/, "sem I, O, 0 e 1");
    // O hash é o que vai para o banco, e ele não pode devolver o texto.
    assert.equal(hashes.includes(hashDeRecuperacao(texto)), true);
    assert.equal(hashes.includes(texto), false);
  }

  /* Digitado sem hífen, em minúscula ou com espaço sobrando é o caso NORMAL:
     a pessoa está lendo de um papel. Recusar por causa disso seria travar quem
     já está sem o celular. */
  const primeiro = textos[0];
  assert.equal(hashDeRecuperacao(primeiro.replace("-", "").toLowerCase()), hashDeRecuperacao(primeiro));
  assert.equal(hashDeRecuperacao(` ${primeiro} `), hashDeRecuperacao(primeiro));
});

test("o roteador distingue código do aplicativo de código de recuperação", () => {
  // É por este teste que a rota sabe em qual dos dois caminhos entrar.
  assert.equal(pareceCodigoDeRecuperacao("050471"), false);
  assert.equal(pareceCodigoDeRecuperacao("ABCDE-FGHJK"), true);
  const { textos } = gerarCodigosDeRecuperacao(3);
  for (const texto of textos) assert.equal(pareceCodigoDeRecuperacao(texto), true);
});

/* Gera o código de um passo do jeito do RFC, para os testes que precisam de um
   código válido sem depender do relógio real. É a mesma conta do serviço,
   escrita à parte de propósito: se as duas divergirem, os vetores do RFC lá em
   cima é que decidem quem está errado. */
function codigoDeReferencia(segredoBase32, passo) {
  const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const limpo = segredoBase32.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let valor = 0;
  const bytes = [];
  for (const c of limpo) {
    valor = (valor << 5) | ALFABETO.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(passo));
  const mac = crypto.createHmac("sha1", Buffer.from(bytes)).update(contador).digest();
  const deslocamento = mac[mac.length - 1] & 0x0f;
  return String((mac.readUInt32BE(deslocamento) & 0x7fffffff) % 1000000).padStart(6, "0");
}
