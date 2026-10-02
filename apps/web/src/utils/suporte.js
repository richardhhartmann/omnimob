import { api } from "../api";

/* ────────────────────────────────────────────────────────────────────────────
   Abertura de chamado.

   O canal existe: `POST /api/chamados` grava na tabela `tb_chamado`, e o
   super-admin lê tudo em Administração › Chamados. A fila em `localStorage`
   que morava aqui — remendo de quando não havia backend — só sobreviveu como
   REDE DE PROTEÇÃO: se a requisição falhar (rede caiu, servidor fora), o texto
   que a pessoa escreveu não é jogado fora, e `reenviarPendentes()` tenta de
   novo na próxima vez que o painel abrir.

   Perder o desabafo de quem está pedindo ajuda é o pior desfecho possível de um
   pedido de ajuda.
   ──────────────────────────────────────────────────────────────────────────── */

const CHAVE_FILA = "domus_chamados_pendentes";
const LIMITE_FILA = 20;

/** E-mail de escape, oferecido quando nem a fila local funciona. */
export const EMAIL_SUPORTE = "suporte@omnimob.app";

/* A cor é a do cartão no primeiro passo do formulário e do selo depois de
   escolhido — a mesma em todo lugar, para o tipo ser reconhecido de relance. */
export const CATEGORIAS_CHAMADO = [
  { valor: "duvida",   rotulo: "Dúvida de uso",     dica: "Não sei como fazer alguma coisa", prioridade: "BAIXA", cor: "#3b82f6" },
  { valor: "problema", rotulo: "Algo não funciona", dica: "Erro, tela travada, botão sem efeito", prioridade: "ALTA", cor: "#ef4444" },
  { valor: "cobranca", rotulo: "Plano e cobrança",  dica: "Assinatura, nota fiscal, upgrade", prioridade: "MEDIA", cor: "#10b981" },
  { valor: "sugestao", rotulo: "Sugestão",          dica: "Uma ideia do que faltou", prioridade: "BAIXA", cor: "#f59e0b" },
  { valor: "outro",    rotulo: "Outro",             dica: "Não se encaixa nos anteriores", prioridade: "MEDIA", cor: "#8b5cf6" },
];

/** "Dúvida de uso" a partir de "duvida" — para listas e fichas. */
export const ROTULO_CATEGORIA = Object.fromEntries(CATEGORIAS_CHAMADO.map((c) => [c.valor, c.rotulo]));

/* O status do chamado, como o CLIENTE o lê. A cor diz de quem é a vez: rosa é
   "o suporte espera você", âmbar é "estão com ele", e o verde fecha. */
export const STATUS_CHAMADO = {
  ABERTO:             { rotulo: "Aberto",          cor: "#818cf8", dica: "Recebido. O suporte ainda vai responder." },
  EM_ATENDIMENTO:     { rotulo: "Em atendimento",  cor: "#f59e0b", dica: "Alguém do suporte está com o seu chamado." },
  AGUARDANDO_CLIENTE: { rotulo: "Aguardando você", cor: "#ec4899", dica: "O suporte respondeu e espera a sua resposta." },
  RESOLVIDO:          { rotulo: "Resolvido",       cor: "#10b981", dica: "Fechado. Se voltou a acontecer, é só reabrir." },
};

/* Avisa o resto do painel que algo mudou nos chamados (abrir marca o visto,
   responder, encerrar): o selo do avatar desce AGORA, e não na próxima volta
   do relógio. */
export const EVENTO_CHAMADOS = "omnimob:chamados-mudaram";
export const avisarQueChamadosMudaram = () => {
  try { window.dispatchEvent(new CustomEvent(EVENTO_CHAMADOS)); } catch { /* fora do navegador */ }
};

/** "hoje, 14:32" para o recente; a data cheia para o resto. */
export function quandoChamado(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dias = Math.floor((Date.now() - d.getTime()) / 86400000);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (dias <= 0) return `hoje, ${hora}`;
  if (dias === 1) return `ontem, ${hora}`;
  return `${d.toLocaleDateString("pt-BR")} ${hora}`;
}

