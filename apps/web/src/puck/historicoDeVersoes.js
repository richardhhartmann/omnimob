import { CHAVES, gravarNoTenant, lerDoTenant } from "../utils/chaveDoTenant";

/* ────────────────────────────────────────────────────────────────────────────
   INSTANTÂNEOS DA PÁGINA.

   Uma cópia do documento a cada publicação, para dar meia-volta em algo feito
   ontem — o desfazer do Puck só alcança a sessão aberta, e fechar a aba apaga
   a pilha inteira.

   É o mesmo mecanismo do editor clássico, inclusive o lugar: `localStorage`
   chaveado pelo ID do tenant. A chave é o id e não o slug porque slug muda de
   dono — a imobiliária que se renomeia herdaria o histórico de outra.

   ── POR QUE NÃO NO BANCO ──

   Porque isso é rascunho de quem está desenhando, não dado do cliente. Guardar
   no servidor exigiria decidir retenção, quota e o que acontece quando dois
   navegadores discordam — conversas que o produto não precisa ter para o
   histórico servir ao que serve: consertar um arrependimento na mesma semana.

   O limite é o que evita o outro extremo: sem teto, um mês de edição diária
   enche a cota do navegador e o `localStorage` passa a recusar TUDO — inclusive
   a sessão. Doze é folga para uma semana de trabalho.
   ──────────────────────────────────────────────────────────────────────────── */

const LIMITE = 12;

/* Prefixo próprio: o histórico do editor clássico guarda `showcaseConfig`, e
   este guarda documento do Puck. Os dois formatos na mesma chave fariam a lista
   oferecer versões que a tela não sabe abrir. */
const PREFIXO = `${CHAVES.historicoEditor}_puck`;

export function lerHistorico(tenantId) {
  if (!tenantId) return [];
  try {
    const bruto = JSON.parse(lerDoTenant(PREFIXO, tenantId) || "[]");
    return Array.isArray(bruto) ? bruto : [];
  } catch {
    return [];
  }
}

/**
 * Guarda mais um instantâneo, se ele DIFERIR do último.
 *
 * A comparação existe porque o autosave dispara a cada segundo de silêncio, e
 * sem ela o histórico encheria de doze cópias idênticas — o que é o mesmo que
 * não ter histórico, com o custo de parecer que tem.
 */
export function guardarVersao(tenantId, documento) {
  if (!tenantId || !documento) return lerHistorico(tenantId);

  const atual = lerHistorico(tenantId);
  const texto = JSON.stringify(documento);
  if (atual[0]?.texto === texto) return atual;

  const nova = [{ quando: Date.now(), texto }, ...atual].slice(0, LIMITE);
  gravarNoTenant(PREFIXO, tenantId, JSON.stringify(nova));
  return nova;
}

/** O documento de uma versão, ou `null` se ela estiver ilegível. */
export function documentoDaVersao(versao) {
  try {
    const doc = JSON.parse(versao.texto);
    return Array.isArray(doc?.content) ? doc : null;
  } catch {
    /* Instantâneo corrompido não pode derrubar a tela: o histórico é conforto,
       e uma linha ilegível vale menos que o editor continuar de pé. */
    return null;
  }
}

/** "hoje às 14:32", "ontem às 9:05", "3 de setembro às 18:40". */
export function quandoFoi(quando) {
  const data = new Date(quando);
  const hora = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const hoje = new Date();
  const umDia = 24 * 60 * 60 * 1000;
  const soData = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  const diferenca = soData(hoje) - soData(data);
  if (diferenca === 0) return `hoje às ${hora}`;
  if (diferenca === umDia) return `ontem às ${hora}`;
  return `${data.toLocaleDateString("pt-BR", { day: "numeric", month: "long" })} às ${hora}`;
}
