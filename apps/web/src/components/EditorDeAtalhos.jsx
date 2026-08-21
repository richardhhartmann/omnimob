import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, ArrowCounterClockwise, Warning } from "@phosphor-icons/react";
import { ACOES_POR_ID, acoesConfiguraveis, atribuirTecla, conflitosDe, teclaValida, rotuloDaTecla } from "../utils/atalhos";

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
   ──────────────────────────────────────────────────────────────────────────── */

const NOME_DO_GRUPO = {
  dashboard: "Dashboard",
  inicio: "Início",
  imoveis: "Gerenciar imóveis",
  relatorios: "Relatórios",
  configuracoes: "Configurações",
  global: "Em qualquer tela",
};

function CampoDeTecla({ valor, herdado, emConflito, aoDefinir, disabled }) {
  const [ouvindo, setOuvindo] = useState(false);
  const efetivo = valor ?? herdado;

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

  return (
    <button
      type="button"
      className={`ea-tecla${ouvindo ? " is-ouvindo" : ""}${emConflito ? " is-conflito" : ""}${efetivo === "" ? " is-vazio" : ""}`}
      onClick={() => setOuvindo(true)}
      onBlur={() => setOuvindo(false)}
      onKeyDown={ouvindo ? aoTeclar : undefined}
      disabled={disabled}
      title={ouvindo ? "Aperte a tecla desejada — Backspace desliga" : "Clique e aperte a tecla"}
    >
      {ouvindo ? "…" : efetivo === "" ? "desligado" : rotuloDaTecla(efetivo)}
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
        <Keyboard size={15} /> Estando na tela, aperte a tecla para o mesmo efeito de clicar no botão.
        Clique num campo e aperte a tecla que quiser; <strong>Backspace</strong> desliga o atalho.
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
        <section key={grupo} className="ea-grupo">
          <h4>{NOME_DO_GRUPO[grupo] || grupo}</h4>
          <ul>
            {acoes.map((acao) => (
              <li key={acao.id}>
                <span className="ea-rotulo">{acao.rotulo}</span>
                <CampoDeTecla
                  valor={valor[acao.id]}
                  herdado={herdados[acao.id] ?? acao.padrao}
                  emConflito={idsEmConflito.has(acao.id)}
                  disabled={disabled}
                  aoDefinir={(t) => definir(acao.id, t)}
                />
              </li>
            ))}
          </ul>
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
