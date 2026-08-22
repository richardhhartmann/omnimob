import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { TourGuiado } from "./TourGuiado";
import { totalDePassos } from "../utils/tourFluxo";
import { ETAPA_BOAS_VINDAS_FLOW, chavesDoFlow, montarFluxoFlow } from "../utils/tourFlow";
import { lerDoUsuario, gravarNoUsuario, CHAVES } from "../utils/chaveDoTenant";
import { IconeChapeuFormatura } from "./Icones.jsx";
import { PRIMEIRO_ACESSO_CSS } from "./PrimeiroAcessoModal.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   O PRIMEIRO ACESSO AO FLOW.

   Irmão de [PrimeiroAcessoTour], e as diferenças são todas de MOMENTO:

     aquele dispara no primeiro acesso ao PAINEL;
     este dispara na primeira vez que a pessoa entra no MÓDULO — o que pode
     acontecer meses depois, quando a imobiliária contrata o Flow.

   Por isso ele é montado dentro do `AdminLayout` mas só existe quando
   `moduloAtivo === FLOW`. Montá-lo sempre faria uma consulta ao progresso do
   tutorial em toda sessão de quem só usa o Hub — que é a maioria das contas.

   ── QUEM MANDA CONTINUA SENDO O BANCO ──

   Mesma regra do tour do Hub, e pelo mesmo motivo: "esta pessoa já viu o Flow?"
   tem que seguir a pessoa entre navegadores. A marca local é só o ATALHO que
   evita o véu de espera no recarregamento — ela silencia, nunca mostra.

   ── ELE ESPERA A VEZ ──

   `pronto` vem do layout e cobre o encontro com os outros modais de entrada.
   Sem isso, quem contrata o Flow e entra pela primeira vez veria o assistente
   da conta, o tour do Hub e este, os três disputando a mesma tela.
   ──────────────────────────────────────────────────────────────────────────── */

export function PrimeiroAcessoFlow({ session, pronto = true, aoMudarEstado }) {
  const tenantSlug = session?.tenant?.slug || "";
  const tenantId = session?.tenant?.id || "";
  const usuarioId = session?.usuario?.id;
  const cargo = session?.usuario?.cargo;
  const nome = session?.usuario?.nome || "";
  const navegar = useNavigate();

  const fluxo = useMemo(
    () => montarFluxoFlow({ cargo, plano: session?.tenant?.plano }),
    [cargo, session?.tenant?.plano],
  );
  const totalPassos = useMemo(() => totalDePassos(fluxo), [fluxo]);

  const [fase, setFase] = useState("carregando"); // carregando · oculto · convite · tour

  /* Abaixo disto o holofote não tem para onde apontar — o funil vira rolagem
     horizontal e o cartão cobriria o alvo. Mesma trava do tour do Hub: em vez
     de rodar um tour ruim, não grava nada e deixa pendente. */
  const LARGURA_MINIMA = 900;

  const [decidido, setDecidido] = useState(
    () => (usuarioId && lerDoUsuario(CHAVES.tourFlowResolvido, tenantId, usuarioId) === "1" ? "oculto" : null),
  );

  useEffect(() => {
    if (!tenantSlug || !fluxo.length) return undefined;
    if (window.innerWidth < LARGURA_MINIMA) { setDecidido("oculto"); return undefined; }

    let vivo = true;
    api.getTutorial(tenantSlug)
      .then((r) => {
        if (!vivo) return;
        const resolvidas = new Set(
          (r?.etapas || [])
            .filter((e) => e.status === "FINALIZADO" || e.status === "PULADO")
            .map((e) => e.etapa),
        );
        const resolvido = resolvidas.has(ETAPA_BOAS_VINDAS_FLOW);
        if (resolvido && usuarioId) {
          gravarNoUsuario(CHAVES.tourFlowResolvido, tenantId, usuarioId, "1");
        }
        setDecidido(resolvido ? "oculto" : "convite");
      })
      .catch(() => { if (vivo) setDecidido("oculto"); });

    return () => { vivo = false; };
  }, [tenantSlug, tenantId, usuarioId, fluxo.length]);

  useEffect(() => {
    if (!pronto || !decidido) return;
    setFase((atual) => (atual === "carregando" ? decidido : atual));
  }, [pronto, decidido]);

  useEffect(() => {
    aoMudarEstado?.(fase === "convite" || fase === "tour");
  }, [fase, aoMudarEstado]);

  const registrar = useCallback((etapa, status, passoParou, totalDaEtapa) => {
    if (!tenantSlug) return Promise.resolve();
    return api.marcarTutorial(tenantSlug, {
      etapa, status, passoParou: passoParou ?? null, totalPassos: totalDaEtapa ?? null,
    }).catch((erro) => {
      console.warn("[tour flow] não consegui gravar o progresso:", erro?.message || erro);
    });
  }, [tenantSlug]);

  const marcarResolvido = useCallback(() => {
    gravarNoUsuario(CHAVES.tourFlowResolvido, tenantId, usuarioId, "1");
  }, [tenantId, usuarioId]);

  const pularTudo = useCallback((chaves) => {
    if (!tenantSlug || !chaves.length) return Promise.resolve();
    return api.pularTutorialTodo(tenantSlug, { etapas: chaves, passoParou: null }).catch(() => {});
  }, [tenantSlug]);

  function comecar() {
    marcarResolvido();
    registrar(ETAPA_BOAS_VINDAS_FLOW, "FINALIZADO", 1, 1);
    setFase("tour");
  }

  function dispensar() {
    marcarResolvido();
    pularTudo(chavesDoFlow(fluxo));
    setFase("oculto");
  }

  function terminar(motivo, info) {
    marcarResolvido();
    if (motivo === "concluiu") {
      /* Volta para a visão do Flow. O tour termina apontando o seletor de
         módulo, que fica na barra — largar a pessoa na tela de comissões depois
         de um passo que fala em trocar de módulo seria largá-la no lugar
         errado. Mesma escolha do tour do Hub. */
      navegar("/flow");
      setFase("oculto");
      return;
    }
    const idx = fluxo.findIndex((e) => e.chave === info?.chave);
    if (idx >= 0) {
      registrar(info.chave, "PULADO", info.passo, info.total);
      const restantes = fluxo.slice(idx + 1).map((e) => e.chave);
      if (restantes.length) pularTudo(restantes);
    } else {
      pularTudo(chavesDoFlow(fluxo));
    }
    setFase("oculto");
  }

  if (fase === "oculto" || fase === "carregando") return null;

  if (fase === "convite") {
    return <ConviteFlow nome={nome} totalPassos={totalPassos} aoComecar={comecar} aoPular={dispensar} />;
  }
  return <TourGuiado fluxo={fluxo} aoRegistrar={registrar} aoTerminar={terminar} />;
}

