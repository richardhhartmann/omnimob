import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { ToggleDoFlow } from "../src/components/ToggleDoFlow.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   O INTERRUPTOR DO FLOW É UM SÓ, NAS QUATRO TELAS DE PAGAMENTO.

   ── O DEFEITO QUE ISTO GUARDA ──

   Ele já foi três coisas diferentes ao mesmo tempo: dois cartões na landing,
   dois cartões no modal de assinar, um botão "Contratar/Desativar" em
   Configurações — e a parede de reativação não perguntava nada, o que fazia
   quem voltava de uma conta suspensa perder o módulo em silêncio.

   Divergência de componente costuma ser um problema estético. Aqui não: as
   quatro telas COBRAM. Uma dizendo "+R$ 50" e outra "+R$ 49" na mesma compra é
   motivo de estorno, e a que esquecer de mandar o `pacote` vende o Flow e
   entrega o Hub.

   ── AS DUAS COISAS ──

   1. O componente desenha o que promete nos dois estados.
   2. As quatro telas o IMPORTAM, e nenhuma voltou a desenhar o seu.
   ──────────────────────────────────────────────────────────────────────────── */

/* As quatro telas onde se paga. `SuperAdminPage` fica de fora de propósito: lá
   quem marca é o comercial da Omnimob criando a conta, não o cliente pagando —
   é uma caixa de cadastro, e não uma escolha de compra. */
const TELAS_DE_PAGAMENTO = [
  "src/pages/OmnimobLandingPage.jsx",
  "src/components/TrialAviso.jsx",
  "src/pages/ContaSuspensaPage.jsx",
  "src/pages/ConfiguracaoPage.jsx",
];

test("desenha os dois estados, e o texto muda entre eles", () => {
  const desligado = renderToStaticMarkup(<ToggleDoFlow ligado={false} aoAlternar={() => {}} />);
  const ligado = renderToStaticMarkup(<ToggleDoFlow ligado aoAlternar={() => {}} />);

  // Um checkbox de verdade: foco, Espaço e leitor de tela saem de graça.
  assert.match(desligado, /type="checkbox"/);
  assert.match(desligado, /class="sw"/, "precisa usar o switch do painel, não um novo");
  assert.ok(!desligado.includes("checked"), "desligado não pode vir marcado");
  assert.match(ligado, /checked/);

  /* A frase muda com o estado, e não é enfeite: desligado ela VENDE, ligado ela
     CONFIRMA. O mesmo texto nos dois deixaria a pessoa sem saber se o clique
     surtiu efeito. */
  assert.match(desligado, /só o Hub/i);
  assert.match(ligado, /funil de negócios/i);
  assert.notEqual(desligado, ligado);

  // O realce do estado ligado é o que a caixa inteira usa para mudar de cor.
  assert.match(ligado, /pkg-caixa is-on/);
});

test("o rótulo inteiro é área de clique, e o id acompanha", () => {
  /* `<label for>` apontando para o `id` do input: sem isso, só o quadradinho do
     switch responde ao clique, e numa caixa de 60px de altura a pessoa acerta o
     texto e nada acontece. */
  const html = renderToStaticMarkup(<ToggleDoFlow id="pkg-x" ligado={false} aoAlternar={() => {}} />);
  assert.match(html, /for="pkg-x"/);
  assert.match(html, /id="pkg-x"/);
});

test("desabilitado e ocupado travam o controle", () => {
  const desabilitado = renderToStaticMarkup(<ToggleDoFlow ligado={false} desabilitado aoAlternar={() => {}} />);
  assert.match(desabilitado, /disabled/);

  const ocupado = renderToStaticMarkup(<ToggleDoFlow ligado={false} ocupado aoAlternar={() => {}} />);
  assert.match(ocupado, /disabled/, "gravando também trava — dois cliques seriam duas cobranças");
  assert.match(ocupado, /Salvando/);
});

