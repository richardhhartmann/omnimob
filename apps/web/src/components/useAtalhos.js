import { useEffect, useRef } from "react";
import { criarNovo } from "../utils/registroDeNovo";
import { useLocation, useNavigate } from "react-router-dom";
import { mapaDeAtalhos, paiDaRota, telaDosAtalhos } from "../utils/atalhos";
import { filtrarNoTour, tourAtivo } from "../utils/tourAtivo";
import { temCaixaPorCima } from "../utils/caixaPorCima";

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

   ── TOUR ABERTO CALA O TECLADO ──

   Com um tour no ar, este hook não faz NADA — nem o Esc, que é a única tecla
   que o interruptor mestre não desliga. O motivo é diferente do da imobiliária
   que desliga os atalhos: ali é preferência, aqui é integridade. O tour aponta
   para elementos de UMA tela, e qualquer tecla que troque de tela o deixa
   falando de uma página que não está mais ali — o holofote fica no vazio e a
   pessoa fugiu do tour sem ter pedido nada.

   A exceção é o "N", e ela não é um furo: `global.novo` faz exatamente o que o
   passo está pedindo ("Clique em Novo Cliente"), sem sair de lugar nenhum. Quem
   decide isso é `ACOES_NO_TOUR`, em `utils/tourAtivo.js`, e o mesmo filtro
   governa o selo desenhado no botão — nunca uma tecla anunciada e morta.
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

  /* A contagem de profundidade da navegação saiu daqui junto com o `navigate(-1)`:
     o Esc não anda mais no histórico, ele SOBE um nível na rota. Ver `paiDaRota`. */

  /* Refs porque o ouvinte é registrado uma vez: sem elas, cada troca de tela
     removeria e recolocaria o `keydown` da janela. */
  const contexto = useRef({});
  contexto.current = { cargo, doTenant, doUsuario, aoNovo, inicial, ativos, pathname: location.pathname };

  useEffect(() => {
    function aoTeclar(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const { cargo: c, doTenant: t, doUsuario: u, aoNovo: novo, inicial: casa, pathname, ativos: ligados } = contexto.current;

      if (e.key === "Escape") {
        /* ── QUEM ESTÁ POR CIMA TEM A TECLA ────────────────────────────────
           Estas duas guardas faltavam, e o sintoma era exatamente o que se
           espera de um Esc sem dono: com a paleta de busca aberta, a tecla
           fechava o modal E subia um nível na rota — a pessoa via a página de
           trás trocar por baixo da caixa. Bastava o foco não estar no campo
           para o `escrevendo` abaixo não segurar nada.

           `defaultPrevented` cobre quem já tratou a tecla no caminho; a caixa
           por cima cobre quem ainda vai tratar, mas não tem o foco. São as
           mesmas duas de `useSaidaDaTela` — o Esc do painel e o das sub-telas
           precisam concordar sobre de quem é a tecla. */
        if (e.defaultPrevented) return;
        if (temCaixaPorCima()) return;
        /* Escrevendo, Esc é "abandonar o que estou digitando" — deixa o campo
           tratar. Sair da tela no meio de um formulário perderia o trabalho. */
        if (escrevendo(e.target)) return;
        /* Com o tour aberto o Esc é DELE — encerra o tutorial, e só. Antes as
           duas coisas aconteciam de uma vez: o tour fechava e a pessoa era
           levada um nível acima junto, saindo do formulário pela metade. */
        if (tourAtivo()) return;
        e.preventDefault();
        /* SOBE um nível, e não volta no histórico. Ver `paiDaRota`: o gesto é
           "sair desta tela para a de cima", e ele tem de dar no mesmo lugar
           independentemente do caminho que trouxe a pessoa até aqui. */
        const acima = paiDaRota(pathname, casa);
        if (acima !== pathname) navigate(acima);
        return;
      }

      /* O interruptor mestre desliga as TECLAS, e nunca o Esc — ele é tratado
         acima, de propósito. Esc não é atalho configurável: é o gesto de sair
         daqui, e a imobiliária que desliga os atalhos não está pedindo para
         perder o botão de voltar. */
      if (!ligados) return;
      if (escrevendo(e.target)) return;
      /* Alguém já tratou esta tecla na fase de captura. Hoje é a grade de
         índices paginada (`GradeDeMenu`), onde as teclas 1 a 9 pertencem à
         POSIÇÃO na página e não à ação — e agir aqui em cima faria a mesma
         tecla navegar para dois lugares. */
      if (e.defaultPrevented) return;

      const tela = telaDosAtalhos(pathname);
      const mapa = filtrarNoTour(mapaDeAtalhos({ tela, cargo: c, doTenant: t, doUsuario: u }));
      const acao = mapa.get(String(e.key).toLowerCase());
      if (!acao) return;

      e.preventDefault();
      if (acao.destino) { navigate(acao.destino); return; }
      /* Ação sem rota é da tela — hoje só "novo registro". Quem responde é o
         botão de "novo" da tela aberta, que se registra sozinho (ver
         `registroDeNovo.js`). `aoNovo` continua aceito para o caso de uma tela
         precisar responder sem ter o botão compartilhado; sem nenhum dos dois,
         a tecla não faz nada, que é melhor do que adivinhar.

         Antes só existia o `aoNovo`, e ninguém o passava: a tecla não fazia
         nada em tela nenhuma desde que foi criada. */
      if (acao.id === "global.novo") {
        if (novo) novo();
        else criarNovo();
      }
    }

    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [navigate]);
}
