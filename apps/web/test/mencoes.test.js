import test from "node:test";
import assert from "node:assert/strict";

import {
  catalogoDeTelas, comMencoes, consultaDoArroba, filtrarTelas, partesDaMensagem,
} from "../src/utils/mencoes.js";

/* ────────────────────────────────────────────────────────────────────────────
   As menções de tela do chamado ("@" do suporte).

   Dois riscos, os dois silenciosos:

   1. LINK PARA FORA. A menção é texto que o cliente também pode digitar; se o
      formato aceitasse "//site.com" ou "https://…", qualquer fala viraria um
      link com cara de tela do sistema levando para outro lugar.

   2. RÓTULO QUE COME RÓTULO. "@Configurações" é o começo de
      "@Configurações › Perfil". Trocar na ordem errada produz uma menção para
      a tela errada — e o suporte não vê, porque a caixa mostra o texto
      legível.
   ──────────────────────────────────────────────────────────────────────────── */

test("a menção só vira link para caminho interno", () => {
  const partes = partesDaMensagem("veja @[Cargos](/cargos) e @[Fora](//mal.com) e @[X](https://mal.com)");
  const links = partes.filter((p) => p.caminho);
  assert.deepEqual(links, [{ rotulo: "Cargos", caminho: "/cargos" }]);
  // O resto continua como texto, sem sumir nada.
  assert.equal(partes.map((p) => p.texto ?? `@[${p.rotulo}](${p.caminho})`).join(""),
    "veja @[Cargos](/cargos) e @[Fora](//mal.com) e @[X](https://mal.com)");
});

test("o rótulo mais longo vence o mais curto que é começo dele", () => {
  const telas = [
    { rotulo: "Configurações", caminho: "/configuracoes" },
    { rotulo: "Configurações › Perfil", caminho: "/configuracoes?ver=perfil" },
  ];
  const saida = comMencoes("abra @Configurações › Perfil, ou @Configurações", telas);
  assert.equal(saida, "abra @[Configurações › Perfil](/configuracoes?ver=perfil), ou @[Configurações](/configuracoes)");
  // E o que saiu é lido de volta como duas menções.
  assert.equal(partesDaMensagem(saida).filter((p) => p.caminho).length, 2);
});

test("o @ abre a busca e uma tela já escolhida não a reabre", () => {
  const telas = catalogoDeTelas();
  assert.deepEqual(consultaDoArroba("olá @carg", 9, telas), { inicio: 4, fim: 9, consulta: "carg" });
  assert.equal(consultaDoArroba("email@dominio", 13, telas), null, "arroba no meio da palavra não é menção");
  assert.equal(consultaDoArroba("veja @Equipe › Cargos depois", 28, telas), null);
});

test("a busca ignora acento e acha pelo título", () => {
  const achadas = filtrarTelas("usuario");
  assert.ok(achadas.some((t) => t.caminho === "/usuarios"));
  assert.ok(achadas.length <= 8);
  // Todo caminho do catálogo é interno — o mesmo critério da menção.
  for (const t of catalogoDeTelas()) assert.match(t.caminho, /^\/(?!\/)/);
});
