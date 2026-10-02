import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { prisma, criarImobiliariaDeTeste, apagarImobiliaria, subirApi } from "./helpers.js";
import { chamadoRouter } from "../src/routes/chamadoRoutes.js";
import { adminRouter } from "../src/routes/adminRoutes.js";
import { CARGO_ADMIN_PLATAFORMA, permissoesCompletas } from "../src/services/permissoesSuperAdmin.js";

/* ────────────────────────────────────────────────────────────────────────────
   A conversa do chamado, na junção rota + query.

   Dois riscos, e os dois são silenciosos:

   1. VAZAMENTO. O número do chamado é sequencial e GLOBAL — o #12 de uma
      imobiliária é vizinho do #13 de outra. Se a rota do cliente buscar pelo
      número sem o tenant, A lê e escreve na conversa da B. O teste pede o
      chamado da B pelo número real, na leitura e na escrita, e espera 404.

   2. RÉGUA DE STATUS DIVERGENTE. Cliente e suporte mexem no mesmo status por
      rotas diferentes; se cada uma tivesse a sua regra, o chamado ficaria
      "aguardando você" de um lado e "em atendimento" do outro. O teste
      percorre o ciclo inteiro pelos dois lados.

   E três que vieram com o porte do VYA:

   3. DENTRO DO TENANT, CADA UM VÊ OS SEUS. O corretor não lê o chamado do
      colega nem pelo número; o Administrador vê os da equipe só com `todos`.
   4. A NOVIDADE. Resposta do suporte acende o contador do dono; abrir o
      chamado o apaga — e a própria marca de visto não pode virar novidade.
   5. O CHAMADO INTERNO. Nasce interno pelo TOKEN da equipe (nunca pelo corpo),
      some para o Administrador do cliente logado por conta própria e para o
      cargo de suporte que não é Administrador da plataforma.
   ──────────────────────────────────────────────────────────────────────────── */

const JWT_SECRET = process.env.JWT_SECRET || "omnimob-dev-secret";

