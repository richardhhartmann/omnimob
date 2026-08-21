import { useEffect, useState } from "react";
import { api } from "../api";
import {
  OPACIDADE_MAX,
  OPACIDADE_MIN,
  OPACIDADE_PADRAO,
  PROPORCAO_MARCA,
} from "../utils/marcaDagua";

/* ────────────────────────────────────────────────────────────────────────────
   Marca d'água: o controle e a simulação.

   O ajuste é de aparência e a decisão é visual — "quanto de logo eu quero na
   minha foto?" não se responde olhando para o número 55. Por isso o controle
   vem colado a uma simulação de post que reage no mesmo quadro em que a pessoa
   arrasta o cursor.

   ── A SIMULAÇÃO É UMA APROXIMAÇÃO, E ISSO É DELIBERADO ──

   A marca de verdade é composta em canvas na hora do upload
   (`utils/marcaDagua.js`); aqui ela é uma `<img>` sobreposta por CSS. Refazer a
   composição em canvas a cada movimento do controle custaria caro e não daria
   nada em troca: o que muda entre as duas é a técnica, não o resultado.

   O que impede as duas de divergirem são os NÚMEROS, importados do mesmo
   módulo: a proporção da marca e os limites de opacidade vêm de lá. Mexer na
   regra num lugar move os dois.
   ──────────────────────────────────────────────────────────────────────────── */

const TAMANHO_PCT = `${Math.round(PROPORCAO_MARCA * 100)}%`;

function IconeCoracao() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}
function IconeBalao() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-3.8-.9L3 21l1.9-5.1A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z" />
    </svg>
  );
}
function IconeAviao() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

