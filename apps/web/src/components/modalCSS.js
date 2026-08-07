/* Folha comum das telas de entrada: o TrialModal da landing e a
   TrialConfirmarPage, destino do link do e-mail.

   Fica em módulo próprio porque o modal só existe no DOM quando está aberto —
   se as regras morassem dentro dele, a página de confirmação, que reaproveita
   as mesmas peças (.pm-caixa, .pm-titulo, .pm-botao), abriria sem estilo. */

export const MODAL_CSS = `
.pm-veu {
  position: fixed; inset: 0; z-index: 3000;
  display: grid; place-items: center; padding: 24px;
  background: rgba(5,5,7,0.72);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  animation: pmVeu 0.25s ease both;
  overflow-y: auto;
}
@keyframes pmVeu { from { opacity: 0; } to { opacity: 1; } }

.pm-caixa {
  position: relative; width: min(560px, 100%);
  border-radius: 22px; padding: 34px 34px 30px;
  max-height: calc(100vh - 48px); overflow-y: auto;
  animation: pmCaixa 0.42s cubic-bezier(0.16, 1, 0.3, 1) both;
}
@keyframes pmCaixa {
  from { opacity: 0; transform: translateY(18px) scale(0.97); }
  to { opacity: 1; transform: none; }
}

.pm-fechar {
  position: absolute; top: 16px; right: 16px; width: 30px; height: 30px;
  display: grid; place-items: center; padding: 0;
  border: 1px solid var(--line); border-radius: 9px; background: rgba(255,255,255,0.04);
  color: var(--subtle); font-size: 12px; cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease;
}
.pm-fechar:hover { color: var(--strong); background: rgba(255,255,255,0.09); }

.pm-eyebrow { display: block; color: var(--gold); margin-bottom: 14px; }
.pm-titulo {
  font-size: clamp(21px, 2.6vw, 26px); font-weight: 700; letter-spacing: -0.03em;
  color: var(--strong); line-height: 1.2;
}
.pm-sub { margin-top: 10px; font-size: 13.5px; line-height: 1.7; color: var(--subtle); }

.pm-form { display: grid; gap: 15px; margin-top: 24px; }
/* min-width: 0 em tudo que é item de grade aqui.
   Item de grade nasce com min-width: auto, que é o tamanho MÍNIMO do conteúdo
   — e basta um texto que não quebra (o endereço da vitrine, que é uma linha só
   de 300px) para a coluna inteira esticar além da caixa e todo o formulário
   vazar para fora do modal. Foi o que aconteceu no celular. */
.pm-form, .pm-form > *, .pm-dupla > *, .pm-campo > * { min-width: 0; }
.pm-dupla { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
.pm-campo { display: grid; gap: 6px; }
.pm-rotulo { font-size: 11.5px; font-weight: 600; color: var(--subtle); }

/* O styles.css global estiliza input/select para o painel (fundo claro, largura
   cheia). Aqui o modal é escuro, então a aparência é redefinida por completo. */
.dl-root .pm-entrada {
  width: 100%; padding: 11px 13px; border-radius: 11px;
  border: 1px solid var(--line); background: rgba(255,255,255,0.04);
  color: var(--strong); font-size: 13.5px; font-family: inherit;
  transition: border-color 0.2s ease, background 0.2s ease;
}
.dl-root .pm-entrada:focus {
  outline: none; border-color: var(--accent-soft); background: rgba(255,255,255,0.07);
}
.dl-root .pm-entrada.is-erro { border-color: #f87171; }
.dl-root .pm-entrada::placeholder { color: var(--placeholder); }
/* A lista nativa do select herda o tema do sistema; sem isto as opções saem
   com texto branco sobre fundo branco em boa parte dos navegadores. */
.dl-root .pm-entrada option { background: #141416; color: #e8e8ee; }
.pm-erro { font-size: 11.5px; color: #f87171; }

.pm-resumo {
  border-radius: 13px; padding: 14px 16px;
  background: rgba(99,102,241,0.09); border: 1px solid rgba(99,102,241,0.22);
  animation: pmResumo 0.3s var(--ease-out) both;
}
@keyframes pmResumo {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: none; }
}
.pm-resumo__desc { font-size: 12.5px; line-height: 1.65; color: var(--default); }
.pm-resumo__lista { display: grid; gap: 5px; margin-top: 10px; }
/* A margem acima só existe para afastar a lista da descrição do plano. Quando
   a lista é o primeiro filho da caixa (o convite ao teste, que não tem
   descrição), ela virava um vão morto encostado na borda de cima. */
.pm-resumo__lista:first-child { margin-top: 0; }
.pm-resumo__lista li {
  font-size: 12px; color: var(--subtle); padding-left: 17px; position: relative; line-height: 1.5;
}
.pm-resumo__lista li::before {
  color: var(--mint); content: ""; position: absolute; left: 0; top: 0.36em; width: 11px; height: 11px; background-color: currentColor; -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='4 12.5 9.5 18 20 6.5'/%3E%3C/svg%3E") center / contain no-repeat; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='4 12.5 9.5 18 20 6.5'/%3E%3C/svg%3E") center / contain no-repeat;
}
.pm-resumo__nota { display: block; margin-top: 11px; color: var(--placeholder); font-size: 8.5px; }

.dl-root .pm-toggle {
  display: inline-flex; align-items: center; gap: 11px; width: auto;
  padding: 0; border: none; background: none; box-shadow: none;
  font-size: 13px; font-weight: 500; color: var(--subtle); cursor: pointer;
  justify-content: flex-start; transition: color 0.2s ease;
}
.dl-root .pm-toggle:hover { color: var(--default); background: none; transform: none; box-shadow: none; }
.dl-root .pm-toggle:active { scale: 1; }
.pm-toggle__trilho {
  width: 40px; height: 22px; border-radius: 999px; flex: 0 0 auto;
  background: rgba(255,255,255,0.10); border: 1px solid var(--line);
  display: flex; align-items: center; padding: 2px;
  transition: background 0.28s var(--ease-out), border-color 0.28s var(--ease-out);
}
.pm-toggle__bola {
  width: 16px; height: 16px; border-radius: 999px; background: var(--placeholder);
  transition: transform 0.28s var(--ease-out), background 0.28s var(--ease-out);
}
.dl-root .pm-toggle.is-on { color: var(--strong); }
.pm-toggle.is-on .pm-toggle__trilho { background: rgba(20,184,166,0.26); border-color: rgba(20,184,166,0.5); }
.pm-toggle.is-on .pm-toggle__bola { transform: translateX(18px); background: var(--mint); }

.pm-isca { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }
.pm-falha {
  font-size: 12.5px; color: #fca5a5; line-height: 1.6;
  padding: 10px 13px; border-radius: 10px;
  background: rgba(248,113,113,0.10); border: 1px solid rgba(248,113,113,0.28);
}

.pm-acoes { display: flex; gap: 11px; justify-content: flex-end; margin-top: 5px; }
.dl-root .pm-botao {
  width: auto; padding: 11px 20px; border-radius: 999px; border: 1px solid var(--line);
  background: transparent; color: var(--default);
  font-size: 13px; font-weight: 600; cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}
.dl-root .pm-botao:hover { background: rgba(255,255,255,0.07); color: var(--strong); transform: none; box-shadow: none; }
.dl-root .pm-botao--primario { background: var(--strong); color: #0a0a0b; border-color: var(--strong); }
.dl-root .pm-botao--primario:hover { background: #e6e6ee; color: #0a0a0b; }
.dl-root .pm-botao:disabled { opacity: 0.55; cursor: default; }

.pm-feito { text-align: center; display: grid; justify-items: center; gap: 12px; padding: 10px 0; }
.pm-feito__marca {
  width: 52px; height: 52px; border-radius: 999px; display: grid; place-items: center;
  background: rgba(20,184,166,0.16); border: 1px solid rgba(20,184,166,0.42);
  color: var(--mint); font-size: 24px; margin-bottom: 4px;
}
.pm-feito .pm-sub { margin-top: 0; }
.pm-feito .pm-botao { margin-top: 10px; }

@media (max-width: 560px) {
  /* ── Modal no celular ──
     A caixa deixa de ser um cartão flutuando no meio da tela e passa a ocupá-la
     quase inteira: com 24px de véu de cada lado sobravam 296px de conteúdo para
     um formulário de cadastro, e cada campo ficava mais estreito que o texto
     que ele guarda. O véu encolhe, a caixa cresce e o que não couber rola
     dentro dela — a rolagem fica na caixa, e não na página atrás. */
  .pm-veu { padding: 12px; align-items: start; }
  .pm-caixa {
    padding: 26px 18px 22px; border-radius: 18px;
    max-height: calc(100vh - 24px);
    max-height: calc(100dvh - 24px);
    margin-top: 12px;
  }
  /* O ✕ é um quadrado no canto de cima; sem esta reserva o texto de abertura
     passa por baixo dele. */
  .pm-eyebrow, .pm-titulo { padding-right: 42px; }
  .pm-titulo { font-size: 20px; }
  .pm-sub { font-size: 13px; }
  .pm-form { margin-top: 20px; gap: 13px; }
  .pm-dupla { grid-template-columns: 1fr; }
  .pm-acoes { flex-direction: column-reverse; }
  .dl-root .pm-acoes .pm-botao { width: 100%; }
  /* Três ações empilhadas (a etapa de migração) viram três botões de tela
     cheia; o do meio é o "pular", que não precisa do mesmo peso. */
  .pm-acoes--tres { gap: 8px; }
}

@media (prefers-reduced-motion: reduce) {
  .pm-veu, .pm-caixa, .pm-resumo { animation: none; }
  .pm-toggle__trilho, .pm-toggle__bola { transition: none; }
}
`;
