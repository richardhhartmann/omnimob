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

export const CATEGORIAS_CHAMADO = [
  { valor: "duvida",   rotulo: "Dúvida de uso",     dica: "Não sei como fazer alguma coisa", prioridade: "BAIXA" },
  { valor: "problema", rotulo: "Algo não funciona", dica: "Erro, tela travada, botão sem efeito", prioridade: "ALTA" },
  { valor: "cobranca", rotulo: "Plano e cobrança",  dica: "Assinatura, nota fiscal, upgrade", prioridade: "MEDIA" },
  { valor: "sugestao", rotulo: "Sugestão",          dica: "Uma ideia do que faltou", prioridade: "BAIXA" },
];

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
