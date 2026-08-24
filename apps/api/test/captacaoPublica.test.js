import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { captacaoPublicaRouter, captacaoCorpoInvalido } from "../src/routes/captacaoPublicaRoutes.js";
import {
  prisma, limparRestos, criarImobiliariaDeTeste, apagarImobiliaria, subirApi,
} from "./helpers.js";

/* ────────────────────────────────────────────────────────────────────────────
   A PORTA DE ENTRADA DE LEAD — a única rota pública de ESCRITA do Flow.

   Quem chama é um robô do ZAP. Ele não tem sessão, não tem cargo, e não lê
   mensagem de erro: ele lê o código de status, e quando vê erro DESATIVA a
   integração por conta própria — sem avisar ninguém. A imobiliária descobre
   três dias depois, quando estranha o silêncio.

   Por isso o cabeçalho da rota tem três regras de ouro, e é isto que esta suíte
   guarda:

     1. RESPONDER 200 QUASE SEMPRE. Corpo que não entendemos, lead sem contato,
        conta sem o módulo, plano insuficiente, defeito nosso — tudo 200, com o
        motivo no corpo. Os dois únicos erros de verdade são chave inválida
        (404) e assinatura errada (401), porque nos dois casos quem chama não é
        quem diz ser.

     2. GRAVAR O CORPO CRU, SEMPRE. Antes de qualquer interpretação, e também
        nas recusas. Sem o corpo original não há como descobrir POR QUE um
        portal parou — e é justamente nas recusas que a resposta está.

     3. NUNCA DERRUBAR POR CAUSA DO QUE VEM DEPOIS. O lead é o ativo; abrir
        negócio, distribuir e avisar o CRM são conveniência.

   Um teste de função pura não pega nada disso: o que está sob prova aqui é a
   junção rota + query + schema. Por isso, integração, contra o banco de dev —
   o mesmo raciocínio do `helpers.js`.
   ──────────────────────────────────────────────────────────────────────────── */

let api;
let A;
let B;
let imovelA;
let imovelB;
let fonte;

const SEGREDO = crypto.randomBytes(32).toString("hex");

async function criarFonte(tenantId, extra = {}) {
  return prisma.fonteCaptacao.create({
    data: {
      tenantId,
      nome: extra.nome || "ZAP Imóveis",
      canal: extra.canal || "ZAP",
      chave: crypto.randomBytes(24).toString("base64url"),
      segredo: extra.segredo ?? SEGREDO,
      ...extra,
    },
  });
}

async function criarImovel(tenantId, origemExterna, title = "Apartamento no Centro") {
  return prisma.property.create({
    data: {
      tenantId, title, description: "Imóvel de teste",
      price: 350000, address: "Rua A, 100", origemExterna, status: "ACTIVE",
    },
  });
}

/* Manda os BYTES que o teste escolher. É o que permite assinar o corpo exato e
   provar que a conferência não passa pelo `JSON.stringify` de volta. */
