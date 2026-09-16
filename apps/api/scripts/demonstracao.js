import "dotenv/config";
import { randomBytes } from "node:crypto";
import {
  prisma, hashPassword,
  TENANTS_DEV, USUARIOS_DEV, IMOVEIS_DEV, CLIENTES_DEV, VENDAS_DEV,
  seedTenants, seedCargos, seedTipos, seedUsuarios, seedClientes, seedImoveis, seedVendas,
} from "../prisma/seed.js";

/* ────────────────────────────────────────────────────────────────────────────
   A imobiliária de DEMONSTRAÇÃO — a que o "Ver por dentro" da landing abre.

     npm run demonstracao                      → cria/atualiza no banco do .env (dev)
     INFISICAL_ENV=prod npm run demonstracao   → idem, no banco de produção

   ── O QUE ELA É ──
   A `imobiliaria-centro` do seed de dev, copiada com outro slug: mesma equipe,
   mesmos dez imóveis, clientes, venda, leads e métricas — é o acervo que o
   tour guiado percorre, e ele foi escrito olhando para esses dados. Ids e
   logins ganham o prefixo `demo-` porque login é ÚNICO no banco inteiro, e
   porque os dois conjuntos convivem no banco de dev.

   ── O QUE MUDA ──
   1. AS FOTOS. O seed usa placeholders do picsum — paisagem, gato, o que
      vier —, e isso numa demonstração diz "produto de brinquedo". Aqui cada
      imóvel recebe fotos de imóvel de verdade, escolhidas por tipo
      (apartamento, casa, cobertura, sala comercial…), do Unsplash — licença
      livre para uso comercial sem atribuição (unsplash.com/license). São
      endereços diretos da CDN deles, os mesmos que o site do Unsplash serve.
   2. A CONTA. Premium, com os dois módulos, EM_DIA e sem vencimento: a
      demonstração não pode cair na faxina de trials nem no aviso de
      vencimento, e precisa mostrar o produto inteiro.
   3. A SENHA. Os usuários da `imobiliaria-centro` têm senha "admin". Aqui é
      uma senha ALEATÓRIA, impressa UMA vez no fim: a sessão da demonstração é
      emitida pelo servidor, sem senha, e é somente leitura — mas a conta é de
      verdade, e com senha "admin" qualquer visitante entraria pelo login normal
      e ESCREVERIA nela, passando por cima da trava inteira. Guarde a senha no
      cofre; ela é o que abre "Entrar no tenant" no super-admin para editar o
      acervo da demonstração.

   Idempotente: rodar de novo atualiza o que existe. A senha só é redefinida
   com `--senha-nova` — sem isso, rodar para atualizar fotos não invalida a
   senha guardada.
   ──────────────────────────────────────────────────────────────────────────── */

const ORIGEM = "imobiliaria-centro";
const SLUG = "demonstracao";
const PREFIXO = "demo-";

/* As fotos, por imóvel de origem (`seed-prop-N`), na ordem em que aparecem.
   Ids do Unsplash (`images.unsplash.com/photo-<id>`), conferidos um a um numa
   prancha antes de entrar aqui. Imóvel ACTIVE recebe 4; DRAFT/INACTIVE, 2. */
const FOTOS = {
  // Apartamento 2 quartos no Centro: o prédio, a sala, a cozinha, o quarto
  "seed-prop-1": ["1594484208280-efa00f96fc21", "1522708323590-d24dbb6b0267", "1484154218962-a197022b5858", "1616594039964-ae9021a400a0"],
  // Casa térrea com quintal
  "seed-prop-2": ["1570129477492-45c003edd2be", "1502672260266-1c1ef2d93688", "1600585152220-90363fe7e115", "1505873242700-f289a29e1e0f"],
  // Cobertura duplex: a casa com piscina, a sala com escada, o quarto, a fachada
  "seed-prop-3": ["1600596542815-ffad4c1539a9", "1600566753086-00f18fb6b3ea", "1600573472591-ee6b68d14c68", "1512917774080-9991f1c4c750"],
  // Studio mobiliado
  "seed-prop-4": ["1524758631624-e2822e304c36", "1586023492125-27b2c045efd7", "1519643381401-22c77e60520e", "1493809842364-78817add7ffb"],
  // Kitnet compacta: o prédio e ambientes pequenos
  "seed-prop-5": ["1574362848149-11496d93a7c7", "1536376072261-38c75010e6c9", "1560185007-cde436f6a4d0", "1600210492486-724fe5c67fb0"],
  // Sobrado 3 suítes em obras (rascunho, 2 fotos)
  "seed-prop-6": ["1580587771525-78b9dba3b914", "1613490493576-7fde63acd811"],
  // Sala comercial mobiliada
  "seed-prop-7": ["1560448204-e02f11c3d0e2", "1554995207-c18c203602cb", "1567767292278-a4f21aa2d36e", "1600607687939-ce8a6c25118c"],
  // Terreno plano (inativo, 2 fotos): o terreno e a rua do bairro
  "seed-prop-8": ["1500382017468-9049fed747ef", "1605276374104-dee2a0ed3cd6"],
  // Loft industrial reformado
  "seed-prop-9": ["1518780664697-55e3ad937233", "1583608205776-bfd35f0d9f83", "1565182999561-18d7dc61c393", "1600585154340-be6161a56a0c"],
  // Galpão logístico: os vãos livres e as fachadas
  "seed-prop-10": ["1497366216548-37526070297c", "1497366811353-6870744d04b2", "1600047509807-ba8f99d2cdde", "1523217582562-09d0def993a6"],
};
const urlDaFoto = (id) => `https://images.unsplash.com/photo-${id}?w=1600&q=80&auto=format&fit=crop`;

