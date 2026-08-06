import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { formatPhone } from "../utils/masks";
import { MODAL_CSS } from "./modalCSS";
import { carregarStripe, stripeConfigurado, APARENCIA_STRIPE } from "../utils/stripe";

/* ────────────────────────────────────────────────────────────────────────────
   Modal de interesse comercial da landing.

   Abre por dois caminhos: "Quero este plano" (já com o plano escolhido) e
   "Assinar Domus" no CTA final (sem plano).

   Com o provedor de pagamento ligado, o modal cobra de verdade: dados → cartão
   → conta criada. Sem provedor, vira formulário de interesse e o time assume.
   A página inteira empurra o teste grátis antes; quem chega aqui é quem já
   decidiu, e obrigá-lo a testar seria atrito à toa.

   Recebe os planos prontos por prop (`planos`) em vez de montá-los aqui: a
   landing já deriva nome, preço e linhas de recursos de utils/planos.js, e
   duplicar essa derivação seria uma segunda fonte de verdade fadada a divergir.
   ──────────────────────────────────────────────────────────────────────────── */

const VAZIO = { plano: "", imobiliaria: "", email: "", telefone: "", temWhatsapp: false, website: "" };

function validar(form) {
  const erros = {};
  if (!form.plano) erros.plano = "Escolha um plano.";
  if (form.imobiliaria.trim().length < 2) erros.imobiliaria = "Informe o nome da imobiliária.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) erros.email = "E-mail inválido.";
  if (form.telefone.replace(/\D/g, "").length < 10) erros.telefone = "Telefone incompleto, com DDD.";
  return erros;
}