async function postarCru(chave, corpoTexto, headers = {}) {
  const r = await fetch(`${api.base}/api/captacao/${chave}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: corpoTexto,
  });
  const json = await r.json().catch(() => null);
  return { status: r.status, json };
}

const postar = (chave, corpo, headers) => postarCru(chave, JSON.stringify(corpo), headers);
const assinar = (corpoTexto, segredo = SEGREDO) =>
  crypto.createHmac("sha256", segredo).update(corpoTexto).digest("hex");

/* O último evento registrado para uma fonte — é por ele que a imobiliária
   descobre o que aconteceu, então quase todo teste daqui olha para ele. */
const ultimoEvento = (fonteId) =>
  prisma.captacaoEvento.findFirst({ where: { fonteId }, orderBy: { createdAt: "desc" } });

test.before(async () => {
  await limparRestos();
  /* O tratador de erro entra DEPOIS do router, como no `server.js`. A ordem
     das chaves é a ordem da montagem, e sem ele o corpo ilegível subiria para
     o tratador geral do Express — que é justamente o defeito sob teste. */
  api = await subirApi({
    "/api/captacao": captacaoPublicaRouter,
    "/api/captacao/:chave": captacaoCorpoInvalido,
  });

  A = await criarImobiliariaDeTeste();
  B = await criarImobiliariaDeTeste();
  for (const t of [A, B]) {
    await prisma.tenant.update({
      where: { id: t.tenant.id },
      data: { modulos: ["HUB", "FLOW"] },
    });
  }

  imovelA = await criarImovel(A.tenant.id, "AP-1042");
  imovelB = await criarImovel(B.tenant.id, "AP-9999", "Casa da outra imobiliária");
  fonte = await criarFonte(A.tenant.id);
});

test.after(async () => {
  await api?.fechar();
  if (A) await apagarImobiliaria(A.tenant.id);
  if (B) await apagarImobiliaria(B.tenant.id);
  await limparRestos();
  await prisma.$disconnect();
});

/* ═══════════════════════════════════════════════════════════════════════════
   OS DOIS ÚNICOS ERROS DE VERDADE
   ═══════════════════════════════════════════════════════════════════════════ */

test("chave inexistente é 404, e não 403", () => {
  /* 403 significaria "existe, mas você não pode" — e confirmaria a chave para
     quem está tentando adivinhar. O 404 não distingue chave errada de fonte que
     nunca existiu, que é exatamente o que se quer. */
  return postar("chave-que-nao-existe", { email: "a@b.com" }).then((r) => {
    assert.equal(r.status, 404);
  });
});

test("assinatura inválida é 401 e fica registrada no diagnóstico", async () => {
  const corpo = JSON.stringify({ lead: { email: "assinatura@exemplo.com" } });
  const r = await postarCru(fonte.chave, corpo, { "x-omnimob-assinatura": assinar("outro corpo") });

  assert.equal(r.status, 401);

  /* A recusa por assinatura é a que MAIS precisa aparecer na tela: significa
     que alguém está batendo na porta com a chave certa e o segredo errado. */
  const ev = await ultimoEvento(fonte.id);
  assert.equal(ev.status, "RECUSADO");
  assert.equal(ev.erro, "Assinatura inválida.");
  assert.deepEqual(ev.payload, { lead: { email: "assinatura@exemplo.com" } });
});

test("a assinatura confere sobre os bytes exatos que chegaram", async () => {
  /* O teste que prova o `req.rawBody`. O corpo abaixo tem espaçamento e ordem
     de chaves próprios; se a rota recalculasse o HMAC sobre
     `JSON.stringify(req.body)`, ele viraria outro texto e a assinatura NUNCA
     bateria. O sintoma em produção seria "o ZAP assina errado" — quando quem
     estaria errado era a gente. */
  const cru = '{ "lead":  {"email": "bytes@exemplo.com",\n "phone": "(11) 96666-5555"} }';
  assert.notEqual(cru, JSON.stringify(JSON.parse(cru)), "o corpo precisa ser reserializável de outro jeito");

  const r = await postarCru(fonte.chave, cru, { "x-omnimob-assinatura": `sha256=${assinar(cru)}` });
  assert.equal(r.status, 200);
  assert.equal(r.json.recebido, true);
});

test("assinatura de tamanho errado é 401, não 500", async () => {
  /* `timingSafeEqual` lança com buffers de tamanhos diferentes. Sem a
     conferência de comprimento, um cabeçalho de um caractere derrubaria a rota
     — e um 500 é o que faz o portal desligar a integração. */
  const r = await postarCru(fonte.chave, JSON.stringify({ email: "x@y.com" }), {
    "x-signature": "1",
  });
  assert.equal(r.status, 401);
});

/* ═══════════════════════════════════════════════════════════════════════════
   REGRA 1 — TUDO O MAIS É 200, COM O MOTIVO NO CORPO
   ═══════════════════════════════════════════════════════════════════════════ */

test("lead sem e-mail nem telefone: 200 com motivo, e vira linha no diagnóstico", async () => {
  /* É assim que a imobiliária descobre que o formulário do portal está mandando
     o campo errado. Recusar com 4xx esconderia o problema atrás de uma
     integração desligada. */
  const r = await postar(fonte.chave, { lead: { name: "Só o nome" } });
  assert.equal(r.status, 200);
  assert.equal(r.json.recebido, false);
  assert.equal(r.json.motivo, "sem-contato");

  const ev = await ultimoEvento(fonte.id);
  assert.equal(ev.status, "RECUSADO");
  assert.deepEqual(ev.payload, { lead: { name: "Só o nome" } }, "o corpo cru precisa estar lá");
});

test("fonte desativada: 200 com motivo", async () => {
  const desligada = await criarFonte(A.tenant.id, { nome: "Desligada", ativa: false });
  const r = await postar(desligada.chave, { email: "desligada@exemplo.com" });
  assert.equal(r.status, 200);
  assert.equal(r.json.motivo, "fonte-inativa");
});

test("conta sem o módulo Flow: 200 com motivo — e NÃO o 403 do resto do Flow", async () => {
  /* Diferença deliberada. Em `/api/flow/*` quem está do outro lado é uma pessoa
     logada, e 403 com `moduloNaoContratado` faz a tela dizer "fale com o
     comercial". Aqui do outro lado tem um robô, e 403 faria o portal desligar
     a integração — que é o pior desfecho possível para um problema comercial. */
  await prisma.tenant.update({ where: { id: A.tenant.id }, data: { modulos: ["HUB"] } });
  try {
    const r = await postar(fonte.chave, { email: "sem-modulo@exemplo.com" });
    assert.equal(r.status, 200);
    assert.equal(r.json.recebido, false);
    assert.equal(r.json.motivo, "modulo-nao-contratado");
  } finally {
    await prisma.tenant.update({ where: { id: A.tenant.id }, data: { modulos: ["HUB", "FLOW"] } });
  }
});