/* ── A derivação ──────────────────────────────────────────────────────────── */

const soDaOrigem = (lista) => lista.filter((x) => x.tenantSlug === ORIGEM);
const idDemo = (id) => id.replace(/^seed-/, PREFIXO);
const loginDemo = (login) => `${PREFIXO}${login}`;

const origem = TENANTS_DEV.find((t) => t.slug === ORIGEM);
const TENANT = {
  ...origem,
  slug: SLUG,
  name: "Imobiliária Demonstração",
  email: "demonstracao@omnimob.app",
  description: "Imobiliária de exemplo da Omnimob: o painel que a landing mostra por dentro.",
  slogan: "Veja como a sua imobiliária ficaria aqui.",
  showcaseHeadline: "Imóveis selecionados para o seu perfil",
  /* O que a torna uma conta que NÃO cai: paga, completa e sem vencimento. */
  plano: "PREMIUM",
  statusPagamento: "EM_DIA",
  proximoVencimento: null,
  modulos: ["HUB", "FLOW"],
  /* As duas recepções já vistas: quem entrar por "Entrar no tenant" não recebe
     o assistente de boas-vindas de uma conta recém-criada. */
  boasVindasVistas: ["teste", "assinante"],
};

const USUARIOS = soDaOrigem(USUARIOS_DEV).map((u) => ({ ...u, login: loginDemo(u.login), tenantSlug: SLUG }));
const CLIENTES = soDaOrigem(CLIENTES_DEV).map((c) => ({ ...c, id: idDemo(c.id), tenantSlug: SLUG }));
const IMOVEIS = soDaOrigem(IMOVEIS_DEV).map((im) => ({ ...im, id: idDemo(im.id), tenantSlug: SLUG, fotos: FOTOS[im.id] || [] }));
const VENDAS = soDaOrigem(VENDAS_DEV).map((v) => ({
  ...v,
  id: idDemo(v.id),
  tenantSlug: SLUG,
  propertyId: idDemo(v.propertyId),
  clienteId: idDemo(v.clienteId),
  usuarioLogin: loginDemo(v.usuarioLogin),
}));

/* A foto k do imóvel: da lista dele; se faltar, cai no placeholder e avisa. */
function fotoDe(im, k) {
  const id = im.fotos?.[k];
  if (!id) {
    console.warn(`    ! ${im.id}: sem foto ${k + 1} na lista — placeholder`);
    return `https://picsum.photos/seed/${im.id}-${k}/1024/768`;
  }
  return urlDaFoto(id);
}

/* ── Execução ─────────────────────────────────────────────────────────────── */

const senhaNova = process.argv.includes("--senha-nova");
const alvo = (process.env.DATABASE_URL || "").replace(/\/\/[^@]*@/, "//<credenciais>@");
console.log(`\n🏢 Imobiliária de demonstração (${SLUG})\n   banco: ${alvo}\n`);

const jaExiste = await prisma.tenant.findUnique({ where: { slug: SLUG }, select: { id: true } });
const admin = jaExiste
  ? await prisma.usuario.findUnique({ where: { login: loginDemo("admin") }, select: { id: true, senha: true } })
  : null;

/* A senha: gerada na criação, ou quando pedida. Fora isso, a que já existe
   fica — `seedUsuarios` regrava o hash que receber, então passamos o atual. */
let senhaTexto = null;
let senhaHash = admin?.senha || null;
if (!senhaHash || senhaNova) {
  senhaTexto = randomBytes(15).toString("base64url");
  senhaHash = await hashPassword(senhaTexto);
}

/* `seedTenants` faz upsert com `update: {}` — de propósito, para o seed de dev
   não sobrescrever o que alguém mexeu à mão. Aqui os campos da CONTA (plano,
   status, módulos) precisam valer sempre, então eles entram por um update
   próprio depois. */
const tenants = await seedTenants([TENANT]);
await prisma.tenant.update({
  where: { slug: SLUG },
  data: {
    plano: TENANT.plano,
    statusPagamento: TENANT.statusPagamento,
    proximoVencimento: null,
    modulos: TENANT.modulos,
    boasVindasVistas: TENANT.boasVindasVistas,
    ativo: true,
  },
});
const cargos = await seedCargos(tenants);
const { tiposMap, atributosMap } = await seedTipos(tenants);
await seedUsuarios(tenants, cargos, USUARIOS, senhaHash);
await seedClientes(tenants, CLIENTES);
await seedImoveis(tenants, tiposMap, atributosMap, IMOVEIS, fotoDe);
await seedVendas(tenants, VENDAS);

console.log(`\n✅ ${TENANT.name} pronta: slug "${SLUG}", ${IMOVEIS.length} imóveis, ${USUARIOS.length} usuários.`);
console.log(`   DEMO_TENANT_SLUG=${SLUG}`);
if (senhaTexto) {
  console.log(`\n🔑 Senha do ${loginDemo("admin")} (aparece UMA vez — guarde no cofre):\n   ${senhaTexto}\n`);
} else {
  console.log("   Senha mantida. Para gerar outra: npm run demonstracao -- --senha-nova\n");
}

await prisma.$disconnect();