test("o extra e a nota aparecem quando passados", () => {
  const html = renderToStaticMarkup(
    <ToggleDoFlow ligado aoAlternar={() => {}} extra="+ R$ 50/mês" nota="Ativo nesta conta." />,
  );
  assert.match(html, /\+ R\$ 50\/mês/);
  assert.match(html, /Ativo nesta conta\./);
});

test("as QUATRO telas de pagamento usam o componente compartilhado", () => {
  for (const arquivo of TELAS_DE_PAGAMENTO) {
    const texto = fs.readFileSync(arquivo, "utf8");
    assert.match(
      texto,
      /import \{ ToggleDoFlow \}/,
      `${arquivo} deveria importar o interruptor compartilhado`,
    );
    assert.match(texto, /<ToggleDoFlow/, `${arquivo} deveria renderizá-lo`);
  }
});

test("nenhuma tela voltou a desenhar o seu próprio", () => {
  /* Os sinais das versões anteriores. Se um deles reaparecer, alguém
     recriou o controle em vez de usar o que existe — e é assim que as três
     versões nasceram da primeira vez. */
  const RASTROS = [
    ["dl-pacote__op", "os cartões da landing"],
    ["tv-pacote__opt", "os cartões do modal de assinar"],
    ["cfg-flow__botao", "o botão Contratar/Desativar de Configurações"],
  ];
  for (const arquivo of TELAS_DE_PAGAMENTO) {
    const texto = fs.readFileSync(arquivo, "utf8");
    for (const [marca, oque] of RASTROS) {
      assert.ok(!texto.includes(marca), `${arquivo}: ${oque} voltou`);
    }
  }
});

test("as quatro mandam o pacote junto do plano", () => {
  /* A metade que não se vê: o interruptor pode estar desenhado e a chamada de
     assinatura sair sem `pacote`. Aí o cliente escolhe Hub+Flow, paga o preço
     do Hub+Flow e recebe só o Hub — o pior desfecho possível, e silencioso.

     Configurações fica de fora porque lá a rota é outra (`contratarFlow`), que
     não recebe plano nenhum. */
  const QUE_ASSINAM = {
    "src/components/TrialAviso.jsx": /assinarPlano(Assincrono)?\([^)]*\{[\s\S]{0,200}?pacote/,
    "src/pages/ContaSuspensaPage.jsx": /assinarPlano\([\s\S]{0,220}?pacote/,
  };
  for (const [arquivo, padrao] of Object.entries(QUE_ASSINAM)) {
    const texto = fs.readFileSync(arquivo, "utf8");
    assert.match(texto, padrao, `${arquivo}: a assinatura precisa mandar o pacote`);
  }

  const config = fs.readFileSync("src/pages/ConfiguracaoPage.jsx", "utf8");
  assert.match(config, /api\.contratarFlow\(/, "Configurações usa a rota de módulos");
});

test("o interruptor só aparece quando existe preço do Flow", () => {
  /* Sem as variáveis `STRIPE_PRICE_*_FLOW` no Stripe, o pacote não é vendável —
     e oferecer a caixa seria vender o que a cobrança recusa. É a mesma escolha
     que o preço anual fez quando entrou.

     A guarda tem que estar nas três telas de COMPRA. Em Configurações não: lá o
     cartão aparece sempre, porque a rota de módulos não passa pelo Stripe para
     liberar o acesso. */
  for (const arquivo of [
    "src/pages/OmnimobLandingPage.jsx",
    "src/components/TrialAviso.jsx",
    "src/pages/ContaSuspensaPage.jsx",
  ]) {
    const texto = fs.readFileSync(arquivo, "utf8");
    assert.match(texto, /temFlow/, `${arquivo}: falta a guarda de preço cadastrado`);
    assert.match(
      texto,
      /flow\?\.mensal/,
      `${arquivo}: a guarda precisa olhar o preço do Flow, não outra coisa`,
    );
  }
});
