import {
  moverPeca,
  redimensionarPeca,
  assentarPecaNova,
  proximaPosicaoLivre,
} from "../../showcase/engine/layoutEngine";
import { parsePieceId, widgetPieceId } from "../../showcase/engine/pieces";
import { WIDGET_LIBRARY } from "../data/biblioteca.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   Executa o plano da IA no documento, uma operação por vez.

   ── A REGRA QUE GOVERNA ESTE ARQUIVO ──

   A IA propõe, a ENGINE dispõe. Nenhuma operação escreve `x`/`y`/`w`/`h` direto
   no config: tudo passa por `moverPeca` e `redimensionarPeca`, exatamente as
   funções que o arrasto do mouse usa. O efeito prático é que a IA não consegue
   produzir um layout inválido nem se quiser — se ela mandar uma peça para cima
   de outra, a cascata desce a de baixo, igualzinho a quando alguém arrasta.

   Isso também é o que torna o resultado EDITÁVEL: o que a IA deixa na tela é
   indistinguível do que uma pessoa deixaria, então continuar mexendo à mão
   funciona sem surpresa.

   ── POR QUE UMA OPERAÇÃO POR VEZ, COM PAUSA ──

   Aplicar as doze de uma vez seria mais rápido e não é o que foi pedido: a ideia
   é ver acontecendo. A pausa entre passos não é enfeite — é o que dá tempo de a
   pessoa associar o movimento ao motivo que está escrito na tela, e é o que
   permite parar no meio.
   ──────────────────────────────────────────────────────────────────────────── */

/* Espaço entre um passo e o próximo. 620ms é o tempo da transição de posição da
   peça (450ms, ver `.builder-piece` no styles.css) mais uma folga para o olho
   alcançar. Abaixo disso os passos se atropelam e viram um borrão. */
export const PAUSA_ENTRE_PASSOS = 620;

const CORES = /^#[0-9a-f]{3,8}$/i;

/** O widget do catálogo, para herdar título e conteúdo padrão do que faltar. */
const doCatalogo = (tipo) => WIDGET_LIBRARY.find((w) => w.type === tipo);

/* Aplica UMA operação e devolve o config novo.
 *
 * Puro de propósito: recebe config, devolve config. Quem cuida de tempo, de
 * seleção e de parar no meio é o hook — aqui não há relógio nem estado. */
export function aplicarOperacao(cfg, modo, op, { novoId }) {
  switch (op.acao) {
    /* `.config` no fim das duas: `moverPeca` e `redimensionarPeca` devolvem um
       objeto com o config E as guias/encostadas que o arrasto usa para desenhar
       o ímã. Sem desembrulhar, o que ia para o documento era `{ config: {...} }`
       — a normalização da gravação seguinte jogava fora, e o efeito era um robô
       que anunciava cada passo e não mexia em nada. */
    case "mover": {
      const atual = pegarRect(cfg, modo, op.alvo);
      if (!atual) return cfg;
      return moverPeca(cfg, modo, op.alvo, {
        x: op.x ?? atual.x,
        y: op.y ?? atual.y,
      }, { encaixar: false }).config;
    }

    case "redimensionar": {
      const atual = pegarRect(cfg, modo, op.alvo);
      if (!atual) return cfg;
      return redimensionarPeca(cfg, modo, op.alvo, {
        w: op.w ?? atual.w,
        h: op.h ?? atual.h,
      }).config;
    }

    case "adicionar": {
      const modelo = doCatalogo(op.tipo);
      if (!modelo) return cfg;
      // Tipo repetido não entra — mesma regra da gaveta de peças.
      if (cfg.widgets.some((w) => w.type === op.tipo)) return cfg;

      const livre = proximaPosicaoLivre(cfg, modo, op.w ?? modelo.tamanho?.w ?? 50);
      const caixa = {
        x: op.x ?? livre.x,
        y: op.y ?? livre.y,
        w: op.w ?? modelo.tamanho?.w ?? 50,
        h: op.h ?? modelo.tamanho?.h ?? 220,
      };
      const novo = {
        id: novoId,
        type: op.tipo,
        title: op.title ?? modelo.title ?? "",
        content: op.content ?? modelo.content ?? "",
        ...(op.ctaLabel ? { ctaLabel: op.ctaLabel } : {}),
        ...(op.ctaUrl ? { ctaUrl: op.ctaUrl } : {}),
        ...(CORES.test(op.backgroundColor || "") ? { backgroundColor: op.backgroundColor } : {}),
        ...(CORES.test(op.color || "") ? { color: op.color } : {}),
        layout: { desktop: { ...caixa }, mobile: { ...caixa } },
        ...caixa,
        hidden: false,
        locked: false,
      };
      return assentarPecaNova(
        { ...cfg, widgets: [...cfg.widgets, novo] },
        modo,
        widgetPieceId(novoId)
      );
    }

    case "remover": {
      const { kind, key } = parsePieceId(op.alvo) || {};
      if (kind !== "widget") return cfg;
      return { ...cfg, widgets: cfg.widgets.filter((w) => w.id !== key) };
    }

    case "estilo": {
      const mudanca = {};
      if (CORES.test(op.backgroundColor || "")) mudanca.backgroundColor = op.backgroundColor;
      if (CORES.test(op.color || "")) mudanca.color = op.color;
      if (!Object.keys(mudanca).length) return cfg;
      return escreverNaPeca(cfg, op.alvo, mudanca);
    }

    case "conteudo": {
      const mudanca = {};
      for (const campo of ["title", "content", "ctaLabel"]) {
        if (op[campo] != null) mudanca[campo] = op[campo];
      }
      if (!Object.keys(mudanca).length) return cfg;

      const { kind, key } = parsePieceId(op.alvo) || {};
      if (kind === "widget") return escreverNaPeca(cfg, op.alvo, mudanca);

      /* Bloco fixo não guarda texto como widget: cada um tem o seu campo, e
         eles estão em lugares diferentes. Cabeçalho e rodapé moram no config;
         o TÍTULO da página mora no perfil do tenant e é tratado por
         `textoDoPerfil`, porque este arquivo só enxerga o config. */
      if (key === "footer" && mudanca.title) return { ...cfg, footerTitle: mudanca.title };
      if (key === "header") {
        const atual = cfg.topHeader || {};
        return {
          ...cfg,
          topHeader: {
            ...atual,
            ...(mudanca.title ? { title: mudanca.title } : {}),
            ...(mudanca.content ? { subtitle: mudanca.content } : {}),
          },
        };
      }
      return cfg;
    }

    case "tema": {
      const proximo = { ...cfg };
      if (op.appearanceMode) proximo.appearanceMode = op.appearanceMode;
      if (op.globalFont) proximo.globalFont = op.globalFont;
      return proximo;
    }

    case "ocultar":
    case "mostrar": {
      const esconder = op.acao === "ocultar";
      const { kind, key } = parsePieceId(op.alvo) || {};
      if (kind === "widget") {
        return {
          ...cfg,
          widgets: cfg.widgets.map((w) => (w.id === key ? { ...w, hidden: esconder } : w)),
        };
      }
      const atuais = cfg.hiddenBlocks || {};
      return { ...cfg, hiddenBlocks: { ...atuais, [key]: esconder } };
    }

    default:
      return cfg;
  }
}

