import crypto from "node:crypto";
import { prisma } from "../db.js";

/* ────────────────────────────────────────────────────────────────────────────
   Chaves de API da imobiliária.

   O crachá que outra plataforma usa para ler o acervo deste tenant e escrever
   nele. Até aqui o único jeito de tirar dado do Omnimob era o feed VRSync — que
   é público, só de leitura e só de imóveis.

   ── O QUE GUARDAMOS ──

   O HASH, nunca o texto. A chave inteira aparece uma vez, na resposta da
   criação, e some. Depois disso nem nós conseguimos recuperá-la: quem perdeu
   gera outra e revoga a antiga.

   É a mesma regra da senha do usuário, e por um motivo mais forte do que
   parece — esta chave lê a carteira de clientes inteira de uma imobiliária,
   com CPF e telefone. Um dump do banco não pode virar isso.

   ── POR QUE SHA-256 E NÃO BCRYPT ──

   A senha do usuário usa bcrypt porque ela é curta, escolhida por gente e
   adivinhável: o custo alto existe para tornar a força bruta cara. Esta chave
   são 32 bytes de aleatoriedade do sistema — não há dicionário que a alcance, e
   o espaço de busca já é o bastante.

   E há uma razão prática: bcrypt é caro DE PROPÓSITO (~100ms), e a verificação
   aconteceria em toda requisição da integração. Com bcrypt não daríamos para
   buscar pelo hash — teríamos de varrer todas as chaves comparando uma a uma, e
   uma integração que sincroniza mil imóveis pagaria isso mil vezes. Com SHA-256
   o hash é determinístico, o banco tem índice único nele e a busca é direta.
   ──────────────────────────────────────────────────────────────────────────── */

/* O prefixo do texto. Serve para três coisas: a pessoa reconhecer o que colou,
   um varredor de segredo em repositório reconhecer o padrão, e nós recusarmos
   cedo o que claramente não é chave nossa. */
const PREFIXO = "omni_sk_";

/* Quanto do texto fica visível na listagem. Oito caracteres depois do prefixo
   distinguem as chaves de uma imobiliária entre si; e como o resto são 24 bytes
   ainda secretos, não ajudam ninguém a adivinhar o todo. */
const VISIVEL = 8;

/** Todo escopo que existe. A tela e o validador leem daqui — lista dupla
    desencontra na primeira entidade nova. */
export const ESCOPOS = [
  { id: "imoveis:ler", rotulo: "Ler imóveis", grupo: "Imóveis" },
  { id: "imoveis:escrever", rotulo: "Criar e atualizar imóveis", grupo: "Imóveis" },
  { id: "clientes:ler", rotulo: "Ler clientes", grupo: "Clientes", sensivel: true },
  { id: "clientes:escrever", rotulo: "Criar e atualizar clientes", grupo: "Clientes" },
  { id: "usuarios:ler", rotulo: "Ler usuários", grupo: "Equipe", sensivel: true },
  { id: "usuarios:escrever", rotulo: "Criar e atualizar usuários", grupo: "Equipe" },
  { id: "leads:ler", rotulo: "Ler leads", grupo: "Leads", sensivel: true },
  { id: "leads:escrever", rotulo: "Registrar leads", grupo: "Leads" },
];

const ESCOPOS_VALIDOS = new Set(ESCOPOS.map((e) => e.id));

export function escoposValidos(lista) {
  if (!Array.isArray(lista)) return [];
  return [...new Set(lista.filter((e) => ESCOPOS_VALIDOS.has(e)))];
}

/** O hash que vai para o banco. Determinístico, para o índice único servir. */
function hashDaChave(texto) {
  return crypto.createHash("sha256").update(String(texto), "utf8").digest("hex");
}

/* Texto novo. `base64url` e não hex porque hex dobra o comprimento sem
   acrescentar entropia — 32 bytes viram 64 caracteres em hex e 43 em base64url,
   e esta string vai ser colada à mão em campos de painéis alheios. */
function gerarTexto() {
  return `${PREFIXO}${crypto.randomBytes(32).toString("base64url")}`;
}

/**
 * Cria uma chave e devolve o TEXTO INTEGRAL uma única vez.
 * @returns {Promise<{registro: object, texto: string}>}
 */
export async function criarChave({ tenantId, nome, escopos, criadaPor }) {
  const texto = gerarTexto();
  const registro = await prisma.chaveApi.create({
    data: {
      tenantId,
      nome: String(nome || "").trim().slice(0, 60) || "Integração",
      prefixo: texto.slice(0, PREFIXO.length + VISIVEL),
      hash: hashDaChave(texto),
      escopos: escoposValidos(escopos),
      criadaPor: criadaPor || null,
    },
  });
  return { registro: semHash(registro), texto };
}

/** O registro como a tela pode vê-lo. O hash nunca sai daqui. */
export function semHash(chave) {
  if (!chave) return chave;
  const { hash, ...resto } = chave;
  return resto;
}

export async function listarChaves(tenantId) {
  const chaves = await prisma.chaveApi.findMany({
    where: { tenantId },
    orderBy: [{ revogadaEm: "asc" }, { createdAt: "desc" }],
  });
  return chaves.map(semHash);
}

/* Revogar é marcar, não apagar. Quem investiga um acesso indevido precisa saber
   que a chave existiu, quem a criou e quando parou de valer — e uma linha
   apagada não conta essa história. */
export async function revogarChave(tenantId, id) {
  const chave = await prisma.chaveApi.findFirst({ where: { id, tenantId } });
  if (!chave) return null;
  if (chave.revogadaEm) return semHash(chave);
  const atualizada = await prisma.chaveApi.update({
    where: { id },
    data: { revogadaEm: new Date() },
  });
  return semHash(atualizada);
}

/* Quando a chave foi usada pela última vez — a informação que responde "posso
   revogar esta sem quebrar nada?".

   Escrito FORA do caminho da resposta e com granularidade grossa: gravar a cada
   requisição transformaria um GET numa escrita, e uma integração que sincroniza
   mil imóveis daria mil UPDATEs na mesma linha para registrar o mesmo minuto. */
const ULTIMO_USO_MS = 5 * 60 * 1000;

function marcarUso(chave) {
  if (chave.ultimoUso && Date.now() - new Date(chave.ultimoUso).getTime() < ULTIMO_USO_MS) return;
  prisma.chaveApi
    .update({ where: { id: chave.id }, data: { ultimoUso: new Date() } })
    .catch(() => {});
}

/**
 * Encontra a chave viva correspondente ao texto apresentado.
 * @returns {Promise<object|null>} o registro com `tenant` incluído, ou null
 */
export async function autenticarChave(texto) {
  const limpo = String(texto || "").trim();
  // Recusa cedo o que nem tem a nossa cara, sem tocar no banco.
  if (!limpo.startsWith(PREFIXO)) return null;

  const chave = await prisma.chaveApi.findUnique({
    where: { hash: hashDaChave(limpo) },
    include: { tenant: true },
  });
  if (!chave || chave.revogadaEm) return null;
  /* Imobiliária desativada ou cancelada não responde por API, pelo mesmo motivo
     que não alimenta portal: dado de quem saiu não continua circulando. */
  if (!chave.tenant?.ativo || chave.tenant.statusPagamento === "CANCELADO") return null;

  marcarUso(chave);
  return chave;
}
