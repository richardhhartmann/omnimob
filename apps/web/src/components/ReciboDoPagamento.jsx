import { Printer, X } from "@phosphor-icons/react";

/* ── O comprovante ───────────────────────────────────────────────────────────

   Emitido por NÓS, e não linkado do provedor. A razão é concreta: o Mercado
   Pago não tem página de comprovante para Pix — o `ticket_url` dele é a tela do
   QR, e depois de pago ela diz apenas "Este pagamento já foi realizado". Um
   botão chamado "Recibo" que abre isso é pior do que não ter botão.

   No Stripe existe recibo de verdade (`hosted_invoice_url`), e o link para lá
   continua aparecendo ao lado deste. São coisas diferentes e as duas cabem: uma
   é o documento de quem processou, a outra é o que a Omnimob declara ter
   recebido.

   ── O QUE ELE NÃO É ──
   Não é nota fiscal, e o texto diz isso na cara. A Omnimob não emite NF hoje;
   deixar a dúvida no ar geraria um chamado por cliente, e o chamado chegaria ao
   contador da imobiliária, não a nós.

   ── IMPRESSÃO ──
   `window.print()` com uma folha que esconde o resto da página. Nada de gerar
   PDF no navegador: uma biblioteca inteira para produzir o que o próprio
   sistema operacional já produz — inclusive "salvar como PDF" — não se paga.
   ────────────────────────────────────────────────────────────────────────── */

const NOME_MEIO = {
  cartao: "Cartão de crédito",
  boleto: "Boleto bancário",
  pix: "Pix",
  manual: "Liberado pela equipe Omnimob",
};

const NOME_PROVEDOR = {
  STRIPE: "Stripe",
  MERCADO_PAGO: "Mercado Pago",
  MANUAL: "Omnimob",
};

const dinheiro = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const dataLonga = (v) =>
  v ? new Date(v).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "—";

const dataCurta = (v) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");

/* Documento formatado só quando dá para formatar. Um CNPJ pela metade sai como
   foi digitado — inventar máscara em cima de dado incompleto produz um número
   que parece oficial e não é. */
function documento(bruto) {
  const d = String(bruto || "").replace(/\D/g, "");
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return bruto || null;
}

export function ReciboDoPagamento({ pagamento, imobiliaria, planoNome, aoFechar }) {
  if (!pagamento) return null;

  const periodo = pagamento.periodo === "anual" ? "12 meses" : pagamento.periodo === "mensal" ? "1 mês" : null;

  return (
    <div className="rcb-veu" onMouseDown={(e) => e.target === e.currentTarget && aoFechar?.()}>
      <style>{RECIBO_CSS}</style>

      <div className="rcb-caixa" role="dialog" aria-modal="true" aria-labelledby="rcb-titulo">
        {/* A folha. É só ela que sai na impressão — ver o @media print. */}
        <div className="rcb-folha">
          <div className="rcb-topo">
            <span className="rcb-marca">OMNIMOB</span>
            <span className="rcb-numero">
              {/* O id da transação é o número do recibo. Não inventamos uma
                  numeração própria: ela pareceria fiscal, e é justamente o que
                  este documento não é. */}
              {pagamento.externoId ? `Transação ${pagamento.externoId}` : `Registro ${pagamento.id.slice(-8)}`}
            </span>
          </div>

          <h2 id="rcb-titulo" className="rcb-titulo">Recibo de pagamento</h2>
          <p className="rcb-valor">{dinheiro(pagamento.valor)}</p>
          <p className="rcb-data">Pago em {dataLonga(pagamento.pagoEm)}</p>

          <dl className="rcb-lista">
            <div>
              <dt>Recebemos de</dt>
              <dd>
                {imobiliaria?.nome || "—"}
                {imobiliaria?.documento ? (
                  <span className="rcb-sub">{documento(imobiliaria.documento)}</span>
                ) : null}
              </dd>
            </div>

            <div>
              <dt>Referente a</dt>
              <dd>
                Assinatura Omnimob{planoNome ? ` — plano ${planoNome}` : ""}
                {periodo ? <span className="rcb-sub">{periodo}</span> : null}
              </dd>
            </div>

            {pagamento.cobreAte ? (
              <div>
                <dt>Período coberto</dt>
                <dd>
                  {pagamento.cobreDe ? `${dataCurta(pagamento.cobreDe)} a ` : "até "}
                  {dataCurta(pagamento.cobreAte)}
                </dd>
              </div>
            ) : null}

            <div>
              <dt>Forma de pagamento</dt>
              <dd>
                {NOME_MEIO[pagamento.meio] || "Cobrança"}
                <span className="rcb-sub">
                  processado por {NOME_PROVEDOR[pagamento.provedor] || pagamento.provedor}
                </span>
              </dd>
            </div>

            {pagamento.descricao ? (
              <div>
                <dt>Observação</dt>
                <dd>{pagamento.descricao}</dd>
              </div>
            ) : null}
          </dl>

          <p className="rcb-nota">
            Este documento comprova o pagamento acima e <strong>não é nota fiscal</strong>.
            A Omnimob não emite NF-e no momento; se a sua contabilidade precisar de uma,
            responda o e-mail da cobrança que a gente resolve.
          </p>
        </div>

        <div className="rcb-acoes">
          <button type="button" className="rcb-btn" onClick={aoFechar}>
            <X size={14} /> Fechar
          </button>
          <button type="button" className="rcb-btn rcb-btn--primario" onClick={() => window.print()}>
            <Printer size={14} /> Imprimir ou salvar em PDF
          </button>
        </div>
      </div>
    </div>
  );
}

