import { useEffect, useState } from "react";
import { api } from "../api";
import { marcarTourAberto, quandoSemTour } from "../utils/tourAtivo";
import { CSS_DO_PULSO } from "./PulsoTrialModal";

/* ────────────────────────────────────────────────────────────────────────────
   O COMUNICADO AVULSO, na tela — porte do modal de comunicado do VYA.

   O aviso que a Omnimob manda para esta imobiliária (ou para todas): abre uma
   vez para cada pessoa, ao entrar no painel, quando nada mais está na tela.
   Enquanto aberto ele se marca como "tour": as Novidades e as perguntas
   esperam, em vez de subirem por cima (`utils/tourAtivo.js`).

   Quem decide o que mostrar é o servidor (`comunicadoRoutes`): nunca para a
   demonstração nem para o suporte dentro da conta. A caixa é a das perguntas
   do painel (`CSS_DO_PULSO`), e o texto vai como texto — sem HTML.
   ──────────────────────────────────────────────────────────────────────────── */

export function ComunicadoAvulso({ tenantSlug, pronto = true, registrar = true }) {
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    if (!tenantSlug || !pronto) return undefined;
    let vivo = true;
    const cancelar = quandoSemTour(() => {
      api.comunicadoPendente(tenantSlug)
        .then((r) => { if (vivo && r?.comunicado) setAviso(r.comunicado); })
        .catch(() => {});
    });
    return () => { vivo = false; cancelar(); };
  }, [tenantSlug, pronto]);

  // Aberto, segura a fila dos outros avisos.
  useEffect(() => (aviso ? marcarTourAberto() : undefined), [aviso]);

  function fechar() {
    if (registrar) api.marcarComunicadoVisto(tenantSlug, aviso.id).catch(() => {});
    setAviso(null);
  }

  useEffect(() => {
    if (!aviso) return undefined;
    const aoTeclar = (e) => { if (e.key === "Escape") fechar(); };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  if (!aviso) return null;
  return (
    <>
      <style>{CSS_DO_PULSO}{CSS}</style>
      <div className="pt-veu" onMouseDown={(e) => e.target === e.currentTarget && fechar()}>
        <div className="pt-caixa" role="dialog" aria-modal="true" aria-labelledby="ca-titulo">
          <span className="pt-eyebrow">● AVISO DA OMNIMOB</span>
          <h2 id="ca-titulo" className="pt-titulo">{aviso.titulo}</h2>
          <p className="ca-texto">{aviso.texto}</p>
          <div className="pt-acoes pt-acoes--centro">
            <button type="button" className="pt-btn pt-btn--primario" onClick={fechar} autoFocus>Entendi</button>
          </div>
        </div>
      </div>
    </>
  );
}

const CSS = `
.ca-texto { margin: 6px 0 18px; font-size: 14px; line-height: 1.6; color: #cbd5e1; white-space: pre-wrap; }
`;