test("conversa do chamado", async (t) => {
  const a = await criarImobiliariaDeTeste();
  const b = await criarImobiliariaDeTeste();
  const api = await subirApi({ "/api/chamados": chamadoRouter, "/api/admin": adminRouter });
  const comoA = api.comoTenant(a);
  const comoB = api.comoTenant(b);
  /* Um super-admin DE VERDADE, no cargo Administrador: o token só prova
     identidade, e é o banco que diz o que a pessoa alcança. */
  const cargoAdmin = await prisma.cargoSuperAdmin.upsert({
    where: { nome: CARGO_ADMIN_PLATAFORMA },
    update: {},
    create: { nome: CARGO_ADMIN_PLATAFORMA, ...permissoesCompletas() },
  });
  const atendente = await prisma.superAdmin.create({
    data: { nome: "Atendente", email: `${a.slug}-suporte@omnimob.app`, senha: "x", ativo: true, cargoId: cargoAdmin.id },
  });
  const tokenSuporte = jwt.sign(
    { role: "SUPERADMIN", superAdminId: atendente.id, email: atendente.email },
    JWT_SECRET,
    { expiresIn: "10m" },
  );
  const suporte = api.comoTenant({ token: tokenSuporte, slug: "" });

  /* Um atendente com cargo "Suporte": vê e responde a fila, mas não é o
     Administrador da plataforma — o chamado interno não é para ele. */
  const cargoSuporte = await prisma.cargoSuperAdmin.create({
    data: { nome: `${a.slug}-Suporte`, verChamados: true, resolverChamado: true },
  });
  const atendenteSuporte = await prisma.superAdmin.create({
    data: { nome: "Atendente de fila", email: `${a.slug}-fila@omnimob.app`, senha: "x", ativo: true, cargoId: cargoSuporte.id },
  });
  const suporteDeFila = api.comoTenant({
    token: jwt.sign({ role: "SUPERADMIN", superAdminId: atendenteSuporte.id, email: atendenteSuporte.email }, JWT_SECRET, { expiresIn: "10m" }),
    slug: "",
  });

  /* Um corretor da A: cargo comum, sem nada de administração. */
  const corretor = await prisma.usuario.create({
    data: { tenantId: a.tenant.id, cargoCodigo: a.cargoComum.id, nome: "Corretor de Teste", login: `corretor-${a.slug}`, senha: "sem-senha" },
  });
  const comoCorretor = api.comoTenant({
    token: jwt.sign({ userId: corretor.id, tenantId: a.tenant.id, cargoCodigo: a.cargoComum.id }, JWT_SECRET, { expiresIn: "10m" }),
    slug: a.slug,
  });

  t.after(async () => {
    await api.fechar();
    await apagarImobiliaria(a.tenant.id);
    await apagarImobiliaria(b.tenant.id);
    await prisma.superAdmin.delete({ where: { id: atendente.id } }).catch(() => {});
    await prisma.superAdmin.delete({ where: { id: atendenteSuporte.id } }).catch(() => {});
    await prisma.cargoSuperAdmin.delete({ where: { id: cargoSuporte.id } }).catch(() => {});
  });

  const aberto = await comoA.post("/api/chamados", {
    titulo: "Foto não sobe",
    descricao: "Ao enviar a terceira foto do imóvel, a barra trava em 80%.",
    categoria: "problema",
  });
  assert.equal(aberto.status, 201, JSON.stringify(aberto.json));
  const numero = aberto.json.numero;
  assert.equal(aberto.json.status, "ABERTO");

  await t.test("a imobiliária B não lê nem escreve no chamado da A — pelo número real", async () => {
    assert.equal((await comoB.get(`/api/chamados/${numero}`)).status, 404);
    assert.equal((await comoB.post(`/api/chamados/${numero}/mensagens`, { texto: "oi" })).status, 404);
    assert.equal((await comoB.post(`/api/chamados/${numero}/reabrir`)).status, 404);
    // E não deixou rastro: a conversa da A continua vazia.
    const daA = await comoA.get(`/api/chamados/${numero}`);
    assert.equal(daA.status, 200);
    assert.deepEqual(daA.json.conversa, []);
    // Nem na lista da B.
    const listaB = await comoB.get("/api/chamados?todos=1");
    assert.ok(!listaB.json.chamados.some((c) => c.numero === numero));
    // Nem pela rota de status nova.
    assert.equal((await comoB.post(`/api/chamados/${numero}/status`, { status: "RESOLVIDO" })).status, 404);
  });

  await t.test("dentro da imobiliária cada um vê os seus; o Administrador vê os da equipe com `todos`", async () => {
    const doCorretor = await comoCorretor.post("/api/chamados", {
      titulo: "Não acho o botão",
      descricao: "Onde fica o botão de duplicar um imóvel que já cadastrei?",
      categoria: "duvida",
    });
    assert.equal(doCorretor.status, 201, JSON.stringify(doCorretor.json));
    const n = doCorretor.json.numero;

    // O corretor não lê o chamado do Administrador, nem pelo número.
    assert.equal((await comoCorretor.get(`/api/chamados/${numero}`)).status, 404);
    assert.equal((await comoCorretor.post(`/api/chamados/${numero}/mensagens`, { texto: "oi" })).status, 404);
    // E `todos` não alarga nada para quem não é Administrador.
    const listaCorretor = await comoCorretor.get("/api/chamados?todos=1");
    assert.equal(listaCorretor.json.podeVerTodos, false);
    assert.deepEqual(listaCorretor.json.chamados.map((c) => c.numero), [n]);

    // O Administrador: sem `todos`, só os dele; com `todos`, os da equipe.
    const soDele = await comoA.get("/api/chamados");
    assert.equal(soDele.json.podeVerTodos, true);
    assert.ok(!soDele.json.chamados.some((c) => c.numero === n));
    const daEquipe = await comoA.get("/api/chamados?todos=1");
    assert.ok(daEquipe.json.chamados.some((c) => c.numero === n));
    assert.equal((await comoA.get(`/api/chamados/${n}`)).status, 200);
  });

  await t.test("o suporte responde: mensagem no fio e a bola vai para o cliente", async () => {
    const r = await suporte.post(`/api/admin/chamados/${numero}/mensagens`, { texto: "Qual o tamanho da foto?" });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal(r.json.mensagem.autorTipo, "SUPORTE");
    assert.equal(r.json.status, "AGUARDANDO_CLIENTE");

    // A resposta é NOVIDADE para o dono: o selo do avatar acende…
    const antes = await comoA.get("/api/chamados/pendentes");
    assert.deepEqual(antes.json, { aguardando: 1, novidades: 1 });
    const lista = await comoA.get("/api/chamados/novidades");
    const nov = lista.json.novidades.find((x) => x.numero === numero);
    assert.ok(nov, JSON.stringify(lista.json));
    assert.equal(nov.autorTipo, "SUPORTE");
    assert.equal(nov.trecho, "Qual o tamanho da foto?");

    const visto = await comoA.get(`/api/chamados/${numero}`);
    assert.equal(visto.json.status, "AGUARDANDO_CLIENTE");
    assert.equal(visto.json.conversa.length, 1);
    assert.equal(visto.json.conversa[0].texto, "Qual o tamanho da foto?");

    // …e abrir o chamado o apaga. A própria marca de visto não vira novidade.
    const depois = await comoA.get("/api/chamados/pendentes");
    assert.deepEqual(depois.json, { aguardando: 1, novidades: 0 });
  });

  await t.test("o cliente responde pela tela: a bola volta ao suporte", async () => {
    const r = await comoA.post(`/api/chamados/${numero}/mensagens`, { texto: "Uns 9 MB." });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal(r.json.mensagem.autorTipo, "CLIENTE");
    assert.match(r.json.mensagem.autorNome, /Admin de Teste/);
    assert.equal(r.json.status, "EM_ATENDIMENTO");

    const doSuporte = await suporte.get(`/api/admin/chamados/${numero}`);
    assert.equal(doSuporte.status, 200);
    assert.equal(doSuporte.json.conversa.length, 2);
    assert.equal(doSuporte.json.tenantSlug, a.slug);
  });

  await t.test("resolver vira anotação de sistema; o cliente vê e reabre", async () => {
    const r = await suporte.patch(`/api/admin/chamados/${numero}`, { resolvido: true });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.status, "RESOLVIDO");
    assert.equal(r.json.resolvido, true);
    assert.ok(r.json.resolvidoEm);

    const visto = await comoA.get(`/api/chamados/${numero}`);
    assert.equal(visto.json.status, "RESOLVIDO");
    const ultima = visto.json.conversa.at(-1);
    assert.equal(ultima.autorTipo, "SISTEMA");
    assert.match(ultima.texto, /^Resolvido por /);

    const reaberto = await comoA.post(`/api/chamados/${numero}/reabrir`);
    assert.equal(reaberto.status, 200, JSON.stringify(reaberto.json));
    assert.equal(reaberto.json.status, "ABERTO");

    const depois = await comoA.get(`/api/chamados/${numero}`);
    assert.equal(depois.json.resolvido, false);
    assert.equal(depois.json.resolvidoEm, null);
    assert.match(depois.json.conversa.at(-1).texto, /^Reaberto por /);

    // Reabrir o que já está aberto é erro do cliente, não do servidor.
    assert.equal((await comoA.post(`/api/chamados/${numero}/reabrir`)).status, 400);
  });

  await t.test("responder um chamado resolvido também o reabre", async () => {
    await suporte.patch(`/api/admin/chamados/${numero}`, { status: "RESOLVIDO" });
    const r = await comoA.post(`/api/chamados/${numero}/mensagens`, { texto: "Voltou a travar." });
    assert.equal(r.status, 201);
    assert.equal(r.json.status, "ABERTO");
  });

  await t.test("o cliente encerra o próprio chamado (\"já resolvi\") e o suporte o reabre respondendo", async () => {
    const r = await comoA.post(`/api/chamados/${numero}/status`, { status: "RESOLVIDO" });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.status, "RESOLVIDO");
    // Encerrar o que já está encerrado é erro de quem pediu.
    assert.equal((await comoA.post(`/api/chamados/${numero}/status`, { status: "RESOLVIDO" })).status, 400);
    // Status que o cliente não pode pedir.
    assert.equal((await comoA.post(`/api/chamados/${numero}/status`, { status: "AGUARDANDO_CLIENTE" })).status, 400);

    /* O suporte voltando a um resolvido reabre o assunto: a pergunta nova não
       pode ficar escondida na lista de resolvidos do cliente. */
    const resp = await suporte.post(`/api/admin/chamados/${numero}/mensagens`, { texto: "Conseguiu mesmo? Ficou alguma foto pendente?" });
    assert.equal(resp.status, 201, JSON.stringify(resp.json));
    assert.equal(resp.json.status, "AGUARDANDO_CLIENTE");
    assert.equal(resp.json.chamado.conversa.at(-1).autorTipo, "SUPORTE");

    const volta = await comoA.post(`/api/chamados/${numero}/mensagens`, { texto: "Ficou tudo certo." });
    assert.equal(volta.json.status, "EM_ATENDIMENTO");
  });

  await t.test("a lista traz a contagem de mensagens e o status", async () => {
    const lista = await comoA.get("/api/chamados");
    const c = lista.json.chamados.find((x) => x.numero === numero);
    assert.ok(c);
    assert.equal(c.status, "EM_ATENDIMENTO");
    /* suporte + cliente + resolvido + reaberto + resolvido + cliente + reaberto
       = 7; depois resolvido (pelo cliente) + suporte + cliente = 10 */
    assert.equal(c.mensagens, 10);
    assert.equal(c.conversa, undefined, "a lista não carrega a conversa");
  });

  await t.test("o chamado interno nasce pelo token da equipe e só a casa o vê", async () => {
    /* A equipe dentro da conta da A (o "Entrar" do super-admin): o token é o
       do Administrador da A, com a marca de suporte assinada junto. */
    const equipeNaA = api.comoTenant({
      token: jwt.sign(
        { userId: a.usuario.id, tenantId: a.tenant.id, cargoCodigo: a.cargoAdmin.id, suporte: { nome: "Atendente", email: atendente.email } },
        JWT_SECRET,
        { expiresIn: "10m" },
      ),
      slug: a.slug,
    });
    const aberto = await equipeNaA.post("/api/chamados", {
      titulo: "Importação travou",
      descricao: "O feed desta imobiliária para no item 412 sem erro nenhum no log.",
      categoria: "problema",
    });
    assert.equal(aberto.status, 201, JSON.stringify(aberto.json));
    assert.equal(aberto.json.interno, true);
    assert.equal(aberto.json.abertoPor, "Atendente");
    const n = aberto.json.numero;

    // O corpo não decide: o Administrador logado por conta própria não abre interno.
    const comum = await comoA.post("/api/chamados", {
      titulo: "Dúvida comum", descricao: "Como troco a foto de capa da minha vitrine?", interno: true,
    });
    assert.equal(comum.status, 201, JSON.stringify(comum.json));
    assert.equal(comum.json.interno, false);

    // O Administrador da A, logado por conta própria, não o vê.
    assert.equal((await comoA.get(`/api/chamados/${n}`)).status, 404);
    assert.ok(!(await comoA.get("/api/chamados?todos=1")).json.chamados.some((c) => c.numero === n));
    // A equipe, dentro da conta, vê.
    assert.equal((await equipeNaA.get(`/api/chamados/${n}`)).status, 200);

    // O cargo "Suporte" da plataforma não o vê; o Administrador da plataforma vê.
    assert.equal((await suporteDeFila.get(`/api/admin/chamados/${n}`)).status, 404);
    const filaDoSuporte = await suporteDeFila.get("/api/admin/chamados");
    assert.equal(filaDoSuporte.status, 200, JSON.stringify(filaDoSuporte.json));
    assert.ok(!filaDoSuporte.json.chamados.some((c) => c.numero === n));
    assert.equal(filaDoSuporte.json.eu.veInternos, false);
    assert.equal(filaDoSuporte.json.internosAbertos, 0);

    const filaDaCasa = await suporte.get("/api/admin/chamados");
    assert.ok(filaDaCasa.json.chamados.some((c) => c.numero === n && c.interno));
    assert.equal(filaDaCasa.json.eu.veInternos, true);
    assert.ok(filaDaCasa.json.internosAbertos >= 1);
  });

  await t.test("a fila do suporte põe a vez da equipe antes da vez do cliente", async () => {
    const fila = await suporte.get(`/api/admin/chamados?tenantId=${a.tenant.id}`);
    assert.equal(fila.status, 200);
    const abertos = fila.json.chamados.filter((c) => !c.resolvido);
    const primeiraDoCliente = abertos.findIndex((c) => c.status === "AGUARDANDO_CLIENTE");
    const ultimaDaEquipe = abertos.map((c) => ["ABERTO", "EM_ATENDIMENTO"].includes(c.status)).lastIndexOf(true);
    if (primeiraDoCliente >= 0) assert.ok(ultimaDaEquipe < primeiraDoCliente);
    assert.equal(typeof fila.json.porStatus, "object");
  });

  await t.test("status fora da régua é recusado", async () => {
    assert.equal((await suporte.patch(`/api/admin/chamados/${numero}`, { status: "FECHADO" })).status, 400);
    assert.equal((await comoA.post(`/api/chamados/${numero}/mensagens`, { texto: "" })).status, 400);
  });

  await t.test("apagar a imobiliária leva a conversa junto", async () => {
    const antes = await prisma.chamadoMensagem.count({ where: { chamadoNumero: numero } });
    assert.ok(antes > 0);
    await apagarImobiliaria(a.tenant.id);
    assert.equal(await prisma.chamadoMensagem.count({ where: { chamadoNumero: numero } }), 0);
  });
});
