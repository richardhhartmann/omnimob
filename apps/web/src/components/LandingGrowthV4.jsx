import { useEffect, useRef, useState } from "react";

/* OMNIMOB_LANDING_GROWTH_V4_COMPONENT
   Camada de produto + conversão da landing:
   - "Veja acontecer": mini-demo interativa do fluxo imóvel → vitrine → lead;
   - confiança operacional sem promessas inventadas;
   - CTA persistente no mobile, só no miolo da página;
   - telemetria agnóstica: gtag/dataLayer quando existem + CustomEvent sempre.

   Nenhum dado pessoal é enviado por este helper. */

export function trackLandingEvent(nome, dados = {}) {
  if (typeof window === "undefined") return;

  const payload = {
    event: `omnimob_${nome}`,
    ...dados,
  };

  try {
    window.dispatchEvent(new CustomEvent("omnimob:landing-event", { detail: payload }));
  } catch {
    // Navegador antigo: analytics nunca pode quebrar a landing.
  }

  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", payload.event, dados);
    } else if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push(payload);
    }
  } catch {
    // Medição é complementar, não parte do fluxo principal.
  }
}

const ETAPAS = [
  {
    id: "cadastro",
    n: "01",
    titulo: "Cadastre o imóvel",
    resumo: "Fotos, atributos, endereço e status entram uma vez.",
  },
  {
    id: "vitrine",
    n: "02",
    titulo: "Publique na vitrine",
    resumo: "A mesma ficha alimenta a página pública e a divulgação.",
  },
  {
    id: "lead",
    n: "03",
    titulo: "Receba o lead",
    resumo: "O interessado volta ao painel já ligado ao imóvel certo.",
  },
];

function CenaCadastro() {
  return (
    <div className="gv4-cena gv4-cena--cadastro" aria-hidden="true">
      <div className="gv4-appbar">
        <span className="gv4-appbar__crumb">IMÓVEIS / NOVO IMÓVEL</span>
        <span className="gv4-appbar__status"><i /> rascunho salvo</span>
      </div>

      <div className="gv4-cadastro">
        <div className="gv4-fotos">
          <span className="gv4-foto gv4-foto--principal">
            <i>FOTO PRINCIPAL</i>
          </span>
          <span className="gv4-foto" />
          <span className="gv4-foto" />
        </div>

        <div className="gv4-campos">
          <label>
            <small>TÍTULO</small>
            <span>Apartamento com varanda · Jardins</span>
          </label>

          <div className="gv4-campos__dupla">
            <label><small>VALOR</small><span>R$ 890.000</span></label>
            <label><small>STATUS</small><span className="is-on">● Ativo</span></label>
          </div>

          <div className="gv4-atributos">
            <span>96 m²</span><span>2 quartos</span><span>2 vagas</span>
          </div>
        </div>
      </div>

      <div className="gv4-cena__rodape">
        <span>Uma ficha. Uma fonte de verdade.</span>
        <b>Salvar imóvel <i>→</i></b>
      </div>
    </div>
  );
}

function CenaVitrine() {
  return (
    <div className="gv4-cena gv4-cena--vitrine" aria-hidden="true">
      <div className="gv4-appbar">
        <span className="gv4-appbar__crumb">VITRINE / EDITOR</span>
        <span className="gv4-segmento">
          <i className="is-on">Desktop</i><i>Mobile</i>
        </span>
      </div>

      <div className="gv4-builder">
        <aside>
          <small>BLOCOS</small>
          <span><i /> Cabeçalho</span>
          <span><i /> Destaques</span>
          <span className="is-on"><i /> Imóveis</span>
          <span><i /> Contato</span>
        </aside>

        <main>
          <div className="gv4-canvas">
            <span className="gv4-canvas__hero">
              <i />
              <b>Encontre seu próximo endereço.</b>
              <small>Imóveis selecionados para viver bem.</small>
            </span>
            <div className="gv4-canvas__cards">
              {[0, 1, 2].map((i) => (
                <span key={i}>
                  <i />
                  <b />
                  <small />
                </span>
              ))}
            </div>
            <span className="gv4-canvas__selecao" />
          </div>
        </main>
      </div>

      <div className="gv4-cena__rodape">
        <span>O que você monta é o que o cliente recebe.</span>
        <b>Publicar vitrine <i>→</i></b>
      </div>
    </div>
  );
}

