import { useCabecalho, useDegrausDoPainel } from "../utils/contextoDeCabecalho.jsx";

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

   O gatilho da BUSCA fez o caminho inverso, e pelo mesmo critério: ele esteve
   aqui e subiu para a faixa do topo. O botão primário é desta tela; a paleta
   abre qualquer uma. O que serve a todas pertence à moldura.

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

export function CabecalhoDoPainel({ Icone = null }) {
  const daTela = useCabecalho();

  /* Os degraus continuam sendo lidos aqui, mas não são mais DESENHADOS aqui: a
     trilha subiu para a faixa do topo (ver `TrilhaDaFaixa`). O que sobra
     desta lista no cabeçalho é o título de reserva — o último degrau é o nome
     da tela quando ela não define um próprio. */
  const degraus = useDegrausDoPainel();
  const ultimo = degraus[degraus.length - 1];

  const titulo = daTela?.titulo ?? ultimo?.rotulo ?? "";
  const subtitulo = daTela?.subtitulo ?? null;

  /* O ícone vem da navegação (o layout o encontra pelo item aceso), e a tela
     pode sobrescrever — mesma regra do título. Serve para as telas de detalhe,
     que não têm item próprio no menu: `/flow/negocios/<id>` acende "Todos os
     Negócios", e o ícone dele é melhor que nenhum, mas a tela sabe mais. */
  const IconeDaTela = daTela?.icone ?? Icone;

  return (
    <header className="ds-topo">
      <div className="ds-topo__esq">
        {/* `aria-hidden`: ele repete o que o título já diz. Um leitor de tela
            anunciando "ícone Cargos, Cargos" é ruído, não acessibilidade. */}
        {IconeDaTela ? (
          <span className="ds-topo__icone" aria-hidden="true">
            <IconeDaTela size={19} weight="regular" />
          </span>
        ) : null}
        <div className="ds-topo__texto">
          {titulo ? <h1 className="ds-topo__titulo">{titulo}</h1> : null}
          {subtitulo ? <p className="ds-topo__sub">{subtitulo}</p> : null}
        </div>
      </div>

      {/* A busca saiu daqui e subiu para a faixa do topo (`.ds-topbar`): ela
          abre qualquer tela do painel, e o que serve a todas as telas pertence à
          moldura, não ao cabeçalho de uma delas. Ver o comentário no
          `AdminLayout`.

          O que sobra é o botão primário DESTA tela — e agora ele tem o canto
          direito só para si, em vez de dividi-lo com um controle que não tem
          nada a ver com o que a página faz.

          A caixa só existe quando há ação: uma `<div>` vazia num flex com
          `space-between` não muda nada hoje, mas deixa uma peça sem conteúdo no
          DOM de quase toda tela do painel. */}
      {daTela?.acao ? (
        <div className="ds-topo__dir">
          <div className="ds-topo__acao">{daTela.acao}</div>
        </div>
      ) : null}
    </header>
  );
}