/* A prioridade sai da categoria, não de um seletor.

   Pedir para a própria pessoa classificar a urgência do que ela está sofrendo
   não produz uma fila: produz uma coluna inteira de "urgente". O que ela sabe
   dizer com precisão é a NATUREZA do problema — e "algo não funciona" é
   objetivamente mais urgente que "tenho uma ideia". */
export function prioridadeDaCategoria(categoria) {
  return CATEGORIAS_CHAMADO.find((c) => c.valor === categoria)?.prioridade || "MEDIA";
}

function lerFila() {
  try {
    const bruto = JSON.parse(localStorage.getItem(CHAVE_FILA) || "[]");
    return Array.isArray(bruto) ? bruto : [];
  } catch {
    return [];
  }
}

function gravarFila(fila) {
  try {
    localStorage.setItem(CHAVE_FILA, JSON.stringify(fila.slice(-LIMITE_FILA)));
    return true;
  } catch {
    // Navegador anônimo, cota estourada, storage bloqueado.
    return false;
  }
}

/**
 * Abre um chamado.
 *
 * @param {string} tenantSlug
 * @param {object} chamado
 * @param {string} chamado.titulo
 * @param {string} chamado.descricao
 * @param {string} chamado.categoria
 * @param {string[]} [chamado.prints]   URLs no Cloudinary
 * @param {string} [chamado.rota]       tela de onde o chamado partiu
 * @returns {Promise<{numero: number|null, enviado: boolean, guardado: boolean}>}
 */
export async function abrirChamado(tenantSlug, { titulo, descricao, categoria, prints = [], rota } = {}) {
  const corpo = {
    titulo: String(titulo || "").trim(),
    descricao: String(descricao || "").trim(),
    categoria: String(categoria || "duvida"),
    prioridade: prioridadeDaCategoria(categoria),
    prints,
    rota: rota || (typeof window !== "undefined" ? window.location.pathname : ""),
  };

  try {
    const criado = await api.abrirChamado(tenantSlug, corpo);
    return { numero: criado.numero, enviado: true, guardado: false };
  } catch (erro) {
    /* Erro de VALIDAÇÃO não vai para a fila: reenviar um texto que o servidor
       já recusou só entupiria a fila com algo que nunca vai passar. Quem trata
       isso é a tela, mostrando o que faltou. */
    if (erro?.status === 400) throw erro;

    const guardado = gravarFila([
      ...lerFila(),
      { ...corpo, tenantSlug, criadoEm: new Date().toISOString() },
    ]);
    return { numero: null, enviado: false, guardado };
  }
}

/** Chamados que ainda não saíram deste navegador. */
export function chamadosPendentes() {
  return lerFila();
}

/**
 * Tenta despachar o que ficou preso. Chamada na entrada do painel: quem teve
 * uma falha de rede na semana passada não deveria precisar reescrever nada.
 * Só remove da fila o que o servidor aceitou.
 */
export async function reenviarPendentes(tenantSlug) {
  const fila = lerFila();
  if (!fila.length) return { enviados: 0, pendentes: 0 };

  const restantes = [];
  let enviados = 0;

  for (const item of fila) {
    if (item.tenantSlug && item.tenantSlug !== tenantSlug) {
      // De outra imobiliária (mesma máquina, outro login). Não é nosso para
      // mandar — fica esperando quem o abriu voltar.
      restantes.push(item);
      continue;
    }
    try {
      // eslint-disable-next-line no-await-in-loop
      await api.abrirChamado(tenantSlug, item);
      enviados += 1;
    } catch (erro) {
      // Recusa definitiva morre aqui; falha de rede tenta de novo depois.
      if (erro?.status !== 400) restantes.push(item);
    }
  }

  gravarFila(restantes);
  return { enviados, pendentes: restantes.length };
}
