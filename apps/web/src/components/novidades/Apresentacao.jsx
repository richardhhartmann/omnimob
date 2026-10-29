import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CaretLeft, CaretRight, MapPin, X } from "@phosphor-icons/react";
import { desenharIcone } from "./icones";
import { ROTULO_DO_TIPO, printsDe, rotulosDoPeriodo, temPagina } from "./tipos";

/* ────────────────────────────────────────────────────────────────────────────
   A APRESENTAÇÃO DAS NOVIDADES — porte da do VYA, com a marca da Omnimob.

   O mesmo desenho do PPTX (`pptx.js`), slide a slide: as medidas são as do
   PowerPoint em polegadas (13,333" × 7,5"), convertidas pela largura do quadro
   (--u = 1 polegada), então fica igual em qualquer tamanho de tela.

   Serve ao comunicado do cliente (`ComunicadoDeNovidades`) e à revisão no
   super-admin (`editar`: os textos se reescrevem clicando neles). Estilos
   próprios (nov-*), sem depender do CSS do painel nem do kit da landing.
   ──────────────────────────────────────────────────────────────────────────── */

const POR_LISTA = 4;
const itensDoSlide = (s) => (s.tipo === "item" ? [s.item] : s.tipo === "lista" ? s.itens.map((x) => x.item) : []);

/** A sequência dos slides, na ordem do PPTX. */
export function montarSlides(c) {
  const slides = [{ tipo: "capa" }, { tipo: "resumo" }];
  c.secoes.filter((s) => s.itens.some(temPagina)).forEach((secao, i) => {
    slides.push({ tipo: "secao", secao, n: i + 1 });
    for (const item of secao.itens.filter(temPagina)) slides.push({ tipo: "item", secao, item });
  });
  for (const [tipo, titulo, rotulo, icone] of [["correcao", "O que corrigimos", "Correções", "Wrench"], ["mudanca", "O que mudou de lugar", "Mudou de lugar", "ArrowsLeftRight"]]) {
    const itens = c.secoes.flatMap((secao) => secao.itens.filter((item) => item.tipo === tipo).map((item) => ({ item, secao })));
    for (let i = 0; i < itens.length; i += POR_LISTA) slides.push({ tipo: "lista", titulo, rotulo, icone, itens: itens.slice(i, i + POR_LISTA) });
  }
  slides.push({ tipo: "fim" });
  return slides;
}

/* A régua: polegadas e pontos do PowerPoint, em CSS. */
const u = (n) => `calc(var(--u) * ${n})`;
const pt = (n) => `calc(var(--u) * ${n / 72})`;
/* A paleta da Omnimob: o quase-preto da landing, o índigo do Omnimob e o dourado da marca. */
export const COR = {
  navy: "#0E0F1A", ardosia: "#1B1D2E", indigo: "#6366F1", indigoClaro: "#A5B4FC", dourado: "#D4AF37",
  lilas: "#EEF2FF", lilasBorda: "#C7D2FE", texto: "#0F172A", apagado: "#64748B", claro: "#CBD5E1", branco: "#FFFFFF",
  fundoCartao: "#F8FAFC", borda: "#E2E8F0",
};
export const LOGO = { src: "/tipo_header_alt.png", proporcao: 2852 / 603 };
const W = 13.333, M = 0.6;

const caixa = (x, y, w, h, extra) => ({ position: "absolute", left: u(x), top: u(y), width: u(w), height: u(h), ...extra });

