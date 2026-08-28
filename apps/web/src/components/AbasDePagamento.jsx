/* ── As abas de meio de pagamento ────────────────────────────────────────────

   Esta tira substitui as abas que o Payment Element desenhava sozinho, e a
   troca tem um motivo único: **o Pix do Mercado Pago não cabe lá dentro**. As
   abas do Stripe vivem dentro do iframe dele e listam o que a conta DELE cobra;
   um meio de outro provedor nunca vai aparecer ali.

   Havia um seletor nosso aqui antes, e ele foi removido de propósito — o
   comentário no `TrialAviso` conta: perguntávamos duas vezes a mesma coisa, e o
   nosso envelhecia a cada meio novo habilitado na conta. O que muda agora, e é
   o que torna a volta defensável:

     · a tira é montada a partir de `meios`, que vem do SERVIDOR lendo o que a
       conta consegue cobrar — não de uma lista escrita aqui. Ligar boleto no
       painel do Stripe faz a aba aparecer sem deploy, que era exatamente a
       propriedade que se perdia antes;
     · o Payment Element continua desenhando o FORMULÁRIO de cada meio, com os
       campos certos (o boleto pede documento e endereço; o cartão não) e
       traduzidos por eles. Só a ESCOLHA saiu de lá — restrito a um método, ele
       mostra o formulário direto, sem aba nenhuma.

   Ou seja: nós escolhemos, eles preenchem. Não há duas listas de meios, há uma,
   e ela é a da conta.
   ────────────────────────────────────────────────────────────────────────── */

const ROTULOS = {
  cartao: "Cartão",
  boleto: "Boleto",
  pix: "Pix",
};

/**
 * Quais abas mostrar, dado o que o servidor disse que a conta cobra.
 *
 * O Pix aqui é o do MERCADO PAGO (`pixMercadoPago`), e não o `pix` do Stripe —
 * que em conta brasileira significa Pix Automático e não funciona. Se um dia a
 * conta do Stripe ganhar Pix de verdade, esta função é o lugar de decidir qual
 * dos dois vale; a tela não precisa saber que existem dois.
 */
export function meiosOfertaveis(meios) {
  const lista = [];
  if (meios?.cartao !== false) lista.push("cartao");
  if (meios?.boleto) lista.push("boleto");
  if (meios?.pixMercadoPago) lista.push("pix");
  return lista;
}

/** A tira. Um grupo de rádio de verdade — as setas do teclado andam entre as
 *  opções sem nenhum código nosso, que é o que um `<div onClick>` perderia. */
export function AbasDePagamento({ meios, escolhido, aoEscolher, id = "meio" }) {
  const abas = meiosOfertaveis(meios);
  // Uma aba só não é uma escolha: some a tira e fica o formulário.
  if (abas.length < 2) return null;

  return (
    <div className="pgto-abas" role="radiogroup" aria-label="Forma de pagamento">
      {abas.map((meio) => (
        <label key={meio} className={`pgto-aba${escolhido === meio ? " is-on" : ""}`}>
          <input
            type="radio"
            name={`pgto-meio-${id}`}
            value={meio}
            checked={escolhido === meio}
            onChange={() => aoEscolher(meio)}
          />
          <span className="pgto-aba__icone" aria-hidden="true">
            {meio === "cartao" ? <IconeCartao /> : meio === "boleto" ? <IconeBoleto /> : <IconePix />}
          </span>
          {ROTULOS[meio]}
        </label>
      ))}
    </div>
  );
}

/* Ícones à mão, no traço da tela: são três, cada um com meia dúzia de
   comandos, e uma biblioteca inteira por causa deles não se paga. */
function IconeCartao() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="5" width="20" height="14" rx="2.5" />
      <path d="M2 10h20" />
    </svg>
  );
}

function IconeBoleto() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 5v14M6.5 5v14M9 5v14M13 5v14M16.5 5v14M21 5v14" strokeLinecap="round" />
    </svg>
  );
}

/* O losango do Pix, simplificado: quatro pontas a partir do centro. */
function IconePix() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3.2 20.8 12 12 20.8 3.2 12z" strokeLinejoin="round" />
      <path d="M8.4 8.4 12 12l3.6-3.6M8.4 15.6 12 12l3.6 3.6" strokeLinejoin="round" />
    </svg>
  );
}

/* ⚠ O PREFIXO `pgto-` foi escolhido a dedo, e o primeiro palpite custou uma
   caçada: as classes nasceram como `mp-abas`/`mp-aba`, e `mp-` já é do Modal do
   Perfil no `styles.css` global. As regras de lá — `width: 178px` e
   `border-right: 1px` — pegaram esta tira em cheio: os botões encolheram e
   apareceu uma listra vertical no meio, que não existia renderizando o
   componente sozinho.

   A folha global e as folhas injetadas por componente dividem UM namespace.
   Antes de inventar um prefixo, `grep` nele.

   Sem CRASE nenhuma nos comentarios daqui: isto e um template literal. */
export const ABAS_PAGAMENTO_CSS = `
.pgto-abas { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 10px; margin-bottom: 14px; }
.pgto-aba {
  display: flex; align-items: center; gap: 9px; cursor: pointer; user-select: none;
  padding: 13px 15px; border-radius: 12px; font-size: 13.5px; font-weight: 500;
  color: #94a3b8; background: rgba(148,163,184,0.06);
  border: 1px solid rgba(148,163,184,0.18);
  transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}
/* O input existe para o teclado e para o leitor de tela; quem desenha o estado
   e a etiqueta. Nada de display:none, que tiraria o foco junto. */
/* Preenchimento, borda e margem zerados porque a folha global estiliza o
   seletor input inteiro (largura total, preenchimento e borda) — e um radio
   invisivel com borda de 1px e exatamente o tipo de sobra que ja apareceu
   nesta tela. Nada de crase aqui: isto e um template literal. */
.pgto-aba input {
  position: absolute; opacity: 0; width: 0; height: 0;
  padding: 0; margin: 0; border: 0;
}
.pgto-aba:hover { color: #e2e8f0; }
.pgto-aba.is-on { background: #6366f1; border-color: #6366f1; color: #fff; }
.pgto-aba:focus-within { outline: 2px solid rgba(99,102,241,0.7); outline-offset: 2px; }
.pgto-aba__icone { display: inline-flex; }

/* No celular a linha de tres vira coluna: com 320px de largura, tres colunas
   cortam o rotulo no meio. */
@media (max-width: 420px) {
  .pgto-abas { grid-auto-flow: row; }
}
`;