export function MarcaDaguaConfig({ logoUrl, ativa, opacidade, onAtiva, onOpacidade, tenantSlug, tenantNome }) {
  const valor = Number.isFinite(Number(opacidade)) ? Number(opacidade) : OPACIDADE_PADRAO;
  const temLogo = Boolean(logoUrl);

  /* Uma foto REAL da imobiliária deixa a simulação convincente: a pergunta é
     "como fica na MINHA foto", e um gradiente genérico não responde. Uma
     chamada, sem bloquear nada — se falhar ou se ainda não houver imóvel com
     foto, o degradê abaixo assume. */
  const [fotoExemplo, setFotoExemplo] = useState("");
  useEffect(() => {
    if (!tenantSlug) return undefined;
    let vivo = true;
    api.getPublicShowcase(tenantSlug)
      .then((dados) => {
        if (!vivo) return;
        const url = (dados?.properties || [])
          .flatMap((p) => p.images || [])
          .find((img) => img?.url && !img.is360)?.url;
        if (url) setFotoExemplo(url);
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, [tenantSlug]);

  return (
    <div style={{ display: "flex", gap: "20px", alignItems: "flex-start", flexWrap: "wrap" }}>
      {/* ── Controles ── */}
      <div style={{ flex: 1, minWidth: "260px", display: "flex", flexDirection: "column", gap: "14px" }}>
        <label
          style={{
            display: "flex", alignItems: "flex-start", gap: "12px", padding: "14px 16px",
            borderRadius: "12px", background: "var(--sup-02, rgba(255,255,255,0.02))",
            border: "1px solid var(--linha-08, rgba(255,255,255,0.08))",
            cursor: temLogo ? "pointer" : "default", opacity: temLogo ? 1 : 0.55,
          }}
        >
          <input
            type="checkbox"
            className="sw"
            checked={Boolean(ativa)}
            disabled={!temLogo}
            onChange={(e) => onAtiva(e.target.checked)}
            style={{ marginTop: "2px" }}
          />
          <span style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600 }}>Aplicar minha logo nas fotos dos imóveis</span>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.5 }}>
              A logo é gravada no centro de cada foto no momento do cadastro — a mesma imagem vale
              para a vitrine, para a página do imóvel e para os posts no Facebook e no Instagram.
              Fotos panorâmicas 360° não recebem marca.
            </span>
          </span>
        </label>

        {/* O controle de opacidade só faz sentido com a marca ligada. Some em
            vez de ficar esmaecido: um deslizador inerte convida ao clique e
            devolve nada. */}
        {temLogo && ativa ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "14px 16px", borderRadius: "12px", background: "var(--sup-02, rgba(255,255,255,0.02))", border: "1px solid var(--linha-08, rgba(255,255,255,0.08))" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "10px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600 }}>Intensidade da marca</span>
              <span style={{ fontSize: "13px", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--accent, #818cf8)" }}>
                {valor}%
              </span>
            </div>
            <input
              type="range"
              min={OPACIDADE_MIN}
              max={OPACIDADE_MAX}
              step={5}
              value={valor}
              onChange={(e) => onOpacidade(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--accent, #818cf8)" }}
              aria-label="Intensidade da marca d'água"
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)" }}>
              <span>Discreta</span>
              <span>Marcante</span>
            </div>
          </div>
        ) : null}

        {!temLogo ? (
          <p style={{ margin: 0, fontSize: "12.5px", lineHeight: 1.6, color: "var(--text-muted)", padding: "12px 14px", borderRadius: "10px", background: "rgba(212,175,55,0.07)", border: "1px solid rgba(212,175,55,0.2)" }}>
            Envie o logotipo acima para liberar a marca d'água.
          </p>
        ) : null}
      </div>

      {/* ── Simulação de post ── */}
      <div style={{ width: "290px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
          Como fica no post
        </span>

        <div style={{ borderRadius: "16px", overflow: "hidden", background: "var(--sup-03, rgba(255,255,255,0.03))", border: "1px solid var(--linha-09, rgba(255,255,255,0.09))" }}>
          {/* Cabeçalho do post */}
          <div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "10px 12px" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "var(--sup-08, rgba(255,255,255,0.08))", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {temLogo
                ? <img src={logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                : <span style={{ fontSize: "12px", fontWeight: 700 }}>{(tenantNome || "I").charAt(0).toUpperCase()}</span>}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "12px", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {tenantNome || "sua imobiliária"}
              </div>
              <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>agora</div>
            </div>
          </div>

          {/* A foto, quadrada como no Instagram */}
          <div
            style={{
              position: "relative", width: "100%", aspectRatio: "1 / 1", overflow: "hidden",
              background: fotoExemplo
                ? "#0b1220"
                : "linear-gradient(135deg, #35507a 0%, #1b2740 55%, #24344f 100%)",
            }}
          >
            {fotoExemplo ? (
              <img src={fotoExemplo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setFotoExemplo("")} />
            ) : (
              /* Sem foto ainda: um ambiente sugerido por formas, o suficiente
                 para julgar a marca contra claro e escuro ao mesmo tempo. */
              <div aria-hidden style={{ position: "absolute", inset: 0 }}>
                <div style={{ position: "absolute", inset: "58% 0 0 0", background: "linear-gradient(180deg, var(--sup-10, rgba(255,255,255,0.10)), var(--sup-02, rgba(255,255,255,0.02)))" }} />
                <div style={{ position: "absolute", left: "12%", top: "22%", width: "24%", height: "34%", borderRadius: "4px", background: "var(--sup-13, rgba(255,255,255,0.13))" }} />
                <div style={{ position: "absolute", right: "14%", top: "30%", width: "18%", height: "26%", borderRadius: "4px", background: "var(--sup-09, rgba(255,255,255,0.09))" }} />
              </div>
            )}

            {temLogo && ativa ? (
              <img
                src={logoUrl}
                alt=""
                style={{
                  position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                  /* Os mesmos limites da composição real: cabe na largura E na
                     altura, mantendo a proporção. `object-fit: contain` faz o
                     papel do fator de escala do canvas. */
                  maxWidth: TAMANHO_PCT, maxHeight: TAMANHO_PCT, objectFit: "contain",
                  opacity: valor / 100,
                  filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.45))",
                  pointerEvents: "none",
                }}
              />
            ) : null}
          </div>

          {/* Rodapé do post */}
          <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "7px" }}>
            <div style={{ display: "flex", gap: "13px", color: "var(--text-muted)" }}>
              <IconeCoracao /><IconeBalao /><IconeAviao />
            </div>
            <p style={{ margin: 0, fontSize: "11.5px", lineHeight: 1.5, color: "var(--text-muted)" }}>
              <strong style={{ color: "var(--text-main)" }}>{tenantNome || "sua imobiliária"}</strong>{" "}
              Apartamento 3 quartos no Centro · R$ 740.000 #imoveis
            </p>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: "11px", color: "var(--text-muted)", opacity: 0.7, lineHeight: 1.5 }}>
          {temLogo && ativa
            ? "Simulação. A marca é gravada na foto no cadastro do imóvel — fotos já cadastradas não mudam."
            : "Com a marca desligada, as fotos são publicadas exatamente como foram enviadas."}
        </p>
      </div>
    </div>
  );
}
