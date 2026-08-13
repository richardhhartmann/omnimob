import { useMemo, useState } from "react";
import { api } from "../api";
import { planoLiberaIA } from "../utils/planos";

/* ────────────────────────────────────────────────────────────────────────────
   Reescrita em massa das descrições — Premium.

   Rodar a IA sobre dezenas de imóveis de uma vez. Inútil para quem tem quinze
   imóveis; decisivo para quem tem trezentos.

   TRÊS PASSOS, e o do meio é o que importa: escolher → CONFERIR → aplicar.
   Gerar e salvar direto sobrescreveria descrições escritas à mão sem ninguém
   ter lido uma linha do que entrou no lugar, e o texto antigo não volta. A tela
   do meio mostra antes e depois lado a lado, com uma caixa de seleção por
   imóvel — dá para aceitar cinco de oito.

   A geração é UMA chamada de IA: o passo de aplicar manda texto pronto de
   volta, não gera nada. Recusar um item não desperdiça nada além do que já foi
   gerado.
   ──────────────────────────────────────────────────────────────────────────── */

const TETO = 25;

export function ReescritaEmMassa({ session, properties, aoConcluir }) {
  const tenantSlug = session?.tenant?.slug || "";
  const liberado = planoLiberaIA(session?.tenant?.plano);

  const [aberto, setAberto] = useState(false);
  const [passo, setPasso] = useState("escolher"); // escolher | conferir
  const [marcados, setMarcados] = useState({});   // { [id]: true }
  const [resultados, setResultados] = useState([]);
  const [aceitos, setAceitos] = useState({});     // { [id]: true }
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  const escolhidos = useMemo(() => Object.keys(marcados).filter((k) => marcados[k]), [marcados]);

  if (!liberado) return null;

  function abrir() {
    setAberto(true);
    setPasso("escolher");
    setMarcados({});
    setResultados([]);
    setAceitos({});
    setErro("");
  }

  async function gerar() {
    setOcupado(true);
    setErro("");
    try {
      const r = await api.reescreverEmMassa(tenantSlug, escolhidos);
      setResultados(r.resultados || []);
      // Tudo que voltou sem erro entra marcado: o caminho comum é aceitar, e a
      // conferência serve para RECUSAR o que não ficou bom.
      setAceitos(Object.fromEntries((r.resultados || []).filter((x) => !x.erro).map((x) => [x.id, true])));
      setPasso("conferir");
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado(false);
    }
  }

  async function aplicar() {
    const itens = resultados
      .filter((r) => !r.erro && aceitos[r.id] && r.depois)
      .map((r) => ({ id: r.id, descricao: r.depois }));
    if (!itens.length) { setAberto(false); return; }

    setOcupado(true);
    setErro("");
    try {
      const r = await api.salvarReescritaEmMassa(tenantSlug, itens);
      setAberto(false);
      aoConcluir?.(r.salvos);
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado(false);
    }
  }

  const aceitosCount = resultados.filter((r) => !r.erro && aceitos[r.id]).length;

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        style={{
          width: "auto", padding: "8px 14px", borderRadius: "999px",
          display: "inline-flex", alignItems: "center", gap: "7px",
          fontSize: "12.5px", fontWeight: 600, cursor: "pointer",
          background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.34)", color: "#e8cf7a",
        }}
      >
        <IconeFaisca /> Reescrever descrições com IA
      </button>

      {aberto ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Reescrever descrições com IA"
          style={{
            position: "fixed", inset: 0, zIndex: 1200, display: "grid", placeItems: "center",
            background: "rgba(0,0,0,0.62)", padding: "20px",
          }}
          onClick={(e) => { if (e.target === e.currentTarget && !ocupado) setAberto(false); }}
        >
          <div className="glass-panel" style={{ width: "min(820px, 100%)", maxHeight: "86vh", display: "flex", flexDirection: "column", padding: "24px" }}>
            <h3 style={{ margin: "0 0 4px", fontSize: "19px", fontWeight: 700 }}>
              {passo === "escolher" ? "Quais imóveis reescrever?" : "Confira antes de salvar"}
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "var(--text-muted)" }}>
              {passo === "escolher"
                ? `A IA reescreve a descrição de cada um a partir da ficha. Até ${TETO} por vez.`
                : "Marque o que quer manter. O que estiver desmarcado fica como está."}
            </p>

            <div style={{ flex: 1, overflowY: "auto", minHeight: 0, display: "grid", gap: "8px" }}>
              {passo === "escolher"
                ? properties.map((p) => {
                    const marcado = Boolean(marcados[p.id]);
                    const cheio = escolhidos.length >= TETO && !marcado;
                    return (
                      <label
                        key={p.id}
                        style={{
                          display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px",
                          borderRadius: "9px", cursor: cheio ? "default" : "pointer",
                          background: marcado ? "rgba(212,175,55,0.08)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${marcado ? "rgba(212,175,55,0.30)" : "rgba(255,255,255,0.07)"}`,
                          opacity: cheio ? 0.45 : 1,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={marcado}
                          disabled={cheio}
                          onChange={(e) => setMarcados((m) => ({ ...m, [p.id]: e.target.checked }))}
                          style={{ width: "auto", margin: 0 }}
                        />
                        <span style={{ flex: 1, minWidth: 0, fontSize: "13.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.title}
                        </span>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                          {(p.description || "").trim() ? `${(p.description || "").trim().length} car.` : "sem descrição"}
                        </span>
                      </label>
                    );
                  })
                : resultados.map((r) => (
                    <div key={r.id} style={{ padding: "12px 14px", borderRadius: "10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "8px" }}>
                        {r.erro ? null : (
                          <input
                            type="checkbox"
                            checked={Boolean(aceitos[r.id])}
                            onChange={(e) => setAceitos((a) => ({ ...a, [r.id]: e.target.checked }))}
                            style={{ width: "auto", margin: 0 }}
                          />
                        )}
                        <strong style={{ fontSize: "13.5px", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.title}
                        </strong>
                        {r.erro ? (
                          <span style={{ fontSize: "11px", color: "#fca5a5" }}>falhou</span>
                        ) : null}
                      </div>

                      {r.erro ? (
                        <p style={{ margin: 0, fontSize: "12px", color: "#fca5a5" }}>{r.erro}</p>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                          <div>
                            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-muted)" }}>ANTES</span>
                            <p style={{ margin: "4px 0 0", fontSize: "12px", lineHeight: 1.55, color: "var(--text-muted)", maxHeight: "128px", overflowY: "auto" }}>
                              {r.antes || <em>sem descrição</em>}
                            </p>
                          </div>
                          <div>
                            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", color: "#e8cf7a" }}>DEPOIS</span>
                            <p style={{ margin: "4px 0 0", fontSize: "12px", lineHeight: 1.55, maxHeight: "128px", overflowY: "auto" }}>
                              {r.depois}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
            </div>

            {erro ? <p style={{ margin: "12px 0 0", fontSize: "12.5px", color: "#fca5a5" }}>{erro}</p> : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "18px" }}>
              <button type="button" className="button-secondary" style={{ width: "auto", padding: "9px 18px" }} disabled={ocupado} onClick={() => setAberto(false)}>
                Cancelar
              </button>
              {passo === "escolher" ? (
                <button type="button" style={{ width: "auto", padding: "9px 18px" }} disabled={ocupado || !escolhidos.length} onClick={gerar}>
                  {ocupado ? "Escrevendo…" : `Reescrever ${escolhidos.length || ""}`.trim()}
                </button>
              ) : (
                <button type="button" style={{ width: "auto", padding: "9px 18px" }} disabled={ocupado || !aceitosCount} onClick={aplicar}>
                  {ocupado ? "Salvando…" : `Salvar ${aceitosCount}`}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function IconeFaisca() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l1.9 5.8L20 9.7l-5.1 3.4L16 19l-4-3.2L8 19l1.1-5.9L4 9.7l6.1-1.9z" />
    </svg>
  );
}
