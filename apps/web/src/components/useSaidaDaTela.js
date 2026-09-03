import { useEffect, useRef } from "react";
import { tourAtivo } from "../utils/tourAtivo";

/* ────────────────────────────────────────────────────────────────────────────
   O Esc de uma SUB-TELA.

   ── O DEFEITO QUE ELE CONSERTA ──

   O Esc do painel (`useAtalhos`) sobe um nível na ROTA, e devolve o teclado ao
   campo quando a pessoa está escrevendo — "Esc no meio de um formulário não
   pode arrastar ninguém para fora da tela" é a regra certa para ele.

   Isso deixa um buraco nos cadastros. Clientes, Usuários, Cargos e Tipos de
   Imóvel HOJE têm rota própria (`/clientes/novo`, `/cargos/:id`, …) — antes não
   tinham, e o Esc ali não fazia nada porque, para o atalho global, quem
   preenchia "Novo Cliente" continuava em `/clientes`.

   As rotas consertaram o Voltar do navegador, o F5 e o link, mas NÃO consertam
   o Esc: o atalho global se recusa a agir com o foco num campo de texto, e num
   formulário ele quase sempre está. O sintoma é o mesmo de antes — a tecla não
   responde justamente onde a pessoa mais espera que responda.

   ── POR QUE ELE AGE MESMO COM O FOCO NUM CAMPO ──

   Porque aqui o gesto tem um destino claro e reversível: fechar este cadastro e
   voltar à lista, que é o mesmo que o botão "Cancelar" faz. É o comportamento
   que todo modal do painel já tem — e um cadastro que ocupa a tela inteira é um
   modal que não sabe que é.

   Quem tem trabalho a perder trata disso no próprio `aoSair` (a tela de Cargos
   pergunta antes de descartar). A tecla não decide isso: ela só pede a saída.

   ── QUEM ESTÁ POR CIMA TEM PREFERÊNCIA ──

   Com uma caixa aberta sobre o formulário — a confirmação, o aviso de permissão
   de risco, um seletor aberto —, o Esc é dela: fecha a caixa e o cadastro fica.
   As três travam a rolagem do corpo enquanto estão no ar, e é esse o sinal
   comum que se lê aqui; `defaultPrevented` cobre quem já tratou a tecla no
   caminho (o `SelectCustom` aberto).
   ────────────────────────────────────────────────────────────────────────── */

/** Há uma caixa modal por cima? Todas travam a rolagem do corpo enquanto abertas. */
function temCaixaPorCima() {
  return document.body.style.overflow === "hidden";
}

export function useSaidaDaTela(aoSair, ativo = true) {
  /* `useRef` para o ouvinte não ser recolocado a cada render: a tela passa uma
     arrow nova toda vez, e sem isto o `keydown` seria removido e registrado de
     novo em todo ciclo. Mesmo motivo do `BtnNovo`. */
  const acao = useRef(aoSair);
  acao.current = aoSair;

  useEffect(() => {
    if (!ativo) return undefined;
    function aoTeclar(e) {
      if (e.key !== "Escape") return;
      if (e.defaultPrevented) return;
      if (temCaixaPorCima()) return;
      /* Com um tour no ar o Esc é dele — encerra o tutorial. Sair da tela junto
         levaria embora o formulário que o tour está ensinando a preencher. */
      if (tourAtivo()) return;
      e.preventDefault();
      acao.current?.();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [ativo]);
}