test("plano abaixo de Profissional: 200 com motivo", async () => {
  const basico = await criarImobiliariaDeTeste({ plano: "BASICO" });
  try {
    await prisma.tenant.update({
      where: { id: basico.tenant.id }, data: { modulos: ["HUB", "FLOW"] },
    });
    const f = await criarFonte(basico.tenant.id);
    const r = await postar(f.chave, { email: "basico@exemplo.com" });
    assert.equal(r.status, 200);
    assert.equal(r.json.motivo, "plano-insuficiente");
  } finally {
    await apagarImobiliaria(basico.tenant.id);
  }
});

test("conta desativada: 200 com motivo", async () => {
  await prisma.tenant.update({ where: { id: A.tenant.id }, data: { ativo: false } });
  try {
    const r = await postar(fonte.chave, { email: "inativa@exemplo.com" });
    assert.equal(r.status, 200);
    assert.equal(r.json.motivo, "conta-inativa");
  } finally {
    await prisma.tenant.update({ where: { id: A.tenant.id }, data: { ativo: true } });
  }
});

test("corpo com content-type que o parser ignora vira recusa registrada, não erro", async () => {
  /* Integrador mal configurado manda formulário urlencoded, ou texto puro. O
     `express.json` não interpreta nada disso e entrega um objeto VAZIO — ele faz
     `req.body = req.body || {}` antes mesmo de olhar o content-type. Então a
     rota recebe `{}`, não entende, e precisa tratar como "não entendi" em vez
     de estourar.

     Consequência de projeto: o corpo original se perde aqui. O evento registra
     `{}`, e a imobiliária vê que CHEGOU alguma coisa e foi recusada — que é o
     mínimo para desconfiar do cabeçalho que o integrador está mandando. */
  const r = await postarCru(fonte.chave, "nome=Maria&email=maria@exemplo.com", {
    "Content-Type": "text/plain",
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.motivo, "sem-contato");

  const ev = await ultimoEvento(fonte.id);
  assert.equal(ev.status, "RECUSADO");
  assert.deepEqual(ev.payload, {});
});

test("acima do teto por hora: 200 com motivo, e registrado", async () => {
  /* Não é rate limit de segurança — é contenção de laço. Integrador que reenvia
     em ciclo já encheu o banco de cliente de gente boa. Acima do teto a
     resposta continua 200 (regra 1) e o diagnóstico mostra exatamente o que
     aconteceu, senão o sintoma seria "sumiram os leads". */
  const cheia = await criarFonte(A.tenant.id, { nome: "No teto" });
  await prisma.captacaoEvento.createMany({
    data: Array.from({ length: 300 }, () => ({
      tenantId: A.tenant.id, fonteId: cheia.id, payload: {}, status: "ACEITO",
    })),
  });

  const r = await postar(cheia.chave, { email: "teto@exemplo.com" });
  assert.equal(r.status, 200);
  assert.equal(r.json.motivo, "teto-por-hora");

  const ev = await ultimoEvento(cheia.id);
  assert.equal(ev.status, "RECUSADO");
  assert.match(ev.erro, /teto de 300/i);
});

/* ═══════════════════════════════════════════════════════════════════════════
   O CAMINHO FELIZ — e onde o lead vai parar
   ═══════════════════════════════════════════════════════════════════════════ */

test("lead reconhecido entra na MESMA tabela da vitrine, com o telefone normalizado", async () => {
  /* Não existe uma segunda caixa de entrada. Duas divergiriam no primeiro mês e
     a imobiliária passaria a ter dois números diferentes para "quantos
     interessados chegaram ontem". */
  const r = await postar(fonte.chave, {
    lead: { name: "Maria Souza", email: "maria.feliz@exemplo.com", phone: "+55 (11) 98888-7777" },
    listing: { externalId: "AP-1042" },
    message: "Quero visitar no sábado.",
  });

  assert.equal(r.status, 200);
  assert.equal(r.json.recebido, true);
  assert.equal(r.json.imovelReconhecido, true);

  const lead = await prisma.propertyLead.findUnique({ where: { id: r.json.leadId } });
  assert.equal(lead.tenantId, A.tenant.id);
  assert.equal(lead.propertyId, imovelA.id, "casou pelo `origemExterna` que o portal conhece");
  assert.equal(lead.name, "Maria Souza");
  assert.equal(lead.phone, "11988887777", "gravado sem máscara e sem DDI");
  assert.equal(lead.source, "flow:zap", "a origem diz que veio do Flow, e por qual canal");
  assert.ok(lead.responsavelId, "lead sem dono é lead que ninguém atende");

  const negocio = await prisma.negocio.findUnique({ where: { id: r.json.negocioId } });
  assert.equal(negocio.estagio, "LEAD");
  assert.equal(negocio.leadId, lead.id);
  assert.equal(negocio.propertyId, imovelA.id);
  assert.equal(negocio.titulo, "Maria Souza — Apartamento no Centro");

  const ev = await ultimoEvento(fonte.id);
  assert.equal(ev.status, "ACEITO");
  assert.equal(ev.leadId, lead.id);
  assert.equal(ev.negocioId, negocio.id);
});

test("o mesmo lead reenviado é reconhecido, e não abre um segundo negócio", async () => {
  /* Portais reenviam: o ZAP quando a primeira entrega dá timeout, o Facebook
     por até 36 horas, e o integrador do cliente quando alguém aperta F5. Sem
     isto, o funil enche de cartões repetidos e o corretor liga duas vezes para
     a mesma pessoa. */
  const corpo = {
    lead: { name: "Repetido", email: "repetido@exemplo.com", phone: "(11) 95555-4444" },
    listing: { externalId: "AP-1042" },
  };

  const primeiro = await postar(fonte.chave, corpo);
  assert.equal(primeiro.json.recebido, true);
  assert.ok(!primeiro.json.duplicado);

  const segundo = await postar(fonte.chave, corpo);
  assert.equal(segundo.status, 200);
  assert.equal(segundo.json.duplicado, true);
  assert.equal(segundo.json.leadId, primeiro.json.leadId, "aponta para o lead que já existia");

  const negocios = await prisma.negocio.count({ where: { leadId: primeiro.json.leadId } });
  assert.equal(negocios, 1);

  const ev = await ultimoEvento(fonte.id);
  assert.equal(ev.status, "DUPLICADO");
});

test("o mesmo telefone com máscara diferente ainda é o mesmo interessado", async () => {
  /* O portal manda "+5511977771111" hoje e "(11) 97777-1111" amanhã. Comparar
     texto deixaria passar o mesmo lead duas vezes. */
  const base = { listing: { externalId: "AP-1042" } };
  const um = await postar(fonte.chave, { ...base, lead: { name: "Máscara", phone: "+5511977771111" } });
  assert.equal(um.json.recebido, true);

  const dois = await postar(fonte.chave, { ...base, lead: { name: "Máscara", phone: "(11) 97777-1111" } });
  assert.equal(dois.json.duplicado, true);
});

test("a mesma pessoa em outro imóvel é um lead novo", async () => {
  /* A janela de duplicata é por imóvel. Sem isso, quem pergunta sobre dois
     apartamentos vira um lead só, e o segundo imóvel nunca é atendido. */
  const outro = await criarImovel(A.tenant.id, "AP-2000", "Cobertura");
  const corpo = (ref) => ({
    lead: { name: "Dois imóveis", email: "dois.imoveis@exemplo.com" },
    listing: { externalId: ref },
  });

  const um = await postar(fonte.chave, corpo("AP-1042"));
  const dois = await postar(fonte.chave, corpo("AP-2000"));

  assert.equal(um.json.recebido, true);
  assert.ok(!dois.json.duplicado, "imóvel diferente, interesse diferente");
  assert.notEqual(dois.json.leadId, um.json.leadId);

  const lead = await prisma.propertyLead.findUnique({ where: { id: dois.json.leadId } });
  assert.equal(lead.propertyId, outro.id);
});

test("imóvel não reconhecido: o lead não se perde, vira negócio sem imóvel", async () => {
  /* `PropertyLead.propertyId` é obrigatório — a relação nasceu na vitrine, onde
     sempre há imóvel. Sem imóvel identificado o lead não pode ser gravado, e a
     saída é o negócio direto. É o caso menos comum e o menos ruim: o contato
     chega ao corretor de qualquer jeito, que é o que importa. */
  const r = await postar(fonte.chave, {
    lead: { name: "Sem imóvel", email: "sem.imovel@exemplo.com" },
    listing: { externalId: "REFERENCIA-QUE-NAO-TEMOS" },
  });

  assert.equal(r.status, 200);
  assert.equal(r.json.recebido, true);
  assert.equal(r.json.imovelReconhecido, false);
  assert.equal(r.json.leadId, null);
  assert.ok(r.json.negocioId, "o negócio é o que impede o contato de se perder");

  const negocio = await prisma.negocio.findUnique({ where: { id: r.json.negocioId } });
  assert.equal(negocio.propertyId, null);
  assert.equal(negocio.titulo, "Sem imóvel");
});

test("fonte com `abrirNegocio` desligado registra o lead e não enche o funil", async () => {
  /* Uma campanha de captação de PROPRIETÁRIO encheria o funil de VENDAS de
     gente que quer anunciar, não comprar. */
  const soLead = await criarFonte(A.tenant.id, { nome: "Proprietários", abrirNegocio: false });
  const r = await postar(soLead.chave, {
    lead: { name: "Proprietário", email: "proprietario@exemplo.com" },
    listing: { externalId: "AP-1042" },
  });

  assert.equal(r.json.recebido, true);
  assert.ok(r.json.leadId);
  assert.equal(r.json.negocioId, null);
});

/* ═══════════════════════════════════════════════════════════════════════════
   ISOLAMENTO — a chave de A não alcança nada de B
   ═══════════════════════════════════════════════════════════════════════════ */

test("a referência de imóvel da OUTRA imobiliária não casa", async () => {
  /* O `origemExterna` vem do sistema antigo de cada cliente, e nada impede duas
     imobiliárias de usarem "AP-9999". Sem o `tenantId` na consulta, o lead de A
     entraria apontando para o imóvel de B — e apareceria na tela de B. */
  const r = await postar(fonte.chave, {
    lead: { name: "Curioso", email: "curioso@exemplo.com" },
    listing: { externalId: "AP-9999" },
  });

  assert.equal(r.json.imovelReconhecido, false, "AP-9999 é da outra imobiliária");

  const negocio = await prisma.negocio.findUnique({ where: { id: r.json.negocioId } });
  assert.equal(negocio.tenantId, A.tenant.id);
  assert.notEqual(negocio.propertyId, imovelB.id);
});

test("o evento e o lead nascem no tenant da FONTE, não no do corpo", async () => {
  /* O corpo é do outro lado do mundo e pode dizer qualquer coisa. Quem decide
     de quem é o lead é a chave. */
  const r = await postar(fonte.chave, {
    tenantId: B.tenant.id,
    lead: { name: "Tenant forjado", email: "forjado@exemplo.com" },
    listing: { externalId: "AP-1042" },
  });

  const lead = await prisma.propertyLead.findUnique({ where: { id: r.json.leadId } });
  assert.equal(lead.tenantId, A.tenant.id);

  const daOutra = await prisma.captacaoEvento.count({ where: { tenantId: B.tenant.id } });
  assert.equal(daOutra, 0);
});

/* ═══════════════════════════════════════════════════════════════════════════
   O GET — a verificação que os provedores exigem antes de ativar
   ═══════════════════════════════════════════════════════════════════════════ */

test("GET confirma que a porta existe, sem contar nada sobre a imobiliária", async () => {
  const r = await fetch(`${api.base}/api/captacao/${fonte.chave}`);
  const json = await r.json();
  assert.equal(r.status, 200);
  assert.deepEqual(json, { ok: true, canal: "ZAP", ativa: true });
  assert.ok(!JSON.stringify(json).includes(A.tenant.id));
  assert.ok(!JSON.stringify(json).includes(A.slug));
});

test("GET devolve o `hub.challenge` do Facebook como texto cru", async () => {
  /* O Facebook não ativa o webhook sem receber o desafio de volta, exatamente
     como mandou. Devolver JSON aqui deixaria a integração impossível de ligar. */
  const r = await fetch(`${api.base}/api/captacao/${fonte.chave}?hub.challenge=1234567890`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type") || "", /text\/plain/);
  assert.equal(await r.text(), "1234567890");
});

/* ═══════════════════════════════════════════════════════════════════════════
   OS CONTADORES DA TELA
   ═══════════════════════════════════════════════════════════════════════════ */

test("aceito e recusado somam em contadores separados", async () => {
  const f = await criarFonte(A.tenant.id, { nome: "Contagem" });

  await postar(f.chave, { lead: { email: "contagem@exemplo.com" }, listing: { externalId: "AP-1042" } });
  await postar(f.chave, { lead: { name: "sem contato nenhum" } });

  const depois = await prisma.fonteCaptacao.findUnique({ where: { id: f.id } });
  assert.equal(depois.totalRecebido, 1);
  assert.equal(depois.totalRecusado, 1);
  assert.ok(depois.ultimoEventoEm, "a tela mostra quando o portal falou pela última vez");
});

/* ═══════════════════════════════════════════════════════════════════════════
   O CORPO QUE NEM CHEGA A SER JSON
   ═══════════════════════════════════════════════════════════════════════════ */

test("corpo ilegível é 200 com o corpo CRU registrado, e não 500 sem rastro", async () => {
  /* O `express.json()` lança antes de a rota existir. Sem o tratador, o erro
     subia para o `server.js`, virava 500, e o portal desativava a integração —
     enquanto a tela de diagnóstico ficava vazia, porque nenhum evento chegou a
     ser gravado. A imobiliária perdia todos os leads seguintes sem uma linha
     que explicasse o silêncio.

     O corpo cru sobrevive porque o `verify` do body-parser roda ANTES do
     `JSON.parse`. É o que torna a regra 2 possível justamente no caso em que
     ela mais importa: para descobrir o que o portal mudou, é preciso ver o que
     ele mandou. */
  const truncado = '{"lead":{"email":';
  const r = await postarCru(fonte.chave, truncado);

  assert.equal(r.status, 200);
  assert.equal(r.json.recebido, false);
  assert.equal(r.json.motivo, "corpo-invalido");

  const ev = await ultimoEvento(fonte.id);
  assert.equal(ev.status, "ERRO");
  assert.deepEqual(ev.payload, { bruto: truncado }, "o corpo original precisa estar guardado");
  assert.match(ev.erro, /ileg/i);
});

test("corpo ilegível em chave inexistente continua 404", async () => {
  /* O tratador não pode virar uma porta que confirma chaves: sem fonte não há
     o que registrar nem a quem responder 200. */
  const r = await postarCru("chave-que-nao-existe", '{"lead":');
  assert.equal(r.status, 404);
});
