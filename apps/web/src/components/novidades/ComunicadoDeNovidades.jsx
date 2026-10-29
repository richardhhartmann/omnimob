import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { X } from "@phosphor-icons/react";
import { api } from "../../api";
import { tourAtivo } from "../../utils/tourAtivo";
/* A apresentação (e os ícones dela) só baixa quando há o que mostrar: este
   componente mora no pacote comum do painel, e quase toda carga termina em
   "nada pendente". */
const Apresentacao = lazy(() => import("./Apresentacao").then((m) => ({ default: m.Apresentacao })));
import { rotuloDaSemana } from "./tipos";

/* ────────────────────────────────────────────────────────────────────────────
   O COMUNICADO DAS NOVIDADES, do lado do cliente — porte do VYA.

   Abre SOZINHO uma vez por pessoa, com a publicação recente que ela ainda não
   viu (`GET /api/novidades/pendente`; o servidor já corta o que o cargo e a
   conta não alcançam). E abre A PEDIDO por Ajuda › Notas de versão, ou pelo
   link do e-mail (`?novidades=<chave>`), com as semanas anteriores num seletor.

   QUEM VIU: cada abertura vira uma linha (origem, total de slides, celular ou
   computador); depois vão o maior slide alcançado e o fechamento. A aba
   Novidades do super-admin junta por pessoa. Na demonstração não registra —
   a escrita seria recusada e acenderia o aviso de "nada é salvo".
   ──────────────────────────────────────────────────────────────────────────── */

function registroDeVisualizacao(slug, chave, origem) {
  let id = null, max = 1, enviado = 1, comecou = false;
  const mandar = (corpo, keepalive = false) => api.registrarVistoNovidade(slug, chave, corpo, { keepalive });
  const avancar = () => {
    if (id && max > enviado) { enviado = max; mandar({ id, slide: max }).catch(() => {}); }
  };
  return {
    slide(numero, total) {
      max = Math.max(max, numero);
      if (comecou) { avancar(); return; }
      comecou = true;
      mandar({ origem, total, dispositivo: window.innerWidth < 768 ? "celular" : "computador" })
        .then((d) => { id = d?.id ?? null; avancar(); })
        .catch(() => {});
    },
    fechar() { if (id) mandar({ id, slide: max, fechou: true }, true).catch(() => {}); },
  };
}

/**
 * `pedido`: `{ chave?: string | null }` quando a pessoa pediu para ver (menu ou
 * link); `null` deixa só o automático. `aoAtender` limpa o pedido.
 */
export function ComunicadoDeNovidades({ tenantSlug, pronto = true, registrar = true, pedido = null, aoAtender }) {
  const [aberto, setAberto] = useState(null); // { chave, versao, conteudo, origem }
  const [semanas, setSemanas] = useState([]);
  const registro = useRef(null);
  const jaPerguntou = useRef(false);

  const abrir = useCallback((n, origem) => {
    registro.current = registrar ? registroDeVisualizacao(tenantSlug, n.chave, origem) : null;
    setAberto({ ...n, origem });
  }, [registrar, tenantSlug]);

  // O automático: uma vez por carga do painel, quando nada mais está na tela.
  useEffect(() => {
    if (!tenantSlug || !pronto || jaPerguntou.current || tourAtivo()) return;
    jaPerguntou.current = true;
    api.novidadesPendente(tenantSlug)
      .then((r) => { if (r?.novidade && !tourAtivo()) abrir(r.novidade, "comunicado"); })
      .catch(() => {});
  }, [tenantSlug, pronto, abrir]);

  // A pedido: a semana pedida, ou a mais recente; a lista alimenta o seletor.
  useEffect(() => {
    if (!pedido || !tenantSlug) return;
    let vivo = true;
    api.listarNovidades(tenantSlug)
      .then(async (r) => {
        const lista = r?.novidades || [];
        if (!vivo) return;
        setSemanas(lista);
        const chave = pedido.chave && lista.some((n) => n.chave === pedido.chave) ? pedido.chave : lista[0]?.chave;
        if (!chave) { aoAtender?.(); return; }
        const n = await api.lerNovidade(tenantSlug, chave);
        if (vivo) abrir(n, "menu");
      })
      .catch(() => {})
      .finally(() => aoAtender?.());
    return () => { vivo = false; };
  }, [pedido, tenantSlug, abrir, aoAtender]);

  const aoMudarSlide = useCallback((numero, total) => registro.current?.slide(numero, total), []);

  function fechar() {
    registro.current?.fechar();
    registro.current = null;
    setAberto(null);
  }

  async function trocarSemana(chave) {
    registro.current?.fechar();
    try {
      abrir(await api.lerNovidade(tenantSlug, chave), "menu");
    } catch { /* fica na que está */ }
  }

  if (!aberto) return null;
  return (
    <div className="cn-veu" role="dialog" aria-modal="true" aria-label={aberto.conteudo.titulo}>
      <style>{CSS}</style>
      <div className="cn-caixa">
        <div className="cn-topo">
          <span className="cn-versao">{aberto.versao ? `Omnimob ${aberto.versao}` : "Novidades"}</span>
          {semanas.length > 1 ? (
            <select className="cn-semanas" value={aberto.chave} onChange={(e) => trocarSemana(e.target.value)} aria-label="Semana">
              {semanas.map((n) => (
                <option key={n.chave} value={n.chave}>
                  {n.versao ? `${n.versao} · ` : ""}{rotuloDaSemana(n.chave)}
                </option>
              ))}
            </select>
          ) : null}
          <button type="button" className="cn-fechar" onClick={fechar} aria-label="Fechar as novidades">
            <X size={18} weight="bold" />
          </button>
        </div>
        <Suspense fallback={<p className="cn-carregando">Carregando as novidades…</p>}>
          <Apresentacao key={aberto.chave} conteudo={aberto.conteudo} aoFechar={fechar} aoMudarSlide={aoMudarSlide} />
        </Suspense>
      </div>
    </div>
  );
}

const CSS = `
.cn-veu { position: fixed; inset: 0; z-index: 1200; background: rgba(5,6,12,0.82); backdrop-filter: blur(6px); display: grid; place-items: center; padding: 24px; overflow-y: auto; }
.cn-caixa { width: min(1180px, 100%); display: grid; gap: 12px; }
.cn-topo { display: flex; align-items: center; gap: 12px; color: #cbd5e1; font-size: 13px; }
.cn-versao { font-weight: 700; letter-spacing: 0.04em; }
.cn-semanas { background: rgba(14,15,26,0.8); color: #fff; border: 1px solid rgba(148,163,184,0.35); border-radius: 999px; padding: 6px 12px; font: inherit; font-size: 12.5px; }
.cn-fechar { margin-left: auto; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; cursor: pointer; color: #fff; background: rgba(14,15,26,0.8); border: 1px solid rgba(148,163,184,0.35); }
.cn-fechar:hover { border-color: #a5b4fc; }
.cn-carregando { color: #cbd5e1; text-align: center; padding: 80px 0; }
@media (max-width: 640px) { .cn-veu { padding: 10px; } }
`;
