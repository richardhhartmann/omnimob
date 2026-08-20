import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { PrimeiroAcessoModal } from "./PrimeiroAcessoModal";
import { TourGuiado } from "./TourGuiado";
import { ETAPA_BOAS_VINDAS, chavesDoFluxo, montarFluxoTour } from "../utils/tourFluxo";
import { chavesDasTelas } from "../utils/tourTelas";
import { IconeChapeuFormatura } from "./Icones.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   Orquestra o primeiro acesso: decide se mostra, abre o convite, roda o tour e
   grava cada desfecho.

   QUEM MANDA É O BANCO, não o localStorage. A pergunta "esta pessoa já viu o
   tour?" segue a pessoa entre navegadores e máquinas — resolver com marca local
   faria o tour reaparecer no notebook de casa e sumir para sempre se alguém
   limpasse o cache. O [BoasVindasModal] usa marca local porque lá o dado nem
   existe no schema; aqui existe, e é a fonte.
   ──────────────────────────────────────────────────────────────────────────── */

// Abaixo disto o holofote não tem para onde apontar: a sidebar vira gaveta e o
// cartão cobriria o alvo. Em vez de rodar um tour ruim, não gravamos nada e
// deixamos pendente — ele abre inteiro no primeiro acesso pelo desktop.
const LARGURA_MINIMA = 900;

