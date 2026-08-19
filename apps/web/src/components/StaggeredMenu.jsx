import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { gsap } from "gsap";
import { useEfeitos } from "./Efeitos.jsx";
import "./StaggeredMenu.css";

/* ────────────────────────────────────────────────────────────────────────────
   StaggeredMenu — porte do React Bits.

   O efeito é o do original: camadas de cor entram escalonadas pela lateral, o
   painel vem por cima, os itens sobem um a um girando, e o botão troca
   "Menu"/"Fechar" rolando enquanto o ícone gira 225°.

   ── O QUE MUDOU EM RELAÇÃO AO ORIGINAL, E POR QUÊ ──

   1. ELE ASSUME O CABEÇALHO INTEIRO. O componente do React Bits traz um header
      próprio, com logotipo e botão. O cabeçalho desta landing já fazia três
      coisas que não podiam se perder — encolher na rolagem, ganhar vidro
      quando sai do topo e esconder logo e CTA quando o menu abre. Em vez de
      manter dois cabeçalhos brigando por `position: fixed`, este componente
      passou a ser o cabeçalho, herdando as classes `.dl-header*` que já
      existiam. O visual da barra continua idêntico; o que trocou foi o menu.

   2. NAVEGAÇÃO DE VERDADE. O original usa `<a href>` puro. Metade dos itens
      daqui aponta para rotas do React Router (`/vitrines`, `/sobre`), e âncora
      pura recarregaria a aplicação inteira — perdendo o pacote já baixado e
      voltando à tela de carregamento. Item que começa com "/" navega pelo
      roteador; item que começa com "#" rola até a seção.

   3. gsap VEM ESTÁTICO, e isso foi medido. A primeira versão o carregava por
      `import()` para economizar ~70 kB de quem só lê a página — até o build
      avisar que não adiantava: o `BounceCards`, na mesma landing, já o importa
      no topo, então ele está no pacote de qualquer jeito. Adiar o que já
      chegou é complexidade sem troco.

   4. RESPEITA O ORÇAMENTO DE EFEITOS. Em máquina fraca (`podeQuadroAQuadro`
      falso) o menu abre e fecha na hora, sem linha do tempo. Continua sendo o
      mesmo menu, com os mesmos itens — o que some é a coreografia. Mesma regra
      que já vale para a névoa e para a parede à deriva.

   5. TECLADO E ROLAGEM. O original não fecha no Esc nem trava a rolagem de
      trás. O menu que estava aqui fazia as duas coisas, e perdê-las seria
      regressão de acessibilidade: com o painel aberto, rolar move a página
      atrás dele e o foco escapa para links invisíveis.

   6. PALETA DA CASA. O painel do original é branco com texto preto — uma
      inversão forte que aqui brigaria com a identidade. As camadas usam o
      índigo e o dourado da marca, e o painel é o quase-preto do resto do site.
   ──────────────────────────────────────────────────────────────────────────── */

