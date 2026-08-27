import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";

import { authRouter } from "../src/routes/authRoutes.js";
import { usuarioRouter } from "../src/routes/usuarioRoutes.js";
import {
  prisma, limparRestos, criarImobiliariaDeTeste, apagarImobiliaria, subirApi,
} from "./helpers.js";

/* ────────────────────────────────────────────────────────────────────────────
   AS CAMADAS DE SEGURANÇA DA PORTA DE ENTRADA.

   Todas nasceram de uma auditoria, e uma delas de um vazamento REAL que estava
   no ar: `GET /api/usuarios` devolvia o hash bcrypt da senha de todo mundo da
   imobiliária.

   ── POR QUE ESTES TESTES IMPORTAM MAIS QUE A MÉDIA ──

   Defesa quebrada não tem sintoma. Um `select` trocado por um `include` numa
   refatoração inocente volta a vazar as senhas, e nada na tela muda; o
   `HASH_FANTASMA` some do login e a enumeração por tempo volta, sem erro em
   lugar nenhum; o `jti` sai do token e o logout vira enfeite. Nenhuma dessas
   regressões apareceria num teste de funcionalidade — só aqui.
   ──────────────────────────────────────────────────────────────────────────── */

let api;
let A;

test.before(async () => {
  await limparRestos();
  api = await subirApi({ "/api/auth": authRouter, "/api/usuarios": usuarioRouter });
  A = await criarImobiliariaDeTeste();
});

test.after(async () => {
  await api?.fechar();
  if (A) await apagarImobiliaria(A.tenant.id);
  await limparRestos();
  await prisma.$disconnect();
});

const SENHA = "senha-de-teste-987";

/** Um usuário descartável com senha conhecida. A trava é por CONTA, então cada
 *  teste precisa da sua — travar a do vizinho faria um derrubar o outro. */
async function usuarioComSenha(sufixo) {
  const login = `zz-seg-${process.pid}-${sufixo}`;
  await prisma.usuario.deleteMany({ where: { login } });
  return prisma.usuario.create({
    data: {
      tenantId: A.tenant.id,
      cargoCodigo: A.cargoAdmin.id,
      nome: `Teste ${sufixo}`,
      login,
      senha: await bcrypt.hash(SENHA, 8),
      ativo: true,
      forcaAlterarSenha: false,
    },
  });
}

