import "dotenv/config";
import bcrypt from "bcryptjs";
import prismaPkg from "@prisma/client";
import { CARGO_ADMIN_PLATAFORMA, permissoesCompletas } from "../src/services/permissoesSuperAdmin.js";

/**
 * Define a senha do super-admin pela linha de comando.
 *
 *   node scripts/super-admin-senha.js                        → lista quem existe
 *   node scripts/super-admin-senha.js --senha "..."          → define a senha
 *   node scripts/super-admin-senha.js --email a@b --senha "..."
 *   node scripts/super-admin-senha.js --email antigo@x --renomear novo@y --senha "..."
 *
 * Existe porque não há outro caminho: `SUPER_ADMIN_PASSWORD` só é lida pelo
 * seed, o seed não roda no deploy, e mesmo rodando ele se recusa a sobrescrever
 * a senha de um super-admin que já existe (de propósito — senão todo seed em
 * produção reverteria a senha para o valor da env). O app também não expõe rota
 * de troca de senha para este usuário.
 *
 * Em qual banco mexe: o da PLATAFORMA — `PLATAFORMA_DATABASE_URL` se estiver
 * definida, senão `DATABASE_URL`. É a mesma regra do `src/db.js`: os
 * super-admins são as mesmas pessoas em dev e em produção, e vivem num banco
 * só. Com o `.env` de dev apontando para a produção, rodar daqui já é mexer na
 * conta real. Para apontar para outro lugar, sobrescreva no ambiente:
 *
 *   bash:        PLATAFORMA_DATABASE_URL="postgresql://..." node scripts/super-admin-senha.js --senha "..."
 *   PowerShell:  $env:PLATAFORMA_DATABASE_URL="postgresql://..."; node scripts/super-admin-senha.js --senha "..."
 *
 * Conta criada aqui nasce no cargo Administrador (tudo ligado), e o cargo é
 * criado se não existir — é o que permite este script inaugurar um banco de
 * plataforma novo, já que o seed se recusa a semear super-admin em banco
 * externo.
 *
 * A senha nunca é impressa, nem no modo de listagem: o que fica registrado é só
 * o e-mail e se a conta está ativa.
 */

const { PrismaClient } = prismaPkg;
const URL_DO_BANCO = (process.env.PLATAFORMA_DATABASE_URL || process.env.DATABASE_URL || "").trim();
const prisma = new PrismaClient(URL_DO_BANCO ? { datasourceUrl: URL_DO_BANCO } : undefined);

const arg = (nome) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const email = arg("email") || process.env.SUPER_ADMIN_EMAIL || "super@omnimob.app";
const senha = arg("senha");
const nome = arg("nome") || process.env.SUPER_ADMIN_NOME || "Super Admin";
const renomear = arg("renomear");

// Sem a URL do banco o Prisma falharia com um erro que não explica nada.
if (!URL_DO_BANCO) {
  console.error("Nem PLATAFORMA_DATABASE_URL nem DATABASE_URL definidas. Rode com a URL do banco no ambiente.");
  process.exit(1);
}

// Mostra em qual banco vamos mexer, sem revelar a senha da conexão.
const alvo = URL_DO_BANCO.replace(/\/\/[^@]*@/, "//<credenciais>@");
console.log(`banco da plataforma: ${alvo}\n`);

if (!senha) {
  const todos = await prisma.superAdmin.findMany({
    select: { email: true, nome: true, ativo: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  if (todos.length === 0) {
    console.log("Nenhum super-admin cadastrado.");
  } else {
    console.log(`${todos.length} super-admin(s):\n`);
    for (const a of todos) {
      console.log(
        `  ${a.email.padEnd(32)} ${(a.nome || "").padEnd(20)} ` +
          `${a.ativo ? "ativo" : "INATIVO"}  criado em ${a.createdAt.toISOString().slice(0, 10)}`,
      );
    }
  }
  console.log(`\nPara definir a senha:  node scripts/super-admin-senha.js --senha "..."`);
  await prisma.$disconnect();
  process.exit(0);
}

if (senha.length < 10) {
  console.error("Senha curta demais: use ao menos 10 caracteres.");
  await prisma.$disconnect();
  process.exit(1);
}

// Mesmo custo do seed, para os hashes ficarem consistentes entre as duas vias.
const hash = await bcrypt.hash(senha, 10);
const existente = await prisma.superAdmin.findUnique({ where: { email } });

if (existente) {
  // --renomear troca o e-mail de login da MESMA conta, em vez de criar uma
  // segunda: dois super-admins conviverem só gera dúvida sobre qual vale.
  const data = { senha: hash, ativo: true };
  if (renomear && renomear !== email) {
    const ocupado = await prisma.superAdmin.findUnique({ where: { email: renomear } });
    if (ocupado) {
      console.error(`Já existe um super-admin com ${renomear}. Escolha outro e-mail.`);
      await prisma.$disconnect();
      process.exit(1);
    }
    data.email = renomear;
  }
  await prisma.superAdmin.update({ where: { email }, data });
  console.log(
    data.email
      ? `✓ ${email} renomeado para ${data.email}, com a senha nova.`
      : `✓ Senha redefinida para ${email} (conta reativada, se estava inativa).`,
  );
} else {
  const cargoAdmin = await prisma.cargoSuperAdmin.upsert({
    where: { nome: CARGO_ADMIN_PLATAFORMA },
    update: {},
    create: { nome: CARGO_ADMIN_PLATAFORMA, ...permissoesCompletas() },
  });
  await prisma.superAdmin.create({ data: { email, nome, senha: hash, ativo: true, cargoId: cargoAdmin.id } });
  console.log(`✓ Super-admin criado: ${email} (cargo ${CARGO_ADMIN_PLATAFORMA})`);
}

await prisma.$disconnect();
