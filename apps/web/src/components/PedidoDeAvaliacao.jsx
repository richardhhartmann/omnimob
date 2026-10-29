import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../api";
import { tourAtivo } from "../utils/tourAtivo";
import {
  consumirPendenciaDeAvaliacao,
  definirDonoDoPulsoDeAvaliacao,
  devolverPendenciaDeAvaliacao,
  encerrarPulsoDeAvaliacao,
} from "../utils/pulsoAvaliacao";
import { CSS_DO_PULSO } from "./PulsoTrialModal";

/* ────────────────────────────────────────────────────────────────────────────
   "O que você está achando da Omnimob?" — porte do pedido do VYA.

   Aparece sozinho, DE VEZ EM QUANDO: a cada 5 operações, quando a pessoa sai
   da tela onde trabalhou (a regra mora em `utils/pulsoAvaliacao.js`). Quem
   responde não vê nunca mais; "Agora não" só adia para as próximas operações.
   A resposta vai para `POST /api/avaliacoes` e aparece na aba Avaliações do
   super-admin.

   As travas que importam: nunca por cima do tour (adia, não engole), nunca no
   editor de vitrine, e quem diz "pode perguntar" é o servidor — ele sabe se a
   pessoa já respondeu, se a conta está em teste, se é o suporte dentro dela.

   A caixa é a da pesquisa do trial (`CSS_DO_PULSO`): um desenho de modal só.
   ──────────────────────────────────────────────────────────────────────────── */

const ESPERA_MS = 2400;
const ROTA_DO_EDITOR = /\/vitrine\/[^/]+\/editar/;
const ROTULOS = ["", "Muito ruim", "Ruim", "Mais ou menos", "Bom", "Excelente"];

export function PedidoDeAvaliacao({ tenantSlug, tenantId, usuarioId, pronto = true }) {
  const { pathname } = useLocation();
  const [aberto, setAberto] = useState(false);
  const [nota, setNota] = useState(0);
  const [sobre, setSobre] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState("");
  const [obrigado, setObrigado] = useState(false);
  const timer = useRef(null);
  const estado = useRef({ aberto, pronto });
  estado.current = { aberto, pronto };

  useEffect(() => {
    definirDonoDoPulsoDeAvaliacao(tenantId, usuarioId);
  }, [tenantId, usuarioId]);

  // O gatilho é a SAÍDA da tela onde houve trabalho.
  useEffect(() => {
    if (!tenantSlug || !pronto || aberto || ROTA_DO_EDITOR.test(pathname) || tourAtivo() || timer.current) return;
    if (!consumirPendenciaDeAvaliacao(pathname)) return;
    api.minhaAvaliacao(tenantSlug)
      .then((r) => {
        if (!r?.perguntar) {
          // Respondeu (ou nunca será perguntada aqui): o contador para de vez.
          if (r?.jaAvaliou) encerrarPulsoDeAvaliacao();
          return;
        }
        timer.current = setTimeout(() => {
          timer.current = null;
          // A tela pode ter mudado na espera: o tour subiu, outro modal abriu.
          if (estado.current.aberto || !estado.current.pronto) return;
          if (tourAtivo()) { devolverPendenciaDeAvaliacao(window.location.pathname); return; }
          setNota(0);
          setComentario("");
          setFalha("");
          setObrigado(false);
          setAberto(true);
        }, ESPERA_MS);
      })
      .catch(() => {});
  }, [pathname, tenantSlug, pronto, aberto]);

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!aberto) return undefined;
    const aoTeclar = (e) => { if (e.key === "Escape" && !enviando) setAberto(false); };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto, enviando]);

  async function enviar() {
    if (!nota || enviando) return;
    setEnviando(true);
    setFalha("");
    try {
      await api.avaliar(tenantSlug, { nota, comentario: comentario.trim() || null, tela: pathname });
      encerrarPulsoDeAvaliacao();
      setObrigado(true);
    } catch (e) {
      if (e?.status === 409) { encerrarPulsoDeAvaliacao(); setObrigado(true); }
      else setFalha(e?.message || "Não deu para enviar agora. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  if (!aberto) return null;
  const mostrada = sobre || nota;

  return (
    <>
      <style>{CSS_DO_PULSO}{CSS}</style>
      <div className="pt-veu" onMouseDown={(e) => e.target === e.currentTarget && !enviando && setAberto(false)}>
        <div className="pt-caixa" role="dialog" aria-modal="true" aria-labelledby="pa-titulo">
          <button type="button" className="pt-fechar" onClick={() => setAberto(false)} aria-label="Fechar" disabled={enviando}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
              <line x1="5.5" y1="5.5" x2="18.5" y2="18.5" />
              <line x1="18.5" y1="5.5" x2="5.5" y2="18.5" />
            </svg>
          </button>

          {obrigado ? (
            <div className="pt-fim">
              <h2 id="pa-titulo" className="pt-titulo">Obrigado!</h2>
              <p className="pt-texto">A sua resposta chega direto a quem constrói a Omnimob.</p>
              <div className="pt-acoes pt-acoes--centro">
                <button type="button" className="pt-btn pt-btn--primario" onClick={() => setAberto(false)}>Fechar</button>
              </div>
            </div>
          ) : (
            <>
              <span className="pt-eyebrow">● UMA PERGUNTA RÁPIDA</span>
              <h2 id="pa-titulo" className="pt-titulo">O que você está achando da Omnimob?</h2>
              <p className="pt-texto">Uma nota de 1 a 5. Se quiser, conte o que mudaria.</p>

              <div className="pa-estrelas" role="radiogroup" aria-label="Nota" onMouseLeave={() => setSobre(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={nota === n}
                    aria-label={`${n} — ${ROTULOS[n]}`}
                    className={`pa-estrela${n <= mostrada ? " is-on" : ""}`}
                    onMouseEnter={() => setSobre(n)}
                    onClick={() => setNota(n)}
                  >
                    ★
                  </button>
                ))}
              </div>
              <p className="pa-rotulo" aria-live="polite">{ROTULOS[mostrada] || " "}</p>

              <label className="pt-campo">
                <span className="pt-campo__rotulo">O que você mudaria? (opcional)</span>
                <textarea
                  className="pt-campo__area"
                  rows={3}
                  maxLength={2000}
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                />
              </label>

              {falha ? <p className="pt-falha">{falha}</p> : null}

              <div className="pt-acoes">
                <button type="button" className="pt-btn" disabled={enviando} onClick={() => setAberto(false)}>Agora não</button>
                <button type="button" className="pt-btn pt-btn--primario" disabled={!nota || enviando} onClick={enviar}>
                  {enviando ? "Enviando…" : "Enviar"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

const CSS = `
.pa-estrelas { display: flex; gap: 6px; margin: 14px 0 4px; }
.pa-estrela {
  font-size: 30px; line-height: 1; padding: 2px 4px; cursor: pointer;
  background: none; border: none; color: rgba(148,163,184,0.35); transition: color 0.12s ease, transform 0.12s ease;
}
.pa-estrela:hover { transform: scale(1.08); }
.pa-estrela.is-on { color: #fbbf24; }
.pa-estrela:focus-visible { outline: 2px solid #fbbf24; outline-offset: 2px; border-radius: 6px; }
.pa-rotulo { min-height: 18px; margin: 0 0 10px; font-size: 12.5px; color: #94a3b8; }
`;
