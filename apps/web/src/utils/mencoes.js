import { ABAS_CONFIG } from "./abasConfiguracoes";
import { RELATORIOS } from "./relatorios";

/* ────────────────────────────────────────────────────────────────────────────
   AS TELAS QUE O SUPORTE PODE CITAR NUM CHAMADO — o "@" da caixa de resposta.

   Na caixa de entrada do suporte (super-admin › Chamados), digitar "@" abre a
   lista destas telas. A escolhida entra na mensagem como uma MENÇÃO:

       @[Equipe › Cargos](/cargos)

   e o cliente, ao ler a resposta em Meus chamados, clica no nome e vai direto
   para a tela. O formato é texto puro de propósito: a mensagem continua sendo
   uma string no banco, lê-se bem onde ninguém a interpreta (o e-mail, um
   registro antigo), e quem sabe desenhar transforma o trecho em link.

   ── SEGURANÇA ──

   A menção só leva a CAMINHO INTERNO: começa com uma barra e nunca com duas. É
   a mesma regra do servidor (`MENCAO_RE` em services/chamados.js) — um texto
   digitado à mão no formato da menção não vira link para fora do sistema.

   ── OS NOMES ──

   Os do menu ("Grupo › Título"), que é como o cliente as procura.
   Configurações e Relatórios saem das listas que o próprio menu usa: aba nova
   entra aqui sem ninguém lembrar desta lista.
   ──────────────────────────────────────────────────────────────────────────── */

export const MENCAO = /@\[([^[\]\n]{1,120})\]\((\/(?!\/)[A-Za-z0-9\-._~/?=&%#+]{0,300})\)/g;

/** (grupo, título, caminho). Título nulo = a própria tela do grupo. */
const FIXAS = [
  [null, "Dashboard", "/"],
  ["Imóveis", "Gerenciar Imóveis", "/imoveis"],
  ["Imóveis", "Novo Imóvel", "/imoveis/novo"],
  ["Imóveis", "Portfólio Ativo", "/imoveis/portfolio"],
  ["Imóveis", "Categoria de Imóvel", "/tipos-imovel"],
  ["Relacionamento", "Relatórios", "/relatorios"],
  ["Relacionamento", "Clientes", "/clientes"],
  ["Equipe", "Usuários", "/usuarios"],
  ["Equipe", "Novo usuário", "/usuarios/novo"],
  ["Equipe", "Cargos", "/cargos"],
  ["Equipe", "Registro de Atividade", "/auditoria"],
  ["Omniflow", "Dashboard do Flow", "/flow"],
  ["Omniflow", "Funil de Vendas", "/flow/funil"],
  ["Omniflow", "Todos os Negócios", "/flow/negocios"],
  ["Omniflow", "Fontes de Captação", "/flow/captacao"],
  ["Omniflow", "Contratos", "/flow/contratos"],
  ["Omniflow", "Modelos de Minuta", "/flow/modelos"],
  ["Omniflow", "Fila de Validação", "/flow/validacao"],
  ["Omniflow", "Comissões", "/flow/comissoes"],
  ["Ajuda", "Meus chamados", "/suporte"],
];

/** [{ rotulo, grupo, titulo, caminho }] na ordem do menu. */
export function catalogoDeTelas() {
  const lista = [
    ...FIXAS.map(([grupo, titulo, caminho]) => ({ grupo, titulo, caminho })),
    ...RELATORIOS.map((r) => ({ grupo: "Relatórios", titulo: r.title, caminho: `/relatorios?ver=${r.param}` })),
    { grupo: "Configurações", titulo: "Configurações", caminho: "/configuracoes" },
    ...ABAS_CONFIG.map((a) => ({ grupo: "Configurações", titulo: a.label, caminho: `/configuracoes?ver=${a.key}` })),
  ];
  return lista.map((t) => ({
    ...t,
    grupo: t.grupo || "",
    rotulo: t.grupo && t.grupo !== t.titulo ? `${t.grupo} › ${t.titulo}` : t.titulo,
  }));
}

/** O texto em pedaços: `{ texto }` ou `{ rotulo, caminho }`. */
export function partesDaMensagem(texto) {
  const s = String(texto ?? "");
  const partes = [];
  const re = new RegExp(MENCAO.source, "g");
  let ultimo = 0;
  let m;
  while ((m = re.exec(s))) {
    if (m.index > ultimo) partes.push({ texto: s.slice(ultimo, m.index) });
    partes.push({ rotulo: m[1], caminho: m[2] });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < s.length) partes.push({ texto: s.slice(ultimo) });
  return partes;
}

export const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/* "@Equipe › Cargos" → "@[Equipe › Cargos](/cargos)". A tela escolhida entra
   LEGÍVEL na caixa, e só vira a marcação ao enviar. O rótulo mais longo
   primeiro: "@Configurações" (a tela do grupo) não pode comer o começo de
   "@Configurações › Perfil". */
export function comMencoes(texto, telas = catalogoDeTelas()) {
  const ordem = [...telas].sort((a, b) => b.rotulo.length - a.rotulo.length);
  let saida = String(texto ?? "");
  const guardadas = [];
  for (const t of ordem) {
    /* Substitui por um marcador, e não direto pela menção: senão a menção
       "@[Configurações › Perfil](…)" seria achada de novo pelo rótulo curto
       "@Configurações" na volta seguinte. */
    saida = saida.split(`@${t.rotulo}`).join(`\u0000${guardadas.length}\u0000`);
    guardadas.push(`@[${t.rotulo}](${t.caminho})`);
  }
  return saida.replace(/\u0000(\d+)\u0000/g, (_, i) => guardadas[Number(i)]);
}

/**
 * A busca do "@" no ponto do cursor: `{ inicio, fim, consulta }` ou nulo.
 * Uma tela já escolhida seguida de texto não reabre a lista — sem isto, cada
 * palavra digitada depois dela voltava a sugeri-la.
 */
export function consultaDoArroba(valor, cursor, telas = catalogoDeTelas()) {
  const antes = String(valor).slice(0, cursor);
  const m = /(^|\s)@([^@\n]{0,40})$/.exec(antes);
  if (!m) return null;
  const consulta = m[2];
  const normal = semAcento(consulta);
  if (telas.some((t) => normal.startsWith(semAcento(t.rotulo)))) return null;
  return { inicio: cursor - consulta.length - 1, fim: cursor, consulta };
}

/** As telas que casam com o que se digitou depois do "@", até 8. */
export function filtrarTelas(consulta, telas = catalogoDeTelas()) {
  const palavras = semAcento(consulta).split(/[\s›>]+/).filter(Boolean);
  const achadas = telas.filter((t) => {
    const alvo = semAcento(`${t.rotulo} ${t.caminho}`);
    return palavras.every((p) => alvo.includes(p));
  });
  // O título que COMEÇA com a primeira palavra vem antes.
  if (palavras.length) {
    const p = palavras[0];
    achadas.sort((a, b) => (semAcento(a.titulo).startsWith(p) ? 0 : 1) - (semAcento(b.titulo).startsWith(p) ? 0 : 1));
  }
  return achadas.slice(0, 8);
}