export function PrimeiroAcessoTour({ session, pronto = true, aoMudarEstado }) {
  const tenantSlug = session?.tenant?.slug || "";
  const tenantName = session?.tenant?.name || "";
  const cargo = session?.usuario?.cargo;
  const nome = session?.usuario?.nome || "";
  const navegar = useNavigate();

  const fluxo = useMemo(
    () => montarFluxoTour({ cargo, tenantSlug }),
    [cargo, tenantSlug],
  );

  // carregando · oculto · convite · tour · concluido
  const [fase, setFase] = useState("carregando");

  const totalPassos = useMemo(
    () => fluxo.reduce((n, e) => n + e.passos.length, 0),
    [fluxo],
  );

  /* ── Decide se este acesso mostra alguma coisa ────────────────────────────

     ── A CONSULTA SAI NA MONTAGEM, NÃO QUANDO O MODAL FECHA ──

     Aqui estava o vão de cinco a dez segundos entre o modal de boas-vindas e o
     convite do tour. A consulta ao progresso do tutorial só começava quando
     `pronto` virava verdadeiro — ou seja, DEPOIS de o modal anterior sair — e o
     que a pessoa via era a tela vazia pelo tempo de uma ida e volta ao
     Supabase, que nesta API custa segundos.

     A pergunta ("esta pessoa já viu o tour?") não depende do modal anterior.
     Então ela sai assim que o componente monta, em paralelo com o que estiver
     na tela, e o resultado espera guardado. Quando o modal fecha, a resposta já
     está aqui e o convite aparece no mesmo quadro.

     `pronto` continua governando o que APARECE — só deixou de governar quando a
     pergunta é feita. */
  const [decidido, setDecidido] = useState(null); // null = ainda perguntando

  useEffect(() => {
    if (!tenantSlug || !fluxo.length) return undefined;
    if (window.innerWidth < LARGURA_MINIMA) { setDecidido("oculto"); return undefined; }

    let vivo = true;
    api.getTutorial(tenantSlug)
      .then((r) => {
        if (!vivo) return;
        // EM_ANDAMENTO não conta como resolvido: quem fechou a aba no meio do
        // tour merece o convite de novo, não o silêncio.
        const resolvidas = new Set(
          (r?.etapas || [])
            .filter((e) => e.status === "FINALIZADO" || e.status === "PULADO")
            .map((e) => e.etapa),
        );
        setDecidido(resolvidas.has(ETAPA_BOAS_VINDAS) ? "oculto" : "convite");
      })
      .catch(() => { if (vivo) setDecidido("oculto"); });

    return () => { vivo = false; };
  }, [tenantSlug, fluxo.length]);

  /* A decisão só vira estado visível quando a fila libera. Separado do efeito
     acima de propósito: um é sobre SABER, o outro sobre MOSTRAR. */
  useEffect(() => {
    if (!pronto || !decidido) return;
    setFase((atual) => (atual === "carregando" ? decidido : atual));
  }, [pronto, decidido]);

  /* Avisa quem está na fila atrás: enquanto o tour global ocupa a tela, os
     tours de tela ficam calados (eles visitam as mesmas páginas). */
  useEffect(() => {
    aoMudarEstado?.(fase === "convite" || fase === "tour" || fase === "concluido");
  }, [fase, aoMudarEstado]);

  /* ── Gravação ───────────────────────────────────────────────────────────── */

  // Progresso que não gravou não pode derrubar o tour na cara do usuário: a
  // falha vai para o console e a navegação continua.
  const registrar = useCallback((etapa, status, passoParou, totalDaEtapa) => {
    if (!tenantSlug) return Promise.resolve();
    return api.marcarTutorial(tenantSlug, {
      etapa,
      status,
      passoParou: passoParou ?? null,
      totalPassos: totalDaEtapa ?? null,
    }).catch((erro) => {
      console.warn("[tour] não consegui gravar o progresso:", erro?.message || erro);
    });
  }, [tenantSlug]);

  const pularTudo = useCallback((chaves, passoParou) => {
    if (!tenantSlug || !chaves.length) return Promise.resolve();
    return api.pularTutorialTodo(tenantSlug, {
      etapas: chaves,
      passoParou: passoParou ?? null,
    }).catch((erro) => {
      console.warn("[tour] não consegui registrar o abandono:", erro?.message || erro);
    });
  }, [tenantSlug]);

  /* ── Desfechos ──────────────────────────────────────────────────────────── */

  function comecar() {
    registrar(ETAPA_BOAS_VINDAS, "FINALIZADO", 1, 1);
    setFase("tour");
  }

  function dispensarConvite() {
    /* "Explorar por conta própria" é uma escolha sobre SER GUIADO, não só sobre
       este modal. Cala o tour global e também os tours de tela — quem disse que
       prefere se virar sozinho não vai gostar de ser abordado de novo ao abrir
       o cadastro de imóvel. Tudo volta pelo "Rever o tour", em Configurações. */
    pularTudo([...chavesDoFluxo(fluxo), ...chavesDasTelas()], null);
    setFase("oculto");
  }

  function terminarTour(motivo, info) {
    if (motivo === "concluiu") {
      // O tour termina apontando a sidebar, ou seja, na última tela visitada.
      // Deixar a pessoa ali é largá-la em Configurações depois de um passo que
      // fala em cadastrar imóvel — volta para o Início, onde tudo começa.
      navegar("/");
      setFase("concluido");
      return;
    }
    // Abandono no meio: a etapa onde parou guarda o passo — é o dado que diz
    // ONDE o tour perdeu a pessoa. As seguintes ficam como puladas, sem passo,
    // porque ela nunca chegou a abri-las.
    const idx = fluxo.findIndex((e) => e.chave === info?.chave);
    if (idx >= 0) {
      registrar(info.chave, "PULADO", info.passo, info.total);
      const restantes = fluxo.slice(idx + 1).map((e) => e.chave);
      if (restantes.length) pularTudo(restantes, null);
    } else {
      pularTudo(chavesDoFluxo(fluxo), null);
    }
    setFase("oculto");
  }

  /* ── Render ─────────────────────────────────────────────────────────────── */

  if (fase === "oculto") return null;

  /* ── A espera, quando ainda houver ────────────────────────────────────────
     Com a consulta saindo na montagem, o normal é a resposta já estar aqui
     quando o modal anterior sai — e este véu nunca aparecer.

     Ele existe para a rede ruim: sem ele, a pessoa fecharia o modal de
     cadastro e cairia num painel que parece pronto, começaria a clicar, e
     seria interrompida por um modal de tour em cima do que estava fazendo. Um
     véu segurando por meio segundo é melhor que um sobressalto depois.

     Só enquanto a fila já liberou (`pronto`) e a resposta não chegou. Antes
     disso quem segura a tela é o modal de boas-vindas, e dois véus empilhados
     escureceriam a página duas vezes. */
  if (fase === "carregando") {
    if (!pronto || decidido) return null;
    return (
      <div className="pat-espera" role="status" aria-live="polite">
        <style>{CSS_ESPERA}</style>
        <span className="pat-espera__giro" aria-hidden="true" />
        <span>Preparando seu painel…</span>
      </div>
    );
  }

  if (fase === "convite") {
    return (
      <PrimeiroAcessoModal
        nome={nome}
        tenantName={tenantName}
        totalPassos={totalPassos}
        aoComecar={comecar}
        aoPular={dispensarConvite}
      />
    );
  }

  if (fase === "tour") {
    return <TourGuiado fluxo={fluxo} aoRegistrar={registrar} aoTerminar={terminarTour} />;
  }

  return <TourConcluido nome={nome} aoFechar={() => setFase("oculto")} />;
}