export function PlanoModal({ aberto, planoInicial = "", planos, aoFechar }) {
  const [form, setForm] = useState(VAZIO);
  const [erros, setErros] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null); // interesse | pago | trial
  const [acesso, setAcesso] = useState(null);   // credenciais devolvidas ao pagar
  const [falha, setFalha] = useState("");
  const [passo, setPasso] = useState(1); // 1 = dados · 2 = convite ao teste · 3 = cartão
  const [cienteDoTeste, setCienteDoTeste] = useState(false);
  const [cartaoPronto, setCartaoPronto] = useState(false);
  const caixaRef = useRef(null);
  const primeiroRef = useRef(null);
  const cartaoRef = useRef(null);
  const elementsRef = useRef(null);
  const stripeRef = useRef(null);

  // Cada abertura recomeça do zero, já com o plano de quem chamou.
  useEffect(() => {
    if (!aberto) return;
    setForm({ ...VAZIO, plano: planoInicial || "" });
    setErros({});
    setResultado(null);
    setAcesso(null);
    setFalha("");
    setEnviando(false);
    setPasso(1);
    setCienteDoTeste(false);
  }, [aberto, planoInicial]);

  // Trava a rolagem do fundo e devolve o foco para dentro do modal.
  useEffect(() => {
    if (!aberto) return undefined;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const foco = setTimeout(() => primeiroRef.current?.focus(), 60);
    return () => {
      document.body.style.overflow = anterior;
      clearTimeout(foco);
    };
  }, [aberto]);

  // Esc fecha; Tab circula dentro do modal (senão o foco escapa para a página
  // atrás, que continua ali inteira embaixo do véu).
  useEffect(() => {
    if (!aberto) return undefined;
    function aoTeclar(evento) {
      if (evento.key === "Escape") {
        aoFechar();
        return;
      }
      if (evento.key !== "Tab") return;
      const alvos = caixaRef.current?.querySelectorAll(
        "button, input, select, [href], [tabindex]:not([tabindex='-1'])",
      );
      if (!alvos?.length) return;
      const primeiro = alvos[0];
      const ultimo = alvos[alvos.length - 1];
      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto, aoFechar]);

  /* Mesmo arranjo do painel: o cartão vive num iframe do Stripe, então o número
     não passa por esta página nem pela nossa API. */
  useEffect(() => {
    if (!aberto || passo !== 3 || !stripeConfigurado()) return undefined;
    const valor = planos.find((p) => p.key === form.plano)?.valor;
    if (valor == null) {
      setFalha("Não consegui ler o valor do plano.");
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
          amount: Math.round(valor * 100),
          paymentMethodCreation: "manual",
          appearance: APARENCIA_STRIPE,
        });
        elemento = elements.create("payment", { layout: "tabs" });
        elemento.mount(cartaoRef.current);
        elemento.on("ready", () => vivo && setCartaoPronto(true));
        elementsRef.current = elements;
      })
      .catch((e) => vivo && setFalha(e.message));
    return () => {
      vivo = false;
      if (elemento) elemento.destroy();
      elementsRef.current = null;
    };
  }, [aberto, passo, form.plano, planos]);

  if (!aberto) return null;

  const escolhido = planos.find((p) => p.key === form.plano) || null;
  // Só cobra se o provedor estiver ligado E o plano tiver preço vivo; senão o
  // fluxo degrada para interesse, e o time fecha na mão.
  const podeCobrar = stripeConfigurado() && escolhido?.valor != null;

  function definir(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErros((e) => (e[campo] ? { ...e, [campo]: undefined } : e));
  }

  async function enviar(evento) {
    evento.preventDefault();
    const achados = validar(form);
    setErros(achados);
    if (Object.keys(achados).length) return;

    // Com cobrança ligada, os dados são só o primeiro passo: o cartão vem depois.
    if (podeCobrar) {
      setFalha("");
      setPasso(2);
      return;
    }

    setEnviando(true);
    setFalha("");
    try {
      await api.enviarInteresseDomus({
        imobiliaria: form.imobiliaria.trim(),
        email: form.email.trim(),
        telefone: form.telefone.trim(),
        plano: form.plano,
        temWhatsapp: form.temWhatsapp,
        website: form.website,
      });
      setResultado("interesse");
    } catch (erro) {
      setFalha(erro.message || "Não foi possível enviar agora.");
    } finally {
      setEnviando(false);
    }
  }

  /* Reaproveita o que a pessoa já digitou e entra no mesmo fluxo de teste da
     landing — link mágico por e-mail, nada de cartão. Sem formulário novo:
     pedir os mesmos dados de novo aqui só faria gente desistir. */
  async function testarGratis() {
    setEnviando(true);
    setFalha("");
    try {
      await api.criarTrialDomus({
        imobiliaria: form.imobiliaria.trim(),
        email: form.email.trim(),
        telefone: form.telefone.trim(),
        website: form.website,
      });
      setResultado("trial");
    } catch (erro) {
      setFalha(erro.message || "Não foi possível criar o teste agora.");
    } finally {
      setEnviando(false);
    }
  }

  async function pagar() {
    setEnviando(true);
    setFalha("");
    try {
      if (!elementsRef.current) throw new Error("O formulário de cartão ainda não carregou.");
      await elementsRef.current.submit();
      const { error, paymentMethod } = await stripeRef.current.createPaymentMethod({
        elements: elementsRef.current,
      });
      if (error) throw new Error(error.message || "Não foi possível validar o cartão.");

      const resposta = await api.assinarDireto({
        imobiliaria: form.imobiliaria.trim(),
        email: form.email.trim(),
        telefone: form.telefone.trim(),
        plano: form.plano,
        temWhatsapp: form.temWhatsapp,
        tokenPagamento: paymentMethod.id,
        website: form.website,
      });
      setAcesso(resposta);
      setResultado("pago");
    } catch (erro) {
      setFalha(erro.message || "Não foi possível concluir a assinatura.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="pm-veu" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <style>{CSS}</style>
      <div
        className="pm-caixa dl-glass"
        ref={caixaRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pm-titulo"
      >
        <button type="button" className="pm-fechar" onClick={aoFechar} aria-label="Fechar">
          ✕
        </button>

        {resultado ? (
          <div className="pm-feito">
            <span className="pm-feito__marca" aria-hidden="true">✓</span>
            <h2 id="pm-titulo" className="pm-titulo">
              {resultado === "pago"
                ? "Pagamento confirmado"
                : resultado === "trial"
                  ? "Confira seu e-mail"
                  : "Recebemos seu interesse"}
            </h2>
            <p className="pm-sub">
              {resultado === "pago" ? (
                acesso?.emailEntregue === false ? (
                  <>
                    A conta da {form.imobiliaria} está ativa, mas <strong>não conseguimos entregar
                    o e-mail</strong> em {form.email}. Confira o endereço — e use o acesso abaixo
                    para entrar agora.
                  </>
                ) : (
                  <>
                    A conta da {form.imobiliaria} já está ativa. Mandamos para{" "}
                    <strong>{form.email}</strong> o link de acesso — e o usuário e senha estão logo
                    abaixo, para você entrar agora mesmo.
                  </>
                )
              ) : resultado === "trial" ? (
                <>
                  Mandamos um link de confirmação para <strong>{form.email}</strong>. Abrir esse link
                  cria o ambiente de teste da {form.imobiliaria} na hora, com 14 dias grátis.
                </>
              ) : (
                <>
                  Vamos responder no e-mail <strong>{form.email}</strong> em até um dia útil, com os
                  próximos passos para colocar a {form.imobiliaria} no ar.
                </>
              )}
            </p>
            {resultado === "pago" && acesso?.login ? (
              <div className="pm-acesso">
                <div className="pm-acesso__linha">
                  <span className="dl-mono pm-acesso__chave">USUÁRIO</span>
                  <code>{acesso.login}</code>
                </div>
                <div className="pm-acesso__linha">
                  <span className="dl-mono pm-acesso__chave">SENHA</span>
                  <code>{acesso.senha}</code>
                </div>
                <div className="pm-acesso__linha">
                  <span className="dl-mono pm-acesso__chave">VITRINE</span>
                  <code>/vitrine/{acesso.slug}</code>
                </div>
              </div>
            ) : null}

            {resultado === "pago" ? (
              <p className="pm-sub pm-sub--aviso">
                Anote a senha antes de fechar — ela não aparece de novo. No primeiro acesso vamos
                pedir que você troque.
              </p>
            ) : null}

            <div className="pm-acoes pm-acoes--centro">
              {resultado === "pago" ? (
                <a className="pm-botao pm-botao--primario" href="/login">
                  Entrar no painel
                </a>
              ) : (
                <button type="button" className="pm-botao pm-botao--primario" onClick={aoFechar}>
                  Fechar
                </button>
              )}
            </div>
          </div>
        ) : passo === 2 ? (
          <>
            <span className="dl-mono pm-eyebrow pm-eyebrow--teste">● ANTES DE PAGAR</span>
            <h2 id="pm-titulo" className="pm-titulo">Que tal testar de graça primeiro?</h2>
            <p className="pm-sub">
              Você tem <strong>14 dias grátis</strong> para usar a plataforma inteira, sem cartão e
              sem compromisso. É tempo de sobra para cadastrar seus imóveis, montar a vitrine e ver
              se a Domus serve para a sua rotina.
            </p>

            <div className="pm-resumo">
              <ul className="pm-resumo__lista">
                <li>Nada do que você fizer no teste se perde ao assinar depois</li>
                <li>O mesmo ambiente continua — só deixa de ser teste</li>
                <li>Sem cartão agora, e sem cobrança automática ao fim do prazo</li>
                <li>Se decidir assinar antes dos 14 dias, é um clique dentro do painel</li>
              </ul>
            </div>

            <button
              type="button"
              className={`pm-toggle${cienteDoTeste ? " is-on" : ""}`}
              onClick={() => setCienteDoTeste((v) => !v)}
              aria-pressed={cienteDoTeste}
            >
              <span className="pm-toggle__trilho" aria-hidden="true">
                <span className="pm-toggle__bola" />
              </span>
              Estou ciente e quero assinar mesmo assim
            </button>

            {falha ? <p className="pm-falha">{falha}</p> : null}

            <div className="pm-acoes pm-acoes--tres">
              <button type="button" className="pm-botao" onClick={() => setPasso(1)} disabled={enviando}>
                Voltar
              </button>
              <button
                type="button"
                className="pm-botao pm-botao--teste"
                onClick={testarGratis}
                disabled={enviando}
              >
                {enviando ? "Criando…" : "Testar grátis"}
              </button>
              <button
                type="button"
                className="pm-botao pm-botao--primario"
                disabled={!cienteDoTeste || enviando}
                onClick={() => setPasso(3)}
              >
                Continuar para o pagamento
              </button>
            </div>
          </>
        ) : passo === 3 ? (
          <>
            <span className="dl-mono pm-eyebrow">● PAGAMENTO</span>
            <h2 id="pm-titulo" className="pm-titulo">Dados do cartão</h2>
            <p className="pm-sub">
              {escolhido?.name} · {escolhido?.price}{escolhido?.per}. Cobrança mensal, cancele
              quando quiser. O cartão é digitado num campo do próprio Stripe.
            </p>

            <div className="pm-cartao" ref={cartaoRef} />
            {!cartaoPronto && !falha ? (
              <p className="pm-sub">Carregando o campo seguro…</p>
            ) : null}
            {falha ? <p className="pm-falha">{falha}</p> : null}

            <div className="pm-acoes">
              <button type="button" className="pm-botao" onClick={() => setPasso(2)} disabled={enviando}>
                Voltar
              </button>
              <button
                type="button"
                className="pm-botao pm-botao--primario"
                onClick={pagar}
                disabled={enviando || !cartaoPronto}
              >
                {enviando ? "Processando…" : "Assinar agora"}
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="dl-mono pm-eyebrow">● COMEÇAR COM A DOMUS</span>
            <h2 id="pm-titulo" className="pm-titulo">Vamos colocar sua imobiliária no ar.</h2>
            <p className="pm-sub">
              Conte quem é você e qual plano faz sentido. A gente responde com os próximos passos.
            </p>

            <form className="pm-form" onSubmit={enviar} noValidate>
              <label className="pm-campo">
                <span className="pm-rotulo">Plano</span>
                <select
                  ref={primeiroRef}
                  className={`pm-entrada${erros.plano ? " is-erro" : ""}`}
                  value={form.plano}
                  onChange={(e) => definir("plano", e.target.value)}
                >
                  <option value="">Escolha um plano…</option>
                  {planos.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.name} — {p.price}{p.per}
                    </option>
                  ))}
                </select>
                {erros.plano ? <span className="pm-erro">{erros.plano}</span> : null}
              </label>

              {/* Lembrete do que o plano entrega: quem chega pelo CTA final não
                  passou pela tabela, e quem passou já rolou para longe dela. */}
              {escolhido ? (
                <div className="pm-resumo">
                  <p className="pm-resumo__desc">{escolhido.desc}</p>
                  <ul className="pm-resumo__lista">
                    {escolhido.linhas
                      .filter((l) => l.incluso)
                      .map((l) => (
                        <li key={l.label}>{l.label}</li>
                      ))}
                  </ul>
                  <span className="dl-mono pm-resumo__nota">{escolhido.nota}</span>
                </div>
              ) : null}

              <label className="pm-campo">
                <span className="pm-rotulo">Nome da imobiliária</span>
                <input
                  className={`pm-entrada${erros.imobiliaria ? " is-erro" : ""}`}
                  value={form.imobiliaria}
                  onChange={(e) => definir("imobiliaria", e.target.value)}
                  placeholder="Imobiliária Centro"
                  autoComplete="organization"
                />
                {erros.imobiliaria ? <span className="pm-erro">{erros.imobiliaria}</span> : null}
              </label>

              <div className="pm-dupla">
                <label className="pm-campo">
                  <span className="pm-rotulo">E-mail</span>
                  <input
                    type="email"
                    className={`pm-entrada${erros.email ? " is-erro" : ""}`}
                    value={form.email}
                    onChange={(e) => definir("email", e.target.value)}
                    placeholder="voce@imobiliaria.com.br"
                    autoComplete="email"
                  />
                  {erros.email ? <span className="pm-erro">{erros.email}</span> : null}
                </label>

                <label className="pm-campo">
                  <span className="pm-rotulo">Telefone</span>
                  <input
                    inputMode="tel"
                    className={`pm-entrada${erros.telefone ? " is-erro" : ""}`}
                    value={form.telefone}
                    onChange={(e) => definir("telefone", formatPhone(e.target.value))}
                    placeholder="(11) 99999-9999"
                    autoComplete="tel"
                  />
                  {erros.telefone ? <span className="pm-erro">{erros.telefone}</span> : null}
                </label>
              </div>

              <button
                type="button"
                className={`pm-toggle${form.temWhatsapp ? " is-on" : ""}`}
                onClick={() => definir("temWhatsapp", !form.temWhatsapp)}
                aria-pressed={form.temWhatsapp}
              >
                <span className="pm-toggle__trilho" aria-hidden="true">
                  <span className="pm-toggle__bola" />
                </span>
                Esse número tem WhatsApp
              </button>

              {/* Isca para robô: fora da tela e fora da ordem de tabulação. */}
              <input
                className="pm-isca"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={form.website}
                onChange={(e) => definir("website", e.target.value)}
              />

              {falha ? <p className="pm-falha">{falha}</p> : null}

              <div className="pm-acoes">
                <button type="button" className="pm-botao" onClick={aoFechar}>
                  Cancelar
                </button>
                <button type="submit" className="pm-botao pm-botao--primario" disabled={enviando}>
                  {enviando ? "Enviando…" : podeCobrar ? "Próximo" : "Enviar interesse"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

const CSS = `${MODAL_CSS}
.pm-cartao { margin: 4px 0 16px; min-height: 60px; }
.pm-eyebrow--teste { color: var(--mint); }
.pm-acoes--tres { flex-wrap: wrap; }
.pm-acoes--centro { justify-content: center; }
.pm-acesso { width: 100%; margin: 4px 0 14px; display: grid; gap: 1px; border-radius: 12px; overflow: hidden; border: 1px solid var(--line); background: var(--line); }
.pm-acesso__linha { display: grid; grid-template-columns: 84px 1fr; gap: 12px; align-items: center; padding: 10px 13px; background: var(--surface); text-align: left; }
.pm-acesso__chave { color: var(--placeholder); font-size: 8.5px; }
.pm-acesso code { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 12.5px; color: var(--strong); word-break: break-all; }
.pm-sub--aviso { font-size: 12px; padding: 9px 12px; border-radius: 10px; background: rgba(212,175,55,0.09); border: 1px solid rgba(212,175,55,0.24); }
.dl-root .pm-botao--teste { border-color: rgba(20,184,166,0.45); color: var(--mint); }
.dl-root .pm-botao--teste:hover { background: rgba(20,184,166,0.12); color: var(--mint); }
.pm-resumo + .pm-toggle { margin-bottom: 4px; }`;


export default PlanoModal;
