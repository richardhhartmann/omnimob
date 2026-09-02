import { useLocation, useNavigate } from "react-router-dom";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { Trilha } from "./Trilha.jsx";
import { degrausAte } from "../utils/trilhaDoPainel";
import { useCabecalho } from "../utils/contextoDeCabecalho.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   O CABEÇALHO DO PAINEL — a faixa que diz onde você está e leva a qualquer
   outro lugar.

   ── POR QUE O TÍTULO SUBIU PARA CÁ ──

   Ele estava desenhado de quatro jeitos: `<h1>` de 28px nas telas de equipe,
   `<h2>` de 26px na grade de índices, 22px no `PageHeader` do Flow, e nada em
   algumas telas. A pessoa atravessava três desses na mesma sessão. O nome da
   tela é a única coisa presente em TODA tela — e o que aparece em toda tela
   pertence à moldura, como o cabeçalho da barra lateral já pertencia.

   Junto com ele veio a trilha (que já era só um degrau acima do título) e o
   botão primário da tela, que morava colado ao título desde sempre: separá-los
   deixaria um "Novo Cliente" solto no alto de uma lista, sem nada explicando o
   que ele cria.

   ── ELE É UM SÓ, NOS DOIS MÓDULOS ──

   Mesma faixa, mesma altura, mesma posição no Hub e no Flow. O que muda é o
   acento, como já acontece com a barra. Um segundo cabeçalho para o Flow seria
   a armadilha que o editor de vitrine caiu duas vezes.

   ── O TÍTULO TEM DUAS FONTES ──

   A rota responde por padrão (`trilhaDoPainel` já sabe o nome de cada tela, e
   um teste garante que a tabela cobre tudo que está na barra) e a tela
   sobrescreve quando tem algo mais específico — "Negócio #412" em vez de
   "Negócios". Ver `utils/contextoDeCabecalho.jsx`.

   ── STICKY, E NÃO FIXO ──

   `sticky` acompanha a rolagem sem sair do fluxo: o conteúdo abaixo continua
   começando onde deveria, sem ninguém precisar reservar altura com um padding
   que envelheceria junto com o cabeçalho. Com `fixed`, mudar a altura da faixa
   exigiria lembrar de mudar o padding do `<main>` no mesmo commit — e esquecer
   disso é como o conteúdo acaba escondido atrás da barra.
   ────────────────────────────────────────────────────────────────────────── */

export function CabecalhoDoPainel({ aoBuscar, atalhoDeBusca = "Ctrl K" }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const daTela = useCabecalho();

  /* A trilha da rota, sempre. Ela é a mesma tabela de onde sai o título de
     reserva, então as duas nunca discordam sobre o nome de uma tela. */
  const degraus = degrausAte(pathname, navigate);
  const ultimo = degraus[degraus.length - 1];

  const titulo = daTela?.titulo ?? ultimo?.rotulo ?? "";
  const subtitulo = daTela?.subtitulo ?? null;

  return (
    <header className="ds-topo">
      <div className="ds-topo__esq">
        {/* Só a partir de dois degraus: um degrau é a própria tela, e repetir o
            nome dela logo acima do título é ruído. */}
        {degraus.length > 1 ? (
          <div className="ds-topo__trilha"><Trilha itens={degraus} /></div>
        ) : null}
        {titulo ? <h1 className="ds-topo__titulo">{titulo}</h1> : null}
        {subtitulo ? <p className="ds-topo__sub">{subtitulo}</p> : null}
      </div>

      <div className="ds-topo__dir">
        {/* O gatilho da busca é um botão com CARA de campo, e não um `<input>`:
            o que ele abre é a paleta, e um campo aqui prometeria digitar no
            lugar onde a pessoa não vai digitar. Ele mostra a tecla porque é
            assim que alguém descobre que existe um atalho. */}
        <button type="button" className="ds-busca" onClick={aoBuscar} aria-label="Buscar telas do painel">
          <MagnifyingGlass size={15} weight="bold" />
          <span className="ds-busca__texto">Buscar no painel…</span>
          <kbd className="ds-busca__tecla">{atalhoDeBusca}</kbd>
        </button>

        {daTela?.acao ? <div className="ds-topo__acao">{daTela.acao}</div> : null}
      </div>
    </header>
  );
}
