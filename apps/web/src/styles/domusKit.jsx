import { useEffect, useMemo, useRef, useState } from "react";

/* ────────────────────────────────────────────────────────────────────────────
   Kit visual Domus — base compartilhada pelas telas que usam a identidade da
   landing (landing pública, login super-admin e painel super-admin).

   Identidade inspirada no site da Kenlo: fundo quase-preto, tipografia Plus
   Jakarta Sans em títulos de duas cores, micro-labels em JetBrains Mono
   (eyebrow "— ● LABEL", índices "[01]", rodapés "// comentário"), grids de
   hairline sem gap, botões pill com seta em círculo, vidro premium sobre os
   blobs coloridos e entrada em fade + slide-up no scroll.

   Como usar numa página:
     <div className="dl-root dl-page">
       <DomusStyles extra={CSS_DA_PAGINA} />
       ...
     </div>

   Tudo é escopado em `.dl-root` para não vazar no painel do tenant, que ainda
   usa o styles.css global.
   ──────────────────────────────────────────────────────────────────────────── */

export const ACCENT = "#6366f1";
export const ACCENT_SOFT = "#818cf8";
export const GOLD = "#d4af37";
export const MINT = "#34d399";
export const ROSE = "#f472b6";
export const DANGER = "#f87171";

// ── Movimento ───────────────────────────────────────────────────────────────

export function reduzirMovimento() {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/* Saída animada das telas de autenticação.

   `sair(aoTerminar)` marca a tela como saindo — as classes `.auth-leaving`,
   `.auth-card` e `.auth-shapes` (definidas em styles.css) cuidam do resto — e
   só chama `aoTerminar` quando a animação acaba. Esperar importa: quem entra
   nessa função troca a sessão, o que troca a rota e desmonta esta página; sem
   a espera a animação seria cortada no primeiro quadro.

   Com movimento reduzido não há animação, então segue direto. */
export function useSaidaDeAuth(duracao = 620) {
  const [saindo, setSaindo] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  function sair(aoTerminar) {
    if (reduzirMovimento()) { aoTerminar(); return; }
    setSaindo(true);
    timer.current = setTimeout(aoTerminar, duracao);
  }

  return { saindo, sair };
}

// Dispara uma única vez, quando o elemento entra na viewport.
export function useReveal() {
  const ref = useRef(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    // Sem observer (ou com movimento reduzido) o conteúdo já nasce visível.
    if (typeof IntersectionObserver === "undefined" || reduzirMovimento()) {
      setVisivel(true);
      return undefined;
    }
    const obs = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada.isIntersecting) return;
        setVisivel(true);
        obs.disconnect();
      },
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return [ref, visivel];
}