/* Sem CRASE nenhuma nos comentarios daqui: isto e um template literal.
   Prefixo `rcb-` conferido contra o styles.css global antes de existir — a
   colisao de prefixo ja custou uma cacada nesta base. */
export const RECIBO_CSS = `
.rcb-veu {
  position: fixed; inset: 0; z-index: 1200;
  background: rgba(0,0,0,0.72); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.rcb-caixa {
  width: 100%; max-width: 480px; max-height: 92vh; overflow-y: auto;
  display: flex; flex-direction: column; gap: 14px;
}
/* Fundo claro FIXO, e nao a paleta do painel: este bloco existe para sair na
   impressora. Papel e branco, e um recibo escuro gasta meia tinta por copia. */
.rcb-folha {
  background: #fff; color: #0f172a; border-radius: 16px; padding: 28px 30px;
  box-shadow: 0 40px 90px -30px rgba(0,0,0,0.8);
}
.rcb-topo {
  display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
  padding-bottom: 14px; border-bottom: 1px solid #e2e8f0;
}
.rcb-marca { font-size: 12px; font-weight: 800; letter-spacing: 0.22em; color: #6366f1; }
.rcb-numero { font-size: 10.5px; color: #64748b; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.rcb-titulo { margin: 18px 0 2px; font-size: 15px; font-weight: 700; color: #0f172a; }
.rcb-valor { margin: 0; font-size: 30px; font-weight: 800; letter-spacing: -0.03em; color: #0f172a; }
.rcb-data { margin: 4px 0 20px; font-size: 12.5px; color: #64748b; }
.rcb-lista { display: grid; gap: 13px; margin: 0; padding: 18px 0 0; border-top: 1px solid #e2e8f0; }
.rcb-lista dt { font-size: 10px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: #94a3b8; }
.rcb-lista dd { margin: 3px 0 0; font-size: 13px; color: #0f172a; line-height: 1.5; }
.rcb-sub { display: block; font-size: 11.5px; color: #64748b; margin-top: 2px; }
.rcb-nota {
  margin: 20px 0 0; padding-top: 14px; border-top: 1px solid #e2e8f0;
  font-size: 11px; line-height: 1.6; color: #64748b;
}
.rcb-acoes { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; }
/* Largura automatica e sem crescer no flex, porque a folha global estica botao
   para a largura toda — sem isto os dois empilham, cada um numa linha, e a
   caixa deixa de parecer um dialogo e vira um formulario.
   (Sem CRASE aqui: template literal.) */
.rcb-btn {
  width: auto; flex: 0 0 auto;
  display: inline-flex; align-items: center; gap: 7px; cursor: pointer;
  box-shadow: none; transform: none;
  padding: 10px 16px; border-radius: 10px; font: inherit; font-size: 13px; font-weight: 600;
  background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.16); color: #f8fafc;
}
.rcb-btn:hover { background: rgba(255,255,255,0.14); }
.rcb-btn--primario { background: #6366f1; border-color: #6366f1; color: #fff; }
.rcb-btn--primario:hover { background: #4f46e5; }

/* ── A impressao ────────────────────────────────────────────────────────────
   Some com a pagina inteira e deixa so a folha, no fluxo normal do documento —
   e nao dentro de um veu com position:fixed, que a impressora corta na primeira
   pagina. */
@media print {
  body > *:not(.rcb-veu) { display: none !important; }
  .rcb-veu {
    position: static; background: none; backdrop-filter: none; padding: 0; display: block;
  }
  .rcb-caixa { max-width: none; max-height: none; overflow: visible; }
  .rcb-folha { box-shadow: none; border-radius: 0; padding: 0; }
  .rcb-acoes { display: none !important; }
}
`;