function Icone({ nome, x, y, d, fundo = COR.indigo, cor = COR.branco }) {
  return (
    <span style={caixa(x, y, d, d, { borderRadius: "50%", background: fundo, display: "grid", placeItems: "center" })}>
      {desenharIcone(nome, { weight: "duotone", color: cor, style: { width: u(d * 0.56), height: u(d * 0.56) } })}
    </span>
  );
}
function Circulos() {
  return (
    <>
      <span style={caixa(8.6, -2.2, 7.2, 7.2, { borderRadius: "50%", background: COR.indigo, opacity: 0.2 })} />
      <span style={caixa(10.6, 3.6, 5.2, 5.2, { borderRadius: "50%", background: COR.dourado, opacity: 0.16 })} />
    </>
  );
}
function Rodape({ c, numero }) {
  return (
    <>
      <span style={caixa(M, 6.98, 6, 0.3, { fontSize: pt(10), color: COR.apagado })}>Omnimob · Novidades {rotulosDoPeriodo(c.mes).de}</span>
      <span style={caixa(W - M - 0.6, 6.98, 0.6, 0.3, { fontSize: pt(10), color: COR.apagado, textAlign: "right" })}>{numero}</span>
    </>
  );
}
function Etiqueta({ icone, texto, x = M, y = 0.38, cor = COR.indigo, fundo = COR.lilas }) {
  return (
    <span style={{ position: "absolute", left: u(x), top: u(y), height: u(0.34), padding: `0 ${u(0.14)}`, borderRadius: u(0.17), background: fundo, display: "inline-flex", alignItems: "center", gap: u(0.08), whiteSpace: "nowrap" }}>
      {desenharIcone(icone, { weight: "duotone", color: cor, style: { width: u(0.22), height: u(0.22) } })}
      <span style={{ fontSize: pt(10), fontWeight: 700, color: cor, letterSpacing: "0.08em", textTransform: "uppercase" }}>{texto}</span>
    </span>
  );
}
function Logo() {
  return <img src={LOGO.src} alt="Omnimob" style={caixa(M, 0.55, 2.6, 2.6 / LOGO.proporcao)} />;
}

function Tela({ item }) {
  const ax = 5.75, ay = 1.75, aw = W - M - ax, ah = 4.8;
  const urls = printsDe(item);
  if (urls.length) {
    const gap = 0.4, pad = 0.09;
    const larguraMax = (aw - gap * (urls.length - 1)) / urls.length - 2 * pad;
    return (
      <span style={caixa(ax, ay, aw, ah, { display: "flex", alignItems: "center", justifyContent: "center", gap: u(gap) })}>
        {urls.map((src) => (
          <span key={src} style={{ background: COR.ardosia, borderRadius: u(0.1), padding: u(pad), boxShadow: "0 0.4em 1.2em rgba(0,0,0,.25)", display: "inline-flex", lineHeight: 0 }}>
            <img src={src} alt={`Tela: ${item.titulo}`} style={{ maxWidth: u(larguraMax), maxHeight: u(ah - 2 * pad), display: "block" }} />
          </span>
        ))}
      </span>
    );
  }
  return (
    <span style={caixa(ax, ay, aw, ah, { background: COR.lilas, borderRadius: u(0.15) })}>
      <Icone nome={item.icone} x={aw / 2 - 1.05} y={1.0} d={2.1} />
      <span style={caixa(0, 3.3, aw, 0.55, { fontSize: pt(22), fontWeight: 700, color: COR.texto, textAlign: "center" })}>{item.titulo}</span>
      <span style={caixa(0, 3.85, aw, 0.4, { fontSize: pt(14), color: COR.apagado, textAlign: "center" })}>{item.onde}</span>
    </span>
  );
}

/** Texto que, na revisão, se reescreve clicando nele: Enter confirma, Esc desfaz.
    Vale a cada tecla. Enquanto a pessoa digita, o texto na tela é dela; o React
    só o reescreve fora da edição (ao sair, ou num Desfazer). */
function Editavel({ valor, max, mudar, style }) {
  const ref = useRef(null);
  const atual = useRef(valor);
  const antes = useRef(valor);
  useLayoutEffect(() => {
    atual.current = valor;
    const el = ref.current;
    if (el && document.activeElement !== el && el.textContent !== valor) el.textContent = valor;
  }, [valor]);
  if (!mudar) return <span style={style}>{valor}</span>;
  return (
    <span
      ref={ref}
      style={style}
      className="nov-editavel"
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      role="textbox"
      title={`Clique para reescrever (até ${max} caracteres)`}
      onFocus={() => { antes.current = valor; }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
        else if (e.key === "Escape") { mudar(antes.current); e.currentTarget.blur(); }
      }}
      onInput={(e) => {
        const t = (e.currentTarget.textContent ?? "").replace(/\s+/g, " ").trim();
        e.currentTarget.classList.toggle("is-longo", t.length > max);
        if (t) mudar(t.slice(0, max));
      }}
      onBlur={(e) => {
        e.currentTarget.classList.remove("is-longo");
        if (e.currentTarget.textContent !== atual.current) e.currentTarget.textContent = atual.current;
      }}
    />
  );
}