export function Reveal({ as: Tag = "div", delay = 0, className = "", style, children, ...rest }) {
  const [ref, visivel] = useReveal();
  return (
    <Tag
      ref={ref}
      className={`dl-reveal${visivel ? " is-visible" : ""}${className ? ` ${className}` : ""}`}
      style={{ transitionDelay: `${delay}ms`, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

// ── Contagem progressiva ────────────────────────────────────────────────────

// Quebra "+1.200" / "98%" / "24/7" em prefixo, número e sufixo para poder
// animar só a parte numérica. Ponto é separador de milhar (pt-BR).
export function parseStat(bruto) {
  const m = String(bruto).match(/^(\D*?)([\d.,]+)(.*)$/);
  if (!m) return null;
  const [, prefixo, numero, sufixo] = m;
  const agrupado = numero.includes(".") && !numero.includes(",");
  const valor = Number(numero.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(valor) ? { prefixo, sufixo, valor, agrupado } : null;
}

export function useContagem(alvo, ativo, duracao = 1500) {
  const [valor, setValor] = useState(0);

  useEffect(() => {
    if (!ativo) return undefined;
    if (reduzirMovimento()) {
      setValor(alvo);
      return undefined;
    }
    let raf = 0;
    const inicio = performance.now();
    const passo = (agora) => {
      const p = Math.min(1, (agora - inicio) / duracao);
      const suave = 1 - Math.pow(1 - p, 4); // easeOutQuart
      setValor(Math.round(alvo * suave));
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo, ativo, duracao]);

  return valor;
}

// `raw` pode mudar depois da primeira renderização (números que chegam da API),
// então o parse acompanha o valor em vez de congelar no estado inicial.
export function StatValue({ raw, ativo }) {
  const info = useMemo(() => parseStat(raw), [raw]);
  const atual = useContagem(info?.valor ?? 0, ativo && !!info);
  if (!info) return raw;
  return `${info.prefixo}${info.agrupado ? atual.toLocaleString("pt-BR") : atual}${info.sufixo}`;
}

// ── Peças de UI ─────────────────────────────────────────────────────────────

export function Eyebrow({ children, tone }) {
  return (
    <span className="dl-eyebrow">
      <i className="dl-eyebrow__line" aria-hidden="true" />
      <i className="dl-eyebrow__dot" style={tone ? { background: tone } : undefined} aria-hidden="true" />
      {children}
    </span>
  );
}

/* Marca da Domus. Os arquivos vivem em `public/`, então os caminhos são
   absolutos e não passam pelo bundler — `/logo.png` é o mesmo do favicon.

   `LOCKUP` é o conjunto marca + tipografia num arquivo só. Atenção: nele o
   texto "DOMUS" é branco, então ele só funciona sobre fundo escuro — em
   superfície clara use `LOGO_SRC` com um texto de verdade ao lado.

   O cabeçalho da landing usa uma arte própria (`_HEADER`), de mesma proporção,
   ajustada para aquele contexto. Todo o resto fica no lockup padrão. */
export const LOGO_SRC = "/logo.png";
export const LOGO_LOCKUP_SRC = "/tipo.png";
export const LOGO_LOCKUP_HEADER_SRC = "/tipo_header.png";

// `size` é o lado da caixa; o PNG é mais alto que largo e se encaixa por
// `object-fit: contain`, então a altura manda no tamanho aparente.
export function LogoMark({ size = 30, className = "", style, ...rest }) {
  return (
    <img
      src={LOGO_SRC}
      alt=""
      aria-hidden="true"
      className={`dl-logo__mark${className ? ` ${className}` : ""}`}
      style={{ width: `${size}px`, height: `${size}px`, ...style }}
      {...rest}
    />
  );
}

/* Marca + tipografia num arquivo só.

   O lockup é bem mais largo que alto, então quem dita o tamanho é a altura: a
   largura vem por `auto`, senão a tipografia achata. Isso também deixa o
   componente indiferente à proporção — reexportar a arte com outro recorte
   não quebra nada.

   Omita `height` quando o tamanho tiver de vir do CSS: o estilo inline venceria
   a folha, e aí uma barra que encolhe ao rolar não conseguiria animar.

   `src` existe para o cabeçalho, que usa uma arte própria; o padrão atende
   todos os outros pontos. */
export function LogoLockup({ src = LOGO_LOCKUP_SRC, height, className = "", style, ...rest }) {
  return (
    <img
      src={src}
      alt="Domus"
      className={`dl-lockup${className ? ` ${className}` : ""}`}
      style={height ? { height: `${height}px`, ...style } : style}
      {...rest}
    />
  );
}

// Marca + palavra "Domus". `as` deixa o chamador escolher entre <Link>, <a>
// ou um <span> estático sem o kit precisar conhecer o react-router.
export function Logo({ as: Tag = "span", size = 30, name = "Domus", className = "", children, ...rest }) {
  return (
    <Tag className={`dl-logo${className ? ` ${className}` : ""}`} {...rest}>
      <LogoMark size={size} />
      {name ? <span className="dl-logo__name">{name}</span> : null}
      {children}
    </Tag>
  );
}

export function Arrow() {
  return (
    <span className="dl-btn__arrow" aria-hidden="true">
      <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
      </svg>
    </span>
  );
}

export function Button({ as: Tag = "a", variant = "primary", arrow = true, className = "", children, ...rest }) {
  return (
    <Tag className={`dl-btn dl-btn--${variant}${className ? ` ${className}` : ""}`} {...rest}>
      {children}
      {arrow ? <Arrow /> : null}
    </Tag>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="dl-field">
      <span className="dl-field__label">{label}</span>
      {children}
      {hint ? <span className="dl-field__hint">{hint}</span> : null}
    </label>
  );
}

export function Alert({ tone = "danger", children }) {
  return <div className={`dl-alert dl-alert--${tone}`}>{children}</div>;
}

// Flor/escalope decorativo — um círculo central com pétalas em volta.
export function Scallop({ size = 130, color, petals = 12, style }) {
  const r = size / 2;
  const pr = size * 0.155;
  const ring = r - pr;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={style} aria-hidden="true">
      <g fill={color}>
        <circle cx={r} cy={r} r={ring} />
        {Array.from({ length: petals }, (_, i) => {
          const a = (i / petals) * Math.PI * 2;
          return <circle key={i} cx={r + Math.cos(a) * ring} cy={r + Math.sin(a) * ring} r={pr} />;
        })}
      </g>
    </svg>
  );
}

export function DomusStyles({ extra }) {
  return <style>{extra ? `${CORE_CSS}\n${extra}` : CORE_CSS}</style>;
}

/* ── CSS base ────────────────────────────────────────────────────────────────
   IMPORTANTE (especificidade): o styles.css global define `button { ... }` e
   este arquivo define `.dl-root a { color: inherit }` — ambos com peso maior
   que uma classe solta. Por isso as variantes de botão vêm prefixadas com
   `.dl-root`, senão a cor do texto seria herdada do pai (branco no branco).
   ────────────────────────────────────────────────────────────────────────── */

const CORE_CSS = `
.dl-root {
  --bg: #0a0a0b;
  --bg-alt: #0f0f11;
  --surface: #141416;
  --surface-2: #1a1a1d;
  --line: #232326;
  --line-soft: rgba(255,255,255,0.07);
  --strong: #ffffff;
  --default: #e8e8ee;
  --subtle: #b6b6c2;
  --placeholder: #7d7d8a;
  --accent: ${ACCENT};
  --accent-soft: ${ACCENT_SOFT};
  --gold: ${GOLD};
  --mint: ${MINT};
  --danger: ${DANGER};
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);

  background: var(--bg);
  color: var(--default);
  font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}
.dl-page { min-height: 100vh; }
.dl-root *, .dl-root *::before, .dl-root *::after { box-sizing: border-box; }
.dl-root a { color: inherit; text-decoration: none; }
.dl-root ul, .dl-root ol { list-style: none; padding: 0; }
.dl-root ::selection { background: var(--accent); color: #fff; }

.dl-wrap { max-width: 1120px; margin: 0 auto; padding: 0 24px; position: relative; z-index: 1; }

.dl-mono {
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  font-size: 10.5px;
}

/* ── Vidro premium ──
   Fundo translúcido + desfoque + borda fina; o realce interno no topo dá a
   sensação de espessura. Só rende bem com algo colorido atrás. */
.dl-glass {
  background: rgba(255,255,255,0.05);
  backdrop-filter: blur(18px) saturate(150%);
  -webkit-backdrop-filter: blur(18px) saturate(150%);
  border: 1px solid rgba(255,255,255,0.10);
  box-shadow:
    0 24px 60px -24px rgba(0,0,0,0.85),
    inset 0 1px 0 rgba(255,255,255,0.07);
}

/* ── Entrada por scroll ── */
.dl-reveal {
  opacity: 0;
  transform: translateY(26px);
  transition: opacity 0.85s var(--ease-out), transform 0.85s var(--ease-out);
}
.dl-reveal.is-visible { opacity: 1; transform: none; }

/* ── Tipografia ── */
.dl-h1 {
  display: flex; flex-direction: column;
  font-size: clamp(38px, 4.6vw, 62px); line-height: 1.0;
  letter-spacing: -0.045em; font-weight: 800; color: var(--strong);
  margin: 20px 0 0;
}
.dl-h1__accent { font-weight: 500; color: var(--accent-soft); }
.dl-h2 {
  display: flex; flex-direction: column;
  font-size: clamp(30px, 3.9vw, 52px); line-height: 1.04;
  letter-spacing: -0.04em; font-weight: 800; color: var(--strong);
  margin: 14px 0 0; max-width: 15ch;
}
.dl-h2__soft { font-weight: 500; color: var(--subtle); }
.dl-lead { font-size: 16px; line-height: 1.72; color: var(--subtle); margin-top: 22px; max-width: 560px; }
.dl-body { font-size: 14.5px; line-height: 1.75; color: var(--placeholder); margin-top: 14px; }
.dl-note { color: var(--placeholder); line-height: 1.85; margin-top: 26px; text-transform: none; letter-spacing: 0.04em; }

.dl-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--subtle); font-weight: 500;
}
.dl-eyebrow__line { width: 22px; height: 1px; background: var(--line); }
.dl-eyebrow__dot { width: 5px; height: 5px; border-radius: 999px; background: var(--accent-soft); }

/* ── Logo ── */
.dl-logo { display: inline-flex; align-items: center; gap: 9px; }
/* O PNG é dourado sobre fundo transparente e não é quadrado: sem caixa,
   sem raio, só object-fit contain para caber na altura pedida sem distorcer. */
.dl-logo__mark {
  width: 30px; height: 30px; flex: 0 0 auto;
  object-fit: contain; object-position: center;
  display: block;
}
.dl-logo__name { font-size: 17px; font-weight: 800; letter-spacing: -0.03em; color: var(--strong); }
/* A altura vem de quem usa (prop ou CSS); aqui só se garante que a largura
   acompanhe a proporção em vez de esticar. */
.dl-lockup { width: auto; display: block; flex: 0 0 auto; }

/* ── Botões ──
   As variantes são prefixadas com .dl-root para vencer o seletor ".dl-root a"
   acima e a regra "button" global do styles.css. */
.dl-root .dl-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 10px;
  width: auto; padding: 11px 16px 11px 20px; border-radius: 999px;
  font-family: inherit; font-size: 13px; font-weight: 600; letter-spacing: -0.01em;
  border: 1px solid transparent; cursor: pointer; white-space: nowrap;
  transition: transform 0.22s var(--ease-out), background 0.18s ease, border-color 0.18s ease, box-shadow 0.22s ease, opacity 0.18s ease;
}
.dl-root .dl-btn:hover { transform: translateY(-2px); }
.dl-root .dl-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
.dl-btn__arrow {
  display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: 999px; background: rgba(0,0,0,0.10);
  transition: transform 0.22s var(--ease-out);
}
.dl-root .dl-btn:hover .dl-btn__arrow { transform: translateX(2px); }

.dl-root .dl-btn--primary { background: #fff; color: #0a0a0b; }
.dl-root .dl-btn--primary:hover { background: #e9e9ee; box-shadow: 0 14px 34px -14px rgba(255,255,255,0.5); }

.dl-root .dl-btn--accent { background: var(--accent); color: #fff; }
.dl-root .dl-btn--accent .dl-btn__arrow { background: rgba(255,255,255,0.18); }
.dl-root .dl-btn--accent:hover { background: #5457e0; box-shadow: 0 14px 34px -14px rgba(99,102,241,0.75); }

.dl-root .dl-btn--ghost {
  background: rgba(255,255,255,0.04); color: var(--strong);
  border-color: var(--line); padding: 11px 20px;
}
.dl-root .dl-btn--ghost:hover { border-color: #3a3a40; background: rgba(255,255,255,0.08); }

.dl-root .dl-btn--outline { background: transparent; color: var(--strong); border-color: var(--line); }
.dl-root .dl-btn--outline .dl-btn__arrow { background: rgba(255,255,255,0.10); }
.dl-root .dl-btn--outline:hover { border-color: #3a3a40; background: rgba(255,255,255,0.05); }

.dl-root .dl-btn--danger {
  background: rgba(248,113,113,0.10); color: #fca5a5;
  border-color: rgba(248,113,113,0.30);
}
.dl-root .dl-btn--danger .dl-btn__arrow { background: rgba(248,113,113,0.18); }
.dl-root .dl-btn--danger:hover { background: rgba(248,113,113,0.18); border-color: rgba(248,113,113,0.55); }

.dl-root .dl-btn--dark { background: #0a0a0b; color: #fff; }
.dl-root .dl-btn--dark .dl-btn__arrow { background: rgba(255,255,255,0.14); }
.dl-root .dl-btn--dark:hover { background: #23232a; }

.dl-root .dl-btn--light {
  background: transparent; color: #0c121a;
  border-color: rgba(12,18,26,0.20); padding: 11px 20px;
}
.dl-root .dl-btn--light:hover { border-color: rgba(12,18,26,0.45); background: rgba(12,18,26,0.04); }

.dl-root .dl-btn--sm { padding: 8px 12px; font-size: 12px; gap: 8px; }
.dl-root .dl-btn--block { width: 100%; padding-left: 16px; }

.dl-btn-row { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 30px; }
.dl-btn-row--center { justify-content: center; }

/* ── Formulários ── */
.dl-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.dl-field__label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 9px; letter-spacing: 0.13em; text-transform: uppercase;
  color: var(--placeholder); font-weight: 500;
}
.dl-field__hint { font-size: 11.5px; line-height: 1.6; color: var(--placeholder); }

.dl-root .dl-input {
  width: 100%; padding: 12px 14px; border-radius: 11px;
  background: rgba(255,255,255,0.04); border: 1px solid var(--line);
  color: var(--strong); font-family: inherit; font-size: 13.5px; outline: none;
  transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
}
.dl-root .dl-input::placeholder { color: #5c5c66; }
.dl-root .dl-input:hover:not(:disabled) { border-color: #35353c; }
.dl-root .dl-input:focus {
  border-color: var(--accent-soft); background: rgba(255,255,255,0.06);
  box-shadow: 0 0 0 3px rgba(99,102,241,0.18);
}
.dl-root .dl-input:disabled { opacity: 0.5; cursor: not-allowed; }
.dl-root select.dl-input { appearance: none; cursor: pointer; padding-right: 34px;
  background-image: linear-gradient(45deg, transparent 50%, #7d7d8a 50%), linear-gradient(135deg, #7d7d8a 50%, transparent 50%);
  background-position: calc(100% - 18px) 52%, calc(100% - 13px) 52%;
  background-size: 5px 5px, 5px 5px; background-repeat: no-repeat;
}
.dl-root select.dl-input option { background: #141416; color: var(--strong); }

/* ── Painéis, alertas, pills ── */
.dl-panel {
  background: var(--surface); border: 1px solid var(--line);
  border-radius: 18px; padding: 22px 24px;
}
.dl-panel--flat { background: var(--bg-alt); }

.dl-alert {
  padding: 12px 16px; border-radius: 12px; font-size: 13px; line-height: 1.6;
  border: 1px solid transparent;
}
.dl-alert--danger { background: rgba(248,113,113,0.10); border-color: rgba(248,113,113,0.28); color: #fca5a5; }
.dl-alert--info { background: rgba(99,102,241,0.10); border-color: rgba(99,102,241,0.26); color: #c7cbff; }

.dl-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 10px; border-radius: 999px;
  font-size: 10.5px; font-weight: 700; letter-spacing: 0.04em;
  border: 1px solid transparent; white-space: nowrap;
}

.dl-chip {
  padding: 3px 9px; border-radius: 999px; font-size: 8.5px; letter-spacing: 0.11em;
  color: var(--accent-soft); background: rgba(99,102,241,0.10); border: 1px solid rgba(99,102,241,0.22);
}

.dl-badge {
  display: inline-block; padding: 7px 14px; border-radius: 999px;
  color: var(--accent-soft); font-size: 9.5px; letter-spacing: 0.13em;
}

.dl-dot { width: 8px; height: 8px; border-radius: 999px; display: block; flex: 0 0 auto; }
.dl-skel { display: block; height: 7px; border-radius: 4px; background: rgba(255,255,255,0.16); }
.dl-index { color: var(--placeholder); display: block; font-size: 9.5px; }

/* ── Grid de hairline ── */
.dl-grid-hair {
  display: grid; border-top: 1px solid var(--line); border-left: 1px solid var(--line);
}
.dl-grid-hair--2 { grid-template-columns: repeat(2, 1fr); }
.dl-grid-hair--3 { grid-template-columns: repeat(3, 1fr); }
.dl-grid-hair--4 { grid-template-columns: repeat(4, 1fr); }
.dl-cell { padding: 22px; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }

.dl-stat { display: flex; flex-direction: column; gap: 6px; }
.dl-stat__n {
  font-size: clamp(28px, 3.4vw, 44px); font-weight: 700; letter-spacing: -0.045em;
  color: var(--strong); line-height: 1; font-variant-numeric: tabular-nums;
}
.dl-stat__l { font-size: 12.5px; line-height: 1.65; color: var(--subtle); }

/* ── Callout ── */
.dl-callout {
  padding: 30px 34px; border-radius: 18px; background: var(--surface);
  border: 1px solid var(--line); display: grid; gap: 14px;
}
.dl-callout p { font-size: clamp(15px, 1.5vw, 19px); line-height: 1.6; letter-spacing: -0.015em; color: var(--strong); }

/* ── Movimento reduzido ── */
@media (prefers-reduced-motion: reduce) {
  .dl-reveal { opacity: 1; transform: none; transition: none; }
  .dl-root .dl-btn:hover { transform: none; }
}

@media (max-width: 640px) {
  .dl-wrap { padding: 0 18px; }
  .dl-grid-hair--2, .dl-grid-hair--3, .dl-grid-hair--4 { grid-template-columns: 1fr; }
}
`;
