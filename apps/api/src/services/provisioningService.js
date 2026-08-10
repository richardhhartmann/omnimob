import bcrypt from "bcryptjs";
import { getGlobalPrisma } from "./tenantRegistry.js";

/**
 * ─── Provisioning Service ────────────────────────────────────────────────────
 * Encapsula a criação/configuração de um novo tenant. Hoje, num banco único,
 * "provisionar" significa: registrar o tenant no banco global, configurar
 * licença/tema padrão e criar o usuário administrador inicial.
 *
 * SEAM DE MIGRAÇÃO: quando a plataforma evoluir para banco/schema-por-tenant,
 * os passos "criar banco", "aplicar estrutura inicial", "criar índices/
 * procedures" e "registrar servidor" entram AQUI (ver TODOs), sem alterar quem
 * chama o serviço (rotas admin).
 */

const CARGO_ADMIN = "Administrador";
const STATUS_VALIDOS = ["TRIAL", "EM_DIA", "ATRASADO", "CANCELADO"];

// Sem 0/O/1/l/I: a senha vai por e-mail (ou é ditada por telefone) e alguém vai
// digitá-la à mão.
const ALFABETO = "abcdefghjkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789";

export function senhaTemporaria(tamanho = 10) {
  let saida = "";
  for (let i = 0; i < tamanho; i += 1) {
    saida += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  }
  return saida;
}

export function slugValido(slug) {
  return typeof slug === "string" && /^[a-z0-9-]+$/.test(slug);
}

/**
 * Provisiona um novo tenant de ponta a ponta.
 *
 * `adminLogin`/`adminSenha` são opcionais e existem para quem já tem um valor
 * em mãos (o trial monta o login antes de chamar). Sem eles o acesso nasce
 * assim mesmo — um tenant sem nenhum usuário é um ambiente em que ninguém
 * consegue entrar, e o passo manual seguinte sempre acabaria sendo este.
 *
 * @returns {{ tenant, adminCreated: boolean, adminLogin: string, adminSenha: string, warning: string|null }}
 * @throws  {Error} com `.code`: "SLUG_INVALIDO" | "SLUG_EM_USO"
 */
export async function provisionTenant(input = {}) {
  const prisma = getGlobalPrisma();
  const {
    name,
    slug,
    email = "",
    whatsapp = "",
    plano = null,
    statusPagamento,
    valorMensal,
    proximoVencimento,
    adminLogin,
    adminSenha,
  } = input;

  if (!name || !slug) {
    const err = new Error("Nome e slug são obrigatórios.");
    err.code = "SLUG_INVALIDO";
    throw err;
  }
  if (!slugValido(slug)) {
    const err = new Error("Slug inválido (use minúsculas, números e hifens).");
    err.code = "SLUG_INVALIDO";
    throw err;
  }

  const existente = await prisma.tenant.findUnique({ where: { slug } });
  if (existente) {
    const err = new Error("Já existe um tenant com esse slug.");
    err.code = "SLUG_EM_USO";
    throw err;
  }

  // TODO (banco-por-tenant): criar banco físico + aplicar estrutura inicial
  // (tabelas, índices, procedures, functions, triggers) e registrar
  // servidor/porta/engine no registro global antes de continuar.

  // 1. Registra o tenant no banco global (com tema padrão implícito do schema).
  const tenant = await prisma.tenant.create({
    data: {
      name,
      slug,
      email,
      whatsapp,
      plano,
      // 2. Configura licença/cobrança inicial.
      statusPagamento: STATUS_VALIDOS.includes(statusPagamento) ? statusPagamento : "TRIAL",
      valorMensal: valorMensal != null && valorMensal !== "" ? Number(valorMensal) : null,
      proximoVencimento: proximoVencimento ? new Date(proximoVencimento) : null,
    },
  });

  // 3. Cria o usuário administrador inicial. O login sai do slug (que é único,
  //    logo o login também é) e a senha é provisória por definição.
  const login = String(adminLogin || `admin-${slug}`).slice(0, 60);
  const senha = adminSenha || senhaTemporaria();
  let adminCreated = false;
  let warning = null;

  const cargo = await prisma.cargo.findFirst({ where: { descricao: CARGO_ADMIN } });
  if (!cargo) {
    warning = `Tenant criado, mas cargo '${CARGO_ADMIN}' não existe (rode o seed base).`;
  } else {
    try {
      const senhaHash = await bcrypt.hash(senha, 10);
      await prisma.usuario.create({
        data: {
          login,
          nome: `Admin ${name}`,
          senha: senhaHash,
          tenantId: tenant.id,
          cargoCodigo: cargo.id,
          ativo: true,
          /* A senha inicial é gerada por nós e trafega por e-mail — ou seja,
             fica registrada na caixa de entrada de alguém. Obrigar a troca no
             primeiro acesso encerra a validade dela ali mesmo. */
          forcaAlterarSenha: true,
        },
      });
      adminCreated = true;
    } catch (e) {
      warning = `Tenant criado, mas falha ao criar usuário admin: ${
        e.code === "P2002" ? "login já existe" : e.message
      }`;
    }
  }

  return { tenant, adminCreated, adminLogin: login, adminSenha: senha, warning };
}
