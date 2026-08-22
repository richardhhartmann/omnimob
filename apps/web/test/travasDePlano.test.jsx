import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { abasVisiveis } from "../src/utils/abasConfiguracoes.js";
import { planoLiberaFunil, planoLiberaPortais, planoLiberaRedes, planoLiberaRelatorioMensal } from "../src/utils/planos.js";
import { relatoriosVisiveis, relatorioLiberado } from "../src/utils/relatorios.js";

/* ────────────────────────────────────────────────────────────────────────────
   O que o plano Básico NÃO deve ver.

   ── O DEFEITO QUE ISTO GUARDA ──

   Esconder um recurso é sempre em DOIS lugares: a tela que o abre e o menu que
   leva até ela. A barra lateral e a página de Configurações tinham cada uma o
   seu `filter`, e divergiram — a página parou de mostrar "Redes sociais" no
   Básico e o menu continuou oferecendo. O menu prometia uma seção que a tela
   não abria, que é pior do que não ter escondido nada.

   Agora é uma função só (`abasVisiveis`), e este arquivo checa que as duas
   telas a usam em vez de reescrevê-la.
   ──────────────────────────────────────────────────────────────────────────── */

const cargoAdmin = {
  acessarPainel: true, gerenciarImoveis: true, gerenciarUsuarios: true,
  gerenciarCargos: true, verRelatorios: true, verConfiguracoes: true,
  gerenciarClientes: true, editarPagina: true, publicarRedes: true, verAuditoria: true,
};
const podeImportar = () => true;

test("Redes some no Básico e volta no Profissional", () => {
  const basico = abasVisiveis(cargoAdmin, "BASICO", { podeImportar }).map((a) => a.key);
  const pro = abasVisiveis(cargoAdmin, "PROFISSIONAL", { podeImportar }).map((a) => a.key);

  assert.ok(!basico.includes("redes"), "tudo dentro de Redes começa no Profissional");
  assert.ok(pro.includes("redes"));
  /* O resto das seções não pode ter ido junto: o Básico continua com vitrine,
     perfil, dados e plano. */
  assert.ok(basico.length >= pro.length - 1);
});

/* ── O MENU MUDOU DE ENDEREÇO ────────────────────────────────────────────────
   Era `AdminLayout.jsx`; virou `navegacaoDoPainel.jsx` quando o segundo módulo
   entrou e a navegação passou a ter duas versões (Hub e Flow) dentro do mesmo
   layout.

   O que este arquivo guarda continua o mesmo, e é o que importa: o menu e a
   tela leem a MESMA lista. Só o caminho do arquivo acompanhou a mudança. */
const ARQUIVO_DO_MENU = "src/components/navegacaoDoPainel.jsx";

