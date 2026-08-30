import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, ArrowCounterClockwise, Warning } from "@phosphor-icons/react";
import { ACOES_POR_ID, acoesConfiguraveis, atribuirTecla, conflitosDe, teclaValida, rotuloDaTecla } from "../utils/atalhos";
import { faceDaAcao } from "../utils/faceDaAcao.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   Escolher as teclas.

   Um componente, dois usos: a imobiliária define a convenção da casa
   (Configurações › Atalhos) e cada pessoa pode discordar dela (Perfil ›
   Atalhos). É a MESMA tela nos dois lugares — o que muda é de onde vem o valor
   herdado e para onde vai o gravado.

   Duas telas parecidas divergiriam, e a divergência aqui seria cruel: a pessoa
   configuraria num lugar esperando o comportamento do outro.

   ── A TECLA É CAPTURADA, NÃO DIGITADA ──

   O campo não aceita texto: ele escuta uma tecla e mostra qual foi. Digitar
   deixaria escrever "Ctrl+Shift+F", que não é uma tecla — e a pessoa só
   descobriria que não funciona depois de fechar a tela.

   ── SALVA SOZINHO ──

   Não há botão. Cada tecla escolhida grava, com um respiro de meio segundo para
   quem está trocando várias — o mesmo padrão do editor de vitrine.

   E é aqui que o conflito muda de natureza: sem botão para travar, uma
   configuração ambígua não pode ser gravada. Então o conflito é RESOLVIDO em
   vez de barrado — quem já tinha a tecla a perde, e a tela diz de quem foi.
   Barrar seria pior: trocar `1` e `2` de lugar exige passar por um estado
   inválido, e um editor que se recusa a gravar no meio da troca trava a pessoa
   num passo que ela não pediu.

   ── A TELA, E NÃO UMA LISTA ──

   Era uma tabela: "Gerenciar imóveis … [1]", "Portfólio ativo … [2]", trinta
   linhas de rótulo e campo. Ela dizia o que cada tecla faz e escondia a única
   coisa que importa na hora de escolher — ONDE a tecla vale. Duas ações com o
   mesmo `1` em telas diferentes ficavam lado a lado como se brigassem, e as
   oito do Dashboard, que de fato dividem a mesma tela, ficavam separadas por
   um cabeçalho miúdo.

   Agora cada grupo é uma MAQUETE da tela a que pertence, com os cartões na
   mesma disposição e o selo da tecla no mesmo canto em que a tela real o
   desenha. Escolher é clicar no cartão e apertar a tecla — o mesmo gesto que
   se faz depois, na tela de verdade.

   A maquete não é um desenho novo: ícone e cor de cada cartão saem dos mesmos
   catálogos que abastecem as telas (ver `utils/faceDaAcao.jsx`), então um
   relatório novo aparece aqui sozinho, com o rosto certo.

   ── O QUE A MAQUETE NÃO É ──

   Não é um espelho pixel a pixel, e não deve virar um. Ela existe para
   responder "onde esta tecla vale?" de relance; perseguir a fidelidade faria
   dela uma segunda implementação do Dashboard, que é exatamente o defeito que
   o editor de vitrine já teve duas vezes.
   ──────────────────────────────────────────────────────────────────────────── */

const NOME_DO_GRUPO = {
  dashboard: "Dashboard",
  inicio: "Início",
  imoveis: "Gerenciar imóveis",
  relatorios: "Relatórios",
  configuracoes: "Configurações",
  global: "Em qualquer tela",
};

/* O endereço mostrado na barra da maquete. É o mesmo que `telaDosAtalhos`
   traduz de volta para o grupo — quem quiser conferir onde a tecla vale tem a
   resposta escrita, e não só sugerida pelo desenho.

   `global` não tem endereço: ela não é uma tela, e inventar um caminho para
   ela seria mentir sobre o alcance. Ver o rodapé da maquete. */
const ROTA_DO_GRUPO = {
  dashboard: "/",
  inicio: "/inicio",
  imoveis: "/imoveis",
  relatorios: "/relatorios",
  configuracoes: "/configuracoes",
};