function SlideDaVez({ s, c, numero, irPara, editar }) {
  // Sem `editar` (o cliente), cada Editavel é um texto comum.
  const ed = (f) => (editar ? (v) => editar((x) => f(x, v)) : undefined);
  const noItem = (id, f) =>
    ed((x, v) => ({ ...x, secoes: x.secoes.map((sec) => ({ ...sec, itens: sec.itens.map((i) => (i.id === id ? { ...i, ...f(i, v) } : i)) })) }));
  const naSecao = (id, campo) => ed((x, v) => ({ ...x, secoes: x.secoes.map((sec) => (sec.id === id ? { ...sec, [campo]: v } : sec)) }));
  const escuro = s.tipo === "capa" || s.tipo === "secao" || s.tipo === "fim";
  const paginas = c.secoes.reduce((t, x) => t + x.itens.filter(temPagina).length, 0);
  const listas = c.secoes.reduce((t, x) => t + x.itens.filter((i) => !temPagina(i)).length, 0);
  const periodo = rotulosDoPeriodo(c.mes);
  return (
    <div className="nov-slide" style={{ background: escuro ? COR.navy : COR.branco }}>
      {s.tipo === "capa" ? (
        <>
          <Circulos />
          <Logo />
          <span style={caixa(M, 2.0, 6, 0.35, { fontSize: pt(13), fontWeight: 700, color: COR.dourado, letterSpacing: "0.3em" })}>{periodo.capa}</span>
          <Editavel style={caixa(M, 2.4, 9, 1.1, { fontSize: pt(54), fontWeight: 700, color: COR.branco, lineHeight: 1.1 })} valor={c.titulo} max={60} mudar={ed((x, v) => ({ ...x, titulo: v }))} />
          <Editavel style={caixa(M, 3.45, 9, 0.5, { fontSize: pt(20), color: COR.claro })} valor={c.subtitulo} max={60} mudar={ed((x, v) => ({ ...x, subtitulo: v }))} />
          <Editavel style={caixa(M, 4.15, 8.4, 1.0, { fontSize: pt(17), color: COR.branco })} valor={c.chamada} max={220} mudar={ed((x, v) => ({ ...x, chamada: v }))} />
          {[[paginas, paginas === 1 ? "novidade" : "novidades"], [listas, "correções e mudanças"]].filter(([n]) => n > 0).map(([n, r], i) => (
            <span key={r}>
              <span style={caixa(M + i * 2.6, 5.45, 2.4, 0.85, { fontSize: pt(48), fontWeight: 700, color: COR.indigoClaro })}>{n}</span>
              <span style={caixa(M + i * 2.6, 6.28, 2.4, 0.35, { fontSize: pt(13), color: COR.claro })}>{r}</span>
            </span>
          ))}
        </>
      ) : null}

      {s.tipo === "resumo" ? (
        <>
          <span style={caixa(M, 0.5, 12, 0.8, { fontSize: pt(34), fontWeight: 700, color: COR.texto })}>O que mudou {periodo.quando}</span>
          <span style={caixa(M, 1.25, 12, 0.4, { fontSize: pt(15), color: COR.apagado })}>
            Uma página para cada novidade, por área do painel{listas ? "; no fim, o que corrigimos e o que mudou de lugar" : ""}.
          </span>
          {c.secoes.filter((x) => x.itens.some(temPagina)).map((sec, i) => {
            const cw = (W - 2 * M - 0.3 * 3) / 4, ch = 2.35, x = M + (i % 4) * (cw + 0.3), y = 1.95 + Math.floor(i / 4) * (ch + 0.3);
            const n = sec.itens.filter(temPagina).length;
            return (
              <button type="button" key={sec.id} onClick={() => irPara(sec.id)} className="nov-cartao" style={caixa(x, y, cw, ch, { background: COR.fundoCartao, border: `1px solid ${COR.borda}`, borderRadius: u(0.12), textAlign: "left", padding: 0 })}>
                <Icone nome={sec.icone} x={0.25} y={0.25} d={0.62} />
                <span style={caixa(cw - 0.8, 0.3, 0.55, 0.4, { fontSize: pt(14), fontWeight: 700, color: COR.lilasBorda, textAlign: "right" })}>{String(i + 1).padStart(2, "0")}</span>
                <span style={caixa(0.25, 1.0, cw - 0.5, 0.65, { fontSize: pt(17), fontWeight: 700, color: COR.texto, lineHeight: 1.15 })}>{sec.titulo}</span>
                <span style={caixa(0.25, 1.75, cw - 0.5, 0.35, { fontSize: pt(13), fontWeight: 700, color: COR.indigo })}>{n} {n === 1 ? "novidade" : "novidades"}</span>
              </button>
            );
          })}
          <Rodape c={c} numero={numero} />
        </>
      ) : null}

      {s.tipo === "secao" ? (
        <>
          <Circulos />
          <span style={caixa(M, 1.2, 3, 1.1, { fontSize: pt(66), fontWeight: 700, color: COR.indigoClaro })}>{String(s.n).padStart(2, "0")}</span>
          <Editavel style={caixa(M, 2.35, 6.2, 1.5, { fontSize: pt(40), fontWeight: 700, color: COR.branco, lineHeight: 1.1 })} valor={s.secao.titulo} max={40} mudar={naSecao(s.secao.id, "titulo")} />
          <Editavel style={caixa(M, 3.95, 5.6, 1.2, { fontSize: pt(18), color: COR.claro })} valor={s.secao.resumo} max={160} mudar={naSecao(s.secao.id, "resumo")} />
          {s.secao.itens.filter(temPagina).map((it, i, todos) => {
            const passo = Math.min(0.62, 5.2 / todos.length), y = 1.25 + i * passo;
            return (
              <span key={it.id}>
                <Icone nome={it.icone} x={7.4} y={y} d={0.44} fundo={COR.ardosia} cor={COR.indigoClaro} />
                <span style={caixa(8.0, y, 4.7, 0.44, { fontSize: pt(17), color: COR.branco, display: "flex", alignItems: "center" })}>{it.titulo}</span>
              </span>
            );
          })}
          <span style={caixa(W - M - 0.6, 6.98, 0.6, 0.3, { fontSize: pt(10), color: COR.apagado, textAlign: "right" })}>{numero}</span>
        </>
      ) : null}

      {s.tipo === "item" ? (
        <>
          <Etiqueta icone={s.secao.icone} texto={s.secao.titulo} />
          {s.item.tipo === "melhoria" ? (
            <Etiqueta icone="Sparkle" texto={ROTULO_DO_TIPO.melhoria} x={M + 0.75 + s.secao.titulo.length * 0.112} cor="#92710C" fundo="#FBF3D5" />
          ) : null}
          <Editavel style={caixa(M, 0.82, W - 2 * M, 0.75, { fontSize: pt(32), fontWeight: 700, color: COR.texto, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" })} valor={s.item.titulo} max={60} mudar={noItem(s.item.id, (_, v) => ({ titulo: v }))} />
          <span style={caixa(M, 1.75, 4.75, 0.3, { fontSize: pt(11), fontWeight: 700, color: COR.indigo, letterSpacing: "0.2em" })}>PARA QUE SERVE</span>
          <Editavel style={caixa(M, 2.08, 4.75, 1.3, { fontSize: pt(15), color: COR.texto, lineHeight: 1.3 })} valor={s.item.paraQue} max={320} mudar={noItem(s.item.id, (_, v) => ({ paraQue: v }))} />
          <span style={caixa(M, 3.48, 4.75, 0.3, { fontSize: pt(11), fontWeight: 700, color: COR.indigo, letterSpacing: "0.2em" })}>COMO USAR</span>
          {s.item.passos.slice(0, 3).map((p, i) => (
            <span key={i}>
              <span style={caixa(M, 3.89 + i * 0.7, 0.36, 0.36, { borderRadius: "50%", background: COR.indigo, color: COR.branco, fontSize: pt(12), fontWeight: 700, display: "grid", placeItems: "center" })}>{i + 1}</span>
              <Editavel style={caixa(M + 0.5, 3.86 + i * 0.7, 4.25, 0.64, { fontSize: pt(13.5), color: COR.texto, lineHeight: 1.25 })} valor={p} max={170} mudar={noItem(s.item.id, (it, v) => ({ passos: it.passos.map((x, k) => (k === i ? v : x)) }))} />
            </span>
          ))}
          <span style={caixa(M, 6.05, 4.75, 0.5, { background: COR.lilas, borderRadius: u(0.1), display: "flex", alignItems: "center", gap: u(0.12), padding: `0 ${u(0.14)}`, boxSizing: "border-box", fontSize: pt(12.5), color: COR.indigo })}>
            <MapPin weight="duotone" style={{ width: u(0.26), height: u(0.26), flex: "none" }} />
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              <b>Onde fica:</b> <Editavel valor={s.item.onde} max={90} mudar={noItem(s.item.id, (_, v) => ({ onde: v }))} />
            </span>
          </span>
          <Tela item={s.item} />
          <Rodape c={c} numero={numero} />
        </>
      ) : null}

      {s.tipo === "lista" ? (
        <>
          <Etiqueta icone={s.icone} texto={s.rotulo} />
          <span style={caixa(M, 0.82, W - 2 * M, 0.75, { fontSize: pt(32), fontWeight: 700, color: COR.texto })}>{s.titulo}</span>
          {s.itens.map(({ item, secao }, i) => (
            <span key={item.id} style={caixa(M, 1.8 + i * 1.18, W - 2 * M, 1.02, { background: COR.fundoCartao, border: `1px solid ${COR.borda}`, borderRadius: u(0.12) })}>
              <Icone nome={item.icone} x={0.25} y={0.2} d={0.62} />
              <Editavel style={caixa(1.1, 0.14, 8.5, 0.4, { fontSize: pt(16), fontWeight: 700, color: COR.texto, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" })} valor={item.titulo} max={60} mudar={noItem(item.id, (_, v) => ({ titulo: v }))} />
              <Editavel style={caixa(1.1, 0.52, 8.5, 0.45, { fontSize: pt(12.5), color: COR.texto, lineHeight: 1.2, overflow: "hidden" })} valor={item.paraQue} max={320} mudar={noItem(item.id, (_, v) => ({ paraQue: v }))} />
              <span style={caixa(9.8, 0.14, 2.1, 0.75, { fontSize: pt(11), color: COR.apagado, textAlign: "right", lineHeight: 1.25 })}>
                <b style={{ color: COR.indigo }}>{secao.titulo}</b>
                <br />
                <Editavel valor={item.onde} max={90} mudar={noItem(item.id, (_, v) => ({ onde: v }))} />
              </span>
            </span>
          ))}
          <Rodape c={c} numero={numero} />
        </>
      ) : null}

      {s.tipo === "fim" ? (
        <>
          <Circulos />
          <Logo />
          <Editavel style={caixa(M, 2.6, 9, 1.0, { fontSize: pt(44), fontWeight: 700, color: COR.branco })} valor={c.encerramento.titulo} max={60} mudar={ed((x, v) => ({ ...x, encerramento: { ...x.encerramento, titulo: v } }))} />
          <Editavel style={caixa(M, 3.65, 7.6, 1.1, { fontSize: pt(19), color: COR.claro, lineHeight: 1.3 })} valor={c.encerramento.texto} max={220} mudar={ed((x, v) => ({ ...x, encerramento: { ...x.encerramento, texto: v } }))} />
        </>
      ) : null}
    </div>
  );
}

const ESTILO = `
.nov{ --u:1px; font-family: Calibri, "Segoe UI", Carlito, Arial, sans-serif; color:${COR.texto}; display:flex; flex-direction:column; gap:10px; width:100%; }
.nov-linha{ position:relative; display:flex; align-items:center; gap:20px; }
.nov-quadro{ container-type:inline-size; flex:1; min-width:0; }
.nov-seta{ flex:none; width:46px; height:46px; padding:0; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; border:1px solid rgba(148,163,184,.35); background:rgba(14,15,26,.75); color:#fff; box-shadow:0 16px 40px -14px rgba(0,0,0,.75); transition: transform .15s cubic-bezier(.16,1,.3,1), background .15s, border-color .15s, opacity .15s; }
.nov-seta:hover:not(:disabled){ background:${COR.indigo}; border-color:${COR.indigo}; }
.nov-seta--antes:hover:not(:disabled){ transform:translateX(-3px); }
.nov-seta--depois:hover:not(:disabled){ transform:translateX(3px); }
.nov-seta:disabled{ opacity:.25; cursor:default; }
.nov-seta:focus-visible{ outline:2px solid ${COR.indigoClaro}; outline-offset:3px; }
@media (max-width: 640px){
  .nov-linha{ gap:0; }
  .nov-seta, .nov-seta:hover:not(:disabled){ position:absolute; z-index:3; top:50%; width:34px; height:34px; transform:translateY(-50%); }
  .nov-seta--antes{ left:6px; } .nov-seta--depois{ right:6px; }
}
.nov-palco{ --u: calc(100cqw / 13.333); position:relative; width:100%; aspect-ratio:16/9; overflow:hidden; border-radius:12px; box-shadow:0 20px 60px rgba(0,0,0,.35); }
.nov-slide{ position:absolute; inset:0; overflow:hidden; animation: nov-entra .22s ease-out; }
.nov-slide span, .nov-slide b { box-sizing:border-box; }
.nov-editavel{ cursor:text; outline:1px dashed transparent; outline-offset:2px; border-radius:3px; transition: outline-color .15s, background .15s; }
.nov-editavel:hover{ outline-color:rgba(165,180,252,.7); }
.nov-editavel:focus{ outline:2px solid ${COR.indigoClaro}; background:rgba(165,180,252,.12); white-space:normal !important; overflow:visible !important; z-index:2; }
.nov-editavel.is-longo{ outline-color:#F43F5E; }
.nov-cartao{ cursor:pointer; transition: transform .15s, box-shadow .15s; font: inherit; }
.nov-cartao:hover{ transform: translateY(-2px); box-shadow: 0 8px 24px rgba(99,102,241,.15); }
.nov-barra{ display:flex; align-items:center; gap:8px; justify-content:center; color:#CBD5E1; font-size:13px; }
.nov-barra button{ display:inline-flex; align-items:center; gap:6px; border:1px solid rgba(148,163,184,.35); background:rgba(14,15,26,.6); color:#fff; border-radius:999px; padding:7px 14px; font:inherit; font-size:13px; cursor:pointer; }
.nov-barra button:hover:not(:disabled){ border-color:${COR.indigoClaro}; }
.nov-pontos{ display:flex; gap:4px; flex-wrap:wrap; justify-content:center; max-width:60%; }
.nov-pontos i{ width:6px; height:6px; border-radius:99px; background:rgba(148,163,184,.4); cursor:pointer; }
.nov-pontos i.is-on{ background:${COR.indigoClaro}; width:16px; }
@keyframes nov-entra{ from{ opacity:.35; } to{ opacity:1; } }
@media (prefers-reduced-motion: reduce){ .nov-slide{ animation:none; } }
`;

/** A apresentação com a navegação (setas, teclado, pontos). `aoFechar` aparece no último slide.
    Com `editar` (a revisão), os textos se reescrevem clicando neles e o clique no slide não avança;
    `abaixoDoSlide` recebe as novidades do slide da vez (uma na página, até quatro numa lista). */
export function Apresentacao({ conteudo, aoFechar, editar, abaixoDoSlide, aoMudarSlide, teclado = true }) {
  const slides = useMemo(() => montarSlides(conteudo), [conteudo]);
  const [i, setI] = useState(0);
  const atual = Math.min(i, slides.length - 1);
  useEffect(() => { aoMudarSlide?.(atual + 1, slides.length); }, [atual, slides.length, aoMudarSlide]);
  const ir = useCallback((n) => setI(Math.max(0, Math.min(slides.length - 1, n))), [slides]);
  const irParaSecao = (id) => ir(slides.findIndex((s) => s.tipo === "secao" && s.secao.id === id));

  useEffect(() => {
    if (!teclado) return undefined;
    const tecla = (e) => {
      const alvo = e.target;
      if (alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.tagName === "SELECT" || alvo.isContentEditable)) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); ir(atual + 1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); ir(atual - 1); }
      else if (e.key === "Escape" && aoFechar) aoFechar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [teclado, atual, ir, aoFechar]);

  const ultimo = atual === slides.length - 1;
  return (
    <div className="nov">
      <style>{ESTILO}</style>
      <div className="nov-linha">
        <button type="button" className="nov-seta nov-seta--antes" onClick={() => ir(atual - 1)} disabled={atual === 0} aria-label="Slide anterior" title="Anterior (←)">
          <CaretLeft size={20} weight="bold" />
        </button>
        <div className="nov-quadro">
          <div className="nov-palco" onClick={(e) => { if (editar || e.target.closest("button")) return; ir(atual + 1); }}>
            <SlideDaVez key={atual} s={slides[atual]} c={conteudo} numero={atual + 1} irPara={irParaSecao} editar={editar} />
          </div>
        </div>
        <button type="button" className="nov-seta nov-seta--depois" onClick={() => ir(atual + 1)} disabled={ultimo} aria-label="Próximo slide" title="Próximo (→)">
          <CaretRight size={20} weight="bold" />
        </button>
      </div>
      {abaixoDoSlide?.(itensDoSlide(slides[atual]))}
      <div className="nov-barra">
        <span className="nov-pontos" aria-hidden="true">
          {slides.map((_, n) => <i key={n} className={n === atual ? "is-on" : undefined} onClick={() => ir(n)} />)}
        </span>
        <span aria-live="polite" style={{ minWidth: 54, textAlign: "center" }}>{atual + 1} / {slides.length}</span>
        {ultimo && aoFechar ? <button type="button" onClick={aoFechar}><X weight="bold" /> Fechar</button> : null}
      </div>
    </div>
  );
}
