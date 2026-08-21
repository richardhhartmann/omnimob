import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

/* ────────────────────────────────────────────────────────────────────────────
   O atalho do tour é da PESSOA, não da imobiliária.

   O servidor já guardava assim — `UsuarioTutorial` tem
   `@@unique([usuarioId, etapa])`. Só o atalho de `localStorage` estava chaveado
   por tenant, e com ele o administrador concluir o tour SILENCIAVA o convite
   para todo mundo que entrasse depois naquele navegador.

   O sintoma foi exato: os tours de TELA apareciam (eles perguntam ao servidor
   por tela) e o GLOBAL não — porque o atalho o descartava antes de qualquer
   consulta. A pessoa não via o tour e não tinha como descobrir que existia.
   ──────────────────────────────────────────────────────────────────────────── */

const { lerDoUsuario, gravarNoUsuario, chaveDoTenant } = await import("../src/utils/chaveDoTenant.js");

/* O `localStorage` não existe em Node; um mínimo basta para provar a separação
   das gavetas, que é o ponto. */
const gaveta = new Map();
globalThis.localStorage = {
  getItem: (k) => (gaveta.has(k) ? gaveta.get(k) : null),
  setItem: (k, v) => gaveta.set(k, String(v)),
};

test("duas pessoas da MESMA imobiliária não compartilham a marca", () => {
  gravarNoUsuario("tour", "tenant-1", "usuario-admin", "1");

  assert.equal(lerDoUsuario("tour", "tenant-1", "usuario-admin"), "1");
  assert.equal(
    lerDoUsuario("tour", "tenant-1", "usuario-corretor"),
    null,
    "o corretor precisa ver o tour, mesmo com o admin já tendo concluído",
  );
});

test("a mesma pessoa em imobiliárias diferentes também é separada", () => {
  gravarNoUsuario("tour", "tenant-1", "u1", "1");
  assert.equal(lerDoUsuario("tour", "tenant-2", "u1"), null);
});

test("sem id de usuário, não grava nem lê", () => {
  /* Montar a chave assim mesmo produziria uma gaveta compartilhada por todo
     mundo sem id — o mesmo problema com outro nome. */
  gravarNoUsuario("tour", "tenant-1", null, "1");
  assert.equal(lerDoUsuario("tour", "tenant-1", null), null);
  assert.equal(lerDoUsuario("tour", "tenant-1", undefined), null);
});

test("a chave por tenant continua existindo para o que é da casa", () => {
  /* Histórico do editor e leads vistos seguem por imobiliária, e devem seguir. */
  assert.equal(chaveDoTenant("x", "tenant-1"), "x_tenant-1");
  assert.equal(chaveDoTenant("x", null), null);
});

test("o tour não guarda mais nada chaveado só por imobiliária", () => {
  const s = fs.readFileSync("src/components/PrimeiroAcessoTour.jsx", "utf8");
  assert.ok(!/\blerDoTenant\b|\bgravarNoTenant\b/.test(s), "voltou a marcar por imobiliária");
  assert.match(s, /gravarNoUsuario\(CHAVES\.tourResolvido/);
});
