import { useEffect, useRef } from "react";
import { Plus } from "@phosphor-icons/react";
import { registrarNovo } from "../utils/registroDeNovo";

/* ── O convite da lista vazia ────────────────────────────────────────────────

   Cinco telas do painel podem abrir sem nada para mostrar — Clientes, Imóveis,
   Tipos de imóvel, Usuários e Cargos — e todas mostravam a mesma linha cinza
   ("Nenhum cliente cadastrado."), que informa e não convida. É a PRIMEIRA tela
   que a imobiliária vê depois de assinar, e ela dizia que não havia nada,
   quando o que precisa dizer é o que fazer agora.

   ── QUANDO ELE APARECE, E QUANDO NÃO ──

   Só quando a coleção INTEIRA está vazia. Lista filtrada que não devolveu nada
   é outra conversa — ali existe cadastro, o filtro é que não achou, e um
   convite a criar seria a resposta errada para a pergunta que a pessoa fez.
   Quem chama passa `vazio` já resolvido.

   ── PLENA: A TELA INTEIRA, E NÃO O BURACO DA TABELA ──

   Quando a coleção está vazia, tudo o que fica em volta da lista também está:
   os cartões de números mostram cinco zeros, a busca não tem o que buscar e as
   abas de filtro filtram nada. Desenhar o convite só no lugar da tabela o
   deixava espremido entre duas fileiras de vazio, e a primeira tela da conta
   virava um relatório de ausências.

   Com `plena`, a página troca stats e filtros pelo convite, que ocupa a altura
   restante. O cabeçalho fica — é ele que diz onde a pessoa está, e é nele que
   mora o botão que o tour de primeiro acesso procura.

   ── O DESENHO ──

   Um disco tingido com o ícone da entidade, um halo que respira em volta e o
   "+" orbitando. Tudo em CSS: são três `@keyframes` contra uma biblioteca de
   animação inteira para uma tela que a pessoa vê uma vez.

   `prefers-reduced-motion` desliga o movimento e mantém o desenho — quem pediu
   menos animação não está pedindo menos informação.
   ────────────────────────────────────────────────────────────────────────── */

export function ConviteDeCriacao({
  icone, titulo, texto, acaoLabel, onAcao, accent = "#6366f1", tecla, plena = false, tourId,
}) {
  /* ── O CONVITE ASSUME AS DUAS HERANÇAS DO BOTÃO DE CIMA ──────────────────

     Com a tela vazia o "Novo …" do cabeçalho sai — dois botões dizendo a mesma
     coisa na mesma tela é ruído, e o de baixo é o que a pessoa está olhando.
     Só que aquele botão carregava mais do que o clique:

     · o "N". `BtnNovo` se registra em `registroDeNovo`, e é dali que a tecla
       descobre o que fazer nesta tela. Sem isto, o atalho anunciado no próprio
       convite não funcionaria justamente onde ele aparece;
     · a âncora do tour. Cinco passos procuram `[data-tour="clientes-novo"]` e
       companhia para dizer "clique aqui" — e o tour de primeiro acesso roda
       exatamente numa conta vazia, que é quando o botão de cima não existe.

     Mesmo `useRef` do `BtnNovo`, e pelo mesmo motivo: a página passa uma arrow
     nova a cada render, e sem ele o registro se desfaria em todo ciclo. */
  const acao = useRef(onAcao);
  acao.current = onAcao;
  useEffect(() => registrarNovo(() => acao.current?.()), []);

  return (
    <div className={`convite${plena ? " convite--plena" : ""}`} style={{ "--convite-cor": accent }}>
      <style>{CONVITE_CSS}</style>

      <div className="convite__palco" aria-hidden="true">
        <span className="convite__halo" />
        <span className="convite__halo convite__halo--2" />
        <span className="convite__disco">{icone}</span>
        <span className="convite__mais"><Plus size={14} weight="bold" /></span>
      </div>

      <h3 className="convite__titulo">{titulo}</h3>
      {texto ? <p className="convite__texto">{texto}</p> : null}

      {acaoLabel && onAcao ? (
        <button type="button" className="convite__botao" data-tour={tourId} onClick={onAcao}>
          <Plus size={15} weight="bold" />
          {acaoLabel}
          {/* A tecla, quando a tela tem uma. Aqui ela ensina o atalho no
              momento em que a pessoa vai usar a ação pela primeira vez. */}
          {tecla ? <kbd className="convite__tecla">{tecla}</kbd> : null}
        </button>
      ) : null}
    </div>
  );
}

