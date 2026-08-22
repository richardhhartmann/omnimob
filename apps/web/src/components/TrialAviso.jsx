import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import {
  getTrialStatusCompartilhado,
  esquecerTrialStatus,
  ouvirMudancaDeTrial,
} from "../utils/trialStatus";
import { ouvirPedidoDeAssinatura } from "../utils/pulsoTrial";
import { PLANOS } from "../utils/planos";
import { ToggleDoFlow } from "./ToggleDoFlow.jsx";
import { carregarStripe, stripeConfigurado, chavesDaMesmaConta, APARENCIA_STRIPE } from "../utils/stripe";
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

/* ── A guia, com os três jeitos de pagar ────────────────────────────────────
   A LINHA DIGITÁVEL vem primeiro porque é o que a maioria usa: copia e cola no
   app do banco, sem sair do celular. O PDF é para quem imprime ou repassa ao
   financeiro — comum em imobiliária, e o motivo de ele não ser opcional. A
   página do Stripe fica por último, como saída para quem prefere o fluxo dele.

   Os três existem porque o e-mail com o boleto é OPT-IN no painel do Stripe e,
   em teste, só chega a endereços da própria conta. Depender dele para a pessoa
   reencontrar a guia era depender de algo que pode nunca ter sido ligado. */
function GuiaDoBoleto({ guia }) {
  const [copiado, setCopiado] = useState(false);
  if (!guia) return null;

  function copiar() {
    navigator.clipboard?.writeText(guia.numero || "").then(
      () => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); },
      () => {},
    );
  }

  return (
    <div className="tv-guia">
      {guia.numero ? (
        <>
          <span className="tv-guia__rotulo">Linha digitável</span>
          <code className="tv-guia__numero">{guia.numero}</code>
          <button type="button" className="tv-btn tv-btn--primario" onClick={copiar}>
            {copiado ? "Copiado" : "Copiar código"}
          </button>
        </>
      ) : null}
      <div className="tv-guia__links">
        {guia.pdf ? <a href={guia.pdf} target="_blank" rel="noreferrer">Baixar PDF</a> : null}
        {guia.url ? <a href={guia.url} target="_blank" rel="noreferrer">Abrir no navegador</a> : null}
      </div>
      {guia.venceEm ? (
        <span className="tv-guia__prazo">
          Vence em {new Date(guia.venceEm).toLocaleDateString("pt-BR")} às{" "}
          {new Date(guia.venceEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      ) : null}
    </div>
  );
}

function plural(n, singular, pluralForma) {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}

export function TrialAviso({ tenantSlug, podeAssinar, aoAssinar }) {
  const [situacao, setSituacao] = useState(null);
  const [aberto, setAberto] = useState(false);
  const [passo, setPasso] = useState(1);
  const [plano, setPlano] = useState("");
  /* Mensal ou anual. Só aparece quando o provedor tem preço anual cadastrado —
     ver `temAnual` mais abaixo. */
  const [periodo, setPeriodo] = useState("mensal");
  /* ── Hub, ou Hub + Flow ───────────────────────────────────────────────────
     Começa no HUB pelo mesmo motivo do mensal: é o menor número da tela, e
     abrir no pacote completo faria o painel anunciar o preço mais alto para
     quem só quer saber quanto custa.

     O alternador só aparece quando existe preço do Flow cadastrado no Stripe —
     ver `temFlow`. Enquanto não existir, esta tela é exatamente a de antes. */
  const [pacote, setPacote] = useState("HUB");
  const [aguardandoAssinc, setAguardandoAssinc] = useState(null);
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
    getTrialStatusCompartilhado(tenantSlug).then(setSituacao).catch(() => setSituacao(null));
  }, [tenantSlug]);

  /* O prazo pode mudar com esta tela de pé: a pesquisa do painel
     ([PulsoTrialModal]) dá dias a mais sem recarregar nada. Sem esta escuta o
     selo continuaria anunciando o vencimento antigo logo depois de o produto
     ter prometido outro. */
  useEffect(() => {
    if (!tenantSlug) return undefined;
    return ouvirMudancaDeTrial(() => {
      getTrialStatusCompartilhado(tenantSlug).then(setSituacao).catch(() => {});
    });
  }, [tenantSlug]);

  /* "Quero assinar" dito lá na pesquisa abre este fluxo direto no passo do
     plano — a etapa do "por que assinar" acabou de acontecer por lá. */
  useEffect(() => ouvirPedidoDeAssinatura((passoPedido) => {
    setPasso(passoPedido || 1);
    setAberto(true);
  }), []);

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
     pagamento. É o que mantém a Omnimob fora do escopo pesado do PCI. */
  useEffect(() => {
    if (passo !== 3 || !stripeConfigurado()) return undefined;

    /* `mode` e `amount` são obrigatórios ao criar o grupo de Elements neste
       fluxo — o cartão é coletado aqui e a assinatura é criada no servidor
       depois (pagamento diferido), então o Stripe precisa saber de antemão o
       que será cobrado para escolher os meios de pagamento e os campos certos.
       Sem eles o Payment Element se recusa a montar. */
    /* Plano sem preço anual cai no mensal — o mesmo que o servidor faria. É o
       que impede o Elements de ser montado com valor nulo enquanto o alternador
       está no anual e aquele plano ainda não tem preço lá. */
    const escolhido = doPacote(plano)?.[periodo] || doPacote(plano)?.mensal;
    const valor = escolhido?.valor;
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
  }, [passo, plano, periodo, pacote, precosVivos]);

  /* O que sobra DEPOIS do vencimento. Vem do servidor, da mesma constante que
     a faxina usa para apagar — cravar o número aqui seria a forma mais fácil de
     prometer trinta dias na tela e remover em vinte. */
  const graca = situacao?.graca || null;


  /* `emTrial` sozinho escondia o selo justamente de quem mais precisa dele: o
     cliente que PAGAVA e cuja cobrança falhou nunca teve `emTrial`, então a
     conta vencia, entrava na contagem para remoção, e o painel não dizia nada.
     A janela de graça é a mesma para os dois, e o aviso também. */
  /* Uma cobrança esperando pagamento mantém o selo de pé mesmo fora do teste:
     é o único lugar do painel onde se reencontra o boleto gerado. */
  const cobranca = situacao?.cobranca || null;

  if (!situacao?.emTrial && !graca?.venceu && cobranca?.situacao !== "aberta") return null;

  /* Com o Stripe ligado, só oferecemos plano que tem preço lá — oferecer um
     plano sem preço daria 503 na hora de cobrar, depois de a pessoa já ter
     digitado o cartão. Sem provedor, mostramos todos e o caminho é o time. */
  const temProvedor = Object.keys(precosVivos).length > 0;
  const planosOfertaveis = temProvedor
    ? PLANOS.filter((p) => (pacote === "HUB_FLOW"
        ? precosVivos[p.key]?.flow?.mensal
        : precosVivos[p.key]?.mensal))
    : PLANOS;
  /* O período que este plano REALMENTE consegue cobrar. Quem não tem preço
     anual cadastrado segue no mensal em silêncio, em vez de sumir da lista por
     causa de uma opção que nem é a principal. */
  /* O bloco de preços DESTE pacote. O Hub mora na raiz do plano e o Hub+Flow
     em `.flow` — a assimetria está explicada em `precosDosPlanos`, no servidor.

     Cai de volta na raiz quando o pacote com Flow não tem preço para o plano:
     assim um plano sem SKU de Flow segue vendável no Hub em vez de sumir. */
  const doPacote = (chave) =>
    (pacote === "HUB_FLOW" ? precosVivos[chave]?.flow : precosVivos[chave]) || null;

  const periodoDe = (chave) => (doPacote(chave)?.[periodo] ? periodo : "mensal");
  const precoDe = (chave) =>
    doPacote(chave)?.[periodoDe(chave)]?.rotulo || PRECOS_RESERVA[chave];
  const economiaDe = (chave) =>
    periodoDe(chave) === "anual" ? doPacote(chave)?.economia || null : null;
  const temAnual = Object.values(precosVivos).some((p) => (pacote === "HUB_FLOW" ? p?.flow?.anual : p?.anual));
  /* O pacote com Flow existe para vender? Só com preço cadastrado. Enquanto as
     variáveis `STRIPE_PRICE_*_FLOW` não existirem, o alternador nem aparece —
     mesma escolha que o preço anual fez quando entrou. */
  const temFlow = Object.values(precosVivos).some((p) => p?.flow?.mensal);
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

  /* Vencido, a pergunta que a pessoa tem deixa de ser "quanto falta para
     vencer" e passa a ser "quanto tempo tenho para não perder tudo". O rótulo
     responde a essa, que é a única que ainda importa. */
  const rotulo = cobranca?.situacao === "aberta"
    ? (cobranca.meio === "boleto" ? "Boleto em aberto" : "Pagamento em análise")
    : graca?.venceu
    ? graca.diasAteRemocao === 0
      ? "Último dia dos seus dados"
      : plural(graca.diasAteRemocao, "dia até apagar", "dias até apagar")
    : restante.semPrazo
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

  /* ── O caminho de quem paga ───────────────────────────────────────────────

     Um só, para todos os meios. Quem escolhe cartão ou boleto é o Payment
     Element — ele já é um seletor, com os campos certos de cada meio (o boleto
     pede documento e endereço; o cartão não) e traduzido pelo próprio Stripe.

     Havia um segundo seletor nosso em cima dele, e a tela perguntava duas vezes
     a mesma coisa. Some: `createPaymentMethod` devolve o TIPO que a pessoa
     escolheu, e é ele que decide para onde vai a requisição.

     A diferença que sobra é de natureza, não de interface. Cartão cobra na
     hora. Boleto nasce como guia, e o dinheiro entra depois — quem vira a chave
     nesse caso é o webhook `invoice.paid`. */
  async function assinar() {
    setEnviando(true);
    setFalha("");
    try {
      let tokenPagamento = null;
      let tipo = "card";

      if (stripeConfigurado()) {
        if (!elementsRef.current) throw new Error("O formulário de pagamento ainda não carregou.");
        await elementsRef.current.submit();
        const { error, paymentMethod } = await stripeRef.current.createPaymentMethod({
          elements: elementsRef.current,
        });
        if (error) throw new Error(error.message || "Não foi possível validar o pagamento.");
        tokenPagamento = paymentMethod.id;
        tipo = paymentMethod.type;
      }

      const periodoDoPlano = doPacote(plano)?.[periodo] ? periodo : "mensal";

      if (tipo !== "card") {
        const r = await api.assinarPlanoAssincrono(tenantSlug, {
          plano, periodo: periodoDoPlano, pacote, meio: tipo, tokenPagamento,
        });
        esquecerTrialStatus(tenantSlug);
        setAguardandoAssinc({ meio: tipo, guia: r.guia || null });
        return;
      }

      const resposta = await api.assinarPlano(tenantSlug, {
        plano, periodo: periodoDoPlano, pacote, tokenPagamento,
      });
      esquecerTrialStatus(tenantSlug);
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
        className={`tv-botao${restante.expirado || graca?.venceu ? " is-expirado" : ""}${cobranca?.situacao === "aberta" ? " is-aguardando" : ""}`}
        onClick={() => setAberto(true)}
        title={
          cobranca?.situacao === "aberta"
            ? `Há uma cobrança de R$ ${cobranca.valor} aguardando pagamento. O plano só é liberado quando ela compensar.`
            : graca?.venceu
            ? `O plano venceu. Seus dados ficam guardados até ${new Date(graca.removidoEm).toLocaleDateString("pt-BR")} — assine para recuperar o ambiente.`
            : "Assinar a Omnimob"
        }
      >
        <span className="tv-ponto" aria-hidden="true" />
        <span className="tv-rotulo">
          <span className="tv-rotulo__dias">{rotulo}</span>
          <span className="tv-rotulo__cta">Assine já</span>
        </span>
      </button>

      {/* ── Quem não é Administrador não entra no fluxo de assinatura ─────────
          A caixa de planos mostra valores, escolhe o pacote e coleta cartão —
          decisões de quem responde pela conta. Antes, qualquer cargo percorria
          os três passos e só esbarrava no fim, na hora de confirmar: a pessoa
          escolhia plano e digitava o cartão para descobrir ali que não era com
          ela.

          `verConfiguracoes` é a permissão exclusiva do Administrador (ver o
          comentário do campo em `schema.prisma`) — a mesma que abre a tela onde
          plano e cobrança vivem. É por ela que `podeAssinar` chega aqui.

          O selo com os dias continua visível para todo mundo: saber que o teste
          está correndo é informação de trabalho, e quem descobre agora tem
          quem avisar. */}
      {aberto && !podeAssinar ? (
        <div className="tv-veu" onMouseDown={(e) => e.target === e.currentTarget && fechar()}>
          <div className="tv-caixa tv-caixa--recado" role="dialog" aria-modal="true" aria-labelledby="tv-titulo">
            <span className="tv-eyebrow">● SEU TESTE ESTÁ CORRENDO</span>
            <h2 id="tv-titulo" className="tv-titulo">
              {restante.expirado ? "O teste expirou" : "A assinatura é com o administrador"}
            </h2>
            <p className="tv-texto">
              Para assinar o plano da Omnimob, fale com o <strong>administrador</strong> da
              {situacao?.nomeTenant ? ` ${situacao.nomeTenant}` : " sua imobiliária"} — pois é ele quem tem
              acesso às configurações, onde plano e cobrança ficam.
            </p>
            <p className="tv-texto tv-texto--fraco">
              {restante.expirado
                ? "Enquanto isso o ambiente segue como teste e pode ser desativado."
                : "Até lá nada muda: o ambiente continua funcionando normalmente."}
            </p>
            <div className="tv-acoes">
              <button type="button" className="tv-btn tv-btn--primario" onClick={fechar}>Entendi</button>
            </div>
          </div>
        </div>
      ) : null}

      {aberto && podeAssinar ? (
        <div className="tv-veu" onMouseDown={(e) => e.target === e.currentTarget && !enviando && fechar()}>
          <div className="tv-caixa" ref={caixaRef} role="dialog" aria-modal="true" aria-labelledby="tv-titulo">
            <div className="tv-passos" aria-hidden="true">
              {[1, 2, 3, 4].map((n) => (
                <span key={n} className={`tv-passo${passo >= n ? " is-on" : ""}`} />
              ))}
            </div>

            {passo === 1 && cobranca?.situacao === "aberta" ? (
              /* Antes de oferecer um plano de novo: já existe cobrança criada.
                 Sem isto a pessoa gera um segundo boleto achando que o primeiro
                 não valeu, e acaba com dois — e um deles vai vencer sozinho. */
              <div className="tv-pendencia">
                <span className="tv-eyebrow">● {cobranca.meio === "boleto" ? "BOLETO EM ABERTO" : "PAGAMENTO EM ANÁLISE"}</span>
                <h2 id="tv-titulo" className="tv-titulo">Já existe uma cobrança</h2>
                <p className="tv-texto">
                  {cobranca.plano ? `Plano ${cobranca.plano.toLowerCase()}` : "Assinatura"}
                  {cobranca.valor ? `, R$ ${cobranca.valor}` : ""}
                  {cobranca.guia?.venceEm
                    ? ` — vence em ${new Date(cobranca.guia.venceEm).toLocaleDateString("pt-BR")}.`
                    : "."}{" "}
                  O plano é liberado assim que o pagamento compensar.
                </p>
                <GuiaDoBoleto guia={cobranca.guia} />
                <p className="tv-texto tv-texto--fraco">
                  Não pagou? Nada acontece com sua conta: a cobrança expira sozinha e o teste
                  segue o curso normal.
                </p>
                <div className="tv-acoes">
                  <button type="button" className="tv-btn" onClick={fechar}>Entendi</button>
                </div>
              </div>
            ) : null}

            {passo === 1 && cobranca?.situacao !== "aberta" ? (
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

                {/* ── O PACOTE VEM ANTES DO PERÍODO ──────────────────────
                    Ele decide o PRODUTO; o outro decide só a forma de pagar.
                    Invertidos, a pessoa escolheria como pagar antes de saber o
                    que está comprando.

                    O mesmo `ToggleDoFlow` da landing, da parede de reativação e
                    de Configurações → Plano. */}
                {temFlow ? (
                  <div className="tv-pacote-caixa">
                    <ToggleDoFlow
                      id="pkg-assinar"
                      ligado={pacote === "HUB_FLOW"}
                      aoAlternar={(on) => setPacote(on ? "HUB_FLOW" : "HUB")}
                    />
                  </div>
                ) : null}

                {temAnual ? (
                  <div className="tv-periodo" role="radiogroup" aria-label="Forma de cobrança">
                    {[
                      { chave: "mensal", rotulo: "Mensal" },
                      { chave: "anual", rotulo: "Anual" },
                    ].map((op) => (
                      <button
                        key={op.chave}
                        type="button"
                        role="radio"
                        aria-checked={periodo === op.chave}
                        className={`tv-periodo__opt${periodo === op.chave ? " is-on" : ""}`}
                        onClick={() => setPeriodo(op.chave)}
                      >
                        {op.rotulo}
                      </button>
                    ))}
                  </div>
                ) : null}

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
                      <span className="tv-plano__preco">
                        {precoDe(p.key)}
                        {economiaDe(p.key)?.mesesGratis >= 0.5 ? (
                          <span className="tv-plano__economia">
                            {String(economiaDe(p.key).mesesGratis).replace(".", ",")} meses grátis
                          </span>
                        ) : null}
                      </span>
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

            {passo === 3 && !aguardandoAssinc ? (
              <>
                <span className="tv-eyebrow">● PAGAMENTO</span>
                <h2 id="tv-titulo" className="tv-titulo">
                  {stripeConfigurado() ? "Dados do cartão" : "Falta conectar a cobrança"}
                </h2>

                {stripeConfigurado() && !chavesDaMesmaConta(situacao?.contaStripe) ? (
                  /* Configuração, não falha de pagamento — e a diferença importa
                     para quem lê: nenhum cartão vai passar até isto ser
                     corrigido, e insistir só produz o mesmo 404. */
                  <div className="tv-falha">
                    <strong>Chaves do Stripe de contas diferentes.</strong> A chave publicável do
                    painel não pertence à mesma conta da chave secreta do servidor — o pagamento
                    é criado numa conta e confirmado na outra. Corrija{" "}
                    <code>VITE_STRIPE_PUBLISHABLE_KEY</code> com a chave da mesma conta.
                  </div>
                ) : stripeConfigurado() ? (
                  <>
                    {/* ── UM seletor, e ele é o do Stripe ──────────────────
                        Havia um nosso aqui — Cartão | Boleto — e o Payment
                        Element mostrava os mesmos dois logo abaixo, porque ele
                        JÁ é um seletor. Duas perguntas idênticas empilhadas.

                        Ficou o dele porque traz junto os campos certos de cada
                        meio (boleto exige documento e endereço; cartão não),
                        traduzidos e validados pelo próprio Stripe. Manter o
                        nosso significava manter um formulário que envelhece a
                        cada meio novo — e ele envelheceu na primeira vez, no dia
                        em que o boleto foi habilitado na conta.

                        Quais meios aparecem é decisão da CONTA, não nossa. */}
                    <p className="tv-texto">
                      Cobrança automática, cancele quando quiser. Os dados são digitados num
                      campo do próprio Stripe — não passam pela Omnimob.
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
                      um quadro isolado, para que o número nunca passe pelo servidor da Omnimob.
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
                  {/* Sem ramo alternativo: quem chega até aqui já passou pela
                      guarda lá em cima, então é sempre o Administrador. */}
                  <button
                    type="button"
                    className="tv-btn tv-btn--primario"
                    onClick={assinar}
                    /* Um botão só. Qual meio a pessoa escolheu, e se os campos
                       dele estão completos, é o Payment Element que sabe — a
                       validação acontece no `elements.submit()`, com a mensagem
                       na língua e no campo certos. Duplicar essa checagem aqui
                       significava reimplementar a regra de cada meio. */
                    disabled={enviando || (stripeConfigurado() && !cartaoPronto)}
                  >
                    {enviando ? "Processando…" : "Confirmar assinatura"}
                  </button>
                </div>
              </>
            ) : null}

            {aguardandoAssinc ? (
              <div className="tv-festa">
                <span className="tv-eyebrow">● AGUARDANDO O PAGAMENTO</span>
                <h2 id="tv-titulo" className="tv-titulo">
                  {aguardandoAssinc.meio !== "boleto"
                    ? "Autorize no app do banco"
                    : aguardandoAssinc.guia
                      ? "Boleto gerado"
                      /* Sem guia não houve boleto, e dizer que houve foi
                         exatamente o que escondeu um defeito por dias. */
                      : "Cobrança criada"}
                </h2>
                {/* Deliberadamente NÃO diz "assinado". O cliente pode ter fechado
                    o app sem autorizar, e uma tela que comemora cedo demais faz
                    a pessoa parar de acompanhar justamente quando ainda falta o
                    passo dela. Quem confirma é o webhook. */}
                <p className="tv-texto">
                  {aguardandoAssinc.meio === "boleto"
                    ? "Pague o boleto no seu banco, aplicativo ou caixa eletrônico. A confirmação chega em até 1 dia útil e o plano segue liberado enquanto isso."
                    : "Abra o aplicativo do seu banco e autorize a cobrança recorrente da Omnimob. Assim que for aprovada, o plano é liberado sozinho — pode levar alguns minutos."}
                </p>
                {/* A guia em si. Sem este link a pessoa sai da tela sem o
                    boleto na mão e precisa procurá-lo no e-mail — que pode nem
                    estar habilitado na conta. */}
                <GuiaDoBoleto guia={aguardandoAssinc.guia} />
                <div className="tv-acoes">
                  <button type="button" className="tv-btn tv-btn--primario" onClick={() => window.location.reload()}>
                    Entendi
                  </button>
                </div>
              </div>
            ) : null}

            {passo === 4 && concluido ? (
              <div className="tv-festa">
                <span className="tv-festa__selo" aria-hidden="true"><IconeCheck size={26} /></span>
                <span className="tv-eyebrow tv-eyebrow--menta">● ASSINATURA CONFIRMADA</span>
                <h2 id="tv-titulo" className="tv-titulo">Bem-vindo à Omnimob de verdade</h2>
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
/* Guia do boleto: linha digitavel, PDF e pagina hospedada.
   (Sem crases neste comentario: template literal.) */
.tv-guia { display: flex; flex-direction: column; gap: 8px; }
.tv-guia__rotulo { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; }
.tv-guia__numero {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px; line-height: 1.6; word-break: break-all;
  padding: 10px 12px; border-radius: 8px;
  background: var(--sup-05, rgba(255,255,255,0.05)); border: 1px solid var(--linha-10, rgba(255,255,255,0.1));
}
.tv-guia__links { display: flex; gap: 14px; flex-wrap: wrap; font-size: 13px; }
.tv-guia__links a { color: #a5b4fc; }
.tv-guia__prazo { font-size: 12px; color: #94a3b8; }

/* Selo do rodape com cobranca esperando pagamento: ambar, entre o normal e o
   vencido. (Sem crases neste comentario: template literal.) */
.tv-botao.is-aguardando { border-color: rgba(245,158,11,0.4); color: #fbbf24; }
.tv-botao.is-aguardando .tv-ponto { background: #f59e0b; }
.tv-pendencia { display: flex; flex-direction: column; gap: 12px; }

/* Alternador de meio de pagamento e o campo de CPF/CNPJ do Pix.
   (Sem crases nestes comentarios: eles vivem dentro de um template literal.) */
.tv-meio { display: flex; padding: 3px; border-radius: 10px; margin-bottom: 4px; }
.tv-meio__op {
  width: auto; flex: 1; padding: 7px 14px; border-radius: 8px; border: none;
  background: transparent; color: #94a3b8; font-size: 13px; font-weight: 600;
  cursor: pointer; box-shadow: none; transform: none;
}
.tv-meio__op.is-on { background: var(--sup-10, rgba(255,255,255,0.1)); color: #f8fafc; }
.tv-meio__op:hover { transform: none; box-shadow: none; }
.tv-campo { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0; }
.tv-campo--curto { flex: 0 0 92px; }
.tv-linha { display: flex; gap: 10px; flex-wrap: wrap; }
.tv-campo span { font-size: 12px; font-weight: 600; color: #94a3b8; }
.tv-campo input {
  width: 100%; box-sizing: border-box; padding: 11px 14px; border-radius: 10px;
  background: var(--campo-fundo, rgba(255,255,255,0.04));
  border: 1px solid var(--campo-borda, rgba(255,255,255,0.12));
  color: inherit; font-size: 14px; font-family: inherit; outline: none;
}

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
  background: #141821; border: 1px solid var(--linha-10, rgba(255,255,255,0.10)); border-radius: 18px;
  padding: 28px 28px 24px;
  box-shadow: 0 30px 70px -24px rgba(0,0,0,0.9);
  font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
  animation: tvCaixa 0.36s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes tvCaixa {
  from { opacity: 0; transform: translateY(14px) scale(0.98); }
  to { opacity: 1; transform: none; }
}

/* O recado para quem não assina é mais curto que o fluxo: sem trilha de passos,
   sem lista de planos. A caixa acompanha — uma janela de 520px com quatro linhas
   de texto lê como algo que faltou carregar. */
.tv-caixa--recado { width: min(430px, 100%); }
.tv-caixa--recado .tv-eyebrow { margin-bottom: 10px; }
.tv-caixa--recado strong { color: #f1f5f9; font-weight: 700; }

.tv-passos { display: flex; gap: 5px; margin-bottom: 18px; }
.tv-passo {
  height: 3px; flex: 1; border-radius: 999px; background: var(--sup-10, rgba(255,255,255,0.10));
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
  background: var(--sup-03, rgba(255,255,255,0.03)); border: 1px solid var(--linha-09, rgba(255,255,255,0.09));
  font-family: inherit; box-shadow: none; transform: none;
  transition: border-color 0.18s ease, background 0.18s ease;
}
.tv-plano:hover { background: var(--sup-06, rgba(255,255,255,0.06)); border-color: var(--linha-18, rgba(255,255,255,0.18)); box-shadow: none; transform: none; }
.tv-plano.is-on { border-color: rgba(129,140,248,0.6); background: rgba(129,140,248,0.12); }
.tv-plano:active { scale: 1; }
.tv-plano__topo { display: flex; align-items: center; gap: 8px; }
.tv-plano__nome { font-size: 14px; font-weight: 700; color: #f1f5f9; }
.tv-plano__tag {
  font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 8px; letter-spacing: 0.1em;
  padding: 2px 7px; border-radius: 999px; color: #d4af37;
  background: rgba(212,175,55,0.12); border: 1px solid rgba(212,175,55,0.3);
}
.tv-plano__preco { font-size: 12.5px; font-weight: 600; color: #818cf8; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tv-plano__economia {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 8px; letter-spacing: 0.09em; text-transform: uppercase;
  padding: 2px 7px; border-radius: 999px; color: #34d399;
  background: rgba(52,211,153,0.12); border: 1px solid rgba(52,211,153,0.3);
}
.tv-plano__desc { font-size: 12px; line-height: 1.5; color: #64748b; }

/* A caixa do interruptor do Flow. O desenho vem do componente; aqui so o
   respiro ate o alternador de periodo, logo abaixo. */
.tv-pacote-caixa { margin-bottom: 12px; }

/* Alternador mensal / anual do passo 2. Dois botões dentro de uma cápsula, no
   mesmo desenho dos cartões de plano logo abaixo — é a mesma escolha, num grão
   mais fino. */
.tv-periodo {
  display: grid; grid-template-columns: 1fr 1fr; gap: 4px;
  padding: 4px; margin-bottom: 12px;
  border-radius: 999px;
  background: var(--sup-03, rgba(255,255,255,0.03)); border: 1px solid var(--linha-09, rgba(255,255,255,0.09));
}
.ds-shell .tv-periodo__opt, .tv-periodo__opt {
  padding: 7px 10px; border-radius: 999px; border: 0; cursor: pointer;
  font-family: inherit; font-size: 12.5px; font-weight: 600;
  background: transparent; color: #94a3b8;
  box-shadow: none; transform: none;
  transition: background 0.18s ease, color 0.18s ease;
}
.tv-periodo__opt:hover { background: var(--sup-05, rgba(255,255,255,0.05)); color: #f1f5f9; box-shadow: none; transform: none; }
.tv-periodo__opt.is-on { background: rgba(129,140,248,0.18); color: #c7d2fe; }
.tv-periodo__opt:active { scale: 1; }

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
  border: 1px solid var(--linha-09, rgba(255,255,255,0.09)); background: var(--sup-09, rgba(255,255,255,0.09));
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
  background: transparent; border: 1px solid var(--linha-14, rgba(255,255,255,0.14)); color: #cbd5e1;
  box-shadow: none; transform: none;
  transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}
.tv-btn:hover { background: var(--sup-07, rgba(255,255,255,0.07)); color: #f1f5f9; box-shadow: none; transform: none; }
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
