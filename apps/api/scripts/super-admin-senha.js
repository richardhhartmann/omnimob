import "dotenv/config";
import bcrypt from "bcryptjs";
import prismaPkg from "@prisma/client";

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
 * Como apontar para produção: rode com a DATABASE_URL de produção no ambiente.
 *
 *   bash:        DATABASE_URL="postgresql://..." node scripts/super-admin-senha.js --senha "..."
 *   PowerShell:  $env:DATABASE_URL="postgresql://..."; node scripts/super-admin-senha.js --senha "..."
 *
 * A senha nunca é impressa, nem no modo de listagem: o que fica registrado é só
 * o e-mail e se a conta está ativa.
 */

const { PrismaClient } = prismaPkg;
const prisma = new PrismaClient();

const arg = (nome) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const email = arg("email") || process.env.SUPER_ADMIN_EMAIL || "super@omnimob.app";
const senha = arg("senha");
const nome = arg("nome") || process.env.SUPER_ADMIN_NOME || "Super Admin";
const renomear = arg("renomear");

// Sem a URL do banco o Prisma falharia com um erro que não explica nada.
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não definida. Rode com a URL do banco no ambiente.");
  process.exit(1);
}

// Mostra em qual banco vamos mexer, sem revelar a senha da conexão.
const alvo = process.env.DATABASE_URL.replace(/\/\/[^@]*@/, "//<credenciais>@");
console.log(`banco: ${alvo}\n`);

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
  await prisma.superAdmin.create({ data: { email, nome, senha: hash, ativo: true } });
  console.log(`✓ Super-admin criado: ${email}`);
}

await prisma.$disconnect();