/* Sem CRASE nenhuma nos comentarios daqui: template literal. */
export const CONVITE_CSS = `
/* A variante que ocupa a area toda. A altura sai do viewport menos o que ja
   esta gasto acima (cabecalho do painel + respiro do main + titulo da tela);
   o max() segura um piso para telas curtas sem empurrar a pagina para a
   rolagem, porque o piso e menor do que a folga descontada. */
.convite--plena {
  min-height: max(320px, calc(100vh - 300px));
  justify-content: center;
}

.convite {
  display: flex; flex-direction: column; align-items: center; text-align: center;
  padding: 56px 28px 52px; border-radius: 18px;
  background: var(--sup-02, rgba(255,255,255,0.02));
  border: 1px dashed var(--linha-12, rgba(255,255,255,0.12));
  animation: conviteEntra 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes conviteEntra {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: none; }
}

/* O palco do icone. Altura fixa para os halos crescerem sem empurrar o texto —
   animar tamanho num elemento em fluxo faria a tela inteira tremer. */
.convite__palco {
  position: relative; width: 96px; height: 96px; margin-bottom: 22px;
  display: flex; align-items: center; justify-content: center;
}
.convite__halo {
  position: absolute; inset: 0; border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--convite-cor) 40%, transparent);
  animation: conviteHalo 2.8s ease-out infinite;
}
.convite__halo--2 { animation-delay: 1.4s; }
@keyframes conviteHalo {
  0%   { transform: scale(0.72); opacity: 0; }
  35%  { opacity: 0.7; }
  100% { transform: scale(1.25); opacity: 0; }
}
.convite__disco {
  position: relative; width: 68px; height: 68px; border-radius: 22px;
  display: flex; align-items: center; justify-content: center;
  color: var(--convite-cor);
  background: color-mix(in srgb, var(--convite-cor) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--convite-cor) 30%, transparent);
  animation: conviteFlutua 4s ease-in-out infinite;
}
@keyframes conviteFlutua {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-6px); }
}
/* O "+" pendurado no canto do disco: diz o que o botao faz antes de a pessoa
   chegar nele. */
.convite__mais {
  position: absolute; right: 6px; bottom: 8px;
  width: 26px; height: 26px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--convite-cor); color: #fff;
  box-shadow: 0 6px 16px -6px color-mix(in srgb, var(--convite-cor) 80%, transparent);
  animation: conviteFlutua 4s ease-in-out infinite 0.35s;
}

.convite__titulo {
  margin: 0 0 8px; font-size: 19px; font-weight: 700; letter-spacing: -0.02em;
  color: var(--text-main);
}
.convite__texto {
  margin: 0; max-width: 46ch; font-size: 13.5px; line-height: 1.65;
  color: var(--text-muted);
}
.convite__botao {
  width: auto; margin-top: 26px; padding: 11px 20px; border-radius: 11px;
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 13.5px; font-weight: 600; cursor: pointer; border: 0;
  background: var(--convite-cor); color: #fff;
  box-shadow: 0 10px 26px -12px color-mix(in srgb, var(--convite-cor) 90%, transparent);
  transition: transform 0.18s ease, filter 0.18s ease;
}
.convite__botao:hover { transform: translateY(-2px); filter: brightness(1.08); }
.convite__tecla {
  margin-left: 4px; padding: 1px 6px; border-radius: 5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px;
  background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.28);
}

/* Quem pediu menos movimento continua vendo o desenho inteiro — o que sai e a
   animacao, nao a informacao. */
@media (prefers-reduced-motion: reduce) {
  .convite, .convite__halo, .convite__disco, .convite__mais { animation: none; }
  .convite__halo { opacity: 0.35; }
}
`;