test("as duas telas usam a MESMA função — não um filtro cada", () => {
  for (const arquivo of [ARQUIVO_DO_MENU, "src/pages/ConfiguracaoPage.jsx"]) {
    const s = fs.readFileSync(arquivo, "utf8");
    assert.match(s, /abasVisiveis\(/, `${arquivo} deveria chamar a função compartilhada`);
    /* O sinal do defeito antigo: reconstruir a lista com um filter local. */
    assert.ok(
      !/ABAS_CONFIG\s*\n?\s*\.filter/.test(s),
      `${arquivo} voltou a filtrar por conta própria — foi assim que menu e tela divergiram`,
    );
  }
});

test("os quatro relatórios são do Básico — o que é pago é o E-MAIL", () => {
  /* A tabela de recursos vende "Relatórios e métricas de desempenho" no Básico,
     e no Profissional a linha é "Relatório mensal de desempenho POR E-MAIL".
     São coisas diferentes: a tela é do Básico, mandar por e-mail não é.

     A tabela de planos discordava disso duas vezes — `relatorioMensal` escondia
     o painel inteiro e `funilVendas: false` tirava funil e comissões. Quem
     manda é a lista que o cliente lê antes de pagar. */
  const esperado = ["LEADS", "MENSAL", "FUNIL", "COMISSOES"];
  assert.deepEqual(relatoriosVisiveis("BASICO").map((r) => r.chave), esperado);
  assert.deepEqual(relatoriosVisiveis("PROFISSIONAL").map((r) => r.chave), esperado);
});

test("o botão de enviar por e-mail é o único que o Básico não vê", () => {
  const s = fs.readFileSync("src/components/RelatorioMensal.jsx", "utf8");
  assert.match(s, /const podeEnviarEmail = planoLiberaRelatorioMensal\(/);
  assert.match(s, /\{podeEnviarEmail \? \(/, "o botão sai da tela, não fica desabilitado");
  /* O defeito antigo: a variável de plano trocava o PAINEL inteiro por um
     convite de upgrade, e o Básico clicava no cartão para bater numa parede. */
  assert.ok(!/Disponível no plano Profissional/.test(s), "o painel voltou a virar upsell");
});

test("relatório fechado não entra nem pelo endereço", () => {
  /* O cartão sumir não basta: um favorito, um link antigo ou o botão Voltar
     levam direto a `?ver=...`. */
  const pagina = fs.readFileSync("src/pages/RelatoriosPage.jsx", "utf8");
  assert.match(pagina, /relatorioLiberado\(pedida, plano\)/, "a página precisa barrar a URL");
  /* Hoje nenhum relatório é fechado por plano, mas a barreira fica: ela é o que
     impede um `?ver=` de driblar a lista no dia em que algum for. */
  assert.equal(relatorioLiberado("INVENTADO", "BASICO"), false);
});

test("cartões e menu leem a MESMA lista de relatórios", () => {
  for (const arquivo of ["src/pages/RelatoriosPage.jsx", ARQUIVO_DO_MENU]) {
    const texto = fs.readFileSync(arquivo, "utf8");
    assert.match(texto, /relatoriosVisiveis\(/, `${arquivo} deveria ler a lista compartilhada`);
    /* O sinal do defeito: uma lista de cartões escrita à mão aqui dentro. */
    assert.ok(!/const CARDS = \[/.test(texto), `${arquivo} voltou a ter a própria lista`);
  }

  assert.equal(planoLiberaRelatorioMensal("BASICO"), false);
});

test("portais entram na tabela de planos e ficam fora do Básico", () => {
  assert.equal(planoLiberaPortais("BASICO"), false);
  assert.equal(planoLiberaPortais("PROFISSIONAL"), true);
  assert.equal(planoLiberaPortais("PREMIUM"), true);

  /* A tabela de recursos da landing precisa dizer isso, senão o produto vende
     uma coisa e entrega outra. */
  const planos = fs.readFileSync("src/utils/planos.js", "utf8");
  assert.match(planos, /Envio aos portais[^"]*/);
});

test("o cadastro de imóvel esconde os portais no Básico", () => {
  const s = fs.readFileSync("src/components/PropertyForm.jsx", "utf8");
  assert.match(s, /const mostrarPortais = planoLiberaPortais\(plano\)/);
  assert.match(s, /\{mostrarPortais \? \(/, "o bloco inteiro sai da tela, não fica desabilitado");
});

test("as três travas do degrau Profissional concordam entre si", () => {
  /* Redes, portais e relatório mensal por e-mail são o MESMO degrau comercial.
     Uma delas liberada sozinha no Básico seria um vazamento de recurso pago.
     Funil e comissões NÃO entram aqui — eles são do Básico. */
  for (const trava of [planoLiberaRedes, planoLiberaPortais, planoLiberaRelatorioMensal]) {
    assert.equal(trava("BASICO"), false);
    assert.equal(trava("PROFISSIONAL"), true);
  }
  assert.equal(planoLiberaFunil("BASICO"), true, "funil é do Básico, não deste degrau");
  /* `planoLiberaRelatorioMensal` está no degrau pago porque significa MANDAR
     POR E-MAIL — não "ver o relatório mensal", que é do Básico. */
});
