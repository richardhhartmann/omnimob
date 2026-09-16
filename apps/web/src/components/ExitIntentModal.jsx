import { useEffect, useRef, useState } from "react";

/* OMNIMOB_EXIT_INTENT_V1_COMPONENT
   Última oportunidade sem virar perseguição:
   - uma aparição por sessão;
   - desktop: saída real do ponteiro pelo topo, depois de tempo + leitura;
   - mobile: profundidade + tempo + inatividade, sem interceptar o botão Voltar;
   - se o TrialModal já foi aberto, este componente se aposenta na sessão. */

const CHAVE_VISTO = "omnimob:exit-intent:v1:visto";
const CHAVE_TRIAL = "omnimob:exit-intent:v1:trial";
const TEMPO_DESKTOP = 10_000;
const TEMPO_MOBILE = 15_000;
const OCIOSO_MOBILE = 9_000;
const LEITURA_DESKTOP = 0.25;
const LEITURA_MOBILE = 0.58;

function lerSessao(chave) {
  try {
    return window.sessionStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravarSessao(chave, valor = "1") {
  try {
    window.sessionStorage.setItem(chave, valor);
  } catch {
    // Navegação privada / storage bloqueado: o modal continua funcional.
  }
}

function progressoDaPagina() {
  const doc = document.documentElement;
  const rolavel = Math.max(1, doc.scrollHeight - window.innerHeight);
  return Math.min(1, Math.max(0, window.scrollY / rolavel));
}

/* Duração da saída. Bate com `ei-caixa-out` / `ei-sheet-out` no CSS: é o
   tempo que o componente espera antes de desmontar. */
const SAIDA_MS = 240;

export function ExitIntentModal({ trialAberto = false, onTeste }) {
  const [aberto, setAberto] = useState(false);
  /* ── O FECHAMENTO ANIMA ─────────────────────────────────────────────────
     `setAberto(false)` desmonta na hora, e a caixa sumia num corte seco
     depois de ter entrado deslizando. `saindo` liga a classe de saída (a
     entrada ao contrário) e só depois dela o modal sai do DOM. Todos os
     caminhos de fechar da PESSOA — botão, Esc, clique no véu, "agora não" —
     passam por `fechar`; os fechamentos por TROCA de modal (o Trial abrindo)
     continuam secos de propósito: ali outra superfície entra no lugar, e duas
     animações no mesmo quadro brigam. */
  const [saindo, setSaindo] = useState(false);
  const saidaRef = useRef(0);
  const [ehMobile, setEhMobile] = useState(false);

  const nasceuEm = useRef(Date.now());
  const maiorProgresso = useRef(0);
  const trialJaAbriu = useRef(false);
  const bloqueado = useRef(false);
  const botaoPrincipalRef = useRef(null);
  const focoAnteriorRef = useRef(null);
  const saindoRef = useRef(false);

  // Se o modal desmontar no meio da saída (o Trial abriu), o timer não pode
  // mexer em estado de componente que já se foi.
  useEffect(() => () => window.clearTimeout(saidaRef.current), []);

  const debug =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("exitdebug") === "1";

  /* Descobre o tipo de interação, não só a largura. Notebook estreito ainda tem
     mouse; tablet largo ainda pode ser toque. */
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px), (pointer: coarse)");
    const atualizar = () => setEhMobile(mq.matches);
    atualizar();
    mq.addEventListener?.("change", atualizar);
    return () => mq.removeEventListener?.("change", atualizar);
  }, []);

  /* Se o usuário já viu o convite nesta sessão ou já abriu o teste, não há
     motivo para insistir. O ?exitdebug=1 ignora isso só para desenvolvimento. */
  useEffect(() => {
    if (debug) {
      bloqueado.current = false;
      return;
    }
    bloqueado.current = Boolean(lerSessao(CHAVE_VISTO) || lerSessao(CHAVE_TRIAL));
  }, [debug]);

  /* O TrialModal é a conversão real. Uma vez que ele abriu, o exit intent perde
     permanentemente o direito de aparecer durante a sessão. */
  useEffect(() => {
    if (!trialAberto) return;
    trialJaAbriu.current = true;
    bloqueado.current = true;
    gravarSessao(CHAVE_TRIAL);
    setAberto(false);
  }, [trialAberto]);

  function podeAbrir({ mobile }) {
    if (aberto || bloqueado.current || trialAberto || trialJaAbriu.current) return false;
    if (document.visibilityState !== "visible") return false;

    const ativo = document.activeElement;
    if (
      ativo &&
      (ativo.matches?.("input, textarea, select, [contenteditable='true']") ||
        ativo.closest?.("[role='dialog']"))
    ) {
      return false;
    }

    const decorrido = Date.now() - nasceuEm.current;
    if (mobile) {
      return decorrido >= TEMPO_MOBILE && maiorProgresso.current >= LEITURA_MOBILE;
    }
    return decorrido >= TEMPO_DESKTOP && maiorProgresso.current >= LEITURA_DESKTOP;
  }

  function mostrar() {
    if (aberto || trialAberto || trialJaAbriu.current) return;
    if (!debug && bloqueado.current) return;

    bloqueado.current = true;
    if (!debug) gravarSessao(CHAVE_VISTO);
    setAberto(true);
  }

  /* Desktop: exit intent de verdade. relatedTarget nulo significa que o ponteiro
     deixou o documento; clientY próximo de zero filtra a saída pela barra/aba,
     em vez de disparar quando a pessoa cruza uma lateral. */
  useEffect(() => {
    if (ehMobile) return undefined;

    const atualizarLeitura = () => {
      maiorProgresso.current = Math.max(maiorProgresso.current, progressoDaPagina());
    };

    const aoSair = (evento) => {
      atualizarLeitura();
      if (evento.relatedTarget !== null) return;
      if (evento.clientY > 10) return;
      if (!podeAbrir({ mobile: false })) return;
      mostrar();
    };

    atualizarLeitura();
    window.addEventListener("scroll", atualizarLeitura, { passive: true });
    document.addEventListener("mouseout", aoSair);

    return () => {
      window.removeEventListener("scroll", atualizarLeitura);
      document.removeEventListener("mouseout", aoSair);
    };
  }, [ehMobile, aberto, trialAberto, debug]);

  /* Mobile não tem "mouse saindo da janela". Em vez de sequestrar o botão
     Voltar, espera a pessoa realmente consumir a página e parar de interagir.
     Qualquer novo scroll/toque reinicia o relógio de inatividade. */
  useEffect(() => {
    if (!ehMobile) return undefined;

    let timer = 0;
    let ultimoMovimento = Date.now();

    const cancelar = () => {
      if (timer) window.clearTimeout(timer);
      timer = 0;
    };

    const agendar = () => {
      cancelar();
      maiorProgresso.current = Math.max(maiorProgresso.current, progressoDaPagina());

      if (aberto || bloqueado.current || trialAberto || trialJaAbriu.current) return;
      if (maiorProgresso.current < LEITURA_MOBILE) return;

      const faltaTempo = Math.max(0, TEMPO_MOBILE - (Date.now() - nasceuEm.current));
      const espera = Math.max(OCIOSO_MOBILE, faltaTempo);

      timer = window.setTimeout(() => {
        const ociosoHa = Date.now() - ultimoMovimento;
        if (ociosoHa < OCIOSO_MOBILE) {
          agendar();
          return;
        }
        if (podeAbrir({ mobile: true })) mostrar();
      }, espera);
    };

    const atividade = () => {
      ultimoMovimento = Date.now();
      agendar();
    };

    maiorProgresso.current = Math.max(maiorProgresso.current, progressoDaPagina());
    agendar();

    window.addEventListener("scroll", atividade, { passive: true });
    window.addEventListener("pointerdown", atividade, { passive: true });
    window.addEventListener("keydown", atividade);

    return () => {
      cancelar();
      window.removeEventListener("scroll", atividade);
      window.removeEventListener("pointerdown", atividade);
      window.removeEventListener("keydown", atividade);
    };
  }, [ehMobile, aberto, trialAberto, debug]);

  /* Atalho de teste: /?exitdebug=1 abre em ~700 ms, mesmo que a sessão já tenha
     visto o modal. Isso não altera storage e facilita comparar desktop/mobile. */
  useEffect(() => {
    if (!debug || trialAberto) return undefined;
    const id = window.setTimeout(() => setAberto(true), 700);
    return () => window.clearTimeout(id);
  }, [debug, trialAberto]);

  /* Foco e teclado. Não prendemos scroll do body aqui para não disputar o lock do
     TrialModal quando o CTA troca um modal pelo outro no mesmo clique. */
  useEffect(() => {
    if (!aberto) return undefined;

    focoAnteriorRef.current = document.activeElement;
    const foco = window.setTimeout(() => botaoPrincipalRef.current?.focus(), 50);

    const aoTeclar = (evento) => {
      if (evento.key === "Escape") {
        evento.preventDefault();
        evento.stopPropagation();
        fechar();
        return;
      }

      if (evento.key !== "Tab") return;
      const caixa = document.querySelector(".ei-caixa");
      const alvos = Array.from(
        caixa?.querySelectorAll(
          "button:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])",
        ) || [],
      ).filter((el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true");

      if (!alvos.length) return;
      const primeiro = alvos[0];
      const ultimo = alvos[alvos.length - 1];

      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    };

    document.addEventListener("keydown", aoTeclar, true);
    return () => {
      window.clearTimeout(foco);
      document.removeEventListener("keydown", aoTeclar, true);
      const anterior = focoAnteriorRef.current;
      if (anterior?.isConnected) anterior.focus?.({ preventScroll: true });
    };
  }, [aberto]);

  /* Declarada antes do retorno vazio: o efeito do teclado (acima) a chama.
     Idempotente — clique duplo no "×" não reinicia a saída. */
  function fechar() {
    if (saindoRef.current) return;
    saindoRef.current = true;
    setSaindo(true);
    saidaRef.current = window.setTimeout(() => {
      saindoRef.current = false;
      setSaindo(false);
      setAberto(false);
    }, SAIDA_MS);
  }

  if (!aberto || trialAberto) return null;

  const testar = () => {
    bloqueado.current = true;
    gravarSessao(CHAVE_TRIAL);
    setAberto(false);
    /* Próximo tick: o exit sai antes de o TrialModal entrar, evitando duas
       superfícies competindo no mesmo frame. */
    window.setTimeout(() => onTeste?.(), 0);
  };

  return (
    <div
      className={`ei-veu${saindo ? " is-saindo" : ""}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) fechar();
      }}
      aria-hidden="false"
    >
      <style>{EXIT_CSS}</style>

      <section
        className={`ei-caixa${saindo ? " is-saindo" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ei-titulo"
        aria-describedby="ei-descricao"
      >
        <button type="button" className="ei-fechar" onClick={fechar} aria-label="Fechar">
          ×
        </button>

        <div className="ei-copy">
          <span className="ei-eyebrow">● UMA ÚLTIMA COISA</span>

          <h2 id="ei-titulo">
            Antes de ir, veja a Omnimob
            <span>com a sua imobiliária.</span>
          </h2>

          <p id="ei-descricao">
            Crie seu ambiente, escolha o plano e monte sua vitrine com seus próprios imóveis.
            Você entende o produto usando — não imaginando.
          </p>

          <div className="ei-provas" aria-label="Condições do teste">
            <span><i aria-hidden="true" />14 dias grátis</span>
            <span><i aria-hidden="true" />Sem cartão</span>
            <span><i aria-hidden="true" />Ambiente próprio</span>
          </div>

          <div className="ei-acoes">
            <button
              ref={botaoPrincipalRef}
              type="button"
              className="ei-primario"
              onClick={testar}
            >
              <span>Testar a Omnimob</span>
              <b aria-hidden="true">→</b>
            </button>

            <button type="button" className="ei-secundario" onClick={fechar}>
              Continuar explorando
            </button>
          </div>

          <span className="ei-nota">Sem compromisso. Você decide depois de ver funcionando.</span>
        </div>

        <div className="ei-visual" aria-hidden="true">
          <span className="ei-orbita ei-orbita--a" />
          <span className="ei-orbita ei-orbita--b" />

          <div className="ei-browser">
            <div className="ei-browser__barra">
              <span /><span /><span />
              <b>omnimob.app / painel</b>
            </div>

            <div className="ei-browser__corpo">
              <aside>
                <strong>O</strong>
                <i className="is-on" /><i /><i /><i />
              </aside>

              <main>
                <div className="ei-kpis">
                  <span><small>IMÓVEIS</small><b>128</b></span>
                  <span><small>LEADS</small><b>46</b></span>
                </div>

                <div className="ei-vitrine">
                  <span className="ei-vitrine__hero" />
                  <div>
                    <i /><i /><i />
                  </div>
                </div>
              </main>
            </div>
          </div>

          <div className="ei-lead">
            <i />
            <span><small>NOVO LEAD</small><strong>Apto. Jardins</strong></span>
          </div>
        </div>
      </section>
    </div>
  );
}

const EXIT_CSS = `
/* OMNIMOB_EXIT_INTENT_V1_CSS_START */
.ei-veu {
  position: fixed;
  inset: 0;
  z-index: 2147482000;
  display: grid;
  place-items: center;
  padding: 24px;
  background:
    radial-gradient(760px 440px at 50% 44%, rgba(99,102,241,.13), transparent 72%),
    rgba(5,5,7,.76);
  backdrop-filter: blur(12px) saturate(.9);
  -webkit-backdrop-filter: blur(12px) saturate(.9);
  animation: ei-veu-in .28s ease both;
}
/* A saida: o inverso da entrada, mais curta (o que fecha nao precisa
   apresentar nada). pointer-events none para um segundo clique no veu, no
   meio da saida, nao acertar a pagina por baixo. */
.ei-veu.is-saindo { animation: ei-veu-out .24s ease both; pointer-events: none; }

.ei-caixa {
  --ei-linha: rgba(255,255,255,.10);
  --ei-fraca: #9b9ba6;
  --ei-forte: #f4f4f7;
  position: relative;
  isolation: isolate;
  width: min(760px, calc(100vw - 48px));
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(270px, .92fr);
  overflow: hidden;
  border: 1px solid var(--ei-linha);
  border-radius: 28px;
  background:
    linear-gradient(135deg, rgba(255,255,255,.055), rgba(255,255,255,.018) 45%, transparent 72%),
    #0b0b0e;
  box-shadow:
    0 46px 110px -34px rgba(0,0,0,.92),
    inset 0 1px 0 rgba(255,255,255,.055);
  color: var(--ei-forte);
  animation: ei-caixa-in .5s cubic-bezier(.22, 1, .36, 1) both;
}
.ei-caixa.is-saindo { animation: ei-caixa-out .24s cubic-bezier(.4, 0, 1, 1) both; }

.ei-caixa::before {
  content: "";
  position: absolute;
  z-index: 5;
  top: 0;
  left: 9%;
  right: 9%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(212,175,55,.70), rgba(129,140,248,.78), transparent);
  opacity: .8;
}

.ei-copy {
  position: relative;
  z-index: 3;
  padding: 42px 12px 38px 42px;
}

.ei-eyebrow {
  display: inline-flex;
  align-items: center;
  margin-bottom: 15px;
  color: #d4af37;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .18em;
}

.ei-copy h2 {
  margin: 0;
  max-width: 12ch;
  color: var(--ei-forte);
  font-size: clamp(30px, 3.2vw, 39px);
  font-weight: 700;
  line-height: 1.02;
  letter-spacing: -.055em;
}

.ei-copy h2 span {
  display: block;
  margin-top: 5px;
  color: #a9a9b2;
  font-weight: 350;
}

.ei-copy > p {
  max-width: 48ch;
  margin: 19px 0 0;
  color: var(--ei-fraca);
  font-size: 13px;
  line-height: 1.72;
}

.ei-provas {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 15px;
  margin-top: 22px;
  color: #c7c7ce;
  font-size: 11px;
}

.ei-provas span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  white-space: nowrap;
}

.ei-provas i {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: #14b8a6;
  box-shadow: 0 0 9px rgba(20,184,166,.65);
}

.ei-acoes {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 27px;
}

.ei-caixa button.ei-primario,
.ei-caixa button.ei-secundario,
.ei-caixa button.ei-fechar {
  width: auto;
  min-width: 0;
  margin: 0;
  font-family: inherit;
  box-shadow: none;
}

.ei-caixa button.ei-primario {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  min-height: 46px;
  padding: 0 8px 0 19px;
  border: 1px solid rgba(255,255,255,.80);
  border-radius: 999px;
  background: #f4f4f6;
  color: #0a0a0c;
  font-size: 12.5px;
  font-weight: 750;
  letter-spacing: -.01em;
  cursor: pointer;
  transition: transform .22s ease, box-shadow .22s ease, background .22s ease;
}

.ei-caixa button.ei-primario b {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: #111116;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  transition: transform .22s ease;
}

.ei-caixa button.ei-primario:hover {
  transform: translateY(-1px);
  background: #fff;
  box-shadow: 0 13px 30px -18px rgba(255,255,255,.48);
}

.ei-caixa button.ei-primario:hover b { transform: translateX(2px); }

.ei-caixa button.ei-secundario {
  min-height: 42px;
  padding: 0 11px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #85858f;
  font-size: 11.5px;
  font-weight: 550;
  cursor: pointer;
  transition: color .18s ease, background .18s ease;
}

.ei-caixa button.ei-secundario:hover {
  transform: none;
  background: rgba(255,255,255,.035);
  color: #d7d7dd;
}

.ei-nota {
  display: block;
  margin-top: 13px;
  color: #5f5f68;
  font-size: 9.5px;
  line-height: 1.5;
}

.ei-caixa button.ei-fechar {
  position: absolute;
  z-index: 20;
  top: 15px;
  right: 15px;
  width: 34px;
  height: 34px;
  padding: 0;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255,255,255,.09);
  border-radius: 999px;
  background: rgba(10,10,12,.52);
  color: #91919b;
  font-size: 20px;
  font-weight: 300;
  line-height: 1;
  cursor: pointer;
  backdrop-filter: blur(10px);
  transition: background .18s ease, color .18s ease, border-color .18s ease;
}

.ei-caixa button.ei-fechar:hover {
  transform: none;
  background: rgba(255,255,255,.08);
  border-color: rgba(255,255,255,.17);
  color: #fff;
}

.ei-caixa button:focus-visible {
  outline: 2px solid #a5b4fc;
  outline-offset: 3px;
}

/* O produto é a imagem do modal. Não usa screenshot: esse recorte em DOM envelhece
   junto com a linguagem visual da landing e continua nítido em qualquer DPR. */
.ei-visual {
  position: relative;
  min-height: 370px;
  overflow: hidden;
  border-left: 1px solid rgba(255,255,255,.07);
  background:
    radial-gradient(240px 220px at 64% 46%, rgba(99,102,241,.20), transparent 72%),
    radial-gradient(180px 160px at 20% 82%, rgba(212,175,55,.08), transparent 74%),
    #09090c;
}

.ei-orbita {
  position: absolute;
  border: 1px solid rgba(129,140,248,.12);
  border-radius: 999px;
  pointer-events: none;
}

.ei-orbita--a { width: 300px; height: 300px; right: -132px; top: 22px; }
.ei-orbita--b { width: 190px; height: 190px; left: -94px; bottom: -84px; border-color: rgba(212,175,55,.09); }

.ei-browser {
  position: absolute;
  z-index: 3;
  left: 24px;
  top: 72px;
  width: 310px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 16px;
  background: rgba(16,16,22,.94);
  box-shadow: 0 28px 60px -28px rgba(0,0,0,.95);
  transform: rotate(-2.5deg);
}

.ei-browser__barra {
  height: 34px;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 10px;
  border-bottom: 1px solid rgba(255,255,255,.07);
  background: rgba(255,255,255,.025);
}

.ei-browser__barra > span {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: #4b4b55;
}

.ei-browser__barra > span:first-child { background: #f87171; }
.ei-browser__barra > span:nth-child(2) { background: #fbbf24; }
.ei-browser__barra > span:nth-child(3) { background: #4ade80; }

.ei-browser__barra b {
  margin-left: 6px;
  color: #565661;
  font-size: 7px;
  font-weight: 600;
  letter-spacing: .02em;
}

.ei-browser__corpo {
  height: 210px;
  display: grid;
  grid-template-columns: 48px 1fr;
}

.ei-browser aside {
  display: grid;
  align-content: start;
  justify-items: center;
  gap: 11px;
  padding: 14px 8px;
  border-right: 1px solid rgba(255,255,255,.06);
  background: rgba(0,0,0,.15);
}

.ei-browser aside strong {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 7px;
  background: linear-gradient(135deg, #d4af37, #818cf8);
  color: #fff;
  font-size: 10px;
}

.ei-browser aside i {
  width: 22px;
  height: 3px;
  border-radius: 99px;
  background: rgba(255,255,255,.08);
}

.ei-browser aside i.is-on {
  background: rgba(129,140,248,.72);
  box-shadow: 0 0 8px rgba(129,140,248,.35);
}

.ei-browser main { padding: 14px; min-width: 0; }

.ei-kpis {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.ei-kpis span {
  padding: 9px 10px;
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 9px;
  background: rgba(255,255,255,.025);
}

.ei-kpis small {
  display: block;
  color: #5f5f69;
  font-size: 6px;
  letter-spacing: .08em;
}

.ei-kpis b {
  display: block;
  margin-top: 2px;
  color: #e6e6eb;
  font-size: 14px;
}

.ei-vitrine {
  margin-top: 10px;
  padding: 9px;
  border: 1px solid rgba(255,255,255,.065);
  border-radius: 10px;
  background: rgba(0,0,0,.18);
}

.ei-vitrine__hero {
  display: block;
  height: 34px;
  border-radius: 6px;
  background:
    linear-gradient(110deg, rgba(99,102,241,.42), rgba(212,175,55,.22)),
    rgba(255,255,255,.04);
}

.ei-vitrine > div {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin-top: 7px;
}

.ei-vitrine > div i {
  height: 54px;
  border-radius: 6px;
  background:
    linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.018));
  border: 1px solid rgba(255,255,255,.05);
}

.ei-lead {
  position: absolute;
  z-index: 5;
  right: 18px;
  bottom: 45px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px 13px 10px 10px;
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 13px;
  background: rgba(18,18,24,.86);
  box-shadow: 0 20px 42px -23px rgba(0,0,0,.95);
  backdrop-filter: blur(12px);
  transform: rotate(2deg);
}

.ei-lead > i {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: #14b8a6;
  box-shadow: 0 0 12px rgba(20,184,166,.7);
}

.ei-lead span { display: grid; gap: 1px; }
.ei-lead small { color: #676771; font-size: 6.5px; letter-spacing: .1em; }
.ei-lead strong { color: #d9d9df; font-size: 9px; }

@keyframes ei-veu-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Entrada: sobe e cresce de 94%, com a curva "out-expo" que assenta sem
   quicar. Era 14px e 97,5% — quase imperceptivel sobre o veu escurecendo ao
   mesmo tempo. */
@keyframes ei-caixa-in {
  from { opacity: 0; transform: translateY(28px) scale(.94); }
  to { opacity: 1; transform: none; }
}
/* Saida: encolhe e desce de leve, apagando — o mesmo movimento ao contrario,
   mais curto. */
@keyframes ei-caixa-out {
  from { opacity: 1; transform: none; }
  to { opacity: 0; transform: translateY(16px) scale(.96); }
}
@keyframes ei-veu-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@media (max-width: 760px) {
  .ei-veu {
    place-items: end center;
    padding: 0;
    background: rgba(4,4,6,.72);
  }

  .ei-caixa {
    width: 100%;
    max-height: min(90dvh, 760px);
    grid-template-columns: 1fr;
    overflow-y: auto;
    overscroll-behavior: contain;
    border-width: 1px 0 0;
    border-radius: 28px 28px 0 0;
    animation-name: ei-sheet-in;
  }
  /* No celular a caixa e uma folha que sobe do rodape; a saida e ela
     descendo de volta. */
  .ei-caixa.is-saindo { animation-name: ei-sheet-out; }

  .ei-caixa::after {
    content: "";
    position: absolute;
    z-index: 21;
    top: 8px;
    left: 50%;
    width: 38px;
    height: 4px;
    translate: -50% 0;
    border-radius: 99px;
    background: rgba(255,255,255,.18);
  }

  .ei-copy {
    order: 2;
    padding: 25px 20px calc(20px + env(safe-area-inset-bottom));
  }

  .ei-eyebrow { margin-bottom: 10px; font-size: 8px; }

  .ei-copy h2 {
    max-width: 14ch;
    font-size: clamp(28px, 8.6vw, 35px);
    line-height: 1.01;
  }

  .ei-copy > p {
    margin-top: 14px;
    max-width: 40ch;
    font-size: 12.5px;
    line-height: 1.62;
  }

  .ei-provas {
    gap: 7px 12px;
    margin-top: 17px;
    font-size: 10.5px;
  }

  .ei-acoes {
    display: grid;
    grid-template-columns: 1fr;
    gap: 7px;
    margin-top: 21px;
  }

  .ei-caixa button.ei-primario {
    width: 100%;
    min-height: 50px;
    justify-content: space-between;
    padding-left: 20px;
  }

  .ei-caixa button.ei-secundario {
    width: 100%;
    min-height: 40px;
  }

  .ei-nota { text-align: center; margin-top: 8px; }

  .ei-caixa button.ei-fechar {
    position: sticky;
    float: right;
    top: 12px;
    margin: 12px 12px -46px auto;
    background: rgba(8,8,11,.76);
  }

  .ei-visual {
    order: 1;
    min-height: 138px;
    border-left: 0;
    border-bottom: 1px solid rgba(255,255,255,.065);
  }

  .ei-browser {
    left: 50%;
    top: 25px;
    width: min(330px, 82vw);
    transform: translateX(-50%) rotate(-1.5deg) scale(.76);
    transform-origin: top center;
  }

  .ei-lead {
    right: 9%;
    bottom: 11px;
    transform: scale(.86) rotate(1.5deg);
    transform-origin: right bottom;
  }

  .ei-orbita--a { right: -170px; top: -58px; }
  .ei-orbita--b { left: -120px; bottom: -115px; }
}

@media (max-width: 390px) {
  .ei-visual { min-height: 122px; }
  .ei-browser { top: 18px; transform: translateX(-50%) rotate(-1.5deg) scale(.68); }
  .ei-lead { right: 5%; bottom: 7px; transform: scale(.78) rotate(1.5deg); }
  .ei-copy { padding-inline: 17px; }
}

@media (prefers-reduced-motion: reduce) {
  .ei-veu,
  .ei-caixa {
    animation: none;
  }
  /* Sem percurso, mas ainda com esmaecimento: sumir de estalo desorienta. */
  .ei-veu.is-saindo, .ei-caixa.is-saindo { animation: ei-veu-out .16s ease both; }

  .ei-caixa button,
  .ei-browser,
  .ei-lead {
    transition: none !important;
  }
}

@keyframes ei-sheet-in {
  from { opacity: 0; transform: translateY(100%); }
  to { opacity: 1; transform: none; }
}
@keyframes ei-sheet-out {
  from { opacity: 1; transform: none; }
  to { opacity: 0; transform: translateY(100%); }
}
/* OMNIMOB_EXIT_INTENT_V1_CSS_END */
`;

export default ExitIntentModal;