/* A caixa atual da peça. Move e redimensiona precisam dela porque a IA pode
   mandar só um dos eixos — "desça o rodapé" não diz nada sobre o x. */
function pegarRect(cfg, modo, pieceId) {
  const info = parsePieceId(pieceId);
  if (!info) return null;
  if (info.kind === "widget") {
    const w = cfg.widgets.find((x) => x.id === info.key);
    if (!w) return null;
    return w.layout?.[modo] || { x: w.x, y: w.y, w: w.w, h: w.h };
  }
  const mapa = modo === "mobile" ? cfg.mobileLayout : cfg.layout;
  return mapa?.[info.key] || null;
}

function escreverNaPeca(cfg, pieceId, mudanca) {
  const info = parsePieceId(pieceId);
  if (!info) return cfg;
  if (info.kind === "widget") {
    return {
      ...cfg,
      widgets: cfg.widgets.map((w) => (w.id === info.key ? { ...w, ...mudanca } : w)),
    };
  }
  return {
    ...cfg,
    blockStyles: { ...cfg.blockStyles, [info.key]: { ...(cfg.blockStyles?.[info.key] || {}), ...mudanca } },
  };
}

/* Campos do PERFIL que uma operação de tema pode tocar — as cores da marca não
   moram no `showcaseConfig`, moram no cadastro da imobiliária. Devolve null
   quando a operação não mexe em nada disso. */
export function temaDoPerfil(op) {
  if (op.acao !== "tema") return null;
  const campos = {};
  if (CORES.test(op.primaryColor || "")) campos.primaryColor = op.primaryColor;
  if (CORES.test(op.secondaryColor || "")) campos.secondaryColor = op.secondaryColor;
  return Object.keys(campos).length ? campos : null;
}

/* O texto do bloco de TÍTULO não está no `showcaseConfig` — a chamada e o
   subtítulo da vitrine são campos do cadastro da imobiliária
   (`showcaseHeadline`/`showcaseSubheadline`), os mesmos que a tela de
   Configurações edita. Sem este mapa, um passo "atualizei o título" aparecia
   como concluído na lista e não mudava nada na tela. */
export function textoDoPerfil(op) {
  if (op.acao !== "conteudo") return null;
  const { kind, key } = parsePieceId(op.alvo) || {};
  if (kind === "widget" || key !== "title") return null;
  const campos = {};
  if (op.title) campos.showcaseHeadline = String(op.title).slice(0, 160);
  if (op.content) campos.showcaseSubheadline = String(op.content).slice(0, 300);
  return Object.keys(campos).length ? campos : null;
}

/** A peça que a operação toca, para a tela poder acender enquanto ela acontece. */
export function alvoDaOperacao(op, novoId) {
  if (op.acao === "adicionar") return widgetPieceId(novoId);
  if (op.acao === "tema") return null;
  return op.alvo || null;
}
