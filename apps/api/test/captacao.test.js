import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  lerPayload, temContato, normalizarTelefone, assinaturaConfere,
  filtroDeDuplicata, tituloDoNegocio, JANELA_DUPLICATA_MS, _internos,
} from "../src/services/flow/captacao.js";

/* ────────────────────────────────────────────────────────────────────────────
   O QUE CHEGA PELA PORTA DE CAPTAÇÃO, E COMO A GENTE LÊ.

   Esta suíte não toca no banco — é a terceira da API assim, junto com a dos
   formatos de importação e a da IA da vitrine, e pela mesma razão: o risco aqui
   não é vazamento entre imobiliárias, é INTERPRETAÇÃO.

   A diferença para o `importacaoFormatos` é o tempo até o sintoma. Um preço
   lido da tag errada aparece na tela do acervo no mesmo dia. Um TELEFONE lido
   do campo errado não aparece em lugar nenhum: o lead entra bonito no funil, o
   corretor liga, o número não existe, e ele conclui que o interessado deu um
   telefone falso. Repete quinhentas vezes antes de alguém desconfiar da
   integração.

   Por isso os casos abaixo são quase todos formas de o corpo estar diferente do
   imaginado: o envelope conhecido sem contato dentro, o campo certo enterrado
   sob dois níveis que ninguém previu, o e-mail que só existe no meio de uma
   frase, o DDD que parece DDI, e a assinatura que confere sobre os bytes crus e
   não sobre o objeto reserializado.
   ──────────────────────────────────────────────────────────────────────────── */

/* ═══════════════════════════════════════════════════════════════════════════
   OS LEITORES POR CANAL
   ═══════════════════════════════════════════════════════════════════════════ */

test("ZAP: o envelope conhecido é lido pelo leitor do canal, não pelo genérico", () => {
  const lido = lerPayload("ZAP", {
    lead: { name: "Maria Souza", email: "maria@exemplo.com", phone: "(11) 98888-7777" },
    listing: { externalId: "AP-1042" },
    message: "Tenho interesse em visitar.",
  });
  assert.equal(lido.leitor, "zap");
  assert.equal(lido.nome, "Maria Souza");
  assert.equal(lido.email, "maria@exemplo.com");
  assert.equal(lido.telefone, "(11) 98888-7777");
  assert.equal(lido.referenciaImovel, "AP-1042");
});

test("VivaReal e OLX são o mesmo envelope, e o interessado pode vir em `contact`", () => {
  /* São o mesmo grupo e mandam a mesma coisa com nomes trocados. Ler só `lead`
     faria o VivaReal cair no genérico sem ninguém notar — ele até funcionaria,
     mas perderia o `listing`, e todo lead entraria sem imóvel. */
  const lido = lerPayload("VIVAREAL", {
    contact: { nome: "João", telefone: "11 3333-4444" },
    property: { external_id: "CA-77" },
  });
  assert.equal(lido.leitor, "vivareal");
  assert.equal(lido.nome, "João");
  assert.equal(lido.referenciaImovel, "CA-77");
});

test("Facebook Lead Ads: a lista de campos vira objeto, aninhada ou não", () => {
  /* O Gerenciador de Anúncios entrega `field_data` na raiz quando o teste é
     feito pela ferramenta deles, e enterrado em `entry[0].changes[0].value`
     quando é o webhook de verdade. Os dois precisam funcionar, senão a
     integração passa no teste e falha em produção. */
  const campos = [
    { name: "full_name", values: ["Ana Lima"] },
    { name: "email", values: ["ana@exemplo.com"] },
    { name: "phone_number", values: ["+5511977776666"] },
  ];

  const raso = lerPayload("FACEBOOK", { field_data: campos });
  const fundo = lerPayload("FACEBOOK", {
    entry: [{ changes: [{ value: { field_data: campos } }] }],
  });

  for (const lido of [raso, fundo]) {
    assert.equal(lido.leitor, "facebook");
    assert.equal(lido.nome, "Ana Lima");
    assert.equal(lido.email, "ana@exemplo.com");
    assert.equal(lido.telefone, "+5511977776666");
  }
});

