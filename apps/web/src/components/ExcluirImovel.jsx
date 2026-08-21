import { useEffect, useState } from "react";
import { Warning, Info, FacebookLogo, InstagramLogo, Storefront } from "@phosphor-icons/react";
import { api } from "../api";
import { Modal } from "./Modal.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   Excluir um imóvel que está anunciado em outros lugares.

   ── POR QUE ISTO NÃO É UM `confirm()` ──

   Era. "Excluir este imóvel permanentemente?" → OK → sumia daqui e continuava
   no ar no Facebook e no Mercado Livre, agora sem nenhum caminho pelo painel
   para alcançá-lo: o registro que guardava o id do anúncio lá fora ia junto.

   ── A REGRA DAS CAIXAS ──

   Marcada por padrão onde a remoção FUNCIONA — é o que a pessoa quer em quase
   todo caso, e desmarcar é mais fácil do que descobrir que precisava marcar.

   Onde NÃO funciona, a linha aparece assim mesmo, travada e com o motivo. É a
   parte que mais importa: o Instagram não deixa apagar post por API, e esconder
   essa linha faria a pessoa sair achando que removeu de tudo.

   ── O VÉU NÃO É DESTE ARQUIVO ──

   Ele montava o próprio `position: fixed`, e o resultado era o véu cobrindo só
   um pedaço da página: o `AdminLayout` embrulha o conteúdo numa div com
   `transform`, e `fixed` dentro de `transform` mede por ela, não pela janela.
   Agora quem cuida disso é `components/Modal.jsx`, que sai pelo portal.

   Os portais são um terceiro caso — não têm caixa nenhuma. Ninguém precisa
   escolher, porque sair é automático; precisa saber QUANDO, e "até 24h" é a
   resposta.
   ──────────────────────────────────────────────────────────────────────────── */

/* Mesmos ícones e cores de `CanaisDoImovel`, para o canal parecer o mesmo
   canal nas duas telas. */
const MARCA = {
  FACEBOOK:      { Icone: FacebookLogo,  cor: "#1877f2" },
  INSTAGRAM:     { Icone: InstagramLogo, cor: "#e1306c" },
  MERCADO_LIVRE: { Icone: Storefront,    cor: "#ffe600", tinta: "#2d3277" },
};

export function ExcluirImovel({ imovel, tenantSlug, aoFechar, aoConfirmar }) {
  const [opcoes, setOpcoes] = useState(null);
  const [marcados, setMarcados] = useState({});
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {
    let vivo = true;
    api.canaisParaRemover(tenantSlug, imovel.id)
      .then((r) => {
        if (!vivo) return;
        const lista = r.opcoes || [];
        setOpcoes(lista);
        const inicial = {};
        for (const o of lista) if (o.podeRemover) inicial[o.canal] = true;
        setMarcados(inicial);
      })
      /* Falhar aqui não pode travar a exclusão: cai na lista vazia e o modal
         vira a confirmação simples de sempre. */
      .catch(() => vivo && setOpcoes([]));
    return () => { vivo = false; };
  }, [tenantSlug, imovel.id]);

  async function confirmar() {
    setExcluindo(true);
    const canais = Object.entries(marcados).filter(([, v]) => v).map(([k]) => k);
    await aoConfirmar(canais);
    setExcluindo(false);
  }

  const carregando = opcoes === null;
  const comCaixa = (opcoes || []).filter((o) => !o.automatico);
  const automaticos = (opcoes || []).filter((o) => o.automatico);

  return (
    <Modal
      titulo="Excluir imóvel"
      subtitulo={imovel.title}
      aoFechar={aoFechar}
      ocupado={excluindo}
      adorno={<div className="exi-alerta"><Warning size={20} weight="fill" /></div>}
      acoes={
        <>
          <button type="button" className="exi-btn" onClick={aoFechar} disabled={excluindo}>
            Cancelar
          </button>
          <button type="button" className="exi-btn exi-btn--perigo" onClick={confirmar} disabled={excluindo || carregando}>
            {excluindo ? "Excluindo…" : "Excluir imóvel"}
          </button>
        </>
      }
    >
      {carregando ? (
        <p className="exi-carregando">Conferindo onde este imóvel está anunciado…</p>
      ) : comCaixa.length || automaticos.length ? (
        <>
          {comCaixa.length ? (
            <>
              <p className="exi-pergunta">Este imóvel está anunciado fora da Omnimob. Remover também de:</p>
              <div className="exi-canais">
                {comCaixa.map((o) => (
                  <label
                    key={o.canal}
                    className={`exi-canal${o.podeRemover ? "" : " is-travado"}${marcados[o.canal] ? " is-on" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(marcados[o.canal])}
                      disabled={!o.podeRemover || excluindo}
                      onChange={(e) => setMarcados((p) => ({ ...p, [o.canal]: e.target.checked }))}
                    />
                    <span className="exi-canal__icone" style={{ background: MARCA[o.canal]?.cor || "#3f3f46" }}>
                      {(() => { const I = MARCA[o.canal]?.Icone || Storefront; return <I size={14} weight="fill" color={MARCA[o.canal]?.tinta || "#fff"} />; })()}
                    </span>
                    <span className="exi-canal__nome">
                      {o.nome}
                      <small>{o.nota}</small>
                    </span>
                  </label>
                ))}
              </div>
            </>
          ) : null}

          {automaticos.map((o) => (
            <p key={o.canal} className="exi-automatico">
              <Info size={15} /> <strong>{o.nome}:</strong> {o.nota}
            </p>
          ))}
        </>
      ) : (
        <p className="exi-pergunta">Este imóvel não está anunciado fora da Omnimob.</p>
      )}

      <p className="exi-aviso">A exclusão aqui não tem volta. Fotos, leads e métricas do imóvel vão junto.</p>
    </Modal>
  );
}