const entrar = (login, senha) =>
  fetch(`${api.base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login, senha }),
  });

/* ══════════════════════════════════════════════════════════════════════════
   1. NENHUM SEGREDO SAI NA LISTAGEM DE USUÁRIOS
   ══════════════════════════════════════════════════════════════════════════ */

test("a listagem de usuários NUNCA devolve o hash da senha", async () => {
  /* O vazamento real: as rotas devolviam a linha inteira do banco, e junto ia
     o campo `senha`. Hash não é senha, mas é a matéria-prima dela — sai da
     máquina do atacante para ser quebrado offline, sem rate limit e sem
     ninguém perceber. */
  await usuarioComSenha("listagem");

  const r = await api.comoTenant(A).get("/api/usuarios");
  assert.equal(r.status, 200);

  const cru = JSON.stringify(r.json);
  assert.ok(!/"senha"/.test(cru), "o campo `senha` voltou para a resposta");
  assert.ok(!/\$2[aby]\$/.test(cru), "há um hash bcrypt na resposta");

  /* O identificador do Google é dado de OUTRA plataforma e não tem uso nesta
     tela. Sai o `googleVinculadoEm`, que responde a pergunta útil ("esta
     pessoa entra pelo Google?") sem entregar o resto. */
  assert.ok(!/"googleId"/.test(cru), "o googleId voltou");
  assert.ok(!/"googleEmail"/.test(cru), "o googleEmail voltou");

  const um = r.json[0];
  assert.ok(um.nome && um.login, "a listagem tem de continuar servindo para alguma coisa");
});

/* ══════════════════════════════════════════════════════════════════════════
   2. ENUMERAÇÃO DE USUÁRIO
   ══════════════════════════════════════════════════════════════════════════ */

test("a mensagem é a MESMA para login inexistente e senha errada", async () => {
  const u = await usuarioComSenha("mensagem");

  const inexistente = await entrar(`zz-nao-existe-${process.pid}`, "qualquer");
  const senhaErrada = await entrar(u.login, "nao-e-essa");

  assert.equal(inexistente.status, 401);
  assert.equal(senhaErrada.status, 401);
  assert.equal(
    (await inexistente.json()).error,
    (await senhaErrada.json()).error,
    "textos diferentes dizem quais logins existem",
  );
});

test("o RELÓGIO também não denuncia quem existe", async () => {
  /* A metade esquecida da enumeração. A mensagem genérica resolve o que se lê;
     o tempo de resposta resolve o que se mede — e sem cuidado ele conta tudo:
     login inexistente respondia na hora, login existente gastava o bcrypt.

     Duas fontes de assimetria foram fechadas: o `HASH_FANTASMA` (comparar
     contra um hash descartável quando não há usuário) e a busca sem `include`
     (as relações do Prisma são CONSULTAS separadas, e só o caminho de quem
     existe as pagava — 424 ms medidos).

     O limite é frouxo de propósito: isto roda contra um banco remoto, e a
     variação de rede é maior que a diferença que se procura. O que ele pega é
     a regressão grosseira — uma ida ao banco a mais de um lado só. */
  const u = await usuarioComSenha("relogio");

  const medir = async (login) => {
    const amostras = [];
    for (let i = 0; i < 5; i += 1) {
      const t0 = performance.now();
      await entrar(login, `chute-${i}`);
      amostras.push(performance.now() - t0);
    }
    return amostras.sort((a, b) => a - b)[2]; // mediana, imune ao primeiro pedido frio
  };

  const existe = await medir(u.login);
  const naoExiste = await medir(`zz-fantasma-${process.pid}`);
  const diferenca = Math.abs(existe - naoExiste);

  assert.ok(
    diferenca < 150,
    `${diferenca.toFixed(0)} ms entre os dois caminhos (existe: ${existe.toFixed(0)}, não existe: ${naoExiste.toFixed(0)}) — dá para enumerar cronometrando`,
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   3. FORÇA BRUTA POR CONTA
   ══════════════════════════════════════════════════════════════════════════ */

test("dez erros trancam a conta, e a senha certa não abre", async () => {
  /* A trava por IP não alcança o ataque que importa: mil máquinas tentando a
     MESMA conta passam por ela, porque cada uma faz poucas tentativas. */
  const u = await usuarioComSenha("bruta");

  for (let i = 0; i < 10; i += 1) {
    const r = await entrar(u.login, `errada-${i}`);
    assert.equal(r.status, 401, `a tentativa ${i + 1} deveria ser só recusada`);
  }

  const travada = await entrar(u.login, SENHA);
  assert.equal(travada.status, 429, "a 11ª tem de bater na trava, mesmo com a senha CERTA");
  const corpo = await travada.json();
  assert.equal(corpo.contaBloqueada, true);
  assert.match(corpo.error, /minuto/i, "a pessoa precisa saber que a espera tem fim");

  const linha = await prisma.usuario.findUnique({
    where: { id: u.id },
    select: { tentativasFalhas: true, bloqueadoAte: true },
  });
  assert.equal(linha.tentativasFalhas, 10);
  assert.ok(linha.bloqueadoAte > new Date(), "o bloqueio precisa estar no futuro");
});

test("acertar a senha zera o contador", async () => {
  /* Um dia ruim de digitação não pode se somar ao do mês passado até trancar
     alguém que sabe a própria senha. */
  const u = await usuarioComSenha("zera");
  for (let i = 0; i < 3; i += 1) await entrar(u.login, `errada-${i}`);

  const antes = await prisma.usuario.findUnique({ where: { id: u.id }, select: { tentativasFalhas: true } });
  assert.equal(antes.tentativasFalhas, 3);

  const ok = await entrar(u.login, SENHA);
  assert.equal(ok.status, 200);

  const depois = await prisma.usuario.findUnique({ where: { id: u.id }, select: { tentativasFalhas: true } });
  assert.equal(depois.tentativasFalhas, 0);
});

test("o bloqueio EXPIRA sozinho", async () => {
  /* Bloqueio permanente vira arma: bastaria errar a senha de alguém dez vezes
     para deixá-lo de fora até um humano intervir. */
  const u = await usuarioComSenha("expira");
  await prisma.usuario.update({
    where: { id: u.id },
    data: { tentativasFalhas: 10, bloqueadoAte: new Date(Date.now() - 1000) }, // já passou
  });

  const r = await entrar(u.login, SENHA);
  assert.equal(r.status, 200, "bloqueio vencido não pode continuar recusando");
});

/* ══════════════════════════════════════════════════════════════════════════
   4. A SESSÃO ACABA NO SERVIDOR, E NÃO SÓ NO NAVEGADOR
   ══════════════════════════════════════════════════════════════════════════ */

test("o token carrega um `jti` — sem ele não há o que revogar", async () => {
  const u = await usuarioComSenha("jti");
  const sessao = await (await entrar(u.login, SENHA)).json();
  const payload = JSON.parse(Buffer.from(sessao.token.split(".")[1], "base64").toString());
  assert.ok(payload.jti, "o token precisa identificar a sessão");
});

test("depois do logout, o MESMO token não vale mais", async () => {
  /* O defeito: "sair" apagava o token do `localStorage` e mais nada. Ele
     continuava válido por sete dias, e quem tivesse copiado aquele texto — de
     um navegador compartilhado, de um log — entrava sem obstáculo. */
  const u = await usuarioComSenha("logout");
  const sessao = await (await entrar(u.login, SENHA)).json();
  const cabecalhos = {
    Authorization: `Bearer ${sessao.token}`,
    "x-tenant-slug": A.tenant.slug,
  };

  const antes = await fetch(`${api.base}/api/auth/me`, { headers: cabecalhos });
  assert.equal(antes.status, 200, "a sessão tem de valer antes do logout");

  const saida = await fetch(`${api.base}/api/auth/logout`, { method: "POST", headers: cabecalhos });
  assert.equal(saida.status, 200);

  const depois = await fetch(`${api.base}/api/auth/me`, { headers: cabecalhos });
  assert.equal(depois.status, 401, "o token continuou valendo depois de sair");
  assert.equal((await depois.json()).sessaoEncerrada, true);
});

test("sair num lugar NÃO derruba as outras sessões da pessoa", async () => {
  /* Por sessão e não por usuário: sair no celular não pode matar o painel
     aberto no computador, no meio do trabalho. É o motivo de existir a tabela
     `SessaoRevogada` em vez de um carimbo no `Usuario`. */
  const u = await usuarioComSenha("duas");
  const celular = await (await entrar(u.login, SENHA)).json();
  const computador = await (await entrar(u.login, SENHA)).json();

  await fetch(`${api.base}/api/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${celular.token}` },
  });

  const morta = await fetch(`${api.base}/api/auth/me`, {
    headers: { Authorization: `Bearer ${celular.token}`, "x-tenant-slug": A.tenant.slug },
  });
  const viva = await fetch(`${api.base}/api/auth/me`, {
    headers: { Authorization: `Bearer ${computador.token}`, "x-tenant-slug": A.tenant.slug },
  });

  assert.equal(morta.status, 401, "a sessão de quem saiu tem de morrer");
  assert.equal(viva.status, 200, "a outra sessão da MESMA pessoa tem de continuar");
});

test("sair sem token, ou com token podre, responde 200 mesmo assim", async () => {
  /* Sair não pode falhar. Um erro aqui deixaria a pessoa presa numa tela com um
     botão que não funciona — e o desfecho dela (apagar a sessão local)
     acontece de qualquer jeito. */
  const semNada = await fetch(`${api.base}/api/auth/logout`, { method: "POST" });
  assert.equal(semNada.status, 200);

  const forjado = await fetch(`${api.base}/api/auth/logout`, {
    method: "POST",
    headers: { Authorization: "Bearer isto.nao.e-um-token" },
  });
  assert.equal(forjado.status, 200);

  /* E um token forjado não pode inserir linha nenhuma na tabela de revogação —
     é `jwt.verify` e não `decode` que decide. */
  const linhas = await prisma.sessaoRevogada.count({
    where: { usuario: { tenantId: A.tenant.id }, jti: { contains: "nao" } },
  });
  assert.equal(linhas, 0);
});