/* O convite. Reusa as classes `pa-*` do [PrimeiroAcessoModal] de propósito: é o
   mesmo tipo de momento e ele já tem o desenho certo. O que muda é o texto e o
   acento — verde-azulado, a cor do módulo, para o convite já anunciar em qual
   metade do produto a pessoa está entrando. */
function ConviteFlow({ nome, totalPassos, aoComecar, aoPular }) {
  const primeiroNome = (nome || "").split(" ")[0];
  const paradas = totalPassos === 1 ? "1 parada curta" : `${totalPassos} paradas curtas`;

  return (
    <div className="pa-veu">
      <style>{`${PRIMEIRO_ACESSO_CSS}
${CSS_FLOW}`}</style>
      <div className="pa-caixa is-flow" role="dialog" aria-modal="true" aria-labelledby="paf-titulo">
        <span className="pa-icone is-flow" aria-hidden="true"><IconeChapeuFormatura size={26} /></span>
        <span className="pa-eyebrow is-flow">● OMNIMOB FLOW</span>
        <h2 id="paf-titulo" className="pa-titulo">
          {primeiroNome ? `Bem-vindo ao Flow, ${primeiroNome}` : "Bem-vindo ao Omnimob Flow"}
        </h2>
        <p className="pa-texto">
          Este é o outro lado do sistema. Enquanto o <strong>Hub</strong> cuida do acervo e da
          vitrine, o <strong>Flow</strong> cuida do que está sendo fechado: o lead que chega do
          portal, o funil, a documentação, o contrato e a comissão.
        </p>
        <ul className="pa-lista is-flow">
          <li>{paradas}, e você pode sair a qualquer momento</li>
          <li>O seu trabalho no Hub continua exatamente onde está</li>
          <li>Dá para rever depois, em Configurações</li>
        </ul>
        <button type="button" className="pa-botao pa-botao--primario is-flow" onClick={aoComecar}>
          Conhecer o Flow
        </button>
        <button type="button" className="pa-botao pa-botao--fraco" onClick={aoPular}>
          Explorar por conta própria
        </button>
      </div>
    </div>
  );
}

/* Só os desvios de cor. O resto (`pa-veu`, `pa-caixa`, `pa-botao`) já está no
   CSS do [PrimeiroAcessoModal], que é montado pelo mesmo layout — duplicar a
   folha inteira aqui é como as duas versões divergem. */
const CSS_FLOW = `
.pa-caixa.is-flow { border-color: rgba(20,184,166,0.28); }
.pa-icone.is-flow { background: rgba(20,184,166,0.14); color: #14b8a6; }
.pa-eyebrow.is-flow { color: #14b8a6; }
.pa-lista.is-flow li::before { background: #14b8a6; }
.pa-botao--primario.is-flow { background: #14b8a6; color: #04211d; }
.pa-botao--primario.is-flow:hover { background: #2dd4bf; }
`;
