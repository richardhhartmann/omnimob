import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../api";
import { TourGuiado } from "./TourGuiado";
import { montarTourDeTela, telaDaRota } from "../utils/tourTelas";

/* ────────────────────────────────────────────────────────────────────────────
   Dispara o tour DA TELA em que a pessoa acabou de entrar.

   Regra de ouro: só aparece para quem escolheu abrir aquela tela. Ele não faz
   parte dos 17 passos do tour global — quem só quis conhecer o sistema por
   cima não deve ser arrastado para dentro de um formulário.

   Quatro silêncios, todos deliberados:

   1. Tour global rodando. Ele já visita /clientes e /usuarios; sem isto, o
      tour de tela subiria por cima na primeira parada e seriam dois roteiros
      disputando a mesma tela. Quem avisa é o `globalAtivo`, que o AdminLayout
      repassa.

   2. Já resolvido. FINALIZADO ou PULADO naquela tela: a aula não se repete.

   3. Telas estreitas. Mesmo motivo do tour global — abaixo de 900px o holofote
      não tem para onde apontar. Não gravamos nada: fica pendente para o dia em
      que ela abrir no desktop.

   4. Troca de rota no meio. Se a pessoa sai da tela com o tour aberto, ele
      encerra e grava onde parou, em vez de ficar apontando para elementos que
      não existem mais.
   ──────────────────────────────────────────────────────────────────────────── */

const LARGURA_MINIMA = 900;

/* Respiro entre chegar na rota e abrir o tour: a tela ainda está montando,
   buscando na API e rodando a animação de entrada do <Outlet>.

   Curto de propósito. Era quase um segundo, e nesse vão dava tempo de alguém
   decidido já ter clicado em "Novo Imóvel" — o tour abria para uma tela que
   tinha mudado embaixo dele. Encurtar não resolve sozinho (ninguém ganha da
   pessoa apressada), por isso os passos também sabem se pular; ver `pularSe`
   em utils/tourTelas.js. */
const ESPERA_MONTAGEM_MS = 450;

export function TourDeTela({ session, globalAtivo, pronto = true, pedido = 0 }) {
  const local = useLocation();
  const tenantSlug = session?.tenant?.slug || "";
  const plano = session?.tenant?.plano;

  const tela = telaDaRota(local.pathname);
  const [ativa, setAtiva] = useState(null); // chave da tela com tour aberto
  // Chaves já resolvidas no banco. Uma consulta por sessão, não por navegação.
  const resolvidasRef = useRef(null);
  const carregandoRef = useRef(false);

  const roteiro = useMemo(
    () => (ativa ? montarTourDeTela(ativa, { plano }) : null),
    [ativa, plano],
  );

  /* ── Carrega o que já foi resolvido, uma vez ────────────────────────────── */

  /* Relê a cada entrada numa tela com tour, em vez de guardar para a sessão
     inteira. O cache de sessão fazia "Rever o tour" não funcionar: o botão
     apaga o progresso no banco, mas este componente continuava consultando a
     lista velha em memória e concluindo que tudo já tinha sido visto. É uma
     requisição pequena por navegação, e ela precisa ser a fonte da verdade. */
  const carregarResolvidas = useCallback(async () => {
    if (carregandoRef.current || !tenantSlug) return;
    carregandoRef.current = true;
    try {
      const r = await api.getTutorial(tenantSlug);
      resolvidasRef.current = new Set(
        (r?.etapas || [])
          .filter((e) => e.status === "FINALIZADO" || e.status === "PULADO")
          .map((e) => e.etapa),
      );
    } catch {
      // Sem resposta, não arriscamos abrir um tour que talvez já tenha sido
      // visto: um conjunto vazio faria tudo reaparecer a cada falha de rede.
      resolvidasRef.current = null;
    } finally {
      carregandoRef.current = false;
    }
  }, [tenantSlug]);

  /* ── Decide abrir ───────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!tela || !pronto || globalAtivo || ativa) return undefined;
    if (window.innerWidth < LARGURA_MINIMA) return undefined;

    let vivo = true;
    const temporizador = setTimeout(async () => {
      await carregarResolvidas();
      if (!vivo || !resolvidasRef.current) return;
      // A rota pode ter mudado durante a espera.
      if (telaDaRota(window.location.pathname) !== tela) return;

      const roteiroTeste = montarTourDeTela(tela, { plano });
      if (!roteiroTeste || resolvidasRef.current.has(roteiroTeste.chave)) return;
      setAtiva(tela);
    }, ESPERA_MONTAGEM_MS);

    return () => { vivo = false; clearTimeout(temporizador); };
  }, [tela, pronto, globalAtivo, ativa, plano, carregarResolvidas]);

  /* ── Reabertura a pedido (botão de Ajuda) ───────────────────────────────── */

  /* O botão de Ajuda pede o tour desta tela DE NOVO, e aqui ele passa por cima
     das quatro condições que o abrem sozinho — inclusive a de já ter sido
     concluído, que é justamente o caso de quem clica em "rever".

     `pedido` é um contador, não um booleano: pedir duas vezes seguidas o mesmo
     tour tem que funcionar, e um `true` que já era `true` não dispara efeito
     nenhum. O ref guarda qual pedido já foi atendido. */
  const pedidoAtendidoRef = useRef(pedido);
  useEffect(() => {
    if (pedido === pedidoAtendidoRef.current) return;
    pedidoAtendidoRef.current = pedido;
    if (!tela) return;
    setAtiva(tela);
  }, [pedido, tela]);

  /* ── Sair da tela encerra o tour ────────────────────────────────────────── */

  useEffect(() => {
    if (!ativa) return;
    if (telaDaRota(local.pathname) === ativa) return;
    // Saiu no meio. Não é "pulou" com desprezo — é abandono, e o registro é o
    // mesmo: a tela não volta a abrir sozinha.
    if (roteiro) {
      api.marcarTutorial(tenantSlug, {
        etapa: roteiro.chave, status: "PULADO", passoParou: null, totalPassos: roteiro.passos.length,
      }).catch(() => {});
      resolvidasRef.current?.add(roteiro.chave);
    }
    setAtiva(null);
  }, [local.pathname, ativa, roteiro, tenantSlug]);

  /* ── Gravação ───────────────────────────────────────────────────────────── */

  const registrar = useCallback((chaveEtapa, status, passoParou, totalPassos) => {
    if (!tenantSlug) return Promise.resolve();
    if (status === "FINALIZADO" || status === "PULADO") resolvidasRef.current?.add(chaveEtapa);
    return api.marcarTutorial(tenantSlug, {
      etapa: chaveEtapa, status, passoParou: passoParou ?? null, totalPassos: totalPassos ?? null,
    }).catch((erro) => {
      console.warn("[tour-tela] não consegui gravar o progresso:", erro?.message || erro);
    });
  }, [tenantSlug]);

  function terminar(motivo, info) {
    if (motivo === "pulou" && info?.chave) {
      registrar(info.chave, "PULADO", info.passo, info.total);
    }
    setAtiva(null);
  }

  if (!roteiro) return null;

  // O motor trabalha com uma LISTA de etapas; aqui é sempre uma só.
  return <TourGuiado fluxo={[roteiro]} aoRegistrar={registrar} aoTerminar={terminar} />;
}

export default TourDeTela;
