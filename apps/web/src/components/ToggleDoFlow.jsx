import { FLOW_ACENTO } from "../utils/modulos";

/* ────────────────────────────────────────────────────────────────────────────
   O INTERRUPTOR DO OMNIMOB FLOW — um só, para as QUATRO telas de pagamento.

   Ele aparece em:

     · a landing, na seção de planos          (visitante escolhendo o que assinar)
     · o painel, ao assinar o teste            (TrialAviso)
     · a parede de reativação                  (ContaSuspensaPage)
     · Configurações → Plano                   (quem já paga, contratando depois)

   ── POR QUE UM COMPONENTE, E NÃO QUATRO ──

   Porque quatro versões da mesma pergunta divergem, e aqui a divergência custa
   dinheiro: uma tela que diz "+R$ 50" e outra que diz "+R$ 49" numa mesma
   compra é motivo de estorno. Já eram duas versões diferentes deste controle
   (cartões na landing, cartões no TrialAviso) e a parede de reativação nem
   perguntava — quem voltava de uma conta suspensa perdia o Flow em silêncio.

   ── POR QUE UM SWITCH, E NÃO DOIS CARTÕES ──

   Duas opções lado a lado dizem "escolha um dos dois", e o cliente para para
   comparar. Mas não são duas coisas concorrentes: uma é a outra MAIS alguma
   coisa. O switch diz isso na forma — o padrão é o Hub, e ligar acrescenta.

   ── O CSS VIAJA COM ELE ──

   Escopado em `pkg-*` e injetado pelo próprio componente, como
   `PrimeiroAcessoModal` e `TrialAviso` já fazem. É o que permite ele funcionar
   dentro do `.dl-root` da landing (que tem reset próprio) e do `.ds-shell` do
   painel sem uma folha em cada lugar.

   As cores saem de uma cadeia de reserva — `var(--text-main, var(--strong,
   #f1f5f9))` — porque os dois mundos nomeiam os tokens de formas diferentes:
   o painel usa `--text-main`/`--text-muted`, a landing usa `--strong`/`--subtle`.
   Cravar um dos dois deixaria o texto ilegível no outro.
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * @param {boolean}  ligado        Hub + Flow marcado?
 * @param {function} aoAlternar    recebe o próximo booleano
 * @param {string}   [extra]       o quanto ele soma, já formatado ("+ R$ 50/mês")
 * @param {boolean}  [desabilitado]
 * @param {boolean}  [ocupado]     gravando — trava e avisa
 * @param {string}   [nota]        uma linha abaixo, para o caso de já estar ativo
 * @param {string}   [id]          quando há mais de um na mesma página
 */
export function ToggleDoFlow({
  ligado, aoAlternar, extra, desabilitado = false, ocupado = false, nota, id = "pkg-flow",
}) {
  return (
    <div className={`pkg-caixa${ligado ? " is-on" : ""}`} style={{ "--pkg-cor": FLOW_ACENTO }}>
      <style>{CSS}</style>

      {/* `<label>` envolvendo tudo: o rótulo inteiro vira área de clique, e o
          switch continua sendo um checkbox de verdade — foco, Espaço e leitor
          de tela funcionam sem nada nosso. */}
      <label className="pkg-linha" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          className="sw"
          checked={ligado}
          disabled={desabilitado || ocupado}
          onChange={(e) => aoAlternar(e.target.checked)}
        />
        <span className="pkg-texto">
          <span className="pkg-titulo">
            Incluir o <strong>Omnimob Flow</strong>
            {extra ? <span className="pkg-extra">{extra}</span> : null}
          </span>
          {/* A frase muda com o estado, e não é enfeite: desligado ela precisa
              VENDER (o que o módulo faz); ligado ela precisa CONFIRMAR (o que
              foi somado). O mesmo texto nos dois estados deixaria a pessoa sem
              saber se o clique surtiu efeito. */}
          <span className="pkg-desc">
            {ligado
              ? "Captação automática pelos portais, funil de negócios, minutas contratuais, assinatura digital e comissão."
              : "Você leva só o Hub: acervo, vitrine, leads, clientes e equipe."}
          </span>
        </span>
      </label>

      {ocupado ? <span className="pkg-nota">Salvando…</span> : nota ? <span className="pkg-nota">{nota}</span> : null}
    </div>
  );
}

/* Sem crases aqui dentro: este bloco é um template literal, e uma crase num
   comentário encerra a string no meio da folha — a peça inteira perde o estilo
   e nada no console diz por quê. Já aconteceu duas vezes neste projeto. */
const CSS = `
.pkg-caixa {
  border-radius: 14px;
  padding: 14px 16px;
  border: 1px solid var(--linha-10, var(--line, rgba(255,255,255,0.1)));
  background: var(--sup-03, var(--surface, rgba(255,255,255,0.03)));
  transition: border-color 0.18s ease, background 0.18s ease;
}
.pkg-caixa.is-on {
  border-color: color-mix(in srgb, var(--pkg-cor) 38%, transparent);
  background: color-mix(in srgb, var(--pkg-cor) 8%, transparent);
}
.pkg-linha { display: flex; align-items: flex-start; gap: 13px; cursor: pointer; margin: 0; }
.pkg-caixa input.sw:disabled { opacity: 0.5; cursor: not-allowed; }
/* O botao aceso na cor do modulo. --sw-aceso e a variavel que o switch do
   painel ja consome (styles.css), entao nao ha regra nova nem um segundo
   switch: e o mesmo componente, tingido. */
.pkg-caixa input.sw { --sw-aceso: var(--pkg-cor); }
.pkg-texto { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.pkg-titulo {
  display: flex; align-items: baseline; gap: 9px; flex-wrap: wrap;
  font-size: 14px; line-height: 1.3;
  color: var(--text-main, var(--strong, #f1f5f9));
}
.pkg-titulo strong { font-weight: 700; }
.pkg-extra {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10.5px; font-weight: 700; letter-spacing: 0.03em;
  padding: 2px 8px; border-radius: 999px; white-space: nowrap;
  color: var(--pkg-cor);
  background: color-mix(in srgb, var(--pkg-cor) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--pkg-cor) 32%, transparent);
}
.pkg-desc {
  font-size: 12.5px; line-height: 1.55;
  color: var(--text-muted, var(--subtle, #94a3b8));
}
.pkg-nota {
  display: block; margin-top: 9px; padding-top: 9px;
  border-top: 1px solid var(--linha-08, var(--line, rgba(255,255,255,0.08)));
  font-size: 11.5px; line-height: 1.5;
  color: var(--text-muted, var(--subtle, #94a3b8));
}
`;