function CenaLead() {
  return (
    <div className="gv4-cena gv4-cena--lead" aria-hidden="true">
      <div className="gv4-appbar">
        <span className="gv4-appbar__crumb">LEADS / NOVO CONTATO</span>
        <span className="gv4-appbar__status gv4-appbar__status--lead"><i /> chegou agora</span>
      </div>

      <div className="gv4-lead">
        <div className="gv4-lead__perfil">
          <span className="gv4-avatar">MR</span>
          <div>
            <small>NOVO LEAD</small>
            <strong>Marina Ribeiro</strong>
            <p>“Gostaria de agendar uma visita para sábado.”</p>
          </div>
        </div>

        <div className="gv4-lead__vinculo">
          <small>INTERESSE VINCULADO</small>
          <article>
            <span className="gv4-mini-imovel" />
            <div>
              <strong>Apartamento com varanda</strong>
              <span>Jardins · R$ 890.000</span>
            </div>
          </article>
        </div>

        <div className="gv4-lead__linha">
          <span><small>ORIGEM</small><b>Vitrine pública</b></span>
          <span><small>ETAPA</small><b>Primeiro contato</b></span>
          <span><small>RESPONSÁVEL</small><b>Distribuir →</b></span>
        </div>
      </div>

      <div className="gv4-cena__rodape">
        <span>O contexto chega junto com o contato.</span>
        <b>Abrir lead <i>→</i></b>
      </div>
    </div>
  );
}

function Cena({ etapa }) {
  if (etapa === "vitrine") return <CenaVitrine />;
  if (etapa === "lead") return <CenaLead />;
  return <CenaCadastro />;
}
/* A cena e a folha, para a landing usar as tres cenas dentro da secao de
   Recursos (uma por aba) sem montar a ProductStorySection inteira. A folha
   vai junto porque as cenas so se desenham com ela — e ela mora aqui, num
   template literal, e nao no styles.css. */
export { Cena as CenaDoFluxo };

/* `divisor`: o DivisorDeOndas da landing, como em TrustStrip. */
export function ProductStorySection({ onTeste, divisor = null }) {
  const [ativo, setAtivo] = useState(0);
  const secaoRef = useRef(null);
  const contouView = useRef(false);

  useEffect(() => {
    const el = secaoRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;

    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !contouView.current) {
        contouView.current = true;
        trackLandingEvent("product_story_view");
      }
    }, { threshold: 0.35 });

    io.observe(el);
    return () => io.disconnect();
  }, []);

  function selecionar(i) {
    setAtivo(i);
    trackLandingEvent("product_story_step", { step: ETAPAS[i].id });
  }

  function teclado(e, i) {
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown"
      ? 1
      : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;

    if (!delta) return;
    e.preventDefault();
    selecionar((i + delta + ETAPAS.length) % ETAPAS.length);
  }

  const etapa = ETAPAS[ativo];

  return (
    <section className="gv4-section" id="veja-acontecer" ref={secaoRef}>
      <style>{CSS}</style>
      {divisor}

      <div className="gv4-wrap">
        <header className="gv4-head">
          <div>
            <span className="gv4-eyebrow"><i /> VEJA ACONTECER</span>
            <h2>
              Cadastre uma vez.
              <span>O resto do fluxo continua.</span>
            </h2>
          </div>

          <div className="gv4-head__lado">
            <p>
              A Omnimob conecta o imóvel que entra no painel à vitrine que o cliente vê
              e ao lead que volta para a equipe.
            </p>
            <span className="gv4-head__nota">TRÊS ETAPAS · UMA MESMA OPERAÇÃO</span>
          </div>
        </header>

        <div className="gv4-shell">
          <div className="gv4-passos" role="tablist" aria-label="Fluxo da Omnimob">
            {ETAPAS.map((item, i) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={i === ativo}
                tabIndex={i === ativo ? 0 : -1}
                className={`gv4-passo${i === ativo ? " is-on" : ""}`}
                onClick={() => selecionar(i)}
                onKeyDown={(e) => teclado(e, i)}
              >
                <span className="gv4-passo__num">{item.n}</span>
                <span className="gv4-passo__texto">
                  <strong>{item.titulo}</strong>
                  <small>{item.resumo}</small>
                </span>
                <i className="gv4-passo__seta" aria-hidden="true">→</i>
              </button>
            ))}
          </div>

          <div
            className="gv4-palco"
            role="tabpanel"
            aria-label={`${etapa.n}. ${etapa.titulo}`}
          >
            <div className="gv4-palco__topo">
              <span><i /> OMNIMOB / FLUXO REAL</span>
              <span>{etapa.n} / 03</span>
            </div>

            <div className="gv4-palco__cena" key={etapa.id}>
              <Cena etapa={etapa.id} />
            </div>

            <div className="gv4-palco__baixo">
              <div>
                <small>O QUE MUDA</small>
                <strong>{etapa.resumo}</strong>
              </div>

              <button
                type="button"
                className="gv4-palco__cta"
                onClick={() => {
                  trackLandingEvent("product_story_cta", { step: etapa.id });
                  onTeste?.();
                }}
              >
                Testar com minha imobiliária <span>→</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const CONFIANCA = [
  {
    n: "01",
    titulo: "Sua operação fica separada",
    texto: "Imóveis, usuários, leads e vitrine pertencem ao ambiente da sua imobiliária.",
  },
  {
    n: "02",
    titulo: "Cada pessoa acessa o que precisa",
    texto: "Cargos e permissões granulares ajudam a organizar corretor, marketing e gestão.",
  },
  {
    n: "03",
    titulo: "Mudança sem redigitar tudo sozinho",
    texto: "Quem já opera pode informar o que precisa trazer e seguir a migração com acompanhamento.",
  },
  {
    n: "04",
    titulo: "Você testa antes de decidir",
    texto: "São 14 dias para conhecer o produto e os planos não exigem fidelidade.",
  },
];