/* ── O CARTÃO DA MAQUETE ─────────────────────────────────────────────────────

   O cartão inteiro é o botão. Não há um campo separado ao lado: na tela real a
   pessoa clica NAQUELE cartão e a tecla é dele — separar o alvo do selo faria
   a maquete ensinar um gesto que a tela de verdade não tem.

   A tecla é CAPTURADA, não digitada. Um campo de texto deixaria escrever
   "Ctrl+Shift+F", que não é uma tecla, e a pessoa só descobriria que não
   funciona depois de fechar a tela. */
function CartaoDeAtalho({ acao, valor, herdado, emConflito, aoDefinir, disabled }) {
  const [ouvindo, setOuvindo] = useState(false);
  const efetivo = valor ?? herdado;
  const { Icone, cor } = faceDaAcao(acao.id);

  function aoTeclar(e) {
    e.preventDefault();
    e.stopPropagation();

    /* Backspace e Delete DESLIGAM o atalho — é a diferença entre "não escolhi"
       (herda) e "não quero" (vazio), e sem um gesto para isso a segunda não
       existiria. */
    if (e.key === "Backspace" || e.key === "Delete") { aoDefinir(""); setOuvindo(false); return; }
    if (e.key === "Escape") { setOuvindo(false); return; }
    if (!teclaValida(e.key)) return; // segue ouvindo: F5, Shift e afins não valem
    aoDefinir(e.key.toLowerCase());
    setOuvindo(false);
  }

  const classe = "ea-cartao"
    + (ouvindo ? " is-ouvindo" : "")
    + (emConflito ? " is-conflito" : "")
    + (efetivo === "" ? " is-vazio" : "");

  return (
    <button
      type="button"
      className={classe}
      style={{ "--ea-cor": cor }}
      onClick={() => setOuvindo(true)}
      onBlur={() => setOuvindo(false)}
      /* Só escuta enquanto está esperando a tecla. Fora disso o cartão é um
         botão comum, e Enter/Espaço continuam sendo "clique" para quem navega
         por teclado — que é justamente como se entra no modo de captura. */
      onKeyDown={ouvindo ? aoTeclar : undefined}
      disabled={disabled}
      title={ouvindo ? "Aperte a tecla desejada — Backspace desliga" : `Clique e aperte a tecla para “${acao.rotulo}”`}
    >
      <span className="ea-cartao__icone" aria-hidden="true">
        {Icone ? <Icone size={17} weight="duotone" /> : null}
      </span>
      <span className="ea-cartao__rotulo">{acao.rotulo}</span>
      {/* No mesmo canto em que a tela real desenha o selo (ver
          `.tecla-atalho--canto`). É o que faz a maquete ser reconhecida antes
          de ser lida. */}
      <kbd className="ea-cartao__tecla">
        {ouvindo ? "…" : efetivo === "" ? "—" : rotuloDaTecla(efetivo)}
      </kbd>
    </button>
  );
}