test("o leitor do canal que reconhece o envelope mas não acha contato cede ao genérico", () => {
  /* A regra menos óbvia do arquivo, e a que mais protege. Um leitor específico
     que devolve tudo vazio é PIOR que o genérico, porque impede o genérico de
     tentar — e o lead vira "sem contato" com o e-mail ali, dois campos ao lado.
     Acontece toda vez que um portal renomeia um campo. */
  const lido = lerPayload("ZAP", {
    lead: { name: "Carlos" },
    interessado: { email_contato: "carlos@exemplo.com" },
  });
  assert.equal(lido.leitor, "generico", "o envelope foi reconhecido, mas estava vazio");
  assert.equal(lido.email, "carlos@exemplo.com");
});

test("canal sem leitor próprio vai direto para o genérico", () => {
  const lido = lerPayload("SITE", { nome: "Beto", email: "beto@exemplo.com" });
  assert.equal(lido.leitor, "generico");
  assert.equal(lido.nome, "Beto");
});

test("corpo que não é objeto não lança — vira leitor `nenhum` e tudo vazio", () => {
  /* Portal que manda texto puro, ou um corpo vazio. Lançar aqui viraria 500 na
     cara deles, e portal que recebe erro desativa a integração sozinho. */
  for (const corpo of [null, undefined, "", "texto puro", 42]) {
    const lido = lerPayload("ZAP", corpo);
    assert.equal(lido.leitor, "nenhum");
    assert.equal(lido.email, null);
    assert.equal(lido.telefone, null);
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   O LEITOR GENÉRICO — o que faz "cole esta URL no seu integrador" funcionar
   ═══════════════════════════════════════════════════════════════════════════ */

test("o genérico acha o campo enterrado sob nomes que ninguém previu", () => {
  const lido = lerPayload("OUTRO", {
    payload: { data: { customer: { emailAddress: "zeca@exemplo.com", celular: "(21) 99999-1111" } } },
  });
  assert.equal(lido.email, "zeca@exemplo.com");
  assert.equal(lido.telefone, "(21) 99999-1111");
});

test("sem nenhum campo com nome reconhecível, o e-mail é varrido do texto", () => {
  /* A última linha de defesa. Formulário que manda tudo numa frase só existe, e
     é melhor pescar o endereço de lá do que recusar o lead. */
  const lido = lerPayload("OUTRO", {
    assunto: "Contato pelo site",
    corpo_livre: "Olá, me chamem em rita@exemplo.com ou (31) 98765-4321.",
  });
  assert.equal(lido.email, "rita@exemplo.com");
  assert.equal(lido.telefone, "(31) 98765-4321");
});

test("o campo do próprio nó ganha do campo aninhado", () => {
  /* `achar` varre os valores rasos de cada nó ANTES de descer. Sem isso, o
     e-mail do CORRETOR responsável — que vem junto no envelope de vários
     portais, mais fundo — poderia ganhar do e-mail do interessado, e o lead
     chegaria com o contato de quem trabalha na imobiliária. */
  const achado = _internos.achar(
    { email: "interessado@exemplo.com", imovel: { corretor: { email: "corretor@imobiliaria.com" } } },
    ["email"],
  );
  assert.equal(achado, "interessado@exemplo.com");
});

test("oito dígitos soltos não viram telefone", () => {
  /* Um CEP, um valor e uma data casam com oito dígitos. O DDD é o que separa
     telefone de qualquer outro número do corpo — sem ele, todo lead chegaria
     com o CEP do imóvel no campo do celular. */
  const lido = lerPayload("OUTRO", { cep: "01310100", contato: "fulano@exemplo.com" });
  assert.equal(lido.telefone, null);
  assert.equal(lido.email, "fulano@exemplo.com");
});

test("a mensagem cabe em 2000 caracteres; os outros campos, não", () => {
  /* Limites diferentes de propósito: a mensagem é o que o interessado escreveu
     e cortar em 300 perderia o pedido dele. Nome e referência em 300 e 80 são
     tetos contra corpo malicioso, não contra texto legítimo. */
  const lido = lerPayload("OUTRO", {
    nome: "N".repeat(500),
    mensagem: "M".repeat(5000),
    codigo: "C".repeat(200),
    email: "x@exemplo.com",
  });
  assert.equal(lido.nome.length, 300);
  assert.equal(lido.mensagem.length, 2000);
  assert.equal(lido.referenciaImovel.length, 80);
});

/* ═══════════════════════════════════════════════════════════════════════════
   TELEFONE — o campo cujo erro não tem sintoma
   ═══════════════════════════════════════════════════════════════════════════ */

test("o DDI 55 sai; o DDD 55 fica", () => {
  /* O caso que quebra a regra ingênua "começa com 55, tira os dois primeiros".
     55 é DDD do Rio Grande do Sul (Santa Maria, Uruguaiana). Um fixo de lá tem
     exatamente 10 dígitos começando em 55, e comê-los deixaria "33334444" — um
     número que não existe, para um lead que o corretor nunca alcançaria.

     O que decide é o COMPRIMENTO: acima de 11 dígitos há DDI sobrando. */
  assert.equal(normalizarTelefone("+55 (11) 98888-7777"), "11988887777");
  assert.equal(normalizarTelefone("5533334444"), "5533334444", "DDD 55 do RS, sem DDI");
  assert.equal(normalizarTelefone("55 55 3333-4444"), "5533334444", "DDI + DDD 55");
});

test("a máscara some, e o que não tem dígito nenhum vira nulo", () => {
  assert.equal(normalizarTelefone("(11) 3333-4444"), "1133334444");
  assert.equal(normalizarTelefone("11 9 8888 7777"), "11988887777");
  assert.equal(normalizarTelefone(null), null);
  assert.equal(normalizarTelefone(""), null);
  assert.equal(normalizarTelefone("sem número"), null);
});

test("sem e-mail nem telefone não há lead", () => {
  assert.equal(temContato({ email: "a@b.com" }), true);
  assert.equal(temContato({ telefone: "(11) 98888-7777" }), true);
  assert.equal(temContato({ nome: "Só o nome", mensagem: "oi" }), false);
  assert.equal(temContato({ telefone: "sem número" }), false);
  assert.equal(temContato(null), false);
});

/* ═══════════════════════════════════════════════════════════════════════════
   A ASSINATURA — a segunda camada da porta
   ═══════════════════════════════════════════════════════════════════════════ */

const SEGREDO = "segredo-de-teste-do-hmac";
const assinar = (corpo) => crypto.createHmac("sha256", SEGREDO).update(corpo).digest("hex");

test("sem assinatura no pedido, ou sem segredo na fonte, não há o que conferir", () => {
  /* Nem todo portal assina. Quando não assina, a CHAVE é a autenticação — e a
     decisão de EXIGIR a assinatura é de quem chama, não daqui. Devolver
     `valida: false` neste caso trancaria toda fonte que não assina. */
  assert.deepEqual(assinaturaConfere("{}", SEGREDO, null), { conferida: false, valida: true });
  assert.deepEqual(assinaturaConfere("{}", null, "abc"), { conferida: false, valida: true });
});

test("confere com `sha256=` na frente e sem", () => {
  /* Os dois formatos aparecem no mundo real — o Facebook manda com prefixo.
     Recusar por causa dele produziria um "não funciona" sem sintoma nenhum. */
  const corpo = '{"lead":{"email":"a@b.com"}}';
  const hex = assinar(corpo);
  assert.deepEqual(assinaturaConfere(corpo, SEGREDO, hex), { conferida: true, valida: true });
  assert.deepEqual(assinaturaConfere(corpo, SEGREDO, `sha256=${hex}`), { conferida: true, valida: true });
  assert.deepEqual(assinaturaConfere(corpo, SEGREDO, `SHA256=${hex}`), { conferida: true, valida: true });
});

test("corpo alterado no caminho não passa", () => {
  const corpo = '{"lead":{"email":"a@b.com"}}';
  const adulterado = '{"lead":{"email":"invasor@b.com"}}';
  assert.deepEqual(assinaturaConfere(adulterado, SEGREDO, assinar(corpo)), { conferida: true, valida: false });
});

test("assinatura de tamanho errado é recusada sem lançar", () => {
  /* `timingSafeEqual` LANÇA quando os buffers têm tamanhos diferentes. Sem a
     conferência de comprimento antes, mandar `x-signature: 1` derrubaria a rota
     com 500 — e um 500 é exatamente o que faz o portal desativar a integração. */
  for (const lixo of ["1", "não é hexadecimal", "a".repeat(63), "a".repeat(65)]) {
    assert.doesNotThrow(() => assinaturaConfere("{}", SEGREDO, lixo));
    assert.equal(assinaturaConfere("{}", SEGREDO, lixo).valida, false);
  }
});

test("a assinatura é sobre os BYTES CRUS, não sobre o objeto reserializado", () => {
  /* A razão de a rota guardar `req.rawBody` em vez de usar `req.body`. O JSON
     que chega tem espaçamento e ordem de chaves próprios; passar por
     `JSON.parse` + `JSON.stringify` devolve outro texto, com o mesmo
     significado e outro HMAC. A assinatura nunca bateria, e o sintoma seria
     "o portal X assina errado" — quando quem estava errado era a gente. */
  const cru = '{ "email": "a@b.com",\n  "nome": "Ana" }';
  const reserializado = JSON.stringify(JSON.parse(cru));
  assert.notEqual(cru, reserializado);

  assert.equal(assinaturaConfere(cru, SEGREDO, assinar(cru)).valida, true);
  assert.equal(assinaturaConfere(reserializado, SEGREDO, assinar(cru)).valida, false);
});

/* ═══════════════════════════════════════════════════════════════════════════
   DUPLICATA — a rajada técnica, e só ela
   ═══════════════════════════════════════════════════════════════════════════ */

test("sem contato nenhum não há como reconhecer repetido", () => {
  assert.equal(filtroDeDuplicata({ tenantId: "t1", email: null, telefone: null }), null);
});

test("o filtro casa por e-mail OU telefone, dentro da janela e dentro do tenant", () => {
  const agora = new Date("2026-08-24T12:00:00Z");
  const f = filtroDeDuplicata({
    tenantId: "t1", propertyId: "p1",
    email: "maria@exemplo.com", telefone: "(11) 98888-7777",
    agora,
  });

  assert.equal(f.tenantId, "t1");
  assert.equal(f.propertyId, "p1");
  assert.deepEqual(f.OR, [
    { email: "maria@exemplo.com" },
    /* Os últimos 8 dígitos: o mesmo número chega com e sem o 9, com e sem DDI,
       conforme o portal. Comparar inteiro deixaria passar a mesma pessoa. */
    { phone: { contains: "88887777" } },
  ]);
  assert.equal(f.createdAt.gte.getTime(), agora.getTime() - JANELA_DUPLICATA_MS);
});

test("a janela é de seis horas — quem volta dois dias depois é lead novo", () => {
  /* O sinal mais forte que existe é a pessoa procurar de novo. Uma janela larga
     engoliria isso como duplicata e o corretor nunca saberia. O que a janela
     evita é o reenvio técnico do portal, não o reencontro do interessado. */
  assert.equal(JANELA_DUPLICATA_MS, 6 * 60 * 60 * 1000);
});

test("sem imóvel identificado, a duplicata não é restrita por imóvel", () => {
  const f = filtroDeDuplicata({ tenantId: "t1", email: "a@b.com" });
  assert.ok(!("propertyId" in f), "restringir por um imóvel que não sabemos qual é não faria sentido");
});

test("a mesma pessoa em DOIS imóveis são dois leads", () => {
  /* Sem o imóvel no filtro, o segundo apartamento nunca receberia atendimento:
     o interesse dele viraria "duplicado" do primeiro. */
  const a = filtroDeDuplicata({ tenantId: "t1", propertyId: "p1", email: "maria@exemplo.com" });
  const b = filtroDeDuplicata({ tenantId: "t1", propertyId: "p2", email: "maria@exemplo.com" });
  assert.notEqual(a.propertyId, b.propertyId);
});

/* ═══════════════════════════════════════════════════════════════════════════
   O NOME NO CARTÃO DO FUNIL
   ═══════════════════════════════════════════════════════════════════════════ */

test("lead sem nome ganha um título honesto, não uma linha em branco", () => {
  assert.equal(tituloDoNegocio({ nome: null, imovelTitulo: null }), "Interessado sem nome");
  assert.equal(
    tituloDoNegocio({ nome: "  Maria   Souza ", imovelTitulo: "Apartamento no Centro" }),
    "Maria Souza — Apartamento no Centro",
  );
  assert.equal(tituloDoNegocio({ nome: "", imovelTitulo: "Casa" }), "Interessado sem nome — Casa");
});