/* `divisor` é o DivisorDeOndas da landing (onda pintada) e `className` é o
   caminho da onda vazada (`dl-ondas-vazadas`) — os dois entram por prop para
   esta faixa não depender do arquivo da página. */
export function TrustStrip({ divisor = null, className = "" }) {
  return (
    <section className={["gv4-trust", className].filter(Boolean).join(" ")} aria-label="Confiança operacional">
      {divisor}
      <div className="gv4-wrap gv4-trust__wrap">
        <div className="gv4-trust__intro">
          <span className="gv4-eyebrow"><i /> PARA OPERAR DE VERDADE</span>
          <h2>Bonito na vitrine.<br /><span>Sólido no bastidor.</span></h2>
          <p>
            Trocar de sistema envolve equipe, carteira e rotina. Por isso a Omnimob
            também precisa responder ao que acontece depois do clique.
          </p>
        </div>

        <div className="gv4-trust__grid">
          {CONFIANCA.map((item) => (
            <article key={item.n}>
              <span>{item.n}</span>
              <strong>{item.titulo}</strong>
              <p>{item.texto}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function MobileStickyCTA({ trialAberto = false, onTeste }) {
  const [mostrar, setMostrar] = useState(false);
  const [outroModal, setOutroModal] = useState(false);
  const mostrouEvento = useRef(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    let raf = 0;

    const atualizar = () => {
      raf = 0;

      if (!media.matches || trialAberto || outroModal) {
        setMostrar(false);
        return;
      }

      const y = window.scrollY;
      const minimo = Math.min(760, window.innerHeight * 0.82);
      const planos = document.querySelector("#planos");
      const contato = document.querySelector("#contato");
      const limitePlanos = planos
        ? planos.getBoundingClientRect().top + y - window.innerHeight * 0.28
        : Number.POSITIVE_INFINITY;
      const contatoVisivel = contato
        ? contato.getBoundingClientRect().top < window.innerHeight * 0.88
        : false;

      setMostrar(y > minimo && y < limitePlanos && !contatoVisivel);
    };

    const pedir = () => {
      if (!raf) raf = requestAnimationFrame(atualizar);
    };

    atualizar();
    window.addEventListener("scroll", pedir, { passive: true });
    window.addEventListener("resize", pedir, { passive: true });
    media.addEventListener?.("change", pedir);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", pedir);
      window.removeEventListener("resize", pedir);
      media.removeEventListener?.("change", pedir);
    };
  }, [trialAberto, outroModal]);

  /* Exit intent e outros dialogs podem nascer sem scroll. Observa só adição/
     remoção de nós, sem ficar lendo layout continuamente. */
  useEffect(() => {
    const checar = () => {
      setOutroModal(Boolean(document.querySelector(".ei-veu, [role='dialog'][aria-modal='true']")));
    };

    checar();
    const mo = new MutationObserver(checar);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    if (mostrar && !mostrouEvento.current) {
      mostrouEvento.current = true;
      trackLandingEvent("mobile_sticky_view");
    }
  }, [mostrar]);

  return (
    <div className={`gv4-sticky${mostrar ? " is-on" : ""}`} aria-hidden={!mostrar}>
      <div>
        <small>14 DIAS · SEM CARTÃO</small>
        <strong>Veja funcionando na sua imobiliária.</strong>
      </div>
      <button
        type="button"
        tabIndex={mostrar ? 0 : -1}
        onClick={() => {
          trackLandingEvent("mobile_sticky_click");
          onTeste?.();
        }}
      >
        Testar <span>→</span>
      </button>
    </div>
  );
}

const CSS = `
/* OMNIMOB_LANDING_GROWTH_V4_CSS_START */
/* OMNIMOB_LANDING_ZEBRA_V41: usa os tokens --bg / --bg-alt da landing. */
.gv4-section,
.gv4-trust {
  --gv4-bg: var(--bg, #0a0a0b);
  --gv4-alt: var(--bg-alt, #0d0d10);
  --gv4-line: rgba(255,255,255,.085);
  --gv4-line-2: rgba(255,255,255,.14);
  --gv4-text: #f2f2f5;
  --gv4-muted: #8d8d98;
  --gv4-soft: #b6b6bf;
  --gv4-indigo: #818cf8;
  --gv4-gold: #d4af37;
  --gv4-mint: #14b8a6;
  color: var(--gv4-text);
}

.gv4-section {
  position: relative;
  overflow: hidden;
  padding: clamp(78px, 9vw, 126px) 0;
  border-top: 1px solid var(--gv4-line);
  background:
    radial-gradient(700px 360px at 71% 48%, rgba(99,102,241,.065), transparent 72%),
    var(--gv4-bg);
  content-visibility: auto;
  contain-intrinsic-size: 980px;
}

.gv4-wrap {
  position: relative;
  z-index: 1;
  width: min(1180px, calc(100% - 48px));
  margin-inline: auto;
}

.gv4-head {
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(280px, .88fr);
  align-items: end;
  gap: clamp(36px, 6vw, 84px);
  margin-bottom: clamp(36px, 5vw, 58px);
}

.gv4-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: #a8a8b1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  font-weight: 650;
  letter-spacing: .18em;
}

.gv4-eyebrow i {
  width: 22px;
  height: 1px;
  background: var(--gv4-gold);
  box-shadow: 0 0 10px rgba(212,175,55,.28);
}

.gv4-head h2,
.gv4-trust__intro h2 {
  margin: 15px 0 0;
  max-width: 14ch;
  color: var(--gv4-text);
  font-size: clamp(38px, 5.1vw, 68px);
  font-weight: 710;
  line-height: .98;
  letter-spacing: -.06em;
}

.gv4-head h2 span,
.gv4-trust__intro h2 span {
  display: block;
  color: #85858f;
  font-weight: 340;
}

.gv4-head__lado {
  padding-bottom: 5px;
}

.gv4-head__lado p,
.gv4-trust__intro p {
  margin: 0;
  color: var(--gv4-muted);
  font-size: 13.5px;
  line-height: 1.76;
}

.gv4-head__nota {
  display: block;
  margin-top: 18px;
  color: #55555f;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 8.5px;
  letter-spacing: .15em;
}

.gv4-shell {
  display: grid;
  grid-template-columns: minmax(245px, .72fr) minmax(0, 1.78fr);
  min-height: 570px;
  border: 1px solid var(--gv4-line);
  border-radius: 24px;
  overflow: hidden;
  background: rgba(255,255,255,.018);
  box-shadow: 0 34px 90px -48px rgba(0,0,0,.86);
}

.gv4-passos {
  display: grid;
  align-content: center;
  border-right: 1px solid var(--gv4-line);
  background:
    linear-gradient(180deg, rgba(255,255,255,.022), transparent 38%),
    rgba(0,0,0,.12);
}

.gv4-passos button.gv4-passo {
  position: relative;
  width: 100%;
  min-height: 132px;
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 20px;
  align-items: center;
  gap: 11px;
  padding: 22px 20px;
  border: 0;
  border-bottom: 1px solid rgba(255,255,255,.06);
  border-radius: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  box-shadow: none;
  cursor: pointer;
  transition: background .24s ease, color .24s ease;
}

.gv4-passos button.gv4-passo:last-child { border-bottom: 0; }

.gv4-passos button.gv4-passo:hover {
  transform: none;
  background: rgba(255,255,255,.025);
}

.gv4-passo::before {
  content: "";
  position: absolute;
  left: 0;
  top: 22%;
  bottom: 22%;
  width: 2px;
  background: transparent;
  transition: background .24s ease, box-shadow .24s ease;
}

.gv4-passo.is-on::before {
  background: var(--gv4-gold);
  box-shadow: 0 0 12px rgba(212,175,55,.38);
}

.gv4-passo__num {
  align-self: start;
  padding-top: 2px;
  color: #50505a;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  transition: color .24s ease;
}

.gv4-passo.is-on .gv4-passo__num { color: var(--gv4-gold); }

.gv4-passo__texto {
  display: grid;
  gap: 6px;
}

.gv4-passo__texto strong {
  color: #b5b5bd;
  font-size: 13.5px;
  font-weight: 630;
  letter-spacing: -.015em;
  transition: color .24s ease;
}

.gv4-passo.is-on .gv4-passo__texto strong { color: var(--gv4-text); }

.gv4-passo__texto small {
  color: #666670;
  font-size: 10.5px;
  line-height: 1.55;
  transition: color .24s ease;
}

.gv4-passo.is-on .gv4-passo__texto small { color: #92929c; }

.gv4-passo__seta {
  color: #43434c;
  font-size: 13px;
  font-style: normal;
  transition: color .24s ease, transform .24s ease;
}

.gv4-passo.is-on .gv4-passo__seta {
  color: var(--gv4-gold);
  transform: translateX(3px);
}

.gv4-passo:focus-visible {
  outline: 2px solid var(--gv4-indigo);
  outline-offset: -3px;
}

.gv4-palco {
  min-width: 0;
  display: grid;
  grid-template-rows: auto 1fr auto;
  background:
    radial-gradient(480px 320px at 58% 44%, rgba(99,102,241,.055), transparent 70%),
    #0a0a0d;
}

.gv4-palco__topo {
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 18px;
  border-bottom: 1px solid var(--gv4-line);
  color: #55555f;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 8px;
  letter-spacing: .11em;
}

.gv4-palco__topo span:first-child {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.gv4-palco__topo i {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--gv4-mint);
  box-shadow: 0 0 9px rgba(20,184,166,.52);
}

.gv4-palco__cena {
  min-height: 405px;
  padding: clamp(20px, 3.2vw, 38px);
  display: grid;
  place-items: center;
  animation: gv4-cena .42s cubic-bezier(.2,.8,.2,1) both;
}

.gv4-cena {
  width: min(100%, 660px);
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.10);
  border-radius: 17px;
  background: rgba(14,14,19,.96);
  box-shadow: 0 28px 64px -36px rgba(0,0,0,.92);
}

.gv4-appbar {
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 13px;
  border-bottom: 1px solid rgba(255,255,255,.065);
  background: rgba(255,255,255,.018);
}

.gv4-appbar__crumb {
  color: #65656e;
  font-size: 7.5px;
  font-weight: 650;
  letter-spacing: .09em;
}

.gv4-appbar__status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #6f918d;
  font-size: 7.5px;
}

.gv4-appbar__status i {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: var(--gv4-mint);
}

.gv4-appbar__status--lead { color: #9b8fc8; }
.gv4-appbar__status--lead i { background: var(--gv4-indigo); }

.gv4-cadastro {
  display: grid;
  grid-template-columns: .9fr 1.1fr;
  gap: 18px;
  padding: 17px;
}

.gv4-fotos {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 108px 64px;
  gap: 7px;
}

.gv4-foto {
  position: relative;
  border: 1px solid rgba(255,255,255,.055);
  border-radius: 8px;
  background:
    linear-gradient(145deg, rgba(129,140,248,.17), rgba(212,175,55,.08)),
    rgba(255,255,255,.025);
}

.gv4-foto--principal {
  grid-column: 1 / -1;
  background:
    linear-gradient(135deg, rgba(129,140,248,.23), rgba(20,184,166,.08)),
    rgba(255,255,255,.025);
}

.gv4-foto i {
  position: absolute;
  left: 8px;
  bottom: 7px;
  padding: 3px 5px;
  border-radius: 4px;
  background: rgba(0,0,0,.38);
  color: #8e8e98;
  font-size: 6px;
  font-style: normal;
  letter-spacing: .08em;
}

.gv4-campos {
  display: grid;
  align-content: start;
  gap: 9px;
}

.gv4-campos label {
  display: grid;
  gap: 5px;
  padding: 9px 10px;
  border: 1px solid rgba(255,255,255,.065);
  border-radius: 8px;
  background: rgba(255,255,255,.02);
}

.gv4-campos small,
.gv4-lead small {
  color: #575760;
  font-size: 6.5px;
  letter-spacing: .1em;
}

.gv4-campos label span {
  color: #c8c8cf;
  font-size: 9px;
}

.gv4-campos label span.is-on { color: #6ec5b9; }

.gv4-campos__dupla {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
}

.gv4-atributos {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.gv4-atributos span {
  padding: 5px 7px;
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 999px;
  color: #777781;
  font-size: 7px;
}

.gv4-cena__rodape {
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 14px;
  border-top: 1px solid rgba(255,255,255,.065);
  background: rgba(0,0,0,.13);
}

.gv4-cena__rodape > span {
  color: #62626c;
  font-size: 7.5px;
}

.gv4-cena__rodape > b {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #c5c5cc;
  font-size: 8px;
  font-weight: 600;
}

.gv4-cena__rodape > b i {
  color: var(--gv4-gold);
  font-style: normal;
}

.gv4-segmento {
  display: inline-flex;
  padding: 2px;
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 6px;
  background: rgba(0,0,0,.15);
}

.gv4-segmento i {
  padding: 4px 7px;
  border-radius: 4px;
  color: #55555f;
  font-size: 6.5px;
  font-style: normal;
}

.gv4-segmento i.is-on {
  background: rgba(255,255,255,.07);
  color: #b9b9c1;
}

.gv4-builder {
  display: grid;
  grid-template-columns: 86px 1fr;
  min-height: 196px;
}

.gv4-builder aside {
  display: grid;
  align-content: start;
  gap: 5px;
  padding: 11px 8px;
  border-right: 1px solid rgba(255,255,255,.06);
  background: rgba(0,0,0,.12);
}

.gv4-builder aside small {
  margin: 0 4px 3px;
  color: #4e4e57;
  font-size: 6px;
  letter-spacing: .12em;
}

.gv4-builder aside span {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 7px;
  border-radius: 6px;
  color: #686872;
  font-size: 7px;
}

.gv4-builder aside span.is-on {
  background: rgba(129,140,248,.10);
  color: #aaa7cf;
}

.gv4-builder aside i {
  width: 7px;
  height: 7px;
  border: 1px solid currentColor;
  border-radius: 2px;
}

.gv4-builder main {
  display: grid;
  place-items: center;
  padding: 12px;
  background:
    radial-gradient(circle at 1px 1px, rgba(255,255,255,.06) 1px, transparent 0) 0 0 / 12px 12px,
    #09090c;
}

.gv4-canvas {
  position: relative;
  width: 78%;
  max-width: 350px;
  padding: 10px;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 7px;
  background: #121218;
  box-shadow: 0 14px 34px -23px rgba(0,0,0,.9);
}

.gv4-canvas__hero {
  display: grid;
  gap: 4px;
  padding: 10px;
  border-radius: 5px;
  background: linear-gradient(135deg, rgba(129,140,248,.17), rgba(212,175,55,.08));
}

.gv4-canvas__hero i {
  width: 24px;
  height: 2px;
  border-radius: 99px;
  background: rgba(212,175,55,.65);
}

.gv4-canvas__hero b {
  margin-top: 2px;
  color: #d2d2d8;
  font-size: 8px;
}

.gv4-canvas__hero small {
  color: #777781;
  font-size: 6px;
}

.gv4-canvas__cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin-top: 7px;
}

.gv4-canvas__cards span {
  display: grid;
  gap: 4px;
  padding-bottom: 7px;
  border: 1px solid rgba(255,255,255,.055);
  border-radius: 5px;
  overflow: hidden;
}

.gv4-canvas__cards i {
  height: 33px;
  background: rgba(255,255,255,.055);
}

.gv4-canvas__cards b,
.gv4-canvas__cards small {
  height: 3px;
  margin-inline: 5px;
  border-radius: 99px;
  background: rgba(255,255,255,.10);
}

.gv4-canvas__cards small { width: 50%; opacity: .6; }

.gv4-canvas__selecao {
  position: absolute;
  left: 7px;
  right: 7px;
  top: 53px;
  bottom: 7px;
  border: 1px solid rgba(129,140,248,.62);
  border-radius: 6px;
  box-shadow: 0 0 0 2px rgba(129,140,248,.07);
}

.gv4-canvas__selecao::before,
.gv4-canvas__selecao::after {
  content: "";
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 1px;
  background: #a5b4fc;
}

.gv4-canvas__selecao::before { left: -2px; top: -2px; }
.gv4-canvas__selecao::after { right: -2px; bottom: -2px; }

.gv4-lead {
  display: grid;
  gap: 12px;
  padding: 16px;
}

.gv4-lead__perfil {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255,255,255,.06);
}

.gv4-avatar {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border: 1px solid rgba(129,140,248,.25);
  border-radius: 10px;
  background: rgba(129,140,248,.11);
  color: #b5b1d5;
  font-size: 9px;
  font-weight: 700;
}

.gv4-lead__perfil > div {
  display: grid;
  gap: 3px;
}

.gv4-lead__perfil strong {
  color: #d4d4da;
  font-size: 10px;
}

.gv4-lead__perfil p {
  margin: 1px 0 0;
  color: #797983;
  font-size: 7.5px;
}

.gv4-lead__vinculo {
  display: grid;
  gap: 6px;
}

.gv4-lead__vinculo article {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border: 1px solid rgba(255,255,255,.065);
  border-radius: 8px;
  background: rgba(255,255,255,.018);
}

.gv4-mini-imovel {
  width: 47px;
  height: 36px;
  flex: 0 0 auto;
  border-radius: 6px;
  background: linear-gradient(135deg, rgba(129,140,248,.20), rgba(212,175,55,.09));
}

.gv4-lead__vinculo article div {
  display: grid;
  gap: 3px;
}

.gv4-lead__vinculo article strong {
  color: #c6c6cd;
  font-size: 8px;
}

.gv4-lead__vinculo article div span {
  color: #62626c;
  font-size: 7px;
}

.gv4-lead__linha {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 7px;
}

.gv4-lead__linha > span {
  display: grid;
  gap: 5px;
  padding: 8px;
  border: 1px solid rgba(255,255,255,.055);
  border-radius: 7px;
}

.gv4-lead__linha b {
  color: #9b9ba5;
  font-size: 7px;
  font-weight: 600;
}

.gv4-palco__baixo {
  min-height: 76px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 12px 17px;
  border-top: 1px solid var(--gv4-line);
  background: rgba(255,255,255,.012);
}

.gv4-palco__baixo > div {
  display: grid;
  gap: 4px;
}

.gv4-palco__baixo small {
  color: #52525c;
  font-size: 6.5px;
  letter-spacing: .11em;
}

.gv4-palco__baixo strong {
  color: #8e8e98;
  font-size: 9px;
  font-weight: 500;
}

button.gv4-palco__cta {
  width: auto;
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 0 7px 0 14px;
  border: 1px solid rgba(255,255,255,.13);
  border-radius: 999px;
  background: rgba(255,255,255,.035);
  color: #cfcfd5;
  font-family: inherit;
  font-size: 9.5px;
  font-weight: 620;
  box-shadow: none;
  cursor: pointer;
  transition: background .2s ease, border-color .2s ease;
}

button.gv4-palco__cta span {
  width: 25px;
  height: 25px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: rgba(255,255,255,.08);
  color: var(--gv4-gold);
}

button.gv4-palco__cta:hover {
  transform: none;
  background: rgba(255,255,255,.065);
  border-color: rgba(212,175,55,.30);
}

button.gv4-palco__cta:focus-visible {
  outline: 2px solid var(--gv4-indigo);
  outline-offset: 3px;
}

@keyframes gv4-cena {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
}

/* ── Confiança operacional ─────────────────────────────────────────────── */
.gv4-trust {
  padding: clamp(62px, 7vw, 88px) 0;
  border-top: 1px solid var(--gv4-line);
  background: var(--gv4-alt);
  content-visibility: auto;
  contain-intrinsic-size: 600px;
}

.gv4-trust__wrap {
  display: grid;
  grid-template-columns: minmax(260px, .82fr) minmax(0, 1.58fr);
  gap: clamp(38px, 6vw, 82px);
  align-items: start;
}

.gv4-trust__intro h2 {
  max-width: 11ch;
  font-size: clamp(34px, 4.2vw, 54px);
}

.gv4-trust__intro p {
  max-width: 42ch;
  margin-top: 18px;
}

.gv4-trust__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-top: 1px solid var(--gv4-line);
  border-left: 1px solid var(--gv4-line);
}

.gv4-trust__grid article {
  min-height: 184px;
  display: grid;
  align-content: start;
  gap: 10px;
  padding: 22px;
  border-right: 1px solid var(--gv4-line);
  border-bottom: 1px solid var(--gv4-line);
  transition: background .22s ease;
}

.gv4-trust__grid article:hover {
  background: rgba(255,255,255,.018);
}

.gv4-trust__grid article > span {
  color: #4d4d56;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 8px;
}

.gv4-trust__grid article strong {
  max-width: 21ch;
  color: #d4d4da;
  font-size: 13px;
  line-height: 1.35;
}

.gv4-trust__grid article p {
  max-width: 32ch;
  margin: 0;
  color: #74747e;
  font-size: 10.5px;
  line-height: 1.65;
}

/* ── CTA persistente mobile ────────────────────────────────────────────── */
.gv4-sticky {
  position: fixed;
  z-index: 900;
  left: 10px;
  right: 10px;
  bottom: calc(10px + env(safe-area-inset-bottom));
  display: none;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 62px;
  padding: 9px 9px 9px 15px;
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 18px;
  background: rgba(12,12,15,.89);
  box-shadow: 0 22px 52px -24px rgba(0,0,0,.86);
  backdrop-filter: blur(18px) saturate(1.12);
  -webkit-backdrop-filter: blur(18px) saturate(1.12);
  opacity: 0;
  transform: translateY(18px);
  pointer-events: none;
  transition: opacity .24s ease, transform .3s cubic-bezier(.2,.8,.2,1);
}

.gv4-sticky > div {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.gv4-sticky small {
  color: #696973;
  font-size: 6.5px;
  letter-spacing: .11em;
}

.gv4-sticky strong {
  overflow: hidden;
  color: #d7d7dc;
  font-size: 10.5px;
  font-weight: 580;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.gv4-sticky button {
  width: auto;
  min-width: 92px;
  min-height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 0 8px 0 14px;
  border: 1px solid rgba(255,255,255,.78);
  border-radius: 999px;
  background: #f2f2f4;
  color: #0b0b0d;
  font-family: inherit;
  font-size: 10.5px;
  font-weight: 720;
  box-shadow: none;
}

.gv4-sticky button span {
  width: 25px;
  height: 25px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: #111115;
  color: #fff;
}

.gv4-sticky button:hover {
  transform: none;
  background: #fff;
}

/* Em telas largas o sticky nem entra na árvore visual. */
@media (min-width: 761px) {
  .gv4-sticky { display: none !important; }
}

@media (max-width: 900px) {
  .gv4-head,
  .gv4-trust__wrap {
    grid-template-columns: 1fr;
  }

  .gv4-head__lado { max-width: 600px; }
  .gv4-trust__intro p { max-width: 58ch; }
}

@media (max-width: 760px) {
  .gv4-section {
    padding: 70px 0 74px;
    contain-intrinsic-size: 1180px;
  }

  .gv4-wrap {
    width: min(100% - 32px, 1180px);
  }

  .gv4-head {
    gap: 18px;
    margin-bottom: 30px;
  }

  .gv4-head h2 {
    max-width: 12ch;
    font-size: clamp(37px, 11vw, 50px);
  }

  .gv4-head__lado p { font-size: 12.5px; }
  .gv4-head__nota { margin-top: 13px; }

  .gv4-shell {
    grid-template-columns: 1fr;
    min-height: 0;
    border-radius: 20px;
    overflow: visible;
    background: transparent;
    border: 0;
    box-shadow: none;
  }

  .gv4-passos {
    grid-template-columns: repeat(3, 1fr);
    border: 1px solid var(--gv4-line);
    border-radius: 15px;
    overflow: hidden;
    background: rgba(255,255,255,.018);
  }

  .gv4-passos button.gv4-passo {
    min-height: 76px;
    grid-template-columns: 1fr;
    gap: 4px;
    padding: 13px 10px;
    border-bottom: 0;
    border-right: 1px solid rgba(255,255,255,.06);
    text-align: center;
  }

  .gv4-passos button.gv4-passo:last-child { border-right: 0; }

  .gv4-passo::before {
    top: auto;
    bottom: 0;
    left: 18%;
    right: 18%;
    width: auto;
    height: 2px;
  }

  .gv4-passo__num { justify-self: center; padding: 0; }
  .gv4-passo__texto { gap: 0; }
  .gv4-passo__texto strong { font-size: 10px; }
  .gv4-passo__texto small,
  .gv4-passo__seta { display: none; }

  .gv4-palco {
    margin-top: 10px;
    border: 1px solid var(--gv4-line);
    border-radius: 18px;
    overflow: hidden;
  }

  .gv4-palco__cena {
    min-height: 350px;
    padding: 18px 12px;
  }

  .gv4-cena { border-radius: 13px; }

  .gv4-cadastro {
    grid-template-columns: 1fr;
    gap: 10px;
    padding: 11px;
  }

  .gv4-fotos {
    grid-template-columns: 1.5fr .75fr .75fr;
    grid-template-rows: 82px;
  }

  .gv4-foto--principal { grid-column: auto; }
  .gv4-campos label { padding: 8px 9px; }
  .gv4-atributos { display: none; }

  .gv4-builder {
    grid-template-columns: 66px 1fr;
    min-height: 190px;
  }

  .gv4-builder aside span {
    padding-inline: 4px;
    font-size: 6px;
  }

  .gv4-canvas { width: 92%; }

  .gv4-lead__linha {
    grid-template-columns: 1fr 1fr;
  }

  .gv4-lead__linha > span:last-child { display: none; }

  .gv4-cena__rodape > span { display: none; }

  .gv4-palco__baixo {
    align-items: stretch;
    flex-direction: column;
    gap: 11px;
    padding: 13px;
  }

  button.gv4-palco__cta {
    width: 100%;
    min-height: 44px;
    justify-content: space-between;
    padding-left: 16px;
  }

  .gv4-trust {
    padding: 64px 0 74px;
    contain-intrinsic-size: 870px;
  }

  .gv4-trust__wrap { gap: 30px; }
  .gv4-trust__intro h2 { font-size: 38px; }
  .gv4-trust__grid { grid-template-columns: 1fr; }

  .gv4-trust__grid article {
    min-height: 0;
    padding: 19px 18px;
  }

  .gv4-trust__grid article strong { max-width: none; }
  .gv4-trust__grid article p { max-width: 48ch; }

  .gv4-sticky { display: flex; }
  .gv4-sticky.is-on {
    opacity: 1;
    transform: none;
    pointer-events: auto;
  }

  /* Dá ao footer/CTA espaço para o safe-area sem a barra cobrir o último conteúdo. */
  body:has(.gv4-sticky.is-on) .dl-root {
    padding-bottom: calc(76px + env(safe-area-inset-bottom));
  }
}

@media (max-width: 390px) {
  .gv4-sticky {
    left: 7px;
    right: 7px;
    bottom: calc(7px + env(safe-area-inset-bottom));
    min-height: 58px;
    padding-left: 12px;
  }

  .gv4-sticky strong { max-width: 165px; }
  .gv4-sticky button { min-width: 84px; }
}

@media (prefers-reduced-motion: reduce) {
  .gv4-palco__cena,
  .gv4-sticky,
  .gv4-passo,
  .gv4-passo::before,
  .gv4-passo__seta {
    animation: none !important;
    transition: none !important;
  }
}
/* OMNIMOB_LANDING_GROWTH_V4_CSS_END */
`;
/* Exportada AQUI, depois da declaracao: uma const de modulo so existe a
   partir da linha dela, e o `export const GV4_CSS = CSS` que morava junto de
   CenaDoFluxo (200 linhas acima) quebrava no dev do Vite com "Cannot access
   CSS before initialization" — o build passava porque o Rollup reordena. */
export const GV4_CSS = CSS;

export default ProductStorySection;
