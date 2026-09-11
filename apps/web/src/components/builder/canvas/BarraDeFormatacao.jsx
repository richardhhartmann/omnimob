import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SelectCustom } from "../../SelectCustom";

/* ────────────────────────────────────────────────────────────────────────────
   Barra flutuante de formatação de texto.

   Aparece ao selecionar texto dentro de qualquer `.editable-inline` e aplica
   cor, família e tamanho na seleção. Continua sobre `document.execCommand`:
   depreciado, sim, mas é o único caminho que produz exatamente o HTML que já
   está gravado em milhares de campos — trocar por um editor de rich text
   mudaria o formato persistido, que é justamente o que não pode mudar.

   ── OS DOIS DETALHES QUE FAZEM ISSO FUNCIONAR ──

   1. O intervalo selecionado é CLONADO e guardado numa ref. Clicar na barra
      tira o foco do texto e o navegador descarta a seleção; sem a cópia, o
      comando seria aplicado no nada.

   2. Ao dispensar a barra, o HTML é sincronizado à força. O `onBlur` do campo
      não serve aqui: clicar na barra não tira o foco do texto (a barra é
      `contentEditable={false}` e não recebe foco), então nada dispararia a
      gravação e o formato se perderia no próximo render.

   A lista do `SelectCustom` é renderizada num portal no `<body>`, então não é
   descendente da barra — mas clicar nela ainda é interagir com a barra. Daí a
   verificação por atributo em `estaSobAbarra`.
   ──────────────────────────────────────────────────────────────────────────── */

function estaSobAbarra(no, barraEl) {
  if (!barraEl || !no) return false;
  let n = no.nodeType === 1 ? no : no.parentElement;
  if (!n || n.nodeType !== 1) return false;
  if (typeof n.closest === "function" && n.closest("[data-selectcustom-list]")) return true;
  while (n) {
    if (n === barraEl) return true;
    if (typeof barraEl.contains === "function" && barraEl.contains(n)) return true;
    const raiz = n.getRootNode && n.getRootNode();
    if (raiz instanceof ShadowRoot) n = raiz.host;
    else n = n.parentElement;
  }
  return false;
}

/* A cor que o navegador REALMENTE está pintando, em hexadecimal.

   `getComputedStyle` resolve tudo — o token da folha, o `<font color>` que uma
   formatação anterior deixou, a herança do bloco — e devolve sempre `rgb(...)`.
   O `<input type="color">` só aceita `#rrggbb`, daí a conversão.

   Sem cor legível (o elemento sumiu, ou o formato é `color(display-p3 …)` de um
   monitor amplo), devolve o índigo da marca: é chute, mas é um chute que não
   estraga nada — a cor só é aplicada se a pessoa mexer no seletor. */
function corDoElemento(elemento) {
  if (!elemento || typeof window === "undefined") return "#6366f1";
  const rgb = window.getComputedStyle(elemento).color;
  const m = /^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(rgb || "");
  if (!m) return "#6366f1";
  const hex = (n) => Number(n).toString(16).padStart(2, "0");
  return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
}