export function EditorDeAtalhos({
  cargo,
  /* O que vale por baixo da escolha desta tela. Em Configurações do tenant é o
     padrão de fábrica; no perfil da pessoa é o padrão da imobiliária — e é essa
     diferença que faz o mesmo componente servir aos dois. */
  herdados = {},
  valor = {},
  aoMudar,
  /* Chamado com um respiro depois de cada mudança. É ele que grava — não há
     botão. */
  aoSalvar,
  estado = "",
  disabled = false,
}) {
  const grupos = useMemo(() => acoesConfiguraveis(cargo), [cargo]);
  const [roubo, setRoubo] = useState(null);

  /* ── Conflito ainda pode existir, e por isso continua sendo marcado ────────
     Escolher uma tecla ocupada resolve o conflito na hora (`atribuirTecla`), o
     que torna impossível criar um aqui. Mas o HERDADO muda por fora: o
     administrador troca a tecla da casa, e ela passa a colidir com uma escolha
     que esta pessoa fez semanas atrás.

     Ninguém fica travado por isso — `mapaDeAtalhos` decide de forma
     determinística e a tecla funciona. O que a marca em vermelho faz é mostrar
     ONDE está a ambiguidade, para a pessoa desempatar quando quiser. */
  const efetivo = useMemo(() => {
    const fora = {};
    for (const id of Object.keys(ACOES_POR_ID)) {
      const v = valor[id] ?? herdados[id];
      if (v !== undefined) fora[id] = v;
    }
    return fora;
  }, [valor, herdados]);

  const idsEmConflito = useMemo(
    () => new Set(conflitosDe(efetivo, cargo).flatMap((c) => c.acoes)),
    [efetivo, cargo],
  );

  /* ── O respiro antes de gravar ────────────────────────────────────────────
     Meio segundo. Quem está trocando três teclas seguidas dispara uma gravação
     só, e não três. É o mesmo padrão do autosave do editor de vitrine.

     A primeira renderização NÃO grava: sem esta trava, abrir a tela já mandaria
     um PUT com a configuração que acabou de ser lida. */
  const primeira = useRef(true);
  useEffect(() => {
    if (primeira.current) { primeira.current = false; return undefined; }
    if (!aoSalvar) return undefined;
    const t = setTimeout(() => aoSalvar(valor), 500);
    return () => clearTimeout(t);
  }, [valor, aoSalvar]);

  /* O aviso de quem perdeu a tecla some sozinho. Ele informa, não interrompe. */
  useEffect(() => {
    if (!roubo) return undefined;
    const t = setTimeout(() => setRoubo(null), 4000);
    return () => clearTimeout(t);
  }, [roubo]);

  function definir(acaoId, tecla) {
    const { proximo, roubadaDe } = atribuirTecla(valor, herdados, cargo, acaoId, tecla);
    aoMudar(proximo);
    setRoubo(roubadaDe ? { de: roubadaDe, tecla } : null);
  }

  return (
    <div className="ea-caixa">
      <p className="ea-ajuda">
        <Keyboard size={15} /> Cada quadro abaixo é uma tela do painel. Estando nela, apertar a tecla
        faz o mesmo que clicar no cartão. Clique no cartão aqui e aperte a tecla que quiser;
        <strong> Backspace</strong> desliga o atalho.
      </p>

      {/* Quem perdeu a tecla. Um atalho que some sem aviso é o mesmo que um
          defeito — a pessoa só descobre quando aperta e nada acontece. */}
      {roubo ? (
        <p className="ea-conflito">
          <Warning size={15} weight="fill" />
          A tecla <strong>{rotuloDaTecla(roubo.tecla)}</strong> saiu de “{roubo.de}”, que estava com ela.
        </p>
      ) : null}

      {[...grupos.entries()].map(([grupo, acoes]) => (
        <section key={grupo} className={`ea-tela${grupo === "global" ? " ea-tela--global" : ""}`}>
          {/* A barra de cima é o que transforma uma grade de botões numa TELA:
              sem ela o bloco lê como mais uma seção da configuração, e a
              pergunta "onde esta tecla vale?" volta a não ter resposta. */}
          <header className="ea-tela__barra">
            <span className="ea-tela__pontos" aria-hidden="true"><i /><i /><i /></span>
            <span className="ea-tela__nome">{NOME_DO_GRUPO[grupo] || grupo}</span>
            {ROTA_DO_GRUPO[grupo] ? (
              <code className="ea-tela__rota">{ROTA_DO_GRUPO[grupo]}</code>
            ) : (
              /* Sem endereço: este grupo não é uma tela. Ver `ROTA_DO_GRUPO`. */
              <span className="ea-tela__rota ea-tela__rota--todas">vale em todas</span>
            )}
          </header>

          <div className="ea-tela__palco">
            {acoes.map((acao) => (
              <CartaoDeAtalho
                key={acao.id}
                acao={acao}
                valor={valor[acao.id]}
                herdado={herdados[acao.id] ?? acao.padrao}
                emConflito={idsEmConflito.has(acao.id)}
                disabled={disabled}
                aoDefinir={(t) => definir(acao.id, t)}
              />
            ))}
          </div>
        </section>
      ))}

      <div className="ea-rodape">
        <button
          type="button"
          className="ea-restaurar"
          onClick={() => { aoMudar({}); setRoubo(null); }}
          disabled={disabled || !Object.keys(valor).length}
        >
          <ArrowCounterClockwise size={14} /> Voltar ao padrão
        </button>
        {/* Não há botão de salvar: o estado é a única confirmação de que gravou,
            e sem ele o salvamento automático seria invisível. */}
        {estado ? <span className="ea-estado">{estado}</span> : null}
      </div>
    </div>
  );
}
