import bcrypt from "bcryptjs";
import { getGlobalPrisma } from "./tenantRegistry.js";
import { garantirSubdominioDaCasa } from "./dominioService.js";
import { criarCargosPadrao, CARGO_ADMIN } from "./cargosPadrao.js";
import { criarTiposPadrao } from "./tiposPadrao.js";

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
    /* ── OS MÓDULOS CONTRATADOS ────────────────────────────────────────────
       Vêm da caixa que o comercial marca ao criar a conta. Ausente é `["HUB"]`
       — o que a conta sempre teve — e nunca o pacote completo: o padrão de um
       campo que decide cobrança tem que ser o mais barato, senão um esquecimento
       entrega produto de graça. */
    modulos = null,
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
      ...(Array.isArray(modulos) && modulos.length ? { modulos } : {}),
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

  /* Cada imobiliária ganha o SEU conjunto de cargos.

     Era `findFirst({ descricao: "Administrador" })` — sem tenant, porque a
     tabela não tinha dono. O cliente novo herdava o cargo de outra empresa, e
     dali em diante as duas dividiam as mesmas permissões: mexer numa mexia na
     outra. Também dependia de o seed ter rodado, o que fazia a criação de
     tenant falhar em banco limpo. */
  /* ── Cargos e tipos SÃO INDEPENDENTES, então vão juntos ────────────────────
     Os dois só precisam do `tenant.id`, e nenhum lê o resultado do outro.
     Em série, a imobiliária esperava a soma dos dois; juntos, espera o maior.

     `allSettled` e não `all`: uma falha no catálogo de tipos não pode impedir a
     criação dos cargos, que é o que decide se o administrador consegue entrar.
     Cada um trata a própria falha abaixo. */
  let cargo = null;
  const [resCargos, resTipos] = await Promise.allSettled([
    criarCargosPadrao(prisma, tenant.id),
    criarTiposPadrao(prisma, tenant.id),
  ]);

  if (resCargos.status === "fulfilled") {
    cargo = resCargos.value;
  } else {
    warning = `Tenant criado, mas falha ao criar os cargos: ${resCargos.reason?.message}`;
  }

  /* Catálogo de tipos de imóvel da casa.

     Enquanto `TipoImovel` era global, o cliente novo enxergava o catálogo dos
     outros e ninguém percebia que o provisionamento não criava nenhum. Agora o
     tipo tem dono: sem este passo, o primeiro cadastro de imóvel abriria com a
     lista de tipos vazia. Falha não derruba o tenant — dá para recriar depois,
     e é melhor um catálogo faltando que um cadastro perdido. */
  if (resTipos.status === "rejected") {
    console.warn(`[provisionamento] falha ao criar tipos de imóvel de ${slug}: ${resTipos.reason?.message}`);
    warning = warning || `Tenant criado, mas falha ao criar os tipos de imóvel: ${resTipos.reason?.message}`;
  }

  if (!cargo) {
    warning = warning || `Tenant criado, mas o cargo '${CARGO_ADMIN}' não foi criado.`;
  } else {
    try {
      const senhaHash = await bcrypt.hash(senha, 10);
      await prisma.usuario.create({
        data: {
          login,
          /* Só "Administrador", sem o nome da imobiliária.

             Era `Admin ${name}`, e isso repetia a imobiliária dentro do nome da
             PESSOA: no painel, a barra lateral já diz de quem é a conta no topo,
             e embaixo aparecia "Admin Dev" — o mesmo nome duas vezes na mesma
             tela, uma delas no lugar onde deveria estar quem está usando o
             sistema. Quem assume a conta troca por gente de verdade em
             Configurações; até lá, o cargo basta. */
          nome: "Administrador",
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

  /* Endereço da casa: `<slug>.omnimob.app`.

     Não bloqueia o provisionamento: se a Vercel estiver fora do ar ou sem
     credencial, a imobiliária nasce do mesmo jeito e continua acessível pelo
     caminho `/vitrine/<slug>`. Amarrar a criação do cliente à disponibilidade de
     um serviço externo seria trocar um endereço bonito por um cadastro que
     falha.

     MAS A FALHA PRECISA APARECER. Antes o retorno era descartado e só restava um
     `console.warn` — o tenant nascia, o painel anunciava `<slug>.omnimob.app`
     para o cliente, e o endereço não abria. Ninguém ficava sabendo até alguém
     tentar acessar. Agora vira `warning`, que é o que o painel do super-admin
     mostra ao final da criação, e o `scripts/subdominios.js` conserta depois. */
  const sub = await garantirSubdominioDaCasa(slug);
  if (!sub.ok) {
    const aviso =
      `A imobiliária foi criada, mas o endereço ${sub.host || `${slug}.omnimob.app`} não ficou ` +
      `pronto (${sub.motivo}). A vitrine responde por /vitrine/${slug}. ` +
      `Rode 'npm run subdominios -- --aplicar' para reparar.`;
    // Não sobrescreve um aviso anterior (cargos/tipos): os dois importam, e o
    // primeiro é o que aconteceu mais cedo na criação.
    warning = warning ? `${warning} | ${aviso}` : aviso;
  }

  return { tenant, adminCreated, adminLogin: login, adminSenha: senha, warning };
}
