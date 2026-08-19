import test from "node:test";
import assert from "node:assert/strict";

import { planejarVitrine, ACOES } from "../src/services/vitrineIA.js";

/* ────────────────────────────────────────────────────────────────────────────
   O filtro do assistente de vitrine.

   Este é o único teste da suíte que não toca no banco, e é de propósito: o que
   está sob teste é o que acontece quando o MODELO ERRA — e ele erra de formas
   previsíveis (alvo que não existe, x fora da faixa, criar um widget que já
   está na página, remover a grade de imóveis).

   Sem a peneira, cada um desses erros vira uma vitrine quebrada na frente do
   cliente, e o "robô" trava no meio de um passo impossível. A função de
   conversa com o modelo é injetada, então nada aqui depende de rede nem de
   chave de API.
   ──────────────────────────────────────────────────────────────────────────── */

const VITRINE = {
  appearanceMode: "dark",
  primaryColor: "#6366f1",
  pecas: [
    { id: "b:header", nome: "Cabeçalho", x: 0, y: 0, w: 100, h: 120 },
    { id: "b:title", nome: "Título", x: 0, y: 160, w: 100, h: 260 },
    { id: "b:properties", nome: "Imóveis", x: 0, y: 460, w: 100, h: 640 },
    { id: "b:footer", nome: "Rodapé", x: 0, y: 1200, w: 100, h: 200 },
    { id: "w:abc", nome: "Depoimento", tipo: "testimonial", x: 0, y: 1140, w: 50, h: 240 },
  ],
};

const CATALOGO = [
  { tipo: "faq", nome: "Perguntas", paraQue: "dúvidas comuns", w: 100, h: 320 },
  { tipo: "cta", nome: "Chamada", paraQue: "botão de ação", w: 100, h: 200 },
  { tipo: "testimonial", nome: "Depoimento", paraQue: "prova social", w: 50, h: 240 },
];

/** Devolve sempre o mesmo plano — o que interessa é o que sai do filtro. */
const modeloQueResponde = (operacoes, resumo = "Pronto.") => async () =>
  JSON.stringify({ resumo, operacoes });

const FONTES = ["Inter", "Playfair Display", "Montserrat"];

async function planejar(operacoes) {
  return planejarVitrine("arrume a página", VITRINE, CATALOGO, modeloQueResponde(operacoes), FONTES);
}

test("passa adiante a operação bem formada", async () => {
  const r = await planejar([
    { acao: "mover", alvo: "w:abc", x: 50, y: 1140, motivo: "movi o depoimento para o lado" },
  ]);
  assert.equal(r.operacoes.length, 1);
  assert.deepEqual(r.operacoes[0], {
    acao: "mover", motivo: "movi o depoimento para o lado", alvo: "w:abc", x: 50, y: 1140,
  });
  assert.equal(r.descartadas, 0);
});

test("descarta alvo que não existe na vitrine", async () => {
  const r = await planejar([
    { acao: "mover", alvo: "w:nao-existe", x: 10, y: 20, motivo: "inventei uma peça" },
  ]);
  assert.equal(r.operacoes.length, 0);
  assert.equal(r.descartadas, 1);
});

test("a grade de imóveis não pode ser removida nem ocultada", async () => {
  /* É a regra de produto mais importante do arquivo: um pedido vago — "deixe
     mais limpo" — não pode terminar numa vitrine sem imóveis. */
  const r = await planejar([
    { acao: "remover", alvo: "b:properties", motivo: "tirei a grade" },
    { acao: "ocultar", alvo: "b:properties", motivo: "escondi a grade" },
  ]);
  assert.equal(r.operacoes.length, 0);
});

test("bloco fixo não é removível", async () => {
  const r = await planejar([{ acao: "remover", alvo: "b:footer", motivo: "tirei o rodapé" }]);
  assert.equal(r.operacoes.length, 0);
});

test("ocultar um bloco fixo continua valendo", async () => {
  const r = await planejar([{ acao: "ocultar", alvo: "b:footer", motivo: "escondi o rodapé" }]);
  assert.equal(r.operacoes.length, 1);
  assert.equal(r.operacoes[0].acao, "ocultar");
});

test("coordenada fora da faixa é aparada, não descartada", async () => {
  /* Aparar em vez de recusar: a intenção ("jogue para a direita") está certa e
     só o número passou do fim da régua. Recusar perderia o passo inteiro. */
  const r = await planejar([
    { acao: "mover", alvo: "w:abc", x: 180, y: -40, motivo: "empurrei para a direita" },
  ]);
  assert.equal(r.operacoes[0].x, 100);
  assert.equal(r.operacoes[0].y, 0);
});

