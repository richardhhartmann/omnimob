import "dotenv/config";
import jwt from "jsonwebtoken";
import express from "express";
import prismaPkg from "@prisma/client";

/* ────────────────────────────────────────────────────────────────────────────
   Andaime dos testes de integração.

   POR QUE INTEGRAÇÃO E NÃO UNIDADE: os três vazamentos entre imobiliárias que
   apareceram neste projeto (cargos globais, tipos de imóvel globais, `cargoCodigo`
   de outra empresa) moravam todos na junção rota + query. Nenhum teste de
   função pura teria pego qualquer um deles — o `where` que faltava era exatamente
   o que não estava lá para ser testado.

   POR QUE CONTRA O BANCO DE DEV: o filtro de tenant é uma propriedade da
   consulta, e consulta simulada não filtra nada. Um mock devolveria o que o
   teste mandasse devolver, que é o oposto do que se quer verificar.

   COMO NÃO SUJAR O BANCO: cada teste cria as próprias imobiliárias com slug
   marcado (`zz-teste-…`) e as apaga no fim, inclusive se falhar. O `onDelete:
   Cascade` do schema leva junto cargos, tipos, usuários e imóveis. `limparRestos`
   roda antes de tudo e remove o que uma execução interrompida tenha deixado.
   ──────────────────────────────────────────────────────────────────────────── */

/* NENHUM teste envia e-mail.

   Sem isto, o teste de recuperação de senha usava o transporte de verdade e
   disparava SMTP para `@exemplo.test` a cada execução — lento, barulhento no
   log, e a um erro de digitação de distância de mandar e-mail para o endereço
   de alguém. Zerado aqui, o `notificationService` cai no caminho "sem
   transporte configurado", que só registra no console.

   Antes de qualquer import que leia estas variáveis, por isso no topo. */
delete process.env.RESEND_API_KEY;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;

const { PrismaClient } = prismaPkg;
export const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || "omnimob-dev-secret";

/* Prefixo reconhecível e improvável. É o que permite a limpeza apagar com
   segurança: nada fora dele é tocado, nunca. */
const PREFIXO_GLOBAL = "zz-teste-";

/* O PID entra no prefixo porque o runner do Node roda um PROCESSO POR ARQUIVO,
   em paralelo. Com prefixo único, o `limparRestos` de um arquivo apagava as
   imobiliárias que outro tinha acabado de criar — e a suíte passava rodando os
   arquivos um a um, mas quebrava inteira no `npm test`. Cada processo agora só
   enxerga e apaga o que é dele. */
export const PREFIXO = `${PREFIXO_GLOBAL}${process.pid}-`;

let contador = 0;
const slugUnico = () => `${PREFIXO}${(contador += 1)}`;

/* Limite de idade para varrer restos de OUTRAS execuções: uma hora é muito mais
   que a suíte inteira leva, então nada em voo é alcançado por engano. */
const RESTO_VELHO_MS = 60 * 60 * 1000;

/**
 * Apaga o que este processo criou, e restos antigos de execuções que morreram
 * no meio. Sem o corte por idade, seria impossível limpar lixo de um processo
 * que já não existe sem arriscar apagar o de um vizinho ainda rodando.
 */
export async function limparRestos() {
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: PREFIXO } } });
  await prisma.tenant.deleteMany({
    where: {
      slug: { startsWith: PREFIXO_GLOBAL },
      createdAt: { lt: new Date(Date.now() - RESTO_VELHO_MS) },
    },
  });
}

/**
 * Cria uma imobiliária completa e descartável: cargo de administrador, um cargo
 * comum, um tipo de imóvel com atributo, e um usuário administrador.
 *
 * Devolve tudo o que os testes precisam para montar requisições em nome dela.
 */
export async function criarImobiliariaDeTeste({ plano = "PREMIUM" } = {}) {
  const slug = slugUnico();

  const tenant = await prisma.tenant.create({
    data: { name: `Teste ${slug}`, slug, email: `${slug}@exemplo.test`, plano, statusPagamento: "EM_DIA" },
  });

  const admin = await prisma.cargo.create({
    data: {
      tenantId: tenant.id,
      descricao: "Administrador",
      acessarPainel: true, editarPagina: true, gerenciarImoveis: true, gerenciarLeads: true,
      gerenciarUsuarios: true, gerenciarClientes: true, gerenciarCargos: true,
      verConfiguracoes: true, verRelatorios: true, verAuditoria: true, publicarRedes: true,
    },
  });

  const comum = await prisma.cargo.create({
    data: { tenantId: tenant.id, descricao: "Corretor", acessarPainel: true, gerenciarImoveis: true },
  });

  const tipo = await prisma.tipoImovel.create({
    data: {
      tenantId: tenant.id,
      descricao: "Casa",
      areaFields: [],
      atributos: { create: [{ descricao: "Piscina", grupo: "Lazer" }] },
    },
    include: { atributos: true },
  });

  const usuario = await prisma.usuario.create({
    data: {
      tenantId: tenant.id,
      cargoCodigo: admin.id,
      nome: "Admin de Teste",
      login: `admin-${slug}`,
      email: `admin-${slug}@exemplo.test`,
      // Hash de bcrypt inválido de propósito: nenhum teste faz login por senha,
      // e um hash real aqui só deixaria a criação mais lenta.
      senha: "sem-senha",
    },
  });

  /* Token assinado direto, com o mesmo formato do `montarSessao`. Passar pelo
     login exigiria hash de senha real em todo teste — e o que está sob teste é
     o isolamento, não o login. */
  const token = jwt.sign(
    { userId: usuario.id, tenantId: tenant.id, cargoCodigo: admin.id },
    JWT_SECRET,
    { expiresIn: "10m" },
  );

  return { tenant, slug, cargoAdmin: admin, cargoComum: comum, tipo, atributo: tipo.atributos[0], usuario, token };
}

export async function apagarImobiliaria(tenantId) {
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
}

/**
 * Sobe os routers num servidor efêmero e devolve um cliente HTTP amarrado a uma
 * imobiliária — todo pedido já sai com o token e o `x-tenant-slug` dela.
 */
export async function subirApi(routers) {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  for (const [caminho, router] of Object.entries(routers)) app.use(caminho, router);

  const servidor = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${servidor.address().port}`;

  function comoTenant({ token, slug }) {
    const pedir = async (metodo, caminho, corpo) => {
      const r = await fetch(`${base}${caminho}`, {
        method: metodo,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-tenant-slug": slug,
        },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      });
      // 204 não tem corpo; tentar ler devolveria erro de parse.
      const json = r.status === 204 ? null : await r.json().catch(() => null);
      return { status: r.status, json };
    };
    return {
      get: (c) => pedir("GET", c),
      post: (c, b) => pedir("POST", c, b),
      put: (c, b) => pedir("PUT", c, b),
      del: (c) => pedir("DELETE", c),
    };
  }

  return { base, comoTenant, fechar: () => new Promise((r) => servidor.close(r)) };
}
