import test from "node:test";
import assert from "node:assert/strict";
import {
  prisma,
  limparRestos,
  criarImobiliariaDeTeste,
  apagarImobiliaria,
  subirApi,
} from "./helpers.js";
import { leadRouter } from "../src/routes/leadRoutes.js";
import { chamadoRouter } from "../src/routes/chamadoRoutes.js";
import { aiRouter } from "../src/routes/aiRoutes.js";
import { tenantRouter } from "../src/routes/tenantRoutes.js";

/* ────────────────────────────────────────────────────────────────────────────
   O que cada plano libera.

   Duas coisas moram aqui, e as duas são regras de NEGÓCIO aplicadas no
   servidor — que é o único lugar onde elas valem. O frontend esconde o botão,
   mas o botão escondido não protege rota nenhuma.

   E, como sempre neste projeto, o teste que mais importa é o de isolamento: a
   rota nova de IA recebe um id de lead na URL, e id na URL é exatamente a forma
   dos três vazamentos entre imobiliárias que já aconteceram aqui.
   ──────────────────────────────────────────────────────────────────────────── */

const api = {
  "/api/leads": leadRouter,
  "/api/chamados": chamadoRouter,
  "/api/ai": aiRouter,
  "/api/tenants": tenantRouter,
};

async function criarImovelComLead(tenantId) {
  const imovel = await prisma.property.create({
    data: {
      tenantId,
      title: "Casa de teste",
      description: "Imóvel criado por teste automatizado.",
      price: 500000,
      address: "Rua de Teste, 100",
      city: "Curitiba",
      neighborhood: "Centro",
      propertyType: "Casa",
      status: "ACTIVE",
    },
  });
  const lead = await prisma.propertyLead.create({
    data: {
      tenantId,
      propertyId: imovel.id,
      name: "Fulano de Teste",
      email: "fulano@exemplo.test",
      message: "Tenho interesse, posso visitar no sábado?",
    },
  });
  return { imovel, lead };
}

test("suporte prioritário: o plano empurra a prioridade do chamado para cima", async (t) => {
  await limparRestos();

  const casos = [
    { plano: "BASICO", categoria: "duvida", enviada: "BAIXA", esperada: "BAIXA" },
    { plano: "PROFISSIONAL", categoria: "duvida", enviada: "BAIXA", esperada: "MEDIA" },
    { plano: "PREMIUM", categoria: "duvida", enviada: "BAIXA", esperada: "ALTA" },
    // "Algo não funciona" já entra em ALTA; no Premium ele estoura o teto.
    { plano: "BASICO", categoria: "problema", enviada: "ALTA", esperada: "ALTA" },
    { plano: "PREMIUM", categoria: "problema", enviada: "ALTA", esperada: "URGENTE" },
  ];

  const criados = [];
  const app = await subirApi(api);
  t.after(async () => {
    await app.fechar();
    for (const id of criados) await apagarImobiliaria(id);
  });

  for (const caso of casos) {
    const casa = await criarImobiliariaDeTeste({ plano: caso.plano });
    criados.push(casa.tenant.id);

    const r = await app.comoTenant(casa).post("/api/chamados", {
      titulo: "Assunto do teste automatizado",
      descricao: "Descrição longa o bastante para passar na validação do schema.",
      categoria: caso.categoria,
      prioridade: caso.enviada,
    });

    assert.equal(r.status, 201, `abertura de chamado no ${caso.plano}`);

    // Confere no BANCO, e não só na resposta: o que ordena a fila do suporte é
    // a coluna gravada.
    const gravado = await prisma.chamado.findFirst({
      where: { tenantId: casa.tenant.id },
      orderBy: { criadoEm: "desc" },
    });
    assert.equal(
      gravado.prioridade,
      caso.esperada,
      `${caso.plano} + ${caso.categoria} (${caso.enviada}) deveria virar ${caso.esperada}`,
    );
  }
});