export function BarraDeFormatacao({ aoSincronizar }) {
  /* A cor do texto SELECIONADO — não uma cor inicial escolhida por nós.
     Ela era `#6366f1` fixo, e o quadrado anunciava azul para um título que
     estava cinza. Um seletor de cor que não mostra a cor atual não informa
     nada: ele só serve para trocar, e depois de trocar mente de novo.

     Agora ela é LIDA da seleção a cada vez que a barra aparece. */
  const [cor, setCor] = useState("#6366f1");
  const [posicao, setPosicao] = useState(null);
  const intervaloRef = useRef(null);
  const barraRef = useRef(null);
  const sincronizarRef = useRef(aoSincronizar);
  sincronizarRef.current = aoSincronizar;

  useEffect(() => {
    const aoMudarSelecao = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
      const intervalo = sel.getRangeAt(0);
      const no = intervalo.commonAncestorContainer;
      const pai = no.nodeType === 3 ? no.parentElement : no;
      if (!pai?.closest?.(".editable-inline")) return;
      const caixa = intervalo.getBoundingClientRect();
      intervaloRef.current = intervalo.cloneRange();
      setCor(corDoElemento(pai));
      setPosicao({ x: caixa.left + caixa.width / 2, y: caixa.top - 8 });
    };
    document.addEventListener("selectionchange", aoMudarSelecao);
    return () => document.removeEventListener("selectionchange", aoMudarSelecao);
  }, []);

  useEffect(() => {
    const aoApontar = (e) => {
      const caminho = typeof e.composedPath === "function" ? e.composedPath() : [e.target];
      if (caminho.some((no) => estaSobAbarra(no, barraRef.current))) return;

      const intervalo = intervaloRef.current;
      if (intervalo) {
        const no = intervalo.commonAncestorContainer;
        const editavel = no.nodeType === 3
          ? no.parentElement?.closest(".editable-inline")
          : no.closest?.(".editable-inline");
        if (editavel) {
          sincronizarRef.current?.(editavel.getAttribute("data-rich-sync"), editavel.innerHTML);
        }
      }
      intervaloRef.current = null;
      setPosicao(null);
    };
    document.addEventListener("pointerdown", aoApontar, true);
    return () => document.removeEventListener("pointerdown", aoApontar, true);
  }, []);

  function aplicar(comando, valor) {
    const intervalo = intervaloRef.current;
    if (!intervalo) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(intervalo);
    try {
      document.execCommand("styleWithCSS", false, true);
      document.execCommand(comando, false, valor);
    } catch {
      /* navegador sem suporte: o texto fica como está, sem derrubar a tela */
    }
    if (sel.rangeCount > 0) intervaloRef.current = sel.getRangeAt(0).cloneRange();
  }

  if (!posicao) return null;

  return createPortal(
    <div
      ref={barraRef}
      className="editor-format-bar"
      role="presentation"
      contentEditable={false}
      onMouseDown={(e) => e.stopPropagation()}
      style={{ top: posicao.y - 10, left: posicao.x }}
    >
      {/* ── O MESMO CONTROLE DE COR DO INSPETOR ──────────────────────────
          Aqui era o seletor CRU do navegador — um quadradinho com a moldura
          que cada sistema desenha do seu jeito — enquanto o inspetor mostra
          uma caixa com borda e o nativo escondido por trás. Dois desenhos para
          escolher cor, na mesma tela.

          Agora os dois são `.editor-color`; o que muda é só o tamanho. E a cor
          escolhida fica em estado para a caixa MOSTRAR a escolha: antes era
          `defaultValue`, então o quadrado continuava azul depois de pintar o
          texto de vermelho. */}
      <label
        className="editor-color editor-format-cor"
        title="Cor da fonte"
        style={{ background: cor }}
      >
        <input
          type="color"
          value={cor}
          onChange={(e) => { setCor(e.currentTarget.value); aplicar("foreColor", e.currentTarget.value); }}
        />
      </label>
      <SelectCustom
        size="sm"
        zIndex={2147483647}
        title="Família da fonte"
        ariaLabel="Família da fonte"
        value=""
        placeholder="Fonte"
        style={{ minWidth: "118px" }}
        options={[
          { value: "", label: "Fonte padrão" },
          { value: "Arial", label: "Arial" },
          { value: "Georgia", label: "Georgia" },
          { value: "Courier New", label: "Courier New" },
          { value: "Times New Roman", label: "Times New Roman" },
          { value: "Verdana", label: "Verdana" },
        ]}
        onChange={(v) => aplicar("fontName", v)}
      />
      <SelectCustom
        size="sm"
        zIndex={2147483647}
        title="Tamanho da fonte"
        ariaLabel="Tamanho da fonte"
        value=""
        placeholder="Tamanho"
        style={{ minWidth: "112px" }}
        options={[
          { value: "1", label: "Muito pequeno" },
          { value: "2", label: "Pequeno" },
          { value: "3", label: "Normal" },
          { value: "4", label: "Médio" },
          { value: "5", label: "Grande" },
          { value: "6", label: "Muito grande" },
          { value: "7", label: "Gigante" },
        ]}
        onChange={(v) => aplicar("fontSize", v)}
      />
    </div>,
    document.body
  );
}