export function StaggeredMenu({
  itens = [],
  sociais = [],
  mostrarSociais = true,
  numerar = true,
  cores = ["#6366f1", "#d4af37"],
  corDeDestaque = "#d4af37",
  logo,
  acoes,
  aoAbrir,
  aoFechar,
  fecharClicandoFora = true,
}) {
  const navegar = useNavigate();
  const { podeQuadroAQuadro } = useEfeitos();

  const [aberto, setAberto] = useState(false);
  const [rolou, setRolou] = useState(false);
  const [linhasDoBotao, setLinhasDoBotao] = useState(["Menu", "Fechar"]);

  const abertoRef = useRef(false);
  const painelRef = useRef(null);
  const camadasRef = useRef(null);
  const camadasEls = useRef([]);
  const barraHRef = useRef(null);
  const barraVRef = useRef(null);
  const iconeRef = useRef(null);
  const textoRef = useRef(null);
  const botaoRef = useRef(null);

  const linhaDoTempoRef = useRef(null);
  const fechamentoRef = useRef(null);
  const giroRef = useRef(null);
  const textoAnimRef = useRef(null);
  const ocupadoRef = useRef(false);

  /* A barra ganha vidro ao sair do topo — comportamento que veio do cabeçalho
     anterior e não tem relação com o menu. `passive` porque o ouvinte não
     cancela nada e sem a marca o navegador precisa esperar para descobrir. */
  useEffect(() => {
    const aoRolar = () => setRolou(window.scrollY > 50);
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  // Estado de partida: tudo fora da tela, à direita.
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const painel = painelRef.current;
      if (!painel) return;
      const camadas = camadasRef.current
        ? Array.from(camadasRef.current.querySelectorAll(".sm-camada"))
        : [];
      camadasEls.current = camadas;

      gsap.set([painel, ...camadas], { xPercent: 100, opacity: 1 });
      if (camadasRef.current) gsap.set(camadasRef.current, { xPercent: 0, opacity: 1 });
      if (barraHRef.current) gsap.set(barraHRef.current, { transformOrigin: "50% 50%", rotate: 0 });
      if (barraVRef.current) gsap.set(barraVRef.current, { transformOrigin: "50% 50%", rotate: 90 });
      if (iconeRef.current) gsap.set(iconeRef.current, { rotate: 0, transformOrigin: "50% 50%" });
      if (textoRef.current) gsap.set(textoRef.current, { yPercent: 0 });
    });
    return () => ctx.revert();
  }, []);

  const montarAbertura = useCallback((g) => {
    const painel = painelRef.current;
    const camadas = camadasEls.current;
    if (!painel) return null;

    linhaDoTempoRef.current?.kill();
    fechamentoRef.current?.kill();
    fechamentoRef.current = null;

    const rotulos = Array.from(painel.querySelectorAll(".sm-item-rotulo"));
    const itensNumerados = Array.from(painel.querySelectorAll(".sm-lista[data-numerar] .sm-item"));
    const tituloSocial = painel.querySelector(".sm-sociais-titulo");
    const linksSociais = Array.from(painel.querySelectorAll(".sm-sociais-link"));

    if (rotulos.length) g.set(rotulos, { yPercent: 140, rotate: 10 });
    if (itensNumerados.length) g.set(itensNumerados, { "--sm-num-opacidade": 0 });
    if (tituloSocial) g.set(tituloSocial, { opacity: 0 });
    if (linksSociais.length) g.set(linksSociais, { y: 25, opacity: 0 });

    const tl = g.timeline({ paused: true });

    camadas.forEach((el, i) => {
      tl.fromTo(el, { xPercent: 100 }, { xPercent: 0, duration: 0.5, ease: "power4.out" }, i * 0.07);
    });

    const ultima = camadas.length ? (camadas.length - 1) * 0.07 : 0;
    const entradaDoPainel = ultima + (camadas.length ? 0.08 : 0);
    const duracaoDoPainel = 0.65;
    tl.fromTo(painel, { xPercent: 100 }, { xPercent: 0, duration: duracaoDoPainel, ease: "power4.out" }, entradaDoPainel);

    if (rotulos.length) {
      const inicioDosItens = entradaDoPainel + duracaoDoPainel * 0.15;
      tl.to(rotulos, {
        yPercent: 0, rotate: 0, duration: 1, ease: "power4.out",
        stagger: { each: 0.1, from: "start" },
      }, inicioDosItens);

      if (itensNumerados.length) {
        tl.to(itensNumerados, {
          duration: 0.6, ease: "power2.out", "--sm-num-opacidade": 1,
          stagger: { each: 0.08, from: "start" },
        }, inicioDosItens + 0.1);
      }
    }

    if (tituloSocial || linksSociais.length) {
      const inicioSocial = entradaDoPainel + duracaoDoPainel * 0.4;
      if (tituloSocial) tl.to(tituloSocial, { opacity: 1, duration: 0.5, ease: "power2.out" }, inicioSocial);
      if (linksSociais.length) {
        tl.to(linksSociais, {
          y: 0, opacity: 1, duration: 0.55, ease: "power3.out",
          stagger: { each: 0.08, from: "start" },
          /* Limpa a opacidade no fim: o CSS usa `:hover` do grupo para apagar
             os irmãos, e um valor inline vindo do gsap venceria a regra. */
          onComplete: () => g.set(linksSociais, { clearProps: "opacity" }),
        }, inicioSocial + 0.04);
      }
    }

    linhaDoTempoRef.current = tl;
    return tl;
  }, []);

  /* Coloca tudo no lugar sem animar. É o caminho do nível de efeitos reduzido e
     também a rede de segurança de quando o gsap não baixa. */
  const abrirSeco = useCallback(() => {
    const painel = painelRef.current;
    if (!painel) return;
    gsap.set([painel, ...camadasEls.current], { xPercent: 0 });
    gsap.set(painel.querySelectorAll(".sm-item-rotulo"), { yPercent: 0, rotate: 0 });
    gsap.set(painel.querySelectorAll(".sm-lista[data-numerar] .sm-item"), { "--sm-num-opacidade": 1 });
    const t = painel.querySelector(".sm-sociais-titulo");
    if (t) gsap.set(t, { opacity: 1 });
    gsap.set(painel.querySelectorAll(".sm-sociais-link"), { y: 0, opacity: 1 });
    ocupadoRef.current = false;
  }, []);

  const tocarAbertura = useCallback(() => {
    if (ocupadoRef.current) return;
    ocupadoRef.current = true;

    if (!podeQuadroAQuadro) { abrirSeco(); return; }

    const tl = montarAbertura(gsap);
    if (!tl) { ocupadoRef.current = false; return; }
    tl.eventCallback("onComplete", () => { ocupadoRef.current = false; });
    tl.play(0);
  }, [montarAbertura, podeQuadroAQuadro, abrirSeco]);

  const tocarFechamento = useCallback(() => {
    linhaDoTempoRef.current?.kill();
    linhaDoTempoRef.current = null;

    const painel = painelRef.current;
    if (!painel) return;

    const reposicionar = () => {
      gsap.set(painel.querySelectorAll(".sm-item-rotulo"), { yPercent: 140, rotate: 10 });
      gsap.set(painel.querySelectorAll(".sm-lista[data-numerar] .sm-item"), { "--sm-num-opacidade": 0 });
      const t = painel.querySelector(".sm-sociais-titulo");
      if (t) gsap.set(t, { opacity: 0 });
      gsap.set(painel.querySelectorAll(".sm-sociais-link"), { y: 25, opacity: 0 });
      ocupadoRef.current = false;
    };

    const tudo = [...camadasEls.current, painel];
    fechamentoRef.current?.kill();

    if (!podeQuadroAQuadro) {
      gsap.set(tudo, { xPercent: 100 });
      reposicionar();
      return;
    }

    fechamentoRef.current = gsap.to(tudo, {
      xPercent: 100, duration: 0.32, ease: "power3.in", overwrite: "auto",
      onComplete: reposicionar,
    });
  }, [podeQuadroAQuadro]);

  const animarIcone = useCallback((abrindo) => {
    const icone = iconeRef.current;
    if (!icone || !podeQuadroAQuadro) {
      if (icone) gsap.set(icone, { rotate: abrindo ? 225 : 0 });
      return;
    }
    giroRef.current?.kill();
    giroRef.current = abrindo
      ? gsap.to(icone, { rotate: 225, duration: 0.8, ease: "power4.out", overwrite: "auto" })
      : gsap.to(icone, { rotate: 0, duration: 0.35, ease: "power3.inOut", overwrite: "auto" });
  }, [podeQuadroAQuadro]);

  /* O rótulo rola por várias repetições antes de parar na palavra certa — é o
     que dá a sensação de contador mecânico. Sem animação, troca direto. */
  const animarTexto = useCallback((abrindo) => {
    const dentro = textoRef.current;
    if (!dentro) return;
    textoAnimRef.current?.kill();

    const destino = abrindo ? "Fechar" : "Menu";
    if (!podeQuadroAQuadro) {
      setLinhasDoBotao([destino]);
      gsap.set(dentro, { yPercent: 0 });
      return;
    }

    const atual = abrindo ? "Menu" : "Fechar";
    const sequencia = [atual];
    let ultimo = atual;
    for (let i = 0; i < 3; i++) {
      ultimo = ultimo === "Menu" ? "Fechar" : "Menu";
      sequencia.push(ultimo);
    }
    if (ultimo !== destino) sequencia.push(destino);
    sequencia.push(destino);
    setLinhasDoBotao(sequencia);

    gsap.set(dentro, { yPercent: 0 });
    const deslocamento = ((sequencia.length - 1) / sequencia.length) * 100;
    textoAnimRef.current = gsap.to(dentro, {
      yPercent: -deslocamento,
      duration: 0.5 + sequencia.length * 0.07,
      ease: "power4.out",
    });
  }, [podeQuadroAQuadro]);

  const definir = useCallback((alvo) => {
    if (abertoRef.current === alvo) return;
    abertoRef.current = alvo;
    setAberto(alvo);
    if (alvo) { aoAbrir?.(); tocarAbertura(); } else { aoFechar?.(); tocarFechamento(); }
    animarIcone(alvo);
    animarTexto(alvo);
  }, [tocarAbertura, tocarFechamento, animarIcone, animarTexto, aoAbrir, aoFechar]);

  const fechar = useCallback(() => definir(false), [definir]);

  // Esc fecha e a página de trás para de rolar enquanto o painel está aberto.
  useEffect(() => {
    if (!aberto) return undefined;
    const aoTeclar = (e) => { if (e.key === "Escape") fechar(); };
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", aoTeclar);
    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto, fechar]);

  useEffect(() => {
    if (!fecharClicandoFora || !aberto) return undefined;
    const aoClicar = (e) => {
      if (painelRef.current?.contains(e.target)) return;
      if (botaoRef.current?.contains(e.target)) return;
      fechar();
    };
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, [fecharClicandoFora, aberto, fechar]);

  /* Um clique num item resolve o destino aqui, e não no href: rota interna vai
     pelo roteador (sem recarregar a aplicação), âncora rola até a seção. O
     `href` continua correto no HTML para o botão do meio do mouse, "abrir em
     nova aba" e os robôs de busca. */
  function irPara(e, destino) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    fechar();
    if (destino.startsWith("#")) {
      const alvo = document.querySelector(destino);
      // O painel ainda está saindo; rolar junto embaralha as duas coisas.
      setTimeout(() => alvo?.scrollIntoView({ behavior: podeQuadroAQuadro ? "smooth" : "auto" }), 260);
      return;
    }
    navegar(destino);
  }

  /* Duas camadas no máximo. O original descarta a do meio quando recebe três ou
     mais — com muitas, o escalonamento vira uma cortina lenta. */
  const camadas = (cores.length ? cores : ["#1e1e22", "#35353c"]).slice(0, 2);

  return (
    <div
      className="sm-raiz"
      data-aberto={aberto || undefined}
      /* Sem desfoque no nível mínimo: `backdrop-filter` de tela cheia obriga o
         compositor a redesenhar e borrar o fundo inteiro, e é exatamente o tipo
         de custo que trava a máquina que já estava sofrendo. Lá o véu só
         escurece — o destaque continua acontecendo, sem o preço. */
      data-simples={!podeQuadroAQuadro || undefined}
      style={{ "--sm-destaque": corDeDestaque }}
    >
      {/* Véu: escurece e desfoca a página enquanto o menu está aberto.
          Ele também CAPTURA O CLIQUE de fora — sem isso, clicar ao lado do
          painel acertaria o que estivesse embaixo, e a página podia navegar
          para outro lugar em vez de só fechar o menu. */}
      <div className="sm-veu" aria-hidden="true" onClick={fechar} />

      <div ref={camadasRef} className="sm-camadas" aria-hidden="true">
        {camadas.map((c, i) => (
          <div key={i} className="sm-camada" style={{ background: c }} />
        ))}
      </div>

      <header className={`dl-header sm-barra${rolou ? " is-scrolled" : ""}${aberto ? " is-menu-open" : ""}`}>
        {logo}
        <div className="dl-header__right">
          {acoes}
          <button
            ref={botaoRef}
            type="button"
            className="sm-botao"
            aria-label={aberto ? "Fechar menu" : "Abrir menu"}
            aria-expanded={aberto}
            aria-controls="sm-painel"
            onClick={() => definir(!abertoRef.current)}
          >
            <span className="sm-botao-caixa" aria-hidden="true">
              <span ref={textoRef} className="sm-botao-rolo">
                {linhasDoBotao.map((l, i) => (
                  <span className="sm-botao-linha" key={`${l}-${i}`}>{l}</span>
                ))}
              </span>
            </span>
            <span ref={iconeRef} className="sm-icone" aria-hidden="true">
              <span ref={barraHRef} className="sm-icone-barra" />
              <span ref={barraVRef} className="sm-icone-barra sm-icone-barra--v" />
            </span>
          </button>
        </div>
      </header>

      <aside id="sm-painel" ref={painelRef} className="sm-painel" aria-hidden={!aberto}>
        <div className="sm-painel-inner">
          <ul className="sm-lista" role="list" data-numerar={numerar || undefined}>
            {itens.map((it, i) => (
              <li className="sm-item-caixa" key={`${it.rotulo}-${i}`}>
                <a
                  className="sm-item"
                  href={it.destino}
                  aria-label={it.descricao || it.rotulo}
                  tabIndex={aberto ? 0 : -1}
                  onClick={(e) => irPara(e, it.destino)}
                >
                  <span className="sm-item-rotulo">{it.rotulo}</span>
                </a>
              </li>
            ))}
          </ul>

          {mostrarSociais && sociais.length > 0 ? (
            <div className="sm-sociais" aria-label="Links da Omnimob">
              <h3 className="sm-sociais-titulo">A Omnimob</h3>
              <ul className="sm-sociais-lista" role="list">
                {sociais.map((s, i) => {
                  const externo = /^https?:|^mailto:/.test(s.destino);
                  return (
                    <li key={`${s.rotulo}-${i}`}>
                      <a
                        className="sm-sociais-link"
                        href={s.destino}
                        tabIndex={aberto ? 0 : -1}
                        {...(externo
                          ? { target: "_blank", rel: "noreferrer" }
                          : { onClick: (e) => irPara(e, s.destino) })}
                      >
                        {s.rotulo}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

export default StaggeredMenu;