test("não cria widget de um tipo que já está na vitrine", async () => {
  const r = await planejar([
    { acao: "adicionar", tipo: "testimonial", x: 0, y: 1500, w: 50, h: 240, motivo: "outro depoimento" },
  ]);
  assert.equal(r.operacoes.length, 0);
});

test("não cria o mesmo tipo duas vezes dentro do mesmo plano", async () => {
  const r = await planejar([
    { acao: "adicionar", tipo: "faq", x: 0, y: 1500, w: 100, h: 320, motivo: "dúvidas" },
    { acao: "adicionar", tipo: "faq", x: 0, y: 1900, w: 100, h: 320, motivo: "dúvidas de novo" },
  ]);
  assert.equal(r.operacoes.length, 1);
});

test("não cria widget que não está no catálogo", async () => {
  const r = await planejar([
    { acao: "adicionar", tipo: "carrossel-3d", x: 0, y: 1500, w: 100, h: 300, motivo: "algo inventado" },
  ]);
  assert.equal(r.operacoes.length, 0);
});

test("cor fora do formato hexadecimal é ignorada", async () => {
  const r = await planejar([
    { acao: "estilo", alvo: "w:abc", backgroundColor: "azul escuro", color: "#ffffff", motivo: "pintei" },
  ]);
  assert.equal(r.operacoes.length, 1);
  assert.equal(r.operacoes[0].backgroundColor, undefined);
  assert.equal(r.operacoes[0].color, "#ffffff");
});

test("operação de estilo sem nenhuma cor válida é descartada inteira", async () => {
  const r = await planejar([
    { acao: "estilo", alvo: "w:abc", backgroundColor: "roxo", motivo: "pintei de roxo" },
  ]);
  assert.equal(r.operacoes.length, 0);
});

test("ação desconhecida não passa", async () => {
  const r = await planejar([{ acao: "explodir", alvo: "w:abc", motivo: "??" }]);
  assert.equal(r.operacoes.length, 0);
  assert.ok(!ACOES.includes("explodir"));
});

test("tema só aceita os modos e as fontes que existem", async () => {
  const r = await planejar([
    { acao: "tema", appearanceMode: "neon", primaryColor: "#0b1220", motivo: "clareei" },
  ]);
  assert.equal(r.operacoes.length, 1);
  assert.equal(r.operacoes[0].appearanceMode, undefined, "modo inválido não passa");
  assert.equal(r.operacoes[0].primaryColor, "#0b1220", "a cor válida do mesmo passo sobrevive");
});

test("fonte fora da lista da tela não é gravada", async () => {
  /* Defeito real, achado ao rodar contra o Gemini: pedindo "cara de alto
     padrão" ele escolheu `globalFont: "serif"`. O seletor do inspetor só sabe
     desenhar os sete nomes de `builder/data/temas.js`, então um valor livre
     grava um estado que a interface não consegue mostrar de volta. */
  const r = await planejar([
    { acao: "tema", globalFont: "serif", appearanceMode: "light", motivo: "fonte elegante" },
  ]);
  assert.equal(r.operacoes.length, 1);
  assert.equal(r.operacoes[0].globalFont, undefined);
  assert.equal(r.operacoes[0].appearanceMode, "light");
});

test("fonte da lista passa", async () => {
  const r = await planejar([
    { acao: "tema", globalFont: "Playfair Display", motivo: "fonte elegante" },
  ]);
  assert.equal(r.operacoes[0].globalFont, "Playfair Display");
});

test("plano longo demais é cortado no teto", async () => {
  /* Sem teto, "refaça tudo" volta com sessenta passos e a pessoa assiste a um
     robô mexendo por dois minutos sem entender o que mudou. */
  const muitas = Array.from({ length: 40 }, (_, i) => ({
    acao: "mover", alvo: "w:abc", x: 0, y: 1000 + i, motivo: `passo ${i}`,
  }));
  const r = await planejar(muitas);
  assert.equal(r.operacoes.length, 20);
});

test("resposta que não é JSON vira erro tratado, não exceção crua", async () => {
  await assert.rejects(
    () => planejarVitrine("arrume", VITRINE, CATALOGO, async () => "desculpe, não entendi"),
    (e) => e.code === "AI_PARSE",
  );
});

test("plano vazio é resposta legítima, não erro", async () => {
  const r = await planejarVitrine(
    "faça algo impossível", VITRINE, CATALOGO,
    modeloQueResponde([], "Não entendi o que você quer mudar."),
  );
  assert.equal(r.operacoes.length, 0);
  assert.match(r.resumo, /não entendi/i);
});
