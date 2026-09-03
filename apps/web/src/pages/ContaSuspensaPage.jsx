import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { PLANOS } from "../utils/planos";
import { ToggleDoFlow } from "../components/ToggleDoFlow.jsx";
import { CodigoPix, useEsperaDoPix, CODIGO_PIX_CSS } from "../components/CodigoPix.jsx";
import { SkeletonPagamento } from "../components/Skeleton.jsx";
import { AbasDePagamento, ABAS_PAGAMENTO_CSS } from "../components/AbasDePagamento.jsx";
import { carregarStripe, stripeConfigurado, APARENCIA_STRIPE } from "../utils/stripe";
import { IconeCheck } from "../components/Icones.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   A parede de reativação.

   ── O PROBLEMA QUE ELA RESOLVE ──

   Conta vencida perde o painel — e tem que perder mesmo, senão o vencimento não
   significa nada. Só que o pagamento MORA no painel. Fechar o login por
   completo trancava a pessoa do lado de fora justamente da tela que resolveria
   a situação: o e-mail de vencimento mandava para o login, o login recusava, e
   a única forma de voltar a ser cliente era responder o e-mail e esperar
   alguém do outro lado.

   Então quem responde pela conta entra — numa sessão de escopo reduzido, que
   alcança duas rotas (ver a situação e assinar) e mais nada. A recusa das
   demais é no servidor, em `authMiddleware`, antes de qualquer regra de
   permissão: nenhuma rota nova nasce alcançável daqui por engano.

   ── POR QUE NÃO REAPROVEITEI O `TrialAviso` ──

   Ele faz quase isto: escolher plano, digitar cartão, assinar. Mas o texto dele
   é todo de TESTE CORRENDO ("seu teste está correndo", "o que você perde ao não
   assinar") e aqui o fato é outro, e às vezes o oposto: pode ser um cliente que
   PAGAVA e cuja cobrança falhou. Dizer a essa pessoa que o "período de teste"
   acabou erra o fato básico, e uma mensagem que erra isso perde a credibilidade
   na hora em que mais precisa dela.

   O que é duplicado aqui é a MECÂNICA do Stripe (montar o Payment Element,
   pegar o método de pagamento), e ela é curta. O que não se duplica é a regra:
   quem cobra é o servidor, pela mesma rota `/me/assinar` de sempre.
   ──────────────────────────────────────────────────────────────────────────── */

const PRECOS_RESERVA = { BASICO: "R$ 99/mês", PROFISSIONAL: "R$ 199/mês", PREMIUM: "sob consulta" };

function dataCurta(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export function ContaSuspensaPage({ session, onLogout }) {
  const tenantSlug = session?.tenant?.slug || "";
  const nomeTenant = session?.tenant?.name || "sua imobiliária";

  const [situacao, setSituacao] = useState(null);
  const [plano, setPlano] = useState("");
  const [periodo, setPeriodo] = useState("mensal");
  /* ── O PACOTE, que esta tela não perguntava ────────────────────────────────
     Ela reativa uma conta vencida, e a conta pode ter tido o Flow. Sem esta
     escolha, quem voltava era recolocado no Hub puro — perdia o módulo no ato
     de voltar a pagar, e sem uma palavra explicando.

     Começa LIGADO quando a conta já tinha o Flow: reativar é voltar ao que era,
     e obrigar a pessoa a remarcar o que ela já contratava seria cobrar duas
     vezes pela mesma decisão. */
  const [pacote, setPacote] = useState(
    () => (session?.tenant?.modulos?.includes("FLOW") ? "HUB_FLOW" : "HUB"),
  );
  /* A cobrança Pix em aberto. É uma COBRANÇA, não uma assinatura: enquanto ela
     existe, a tela mostra o código no lugar do cartão e espera o dinheiro. */
  /* Qual aba está aberta: "cartao" | "boleto" | "pix". Começa no cartão, que é
     o caminho da maioria e o único garantido em qualquer conta. */
  const [meio, setMeio] = useState("cartao");
  const [pix, setPix] = useState(null);
  const [gerandoPix, setGerandoPix] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState("");
  const [pronto, setPronto] = useState(false);

  const cartaoRef = useRef(null);
  const elementsRef = useRef(null);
  const stripeRef = useRef(null);
  const [cartaoPronto, setCartaoPronto] = useState(false);

  const precos = useMemo(() => situacao?.precos || {}, [situacao]);

  /* O TOKEN entra nas dependências, e não só o slug.

     Logo depois do login esta página monta antes de o token estar no cliente
     HTTP, e a busca levava 401. Como a falha só faz `setSituacao(null)` e não
     havia nova tentativa, a tela ficava para sempre sem preços vindos do
     provedor: caía nos valores de reserva, sem alternador de período e — desde
     que ele existe — sem a oferta de Pix, porque `meios` mora nessa mesma
     resposta. Ninguém relacionaria as duas coisas.

     Reagir ao token resolve sem relógio nem nova tentativa às cegas: quando ele
     chega, a busca refaz sozinha. */
  useEffect(() => {
    if (!tenantSlug) return;
    api.getTrialStatus(tenantSlug).then(setSituacao).catch(() => setSituacao(null));
  }, [tenantSlug, session?.token]);

  /* O prazo vem do SERVIDOR, da mesma constante que a faxina usa para apagar.
     Repetir o número aqui seria a forma mais fácil de prometer trinta dias e
     remover em vinte. */
  const graca = situacao?.graca || session?.graca || null;

  /* Mesma mecânica do `TrialAviso`: o cartão é um iframe do Stripe, o número
     digitado nunca entra nesta página nem chega à nossa API — volta só um id de
     método de pagamento, e é o servidor que cria a assinatura. */
  useEffect(() => {
    /* Na aba do Pix não há Payment Element nenhum: o Mercado Pago não tem
       formulário, tem um código. */
    if (meio === "pix" || !plano || !stripeConfigurado()) return undefined;

    const escolhido = doPacote(plano)?.[periodo] || doPacote(plano)?.mensal;
    const valor = escolhido?.valor;
    if (valor == null) return undefined;

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
          amount: Math.round(valor * 100),
          paymentMethodCreation: "manual",
          appearance: APARENCIA_STRIPE,
          /* UM método por vez, porque quem escolhe agora é a tira de abas lá
             fora — ela precisa incluir o Pix do Mercado Pago, que jamais
             apareceria dentro do iframe do Stripe. */
          paymentMethodTypes: [meio === "boleto" ? "boleto" : "card"],
        });
        /* Acordeão sem rádio e já aberto: com um método só, isto desenha o
           formulário direto. O layout "tabs" mostraria uma aba solitária
           logo abaixo da nossa tira — a mesma pergunta, duas vezes. */
        elemento = elements.create("payment", {
          layout: { type: "accordion", defaultCollapsed: false, radios: false, spacedAccordionItems: false },
        });
        elemento.mount(cartaoRef.current);
        elemento.on("ready", () => vivo && setCartaoPronto(true));
        elementsRef.current = elements;
      })
      .catch((erro) => vivo && setFalha(erro.message));

    return () => {
      vivo = false;
      if (elemento) elemento.destroy();
      elementsRef.current = null;
    };
  /* `pix` entra nas dependências para o campo do Stripe ser REMONTADO ao
     voltar do código Pix. Sem ele, a div do cartão saía do DOM enquanto o QR
     estava na tela, voltava vazia, e o `elements` apontava para um elemento que
     já não existia — o botão ficava habilitado e o pagamento falhava no envio. */
  }, [plano, periodo, pacote, precos, pix, meio]);

  async function reativar() {
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
      await api.assinarPlano(tenantSlug, {
        plano,
        periodo: doPacote(plano)?.[periodo] ? periodo : "mensal",
        pacote,
        tokenPagamento,
      });
      setPronto(true);
    } catch (erro) {
      setFalha(erro.message || "Não foi possível concluir a assinatura.");
    } finally {
      setEnviando(false);
    }
  }

  /* Caminho paralelo ao do cartão, e não uma variação dele: aqui não há
     assinatura, não há token e o Stripe não participa. */
  async function gerarPix() {
    setGerandoPix(true);
    setFalha("");
    try {
      /* O período que a pessoa escolheu, com a mesma queda para o mensal que o
         cartão faz quando aquele plano não tem preço anual cadastrado. */
      setPix(await api.criarCobrancaPix(tenantSlug, { plano, periodo: periodoDe(plano), pacote }));
    } catch (erro) {
      setFalha(erro.message || "Não foi possível gerar o Pix.");
    } finally {
      setGerandoPix(false);
    }
  }

  /* A espera do Pix é a mesma do modal do teste — mora em `CodigoPix.jsx`. O
     que é DESTA tela é o desfecho: aqui não há comemoração de assinatura nova,
     há um ambiente que volta. */
  useEsperaDoPix({
    tenantSlug,
    pix,
    aoAprovar: () => { setPix(null); setPronto(true); },
    aoRecusar: () => {
      setPix(null);
      setFalha("O pagamento não foi concluído. Você pode gerar um novo código.");
    },
  });

  /* Recarregar, e não navegar: a sessão em mãos é a de escopo reduzido, e ela
     continuaria reduzida mesmo com a conta já reativada. Um login novo é o que
     devolve o token cheio. */
  if (pronto) {
    return (
      <div className="cs-fundo">
        <style>{CSS + CODIGO_PIX_CSS + ABAS_PAGAMENTO_CSS}</style>
        <div className="cs-caixa cs-caixa--fim">
          <span className="cs-marca">OMNIMOB</span>
          <div className="cs-selo-ok"><IconeCheck size={26} /></div>
          <h1 className="cs-titulo">Ambiente recuperado</h1>
          <p className="cs-texto">
            A assinatura da <strong>{nomeTenant}</strong> está ativa e nada foi perdido —
            imóveis, fotos, leads e a vitrine continuam exatamente como estavam.
          </p>
          <button type="button" className="cs-btn cs-btn--primario" onClick={() => window.location.reload()}>
            Entrar no painel
          </button>
        </div>
      </div>
    );
  }

  const temProvedor = Object.keys(precos).length > 0;
  /* O bloco de preços DESTE pacote. O Hub mora na raiz do plano e o Hub+Flow em
     `.flow` — a assimetria está explicada em `precosDosPlanos`, no servidor. */
  const doPacote = (k) => (pacote === "HUB_FLOW" ? precos[k]?.flow : precos[k]) || null;
  const ofertaveis = temProvedor
    ? PLANOS.filter((p) => (pacote === "HUB_FLOW" ? precos[p.key]?.flow?.mensal : precos[p.key]?.mensal))
    : PLANOS;
  const periodoDe = (k) => (doPacote(k)?.[periodo] ? periodo : "mensal");
  const precoDe = (k) => doPacote(k)?.[periodoDe(k)]?.rotulo || PRECOS_RESERVA[k];
  /* O valor que o Pix vai cobrar, no período escolhido. Sai do MESMO lugar que
     o cartão lê — é o servidor que decide o número em qualquer dos caminhos. */
  const precoDoPix = plano ? doPacote(plano)?.[periodoDe(plano)]?.numero || null : null;
  /* Só existe para vender com preço cadastrado. Sem as variáveis do Flow no
     Stripe, o interruptor nem aparece e a tela é a de antes. */
  const temFlow = Object.values(precos).some((p) => p?.flow?.mensal);
  const temAnual = Object.values(precos).some((p) => p?.anual);
  const eraTeste = situacao?.emTrial ?? true;

  return (
    <div className="cs-fundo">
      <style>{CSS + CODIGO_PIX_CSS + ABAS_PAGAMENTO_CSS}</style>
      <div className="cs-caixa">
        <span className="cs-marca">OMNIMOB</span>

        <span className="cs-eyebrow">● ACESSO SUSPENSO</span>
        <h1 className="cs-titulo">
          {eraTeste ? "O teste da " : "A assinatura da "}
          {nomeTenant} venceu
        </h1>
        <p className="cs-texto">
          O painel está fechado enquanto isso — mas <strong>nada foi apagado</strong>.
          Imóveis, fotos, leads e a vitrine continuam guardados.
        </p>

        {/* O prazo é a informação mais importante da tela, e por isso ele é
            dito em data E em dias. "Faltam 12 dias" responde a urgência; "até
            2 de setembro" é o que a pessoa consegue anotar na agenda. */}
        {graca?.diasAteRemocao != null ? (
          <div className="cs-prazo">
            <strong>
              {graca.diasAteRemocao === 0
                ? "Último dia"
                : graca.diasAteRemocao === 1
                  ? "Falta 1 dia"
                  : `Faltam ${graca.diasAteRemocao} dias`}
            </strong>
            <span>
              Assinando até {dataCurta(graca.removidoEm)}, tudo volta como estava.
              Depois dessa data o ambiente é removido e não há como recuperar.
            </span>
          </div>
        ) : null}

        <div className="cs-secao">
          <div className="cs-secao__cab">
            <h2 className="cs-subtitulo">Escolha o plano</h2>
            {temAnual ? (
              <div className="ui-segmentado cs-periodo">
                {["mensal", "anual"].map((op) => (
                  <button
                    key={op}
                    type="button"
                    className={`cs-periodo__op${periodo === op ? " is-on" : ""}`}
                    onClick={() => setPeriodo(op)}
                  >
                    {op === "mensal" ? "Mensal" : "Anual"}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {temFlow ? (
            <div className="cs-pacote">
              <ToggleDoFlow
                id="pkg-reativar"
                ligado={pacote === "HUB_FLOW"}
                aoAlternar={(on) => setPacote(on ? "HUB_FLOW" : "HUB")}
                nota={
                  session?.tenant?.modulos?.includes("FLOW")
                    ? "Sua conta tinha o Omniflow. Desmarcando, ele não volta — mas os negócios e contratos continuam guardados."
                    : undefined
                }
              />
            </div>
          ) : null}

          <div className="cs-planos">
            {ofertaveis.map((p) => (
              <button
                key={p.key}
                type="button"
                className={`cs-plano${plano === p.key ? " is-on" : ""}`}
                onClick={() => { setPlano(p.key); setFalha(""); }}
              >
                <span className="cs-plano__nome">{p.nome}</span>
                <span className="cs-plano__preco">{precoDe(p.key)}</span>
              </button>
            ))}
          </div>
        </div>

        {plano ? (
          <div className="cs-secao">
            <h2 className="cs-subtitulo">Pagamento</h2>

            {/* A escolha do meio saiu de dentro do iframe do Stripe. O porquê
                está no cabeçalho de `AbasDePagamento`: o Pix é de outro
                provedor e nunca apareceria nas abas deles. */}
            <AbasDePagamento
              id="reativar"
              meios={situacao?.meios}
              escolhido={meio}
              aoEscolher={(m) => { setMeio(m); setFalha(""); if (m !== "pix") setPix(null); }}
            />

            {meio === "pix" ? (
              pix ? (
                <>
                  <p className="cs-texto">
                    Abra o app do seu banco, escolha Pix e leia o código abaixo. Assim que o
                    pagamento cair, o ambiente volta sozinho — pode levar alguns segundos.
                  </p>
                  <CodigoPix pix={pix} />
                  <p className="cs-texto cs-texto--fraco">Aguardando o pagamento…</p>
                </>
              ) : (
                <>
                  {/* O VALOR do período escolhido vem antes do botão, e o aviso
                      de que não renova vem junto: Pix Automático não existe
                      para nós, então cada cobrança é um código que alguém paga.
                      No mensal isso se repete doze vezes por ano, e esconder o
                      fato produziria conta vencida em silêncio. */}
                  <p className="cs-texto">
                    {periodoDe(plano) === "anual" ? "O ano inteiro" : "Um mês"} em um pagamento só{" "}
                    {precoDoPix ? <strong>({precoDoPix})</strong> : null}, aprovado na hora.
                  </p>
                  <p className="cs-texto cs-texto--fraco">
                    Não é cobrança automática: {periodoDe(plano) === "anual"
                      ? "daqui a um ano será preciso gerar um novo código."
                      : "todo mês será preciso gerar um novo código. Para não pensar nisso, o cartão cobra sozinho."}
                  </p>
                  <button
                    type="button"
                    className="cs-btn cs-btn--primario"
                    onClick={gerarPix}
                    disabled={gerandoPix || !precoDoPix}
                  >
                    {gerandoPix ? "Gerando…" : "Gerar código Pix"}
                  </button>
                  {!precoDoPix ? (
                    <p className="cs-texto cs-texto--fraco">
                      Este plano ainda não tem cobrança cadastrada para este período — escolha
                      cartão ou boleto, ou fale com o time.
                    </p>
                  ) : null}
                </>
              )
            ) : stripeConfigurado() ? (
              <>
                {/* Ver o comentário de `SkeletonPagamento`: ele reserva a
                    altura do iframe, que até montar não ocupa nada. */}
                {!cartaoPronto ? <SkeletonPagamento /> : null}
                <div ref={cartaoRef} className="cs-cartao" />
              </>
            ) : (
              <p className="cs-texto cs-texto--fraco">
                A cobrança automática não está configurada neste ambiente. Responda ao
                e-mail que enviamos e a gente resolve por lá.
              </p>
            )}
          </div>
        ) : null}

        {falha ? <div className="cs-falha">{falha}</div> : null}

        <div className="cs-acoes">
          {/* O botão cobra pelo STRIPE. Na aba do Pix ele não existe: quem
              paga por lá já tem o próprio botão, e clicar neste cobraria a
              pessoa duas vezes. */}
          {meio === "pix" ? null : (
            <button
              type="button"
              className="cs-btn cs-btn--primario"
              disabled={!plano || enviando || (stripeConfigurado() && !cartaoPronto)}
              onClick={reativar}
            >
              {enviando ? "Processando…" : "Assinar e recuperar meu ambiente"}
            </button>
          )}
          <button type="button" className="cs-btn" onClick={onLogout}>Sair</button>
        </div>

        <p className="cs-rodape">
          Precisa de mais tempo ou quer conversar sobre o plano? Responda o e-mail
          de vencimento que a gente resolve.
        </p>
      </div>
    </div>
  );
}

/* Escopado em `cs-*`, e com paleta própria em vez de tokens do painel: esta
   tela roda FORA do `AdminLayout`, que é quem define o tema. Ela é sempre
   escura, como a de login — as duas são a moldura do produto, não conteúdo do
   cliente. */
const CSS = `
.cs-fundo {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  padding: 32px 20px; background: #0a0a0b;
  background-image:
    radial-gradient(880px 460px at 82% -6%, rgba(139,92,246,0.13), transparent 68%),
    radial-gradient(560px 340px at 14% 2%, rgba(212,175,55,0.08), transparent 62%);
  font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
  color: #e2e8f0;
}
.cs-caixa {
  width: 100%; max-width: 560px; padding: 34px 32px 26px;
  background: rgba(18,20,29,0.94); border: 1px solid rgba(255,255,255,0.09);
  border-radius: 20px; box-shadow: 0 40px 90px -30px rgba(0,0,0,0.85);
  display: flex; flex-direction: column; gap: 18px;
}
.cs-caixa--fim { text-align: center; align-items: center; }
.cs-marca {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px; letter-spacing: 0.22em; color: #64748b;
}
.cs-eyebrow {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px; letter-spacing: 0.14em; color: #f59e0b; font-weight: 700;
}
.cs-titulo { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; color: #f8fafc; line-height: 1.25; }
.cs-subtitulo { margin: 0; font-size: 13px; font-weight: 700; color: #f1f5f9; }
.cs-texto { margin: 0; font-size: 14px; line-height: 1.6; color: #94a3b8; }
.cs-texto--fraco { font-size: 12.5px; color: #64748b; }
.cs-texto strong, .cs-prazo strong { color: #f1f5f9; }

/* O prazo em destaque: é a informação que decide o comportamento de quem lê. */
.cs-prazo {
  display: flex; flex-direction: column; gap: 4px;
  padding: 14px 16px; border-radius: 12px;
  background: rgba(245,158,11,0.09); border: 1px solid rgba(245,158,11,0.28);
}
.cs-prazo strong { font-size: 15px; color: #fbbf24; }
.cs-prazo span { font-size: 12.5px; line-height: 1.55; color: #94a3b8; }

.cs-secao { display: flex; flex-direction: column; gap: 12px; }
.cs-secao__cab { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.cs-pacote { margin-bottom: 14px; }
.cs-periodo { display: flex; padding: 3px; border-radius: 10px; }
.cs-periodo__op {
  width: auto; padding: 5px 12px; border-radius: 8px; border: none;
  background: transparent; color: #94a3b8; font-size: 12px; font-weight: 600; cursor: pointer;
  box-shadow: none; transform: none;
}
.cs-periodo__op.is-on { background: rgba(255,255,255,0.1); color: #f8fafc; }

.cs-planos { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
.cs-plano {
  display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
  padding: 14px 16px; border-radius: 12px; cursor: pointer; text-align: left;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);
  color: inherit; box-shadow: none; transform: none;
  transition: border-color 0.15s, background 0.15s;
}
.cs-plano:hover { background: rgba(255,255,255,0.06); transform: none; }
.cs-plano.is-on { border-color: rgba(129,140,248,0.7); background: rgba(99,102,241,0.14); }
.cs-plano__nome { font-size: 13.5px; font-weight: 700; color: #f1f5f9; }
.cs-plano__preco { font-size: 12.5px; color: #94a3b8; }

.cs-cartao { padding: 4px 0; min-height: 90px; }
.cs-falha {
  padding: 11px 14px; border-radius: 10px; font-size: 13px; line-height: 1.5;
  background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.32); color: #fca5a5;
}

.cs-acoes { display: flex; gap: 10px; flex-wrap: wrap; }
.cs-btn {
  width: auto; padding: 12px 18px; border-radius: 11px; cursor: pointer;
  font-size: 13.5px; font-weight: 600; box-shadow: none; transform: none;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #e2e8f0;
}
.cs-btn:hover { transform: none; background: rgba(255,255,255,0.1); }
.cs-btn--primario { flex: 1; background: #4f46e5; border-color: #4f46e5; color: #fff; }
.cs-btn--primario:hover { background: #4338ca; }
.cs-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.cs-selo-ok {
  width: 54px; height: 54px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  background: rgba(16,185,129,0.14); border: 1px solid rgba(16,185,129,0.4); color: #34d399;
}
.cs-rodape { margin: 0; font-size: 11.5px; line-height: 1.55; color: #64748b; }
`;
