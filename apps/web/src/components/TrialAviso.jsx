import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { PLANOS } from "../utils/planos";
import { carregarStripe, stripeConfigurado, APARENCIA_STRIPE } from "../utils/stripe";
import { IconeCheck } from "./Icones.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   Aviso de teste no painel + fluxo de assinatura.

   O botão mostra os dias que faltam e, no hover, troca para "Assine já". Clicar
   abre três passos: o que se perde → escolher plano → pagamento.

   O inventário de perdas vem do servidor e conta SÓ o que o cliente criou.
   Hoje isso é o inventário inteiro — o ambiente de teste nasce vazio, sem
   imóveis de demonstração —, mas o filtro fica: inflar esse número com dado
   que não é dele seria mentir para pressionar, e a primeira pessoa que
   conferir descobre.
   ──────────────────────────────────────────────────────────────────────────── */

/* Rótulos de reserva: valem só quando o provedor não está conectado. Com o
   Stripe ligado, o preço vem dele (situacao.precos) — assim a tela nunca diz um
   valor diferente do que será cobrado. */
const PRECOS_RESERVA = { BASICO: "R$ 99/mês", PROFISSIONAL: "R$ 199/mês", PREMIUM: "sob consulta" };

function plural(n, singular, pluralForma) {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}

export function TrialAviso({ tenantSlug, podeAssinar, aoAssinar }) {
  const [situacao, setSituacao] = useState(null);
  const [aberto, setAberto] = useState(false);
  const [passo, setPasso] = useState(1);
  const [plano, setPlano] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState("");
  const [concluido, setConcluido] = useState(null);
  const [agora, setAgora] = useState(() => Date.now());
  // Memoizado porque entra na lista de dependências do efeito do Stripe: um
  // objeto novo a cada render remontaria o campo de cartão sem parar.
  const precosVivos = useMemo(() => situacao?.precos || {}, [situacao]);

  const caixaRef = useRef(null);
  const cartaoRef = useRef(null);   // div onde o iframe do Stripe é montado
  const elementsRef = useRef(null);
  const stripeRef = useRef(null);
  const [cartaoPronto, setCartaoPronto] = useState(false);

  useEffect(() => {
    if (!tenantSlug) return;
    api.getTrialStatus(tenantSlug).then(setSituacao).catch(() => setSituacao(null));
  }, [tenantSlug]);

  // Relógio de minuto em minuto: o rótulo fala em dias, então não precisa de
  // segundo — e um timer de 1s rerenderizaria o painel inteiro sem motivo.
  useEffect(() => {
    if (!situacao?.emTrial) return undefined;
    const id = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [situacao?.emTrial]);

  useEffect(() => {
    if (!aberto) return undefined;
    function aoTeclar(e) {
      if (e.key === "Escape" && !enviando) fechar();
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto, enviando]);

  /* `semPrazo` cobre o tenant em teste sem data marcada — é o caso dos criados
     por seed ou à mão pelo painel. Aí não há contagem para mostrar, mas o
     convite para assinar continua valendo. */
  const restante = useMemo(() => {
    if (!situacao?.expiraEm) return { semPrazo: true, dias: 0, horas: 0, expirado: false };
    const ms = new Date(situacao.expiraEm).getTime() - agora;
    if (ms <= 0) return { semPrazo: false, dias: 0, horas: 0, expirado: true };
    return {
      semPrazo: false,
      dias: Math.floor(ms / 86400000),
      horas: Math.floor((ms % 86400000) / 3600000),
      expirado: false,
    };
  }, [situacao?.expiraEm, agora]);

  /* O campo de cartão é um iframe servido pelo Stripe: o número digitado nunca
     entra nesta página nem chega à nossa API — só volta um id de método de
     pagamento. É o que mantém a Domus fora do escopo pesado do PCI. */
  useEffect(() => {
    if (passo !== 3 || !stripeConfigurado()) return undefined;

    /* `mode` e `amount` são obrigatórios ao criar o grupo de Elements neste
       fluxo — o cartão é coletado aqui e a assinatura é criada no servidor
       depois (pagamento diferido), então o Stripe precisa saber de antemão o
       que será cobrado para escolher os meios de pagamento e os campos certos.
       Sem eles o Payment Element se recusa a montar. */
    const valor = precosVivos[plano]?.valor;
    if (valor == null) {
      setFalha("Não consegui ler o valor do plano. Volte e escolha de novo.");
      return undefined;
    }

    let vivo = true;
    let elemento = null;
    setCartaoPronto(false);

    carregarStripe()
      .then((stripe) => {
        if (!vivo || !stripe || !cartaoRef.current) return;
        stripeRef.current = stripe;
        const elements = stripe.elements({
          mode: "subscription",
          currency: "brl",
          amount: Math.round(valor * 100), // em centavos
          /* Sem isto o Stripe recusa `createPaymentMethod`: por padrão ele
             espera confirmar o pagamento aqui mesmo, com um clientSecret vindo
             do servidor. No nosso fluxo é o contrário — pegamos só o método de
             pagamento e é o servidor que cria a assinatura depois. */
          paymentMethodCreation: "manual",
          appearance: APARENCIA_STRIPE,
        });
        elemento = elements.create("payment", { layout: "tabs" });
        elemento.mount(cartaoRef.current);
        elemento.on("ready", () => vivo && setCartaoPronto(true));
        elementsRef.current = elements;
      })
      .catch((erro) => vivo && setFalha(erro.message));

    /* Desmontar de verdade importa: trocar de plano muda o valor, e um grupo
       de Elements criado com o valor antigo continuaria valendo o antigo. */
    return () => {
      vivo = false;
      if (elemento) elemento.destroy();
      elementsRef.current = null;
    };
  }, [passo, plano, precosVivos]);

  if (!situacao?.emTrial) return null;

  /* Com o Stripe ligado, só oferecemos plano que tem preço lá — oferecer um
     plano sem preço daria 503 na hora de cobrar, depois de a pessoa já ter
     digitado o cartão. Sem provedor, mostramos todos e o caminho é o time. */
  const temProvedor = Object.keys(precosVivos).length > 0;
  const planosOfertaveis = temProvedor ? PLANOS.filter((p) => precosVivos[p.key]) : PLANOS;
  const precoDe = (chave) => precosVivos[chave]?.rotulo || PRECOS_RESERVA[chave];
  const nomeDoPlano = (chave) => PLANOS.find((p) => p.key === chave)?.nome || chave;
  /* O plano em que o teste está rodando. Deixou de ser sempre o Premium — vem
     da escolha feita na landing —, então tanto o texto quanto a etiqueta "SEU
     TESTE" no cartão precisam perguntar em vez de assumir. */
  const planoDoTeste = PLANOS.find((p) => p.key === situacao.plano) || null;

  /* O que o plano assinado entrega além do núcleo. Sai de utils/planos.js, a
     mesma fonte que libera os recursos no produto — se um dia mudar lá, esta
     lista muda junto. */
  const planoAssinado = PLANOS.find((p) => p.key === concluido?.plano);
  const liberados = [
    "Imóveis, vitrine, leads, clientes e equipe sem limite de uso",
    planoAssinado?.redes && "Publicação em Facebook, Instagram e WhatsApp",
    planoAssinado?.tour360 && "Tour virtual 360° nos imóveis",
    planoAssinado?.ia && "Descrição, título e legendas gerados por IA",
  ].filter(Boolean);

  const inv = situacao.inventario || {};
  const perdas = [
    inv.imoveis ? plural(inv.imoveis, "imóvel cadastrado", "imóveis cadastrados") : null,
    inv.fotos ? plural(inv.fotos, "foto enviada", "fotos enviadas") : null,
    inv.clientes ? plural(inv.clientes, "cliente", "clientes") : null,
    inv.leads ? plural(inv.leads, "lead recebido", "leads recebidos") : null,
    inv.usuarios ? plural(inv.usuarios, "usuário da equipe", "usuários da equipe") : null,
    inv.vitrinePersonalizada ? "a vitrine que você montou" : null,
  ].filter(Boolean);

  const rotulo = restante.semPrazo
    ? "Você está em teste"
    : restante.expirado
      ? "Teste expirado"
      : restante.dias > 0
        ? plural(restante.dias, "dia restante", "dias restantes")
        : plural(restante.horas, "hora restante", "horas restantes");

  function fechar() {
    // Depois de assinar, fechar recarrega: o botão de teste tem que sumir e o
    // painel passa a valer o plano novo.
    if (concluido) {
      aoAssinar?.();
      return;
    }
    setAberto(false);
    setPasso(1);
    setFalha("");
  }

  async function assinar() {
    setEnviando(true);
    setFalha("");
    try {
      let tokenPagamento = null;

      if (stripeConfigurado()) {
        if (!elementsRef.current) throw new Error("O formulário de cartão ainda não carregou.");
        await elementsRef.current.submit();
        const { error, paymentMethod } = await stripeRef.current.createPaymentMethod({
          elements: elementsRef.current,
        });
        if (error) throw new Error(error.message || "Não foi possível validar o cartão.");
        tokenPagamento = paymentMethod.id;
      }

      const resposta = await api.assinarPlano(tenantSlug, { plano, tokenPagamento });
      // Não recarrega aqui: a comemoração vem antes, e o recarregamento sai só
      // quando a pessoa fecha — senão a tela some antes de ela ler.
      setConcluido(resposta?.tenant || {});
      setPasso(4);
    } catch (erro) {
      setFalha(erro.message || "Não foi possível concluir a assinatura.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <style>{CSS}</style>

      <button
        type="button"
        className={`tv-botao${restante.expirado ? " is-expirado" : ""}`}
        onClick={() => setAberto(true)}
        title="Assinar a Domus"
      >
        <span className="tv-ponto" aria-hidden="true" />
        <span className="tv-rotulo">
          <span className="tv-rotulo__dias">{rotulo}</span>
          <span className="tv-rotulo__cta">Assine já</span>
        </span>
      </button>

      {aberto ? (
        <div className="tv-veu" onMouseDown={(e) => e.target === e.currentTarget && !enviando && fechar()}>
          <div className="tv-caixa" ref={caixaRef} role="dialog" aria-modal="true" aria-labelledby="tv-titulo">
            <div className="tv-passos" aria-hidden="true">
              {[1, 2, 3, 4].map((n) => (
                <span key={n} className={`tv-passo${passo >= n ? " is-on" : ""}`} />
              ))}
            </div>

            {passo === 1 ? (
              <>
                <span className="tv-eyebrow">● SEU TESTE ESTÁ CORRENDO</span>
                <h2 id="tv-titulo" className="tv-titulo">
                  {restante.semPrazo
                    ? "Seu ambiente ainda é um teste"
                    : restante.expirado
                      ? "Seu teste expirou"
                      : `Faltam ${plural(restante.dias, "dia", "dias")} e ${plural(restante.horas, "hora", "horas")}`}
                </h2>
                <p className="tv-texto">
                  Enquanto for teste, o ambiente pode ser desativado e, depois de um tempo, removido.
                  {perdas.length > 0 ? " Junto vai tudo que você construiu aqui:" : ""}
                </p>

                {perdas.length > 0 ? (
                  <ul className="tv-perdas">
                    {perdas.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="tv-texto tv-texto--fraco">
                    Você ainda não cadastrou nada além dos exemplos que já vieram prontos — comece
                    agora e não perca o trabalho depois.
                  </p>
                )}

                <p className="tv-texto tv-texto--fraco">
                  Assinando, nada disso se perde: o mesmo ambiente continua, só deixa de ser teste.
                </p>

                <div className="tv-acoes">
                  <button type="button" className="tv-btn" onClick={fechar}>Agora não</button>
                  <button type="button" className="tv-btn tv-btn--primario" onClick={() => setPasso(2)}>
                    Quero assinar
                  </button>
                </div>
              </>
            ) : null}

            {passo === 2 ? (
              <>
                <span className="tv-eyebrow">● ESCOLHA O PLANO</span>
                <h2 id="tv-titulo" className="tv-titulo">Qual plano combina com a sua imobiliária?</h2>
                <p className="tv-texto">
                  {planoDoTeste
                    ? <>Você testou o <strong>{planoDoTeste.nome}</strong>. Manter esse plano é seguir
                        com exatamente o que você já conhece — subir libera mais, descer tira
                        recursos que você vinha usando.</>
                    : <>Escolha o plano que combina com a sua rotina. Subir libera mais recursos;
                        descer tira o que você vinha usando no teste.</>}
                </p>

                <div className="tv-planos">
                  {planosOfertaveis.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      className={`tv-plano${plano === p.key ? " is-on" : ""}`}
                      onClick={() => setPlano(p.key)}
                    >
                      <span className="tv-plano__topo">
                        <span className="tv-plano__nome">{p.nome}</span>
                        {p.key === situacao.plano ? <span className="tv-plano__tag">SEU TESTE</span> : null}
                      </span>
                      <span className="tv-plano__preco">{precoDe(p.key)}</span>
                      <span className="tv-plano__desc">{p.descricao}</span>
                    </button>
                  ))}
                </div>

                <div className="tv-acoes">
                  <button type="button" className="tv-btn" onClick={() => setPasso(1)}>Voltar</button>
                  <button
                    type="button"
                    className="tv-btn tv-btn--primario"
                    disabled={!plano}
                    onClick={() => setPasso(3)}
                  >
                    Continuar
                  </button>
                </div>
              </>
            ) : null}

            {passo === 3 ? (
              <>
                <span className="tv-eyebrow">● PAGAMENTO</span>
                <h2 id="tv-titulo" className="tv-titulo">
                  {stripeConfigurado() ? "Dados do cartão" : "Falta conectar a cobrança"}
                </h2>

                {stripeConfigurado() ? (
                  <>
                    <p className="tv-texto">
                      Cobrança mensal automática, cancele quando quiser. O cartão é digitado num
                      campo do próprio Stripe — os dados não passam pela Domus.
                    </p>
                    <div className="tv-cartao" ref={cartaoRef} />
                    {!cartaoPronto && !falha ? (
                      <p className="tv-texto tv-texto--fraco">Carregando o campo seguro…</p>
                    ) : null}
                  </>
                ) : (
                  <div className="tv-pagamento">
                    <p className="tv-texto">
                      O campo de cartão precisa ser o do provedor de pagamento, carregado dentro de
                      um quadro isolado, para que o número nunca passe pelo servidor da Domus.
                    </p>
                    <p className="tv-texto tv-texto--fraco">
                      Enquanto o provedor não está conectado, seguimos pelo time: confirmamos o
                      plano e ativamos a assinatura para você.
                    </p>
                  </div>
                )}

                {falha ? <p className="tv-falha">{falha}</p> : null}

                <div className="tv-acoes">
                  <button type="button" className="tv-btn" onClick={() => setPasso(2)} disabled={enviando}>
                    Voltar
                  </button>
                  {podeAssinar ? (
                    <button
                      type="button"
                      className="tv-btn tv-btn--primario"
                      onClick={assinar}
                      disabled={enviando || (stripeConfigurado() && !cartaoPronto)}
                    >
                      {enviando ? "Processando…" : "Confirmar assinatura"}
                    </button>
                  ) : (
                    <a className="tv-btn tv-btn--primario" href="mailto:contato@domus.com">
                      Falar com o time
                    </a>
                  )}
                </div>
              </>
            ) : null}

            {passo === 4 && concluido ? (
              <div className="tv-festa">
                <span className="tv-festa__selo" aria-hidden="true"><IconeCheck size={26} /></span>
                <span className="tv-eyebrow tv-eyebrow--menta">● ASSINATURA CONFIRMADA</span>
                <h2 id="tv-titulo" className="tv-titulo">Bem-vindo à Domus de verdade</h2>
                <p className="tv-texto">
                  A {situacao?.nomeTenant || "sua imobiliária"} deixou de ser um teste. Tudo que você
                  montou continua exatamente onde estava — imóveis, fotos, leads, equipe e a vitrine.
                </p>

                <div className="tv-resumo">
                  <div className="tv-resumo__linha">
                    <span>Plano</span>
                    <strong>{nomeDoPlano(concluido.plano)}</strong>
                  </div>
                  <div className="tv-resumo__linha">
                    <span>Valor</span>
                    <strong>{precoDe(concluido.plano)}</strong>
                  </div>
                  {concluido.proximoVencimento ? (
                    <div className="tv-resumo__linha">
                      <span>Próxima cobrança</span>
                      <strong>
                        {new Date(concluido.proximoVencimento).toLocaleDateString("pt-BR")}
                      </strong>
                    </div>
                  ) : null}
                </div>

                {liberados.length > 0 ? (
                  <>
                    <p className="tv-texto tv-texto--fraco">O que este plano libera:</p>
                    <ul className="tv-ganhos">
                      {liberados.map((g) => (
                        <li key={g}>{g}</li>
                      ))}
                    </ul>
                  </>
                ) : null}

                <p className="tv-texto tv-texto--fraco">
                  A cobrança é mensal e automática. Para cancelar ou trocar o cartão, é só falar com
                  a gente.
                </p>

                <div className="tv-acoes tv-acoes--centro">
                  <button type="button" className="tv-btn tv-btn--primario" onClick={fechar}>
                    Começar a usar
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

const CSS = `
/* ── Botão na sidebar ── */
.ds-shell .tv-botao {
  display: flex; align-items: center; gap: 9px; width: 100%;
  padding: 9px 10px; margin-bottom: 4px; border-radius: 10px;
  background: rgba(212,175,55,0.10); border: 1px solid rgba(212,175,55,0.28);
  color: #e8d79b; font-family: inherit; font-size: 12.5px; font-weight: 600;
  text-align: left; cursor: pointer; box-shadow: none; transform: none;
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}
.ds-shell .tv-botao:hover {
  background: rgba(212,175,55,0.20); border-color: rgba(212,175,55,0.55);
  color: #fff3cf; box-shadow: none; transform: none;
}
.ds-shell .tv-botao.is-expirado {
  background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.35); color: #fca5a5;
}
.ds-shell .tv-botao:active { scale: 1; }

.tv-ponto {
  width: 7px; height: 7px; border-radius: 999px; flex: 0 0 auto; background: currentColor;
  box-shadow: 0 0 0 0 currentColor; animation: tvPulso 2.4s ease-out infinite;
}
@keyframes tvPulso {
  0% { box-shadow: 0 0 0 0 rgba(212,175,55,0.55); }
  70% { box-shadow: 0 0 0 7px rgba(212,175,55,0); }
  100% { box-shadow: 0 0 0 0 rgba(212,175,55,0); }
}

/* Os dois textos ocupam a mesma célula da grade, então a troca no hover não
   muda a largura do botão nem empurra a sidebar. */
.tv-rotulo { display: grid; min-width: 0; }
.tv-rotulo__dias, .tv-rotulo__cta {
  grid-area: 1 / 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.tv-rotulo__cta { opacity: 0; transform: translateY(4px); }
.tv-botao:hover .tv-rotulo__dias { opacity: 0; transform: translateY(-4px); }
.tv-botao:hover .tv-rotulo__cta { opacity: 1; transform: none; }
.ds-side.is-collapsed .tv-rotulo { display: none; }
.ds-side.is-collapsed .tv-botao { justify-content: center; padding: 9px; }

/* ── Modal ── */
.tv-veu {
  position: fixed; inset: 0; z-index: 9998; display: grid; place-items: center; padding: 24px;
  background: rgba(5,5,7,0.74);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  animation: tvVeu 0.22s ease both;
}
@keyframes tvVeu { from { opacity: 0; } to { opacity: 1; } }

.tv-caixa {
  width: min(520px, 100%); max-height: calc(100vh - 48px); overflow-y: auto;
  background: #141821; border: 1px solid rgba(255,255,255,0.10); border-radius: 18px;
  padding: 28px 28px 24px;
  box-shadow: 0 30px 70px -24px rgba(0,0,0,0.9);
  font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
  animation: tvCaixa 0.36s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes tvCaixa {
  from { opacity: 0; transform: translateY(14px) scale(0.98); }
  to { opacity: 1; transform: none; }
}

.tv-passos { display: flex; gap: 5px; margin-bottom: 18px; }
.tv-passo {
  height: 3px; flex: 1; border-radius: 999px; background: rgba(255,255,255,0.10);
  transition: background 0.3s ease;
}
.tv-passo.is-on { background: #818cf8; }

.tv-eyebrow {
  display: block; margin-bottom: 10px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 9.5px; letter-spacing: 0.14em; text-transform: uppercase; color: #d4af37;
}
.tv-titulo {
  margin: 0 0 10px; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;
  color: #f1f5f9; line-height: 1.28;
}
.tv-texto { margin: 0 0 14px; font-size: 13.5px; line-height: 1.68; color: #94a3b8; }
.tv-texto strong { color: #f1f5f9; font-weight: 600; }
.tv-texto--fraco { font-size: 12.5px; color: #64748b; }

.tv-perdas {
  list-style: none; margin: 0 0 16px; padding: 14px 16px;
  border-radius: 12px; background: rgba(239,68,68,0.07);
  border: 1px solid rgba(239,68,68,0.20); display: grid; gap: 7px;
}
.tv-perdas li {
  position: relative; padding-left: 18px; font-size: 13px; color: #e2e8f0; line-height: 1.5;
}
.tv-perdas li::before { color: #f87171; content: ""; position: absolute; left: 0; top: 0.4em; width: 10px; height: 10px; background-color: currentColor; -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='3.2' stroke-linecap='round'%3E%3Cline x1='5.5' y1='5.5' x2='18.5' y2='18.5'/%3E%3Cline x1='18.5' y1='5.5' x2='5.5' y2='18.5'/%3E%3C/svg%3E") center / contain no-repeat; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='3.2' stroke-linecap='round'%3E%3Cline x1='5.5' y1='5.5' x2='18.5' y2='18.5'/%3E%3Cline x1='18.5' y1='5.5' x2='5.5' y2='18.5'/%3E%3C/svg%3E") center / contain no-repeat; }

.tv-planos { display: grid; gap: 8px; margin-bottom: 18px; }
.ds-shell .tv-plano, .tv-plano {
  display: grid; gap: 3px; width: 100%; text-align: left; cursor: pointer;
  padding: 12px 14px; border-radius: 12px;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.09);
  font-family: inherit; box-shadow: none; transform: none;
  transition: border-color 0.18s ease, background 0.18s ease;
}
.tv-plano:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.18); box-shadow: none; transform: none; }
.tv-plano.is-on { border-color: rgba(129,140,248,0.6); background: rgba(129,140,248,0.12); }
.tv-plano:active { scale: 1; }
.tv-plano__topo { display: flex; align-items: center; gap: 8px; }
.tv-plano__nome { font-size: 14px; font-weight: 700; color: #f1f5f9; }
.tv-plano__tag {
  font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 8px; letter-spacing: 0.1em;
  padding: 2px 7px; border-radius: 999px; color: #d4af37;
  background: rgba(212,175,55,0.12); border: 1px solid rgba(212,175,55,0.3);
}
.tv-plano__preco { font-size: 12.5px; font-weight: 600; color: #818cf8; }
.tv-plano__desc { font-size: 12px; line-height: 1.5; color: #64748b; }

.tv-pagamento {
  padding: 14px 16px; border-radius: 12px; margin-bottom: 16px;
  background: rgba(129,140,248,0.08); border: 1px solid rgba(129,140,248,0.22);
}
.tv-pagamento .tv-texto:last-child { margin-bottom: 0; }
.tv-cartao { margin: 4px 0 16px; min-height: 60px; }

.tv-falha {
  margin: 0 0 14px; padding: 10px 13px; border-radius: 10px;
  font-size: 12.5px; line-height: 1.6; color: #fca5a5;
  background: rgba(239,68,68,0.10); border: 1px solid rgba(239,68,68,0.28);
}

.tv-acoes { display: flex; gap: 9px; justify-content: flex-end; }
.tv-acoes--centro { justify-content: center; }

/* ── Comemoração ── */
.tv-festa { display: grid; justify-items: center; text-align: center; }
.tv-festa .tv-texto, .tv-festa .tv-titulo { text-align: center; }
.tv-festa__selo {
  width: 58px; height: 58px; border-radius: 999px; display: grid; place-items: center;
  margin-bottom: 14px; color: #34d399;
  background: rgba(16,185,129,0.14); border: 1px solid rgba(16,185,129,0.45);
  animation: tvSelo 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes tvSelo {
  from { opacity: 0; transform: scale(0.5); }
  60% { transform: scale(1.08); }
  to { opacity: 1; transform: scale(1); }
}
.tv-eyebrow--menta { color: #34d399; }

.tv-resumo {
  width: 100%; margin: 4px 0 16px; display: grid; gap: 1px;
  border-radius: 12px; overflow: hidden;
  border: 1px solid rgba(255,255,255,0.09); background: rgba(255,255,255,0.09);
}
.tv-resumo__linha {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 11px 14px; background: #10141d; text-align: left;
}
.tv-resumo__linha span { font-size: 12px; color: #64748b; }
.tv-resumo__linha strong { font-size: 13.5px; font-weight: 600; color: #f1f5f9; }

.tv-ganhos {
  list-style: none; width: 100%; margin: 0 0 16px; padding: 0;
  display: grid; gap: 7px; text-align: left;
}
.tv-ganhos li {
  position: relative; padding-left: 20px; font-size: 12.5px; line-height: 1.55; color: #cbd5e1;
}
.tv-ganhos li::before {
  color: #34d399; content: ""; position: absolute; left: 0; top: 0.36em; width: 11px; height: 11px; background-color: currentColor; -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='4 12.5 9.5 18 20 6.5'/%3E%3C/svg%3E") center / contain no-repeat; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='4 12.5 9.5 18 20 6.5'/%3E%3C/svg%3E") center / contain no-repeat;
}
.ds-shell .tv-btn, .tv-btn {
  width: auto; padding: 10px 18px; border-radius: 999px; cursor: pointer;
  font-family: inherit; font-size: 13px; font-weight: 600; text-decoration: none;
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent; border: 1px solid rgba(255,255,255,0.14); color: #cbd5e1;
  box-shadow: none; transform: none;
  transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}
.tv-btn:hover { background: rgba(255,255,255,0.07); color: #f1f5f9; box-shadow: none; transform: none; }
.tv-btn:active { scale: 1; }
.tv-btn--primario { background: #f1f5f9; border-color: #f1f5f9; color: #0c0f1a; }
.tv-btn--primario:hover { background: #fff; color: #0c0f1a; }
.tv-btn:disabled { opacity: 0.5; cursor: default; }

@media (prefers-reduced-motion: reduce) {
  .tv-veu, .tv-caixa, .tv-festa__selo { animation: none; }
  .tv-ponto { animation: none; }
  .tv-rotulo__dias, .tv-rotulo__cta { transition: opacity 0.18s ease; transform: none; }
}
`;

export default TrialAviso;