/* O véu de espera. Mesmo peso do véu do modal de boas-vindas, para a transição
   entre os dois não piscar de claro para escuro. */
const CSS_ESPERA = `
.pat-espera {
  position: fixed; inset: 0; z-index: 9996;
  display: flex; align-items: center; justify-content: center; gap: 12px;
  background: rgba(6, 8, 15, 0.72);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  color: #cbd5e1; font-size: 14px; font-weight: 500;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
}
.pat-espera__giro {
  width: 16px; height: 16px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.18);
  border-top-color: #818cf8;
  animation: pat-gira 0.7s linear infinite;
}
@keyframes pat-gira { to { transform: rotate(360deg); } }
/* Sem movimento, fica o texto: ele já diz que algo está acontecendo. */
@media (prefers-reduced-motion: reduce) { .pat-espera__giro { animation: none; } }
`;

/* ── Fecho ──────────────────────────────────────────────────────────────────
   Quem chegou ao fim do tour merece o aplauso; quem pulou não vê esta tela.
   ────────────────────────────────────────────────────────────────────────── */

function TourConcluido({ nome, aoFechar }) {
  const primeiroNome = (nome || "").split(" ")[0];
  return (
    <div className="tc-veu">
      <style>{CSS_CONCLUIDO}</style>
      <div className="tc-caixa" role="dialog" aria-modal="true" aria-labelledby="tc-titulo">
        <span className="tc-icone" aria-hidden="true"><IconeChapeuFormatura size={26} /></span>
        <h2 id="tc-titulo" className="tc-titulo">
          {primeiroNome ? `Pronto, ${primeiroNome}!` : "Pronto!"}
        </h2>
        <p className="tc-texto">
          Você já sabe onde fica cada coisa. Um bom primeiro passo é cadastrar um imóvel e
          abrir a vitrine para ver como ele aparece para o cliente.
        </p>
        <p className="tc-nota">Precisar rever, o tour continua disponível em Configurações.</p>
        <button type="button" className="tc-botao" onClick={aoFechar}>Começar a usar</button>
      </div>
    </div>
  );
}

const CSS_CONCLUIDO = `
.tc-veu {
  position: fixed; inset: 0; z-index: 99980;
  display: grid; place-items: center; padding: 24px;
  background: rgba(5,7,12,0.76);
  backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px);
  animation: tcVeu 0.26s ease both;
  font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
}
@keyframes tcVeu { from { opacity: 0; } to { opacity: 1; } }

.tc-caixa {
  width: min(430px, 100%); padding: 30px 30px 26px; border-radius: 20px; text-align: center;
  display: grid; justify-items: center;
  background: #141821; border: 1px solid rgba(255,255,255,0.10);
  box-shadow: 0 34px 80px -26px rgba(0,0,0,0.92);
  animation: tcCaixa 0.44s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes tcCaixa {
  from { opacity: 0; transform: translateY(14px) scale(0.97); }
  to   { opacity: 1; transform: none; }
}
.tc-icone {
  width: 58px; height: 58px; border-radius: 999px; display: grid; place-items: center;
  margin-bottom: 14px; color: #34d399;
  background: rgba(16,185,129,0.14); border: 1px solid rgba(16,185,129,0.44);
  animation: tcPulo 0.7s cubic-bezier(0.3,0.9,0.4,1) 0.3s 2 both;
}
@keyframes tcPulo {
  0%, 100% { transform: translateY(0) scale(1); }
  30% { transform: translateY(-12px) scale(1.06); }
  60% { transform: translateY(0) scale(0.95); }
}
.tc-titulo { margin: 0 0 10px; font-size: 21px; font-weight: 700; letter-spacing: -0.025em; color: #f1f5f9; }
.tc-texto { margin: 0 0 12px; font-size: 13.5px; line-height: 1.68; color: #94a3b8; }
.tc-nota { margin: 0 0 20px; font-size: 12px; line-height: 1.6; color: #64748b; }
.tc-caixa .tc-botao {
  width: auto; padding: 11px 22px; border-radius: 999px; cursor: pointer;
  font-family: inherit; font-size: 13px; font-weight: 600;
  background: #6366f1; border: 1px solid #6366f1; color: #fff;
  box-shadow: none; transform: none; transition: background 0.18s ease;
}
.tc-caixa .tc-botao:hover { background: #818cf8; border-color: #818cf8; color: #fff; box-shadow: none; transform: none; }

@media (prefers-reduced-motion: reduce) {
  .tc-veu, .tc-caixa, .tc-icone { animation: none; }
}
`;

export default PrimeiroAcessoTour;
