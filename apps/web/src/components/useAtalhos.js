import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { mapaDeAtalhos, telaDosAtalhos } from "../utils/atalhos";

/* ────────────────────────────────────────────────────────────────────────────
   O ouvido do teclado.

   ── A REGRA QUE EVITA O DESASTRE ──

   Atalho de tecla única e campo de texto não convivem por acidente: quem digita
   "novo cliente" no campo de busca dispara `n` e é levado para outra tela no
   meio da palavra. Por isso a PRIMEIRA coisa que este hook faz é perguntar onde
   o foco está, e desistir se for qualquer lugar onde se escreve —
   `input`, `textarea`, `select` e qualquer elemento com `contenteditable`
   (que é como o editor de vitrine edita texto na prancheta).

   Também desiste com Ctrl/Alt/Meta pressionados: `Ctrl+N` é do navegador, e
   roubá-lo é o tipo de coisa que faz a pessoa desinstalar a ferramenta.

   ── ESC É DIFERENTE ──

   Ele não é configurável e não vive no catálogo. É o gesto de "sair daqui" que
   o sistema inteiro respeita, e trocá-lo por outra tecla quebraria a única
   coisa que a pessoa já sabe antes de aprender o resto.

   Ele volta na PILHA DE NAVEGAÇÃO, e não para uma tela fixa: "anterior" quer
   dizer de onde você veio. Quando não há de onde voltar — primeira tela da
   sessão, ou link colado direto — cai na inicial que aquele cargo alcança.

   Um cuidado: modal aberto trata o próprio Esc e chama `stopPropagation`. Este
   hook escuta na fase de BORBULHA justamente por isso — o modal fecha, o evento
   não chega aqui, e a pessoa não é jogada para trás junto.
   ──────────────────────────────────────────────────────────────────────────── */

/** O foco está num lugar onde se escreve? */
function escrevendo(alvo) {
  if (!alvo) return false;
  if (alvo.isContentEditable) return true;
  const tag = alvo.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function useAtalhos({ cargo, doTenant, doUsuario, aoNovo, inicial = "/", ativos = true }) {
  const navigate = useNavigate();
  const location = useLocation();

  /* A profundidade da navegação DESTA sessão. `history.length` não serve: ele
     conta a aba inteira, inclusive as páginas antes do login. Sem isto, o Esc
     na primeira tela levaria a pessoa para fora do painel. */
  const profundidade = useRef(0);

  useEffect(() => { profundidade.current += 1; }, [location.key]);

  /* Refs porque o ouvinte é registrado uma vez: sem elas, cada troca de tela
     removeria e recolocaria o `keydown` da janela. */
  const contexto = useRef({});
  contexto.current = { cargo, doTenant, doUsuario, aoNovo, inicial, ativos, pathname: location.pathname };

  useEffect(() => {
    function aoTeclar(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const { cargo: c, doTenant: t, doUsuario: u, aoNovo: novo, inicial: casa, pathname, ativos: ligados } = contexto.current;

      if (e.key === "Escape") {
        /* Escrevendo, Esc é "abandonar o que estou digitando" — deixa o campo
           tratar. Sair da tela no meio de um formulário perderia o trabalho. */
        if (escrevendo(e.target)) return;
        e.preventDefault();
        if (profundidade.current > 1) navigate(-1);
        else if (pathname !== casa) navigate(casa);
        return;
      }

      /* O interruptor mestre desliga as TECLAS, e nunca o Esc — ele é tratado
         acima, de propósito. Esc não é atalho configurável: é o gesto de sair
         daqui, e a imobiliária que desliga os atalhos não está pedindo para
         perder o botão de voltar. */
      if (!ligados) return;
      if (escrevendo(e.target)) return;

      const tela = telaDosAtalhos(pathname);
      const mapa = mapaDeAtalhos({ tela, cargo: c, doTenant: t, doUsuario: u });
      const acao = mapa.get(String(e.key).toLowerCase());
      if (!acao) return;

      e.preventDefault();
      if (acao.destino) { navigate(acao.destino); return; }
      /* Ação sem rota é da tela — hoje só "novo registro". A tela informa o que
         fazer por `aoNovo`; sem isso, a tecla simplesmente não faz nada, que é
         melhor do que adivinhar. */
      if (acao.id === "global.novo") novo?.();
    }

    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [navigate]);
}