test("IA sobre o lead: só no Premium, e nunca o lead de outra imobiliária", async (t) => {
  await limparRestos();

  const basico = await criarImobiliariaDeTeste({ plano: "BASICO" });
  const profissional = await criarImobiliariaDeTeste({ plano: "PROFISSIONAL" });
  const premium = await criarImobiliariaDeTeste({ plano: "PREMIUM" });
  const outroPremium = await criarImobiliariaDeTeste({ plano: "PREMIUM" });

  const app = await subirApi(api);
  t.after(async () => {
    await app.fechar();
    for (const c of [basico, profissional, premium, outroPremium]) {
      await apagarImobiliaria(c.tenant.id);
    }
  });

  const doBasico = await criarImovelComLead(basico.tenant.id);
  const doPremium = await criarImovelComLead(premium.tenant.id);

  // ── A porta do plano ──────────────────────────────────────────────────────
  const rBasico = await app.comoTenant(basico).post(`/api/leads/${doBasico.lead.id}/ia`);
  assert.equal(rBasico.status, 403, "Básico não deve passar da porta da IA");

  const rProf = await app.comoTenant(profissional).post(`/api/leads/${doBasico.lead.id}/ia`);
  assert.equal(rProf.status, 403, "Profissional também não: IA é exclusiva do Premium");

  /* No Premium a porta abre. O que vem depois depende de haver GEMINI_API_KEY no
     ambiente: sem chave a rota responde 503, com chave ela chama o Gemini de
     verdade. O teste aceita os dois — o que ele está verificando é que o plano
     deixou passar, e não a resposta do modelo. Fixar 200 aqui deixaria a suíte
     dependente de rede e de crédito de API. */
  const rPremium = await app.comoTenant(premium).post(`/api/leads/${doPremium.lead.id}/ia`);
  assert.notEqual(rPremium.status, 403, "Premium deve passar da porta da IA");
  assert.ok(
    [200, 503].includes(rPremium.status),
    `Premium deveria responder 200 (com chave) ou 503 (sem), veio ${rPremium.status}`,
  );

  // ── O isolamento ──────────────────────────────────────────────────────────
  /* Os dois são Premium, então o plano NÃO barra: quem tem de barrar é o
     `where` com tenantId. É esta a linha que pega o vazamento — e 404, não 403,
     porque para esta imobiliária aquele lead simplesmente não existe. */
  const rVizinho = await app
    .comoTenant(outroPremium)
    .post(`/api/leads/${doPremium.lead.id}/ia`);
  assert.equal(rVizinho.status, 404, "lead de outra imobiliária tem de responder 404");
});

test("relatório mensal: fechado no Básico, aberto do Profissional para cima", async (t) => {
  await limparRestos();

  const basico = await criarImobiliariaDeTeste({ plano: "BASICO" });
  const profissional = await criarImobiliariaDeTeste({ plano: "PROFISSIONAL" });

  const app = await subirApi(api);
  t.after(async () => {
    await app.fechar();
    for (const c of [basico, profissional]) await apagarImobiliaria(c.tenant.id);
  });

  const rBasico = await app.comoTenant(basico).get("/api/tenants/me/relatorio-mensal");
  assert.equal(rBasico.status, 403, "Básico não tem relatório mensal");

  const rProf = await app.comoTenant(profissional).get("/api/tenants/me/relatorio-mensal");
  assert.equal(rProf.status, 200, "Profissional tem");
  // Imobiliária recém-criada não teve movimento nenhum: o relatório existe e
  // vem zerado, que é diferente de não existir.
  assert.equal(rProf.json.vazio, true);
  assert.equal(rProf.json.visitas, 0);
  assert.ok(rProf.json.periodo?.rotulo, "o período tem de vir rotulado");
});

test("reescrita em massa: só Premium, e não toca no imóvel de outra imobiliária", async (t) => {
  await limparRestos();

  const profissional = await criarImobiliariaDeTeste({ plano: "PROFISSIONAL" });
  const premium = await criarImobiliariaDeTeste({ plano: "PREMIUM" });
  const vizinho = await criarImobiliariaDeTeste({ plano: "PREMIUM" });

  const app = await subirApi(api);
  t.after(async () => {
    await app.fechar();
    for (const c of [profissional, premium, vizinho]) await apagarImobiliaria(c.tenant.id);
  });

  const doVizinho = await criarImovelComLead(vizinho.tenant.id);
  const ORIGINAL = doVizinho.imovel.description;

  // ── A porta do plano ──
  const rProf = await app.comoTenant(profissional).post("/api/ai/imovel/massa", { ids: ["qualquer"] });
  assert.equal(rProf.status, 403, "Profissional não tem reescrita em massa");

  /* ── O isolamento, no passo que SALVA ──
     Este é o teste que importa: o PUT recebe ids no corpo da requisição, e id
     vindo do cliente é a forma exata dos vazamentos que este projeto já teve.
     O Premium `premium` manda o id de um imóvel do Premium `vizinho`. A resposta
     não pode ser erro — tem de ser "salvei zero", porque para ele aquele imóvel
     não existe. E, sobretudo, o texto do vizinho tem de continuar intacto. */
  const rPut = await app.comoTenant(premium).put("/api/ai/imovel/massa", {
    itens: [{ id: doVizinho.imovel.id, descricao: "TEXTO INVASOR" }],
  });
  assert.equal(rPut.status, 200);
  assert.equal(rPut.json.salvos, 0, "não pode salvar em imóvel de outra imobiliária");

  const depois = await prisma.property.findUnique({ where: { id: doVizinho.imovel.id } });
  assert.equal(depois.description, ORIGINAL, "a descrição do vizinho tem de continuar a mesma");
});
