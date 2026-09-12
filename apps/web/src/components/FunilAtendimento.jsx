import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { ESTAGIOS, corDoEstagio, rotuloDoEstagio } from "./LeadAtendimento.jsx";
import { CascaDeRelatorio } from "./CascaDeRelatorio.jsx";
import { SkeletonFunil } from "./Skeleton";
import { UsersThree, Timer, ChatCircleText, Prohibit } from "@phosphor-icons/react";

/* ────────────────────────────────────────────────────────────────────────────
   Funil de atendimento — dos leads, e não das vendas.

   O "Funil de vendas" (FunilVendas.jsx) conta visitas → leads → vendas: é o
   funil do MARKETING, e diz se a vitrine converte. Este conta o que acontece
   DEPOIS que o lead chega: em que estágio os contatos empacam, quanto tempo
   levam para receber o primeiro retorno, por que se perdem e como cada
   corretor está indo. É o funil da OPERAÇÃO, e é o que o dono da imobiliária
   olha para decidir com quem conversar.

   Toda a conta é do servidor (`GET /api/leads/funil`). Aqui só se desenha —
   a mesma regra de "parado" que vale para a lista tem de valer aqui.

   Do Básico, como a lista de leads: é a leitura dela, não um recurso à parte.
   ──────────────────────────────────────────────────────────────────────────── */

function diasAtras(n) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}
function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function minutosLegiveis(min) {
  if (min == null) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h}h`;
  return `${Math.round(h / 24)} dias`;
}

function Periodo({ de, ate, setDe, setAte }) {
  const campo = {
    width: "auto", padding: "6px 10px", borderRadius: "8px", fontSize: "13px",
    background: "var(--sup-05, rgba(255,255,255,0.05))", border: "1px solid var(--linha-12, rgba(255,255,255,0.12))", color: "inherit",
  };
  const atalho = (dias) => (
    <button
      type="button"
      onClick={() => { setDe(diasAtras(dias)); setAte(hojeISO()); }}
      style={{ width: "auto", padding: "5px 10px", borderRadius: "999px", fontSize: "12px", background: "var(--sup-05, rgba(255,255,255,0.05))", border: "1px solid var(--linha-12, rgba(255,255,255,0.12))", color: "var(--text-muted)", cursor: "pointer" }}
    >
      {dias} dias
    </button>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "9px", flexWrap: "wrap" }}>
      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Leads que chegaram de</span>
      <input type="date" value={de} onChange={(e) => setDe(e.target.value)} style={campo} />
      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>até</span>
      <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} style={campo} />
      {atalho(30)}{atalho(90)}{atalho(365)}
    </div>
  );
}

export function FunilAtendimento({ session }) {
  const tenantSlug = session?.tenant?.slug || "";
  const [de, setDe] = useState(diasAtras(30));
  const [ate, setAte] = useState(hojeISO());
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!tenantSlug) return undefined;
    let vivo = true;
    setCarregando(true);
    setErro("");
    api.funilDeLeads(tenantSlug, { de, ate })
      .then((r) => vivo && setDados(r))
      .catch((e) => vivo && setErro(e.message))
      .finally(() => vivo && setCarregando(false));
    return () => { vivo = false; };
  }, [tenantSlug, de, ate]);

  const degraus = dados?.degraus || [];
  const maior = Math.max(dados?.alcancaram?.NOVO || 0, 1);
  const rotuloPrazo = dados?.horasParaParado >= 48 && dados.horasParaParado % 24 === 0
    ? `${dados.horasParaParado / 24} dias`
    : `${dados?.horasParaParado || 48}h`;

  const metricas = !dados ? [] : [
    { label: "Leads no período", value: dados.total, accent: "#06b6d4", icon: <UsersThree size={20} /> },
    { label: "1º retorno em média", value: minutosLegiveis(dados.tempoMedioPrimeiroContatoMin), accent: "#38bdf8", icon: <Timer size={20} /> },
    { label: "Sem nenhum retorno", value: dados.semContato, accent: "#fbbf24", icon: <ChatCircleText size={20} /> },
    { label: `Parados há +${rotuloPrazo}`, value: dados.parados, accent: "#f87171", icon: <Prohibit size={20} /> },
  ];

  return (
    <CascaDeRelatorio
      titulo="Funil de atendimento"
      subtitulo="Em que estágio os leads empacam, por que se perdem e como cada corretor está indo."
      metricas={metricas}
      carregando={carregando}
      erro={erro}
      filtros={<Periodo de={de} ate={ate} setDe={setDe} setAte={setAte} />}
    >
      {carregando ? (
        <div className="glass-panel" style={{ padding: "22px 24px" }}><SkeletonFunil /></div>
      ) : erro || !dados ? null : dados.total === 0 ? (
        <div className="glass-panel" style={{ padding: "40px 24px", textAlign: "center" }}>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "14px" }}>
            Nenhum lead chegou neste período. Amplie as datas ou espere a vitrine trabalhar.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "16px" }}>
          {/* ── O funil ─────────────────────────────────────────────────── */}
          <div className="glass-panel" style={{ padding: "22px 24px" }}>
            <Cabecalho titulo="Até onde os leads chegam" nota="Cada degrau conta quem chegou nele ou passou dele. Perdidos contam até o último estágio que alcançaram." />
            <div style={{ display: "grid", gap: "12px" }}>
              {degraus.map((d, i) => {
                const valor = dados.alcancaram[d] || 0;
                const taxa = dados.taxas[d];
                const perdidos = dados.perdidosPorDegrau[d] || 0;
                return (
                  <div key={d}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "10px", marginBottom: "5px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: corDoEstagio(d), display: "inline-block" }} />
                        {rotuloDoEstagio(d)}
                        {perdidos > 0 ? (
                          <span style={{ fontSize: "11px", color: "#fca5a5" }} title="Leads perdidos que pararam neste estágio">
                            · {perdidos} perdido{perdidos !== 1 ? "s" : ""} aqui
                          </span>
                        ) : null}
                      </span>
                      <span style={{ fontSize: "13px", fontWeight: 700 }}>
                        {valor}
                        {i > 0 && taxa != null ? (
                          <span style={{ fontSize: "11.5px", fontWeight: 400, color: "var(--text-muted)" }}>
                            {"  "}· {taxa}% de {rotuloDoEstagio(degraus[i - 1]).toLowerCase()}
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <div style={{ height: "10px", borderRadius: "999px", background: "var(--sup-05, rgba(255,255,255,0.05))", overflow: "hidden" }}>
                      <div style={{ width: `${Math.max((valor / maior) * 100, valor > 0 ? 2 : 0)}%`, height: "100%", borderRadius: "999px", background: corDoEstagio(d), transition: "width 0.5s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "26px", marginTop: "18px", paddingTop: "16px", borderTop: "1px solid var(--linha-07, rgba(255,255,255,0.07))" }}>
              <Numero rotulo="Ganhos" valor={dados.atuais.GANHO} cor="#10b981" />
              <Numero rotulo="Perdidos" valor={dados.atuais.PERDIDO} cor="#f87171" />
              <Numero rotulo="Em aberto" valor={dados.total - dados.atuais.GANHO - dados.atuais.PERDIDO} />
              <Numero
                rotulo="Conversão"
                valor={dados.conversao == null ? "—" : `${dados.conversao}%`}
                dica={dados.conversao == null ? "Precisa de pelo menos 5 leads encerrados para ter significado." : "Ganhos sobre encerrados (ganhos + perdidos)."}
              />
            </div>
            {dados.truncado ? (
              <p style={{ margin: "14px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                Período com mais de {dados.total} leads: os números consideram os mais recentes. Reduza o intervalo para ver tudo.
              </p>
            ) : null}
          </div>

          <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
            {/* ── Onde estão agora ─────────────────────────────────────── */}
            <div className="glass-panel" style={{ padding: "22px 24px" }}>
              <Cabecalho titulo="Onde estão agora" />
              <div style={{ display: "grid", gap: "8px" }}>
                {ESTAGIOS.map((e) => {
                  const n = dados.atuais[e.valor] || 0;
                  return (
                    <Link
                      key={e.valor}
                      to={`/relatorios?ver=leads&estagio=${e.valor}`}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px", padding: "6px 0", textDecoration: "none", color: "inherit" }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: e.cor, display: "inline-block" }} />
                        {e.rotulo}
                      </span>
                      <span style={{ fontWeight: 700 }}>{n}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* ── Por que se perdem ────────────────────────────────────── */}
            <div className="glass-panel" style={{ padding: "22px 24px" }}>
              <Cabecalho titulo="Por que se perdem" nota="O motivo é pedido ao marcar um lead como perdido." />
              {dados.motivosPerda.length === 0 ? (
                <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>Nenhum lead perdido neste período.</p>
              ) : (
                <div style={{ display: "grid", gap: "9px" }}>
                  {dados.motivosPerda.map((m) => {
                    const pct = Math.round((m.quantidade / Math.max(dados.atuais.PERDIDO, 1)) * 100);
                    return (
                      <div key={m.motivo}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                          <span style={{ color: m.motivo === "Sem motivo informado" ? "var(--text-muted)" : "inherit" }}>{m.motivo}</span>
                          <span style={{ fontWeight: 700 }}>{m.quantidade} <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: "11.5px" }}>· {pct}%</span></span>
                        </div>
                        <div style={{ height: "6px", borderRadius: "999px", background: "var(--sup-05, rgba(255,255,255,0.05))", overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: "rgba(248,113,113,0.7)", borderRadius: "999px" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Por corretor ───────────────────────────────────────────── */}
          <div className="glass-panel" style={{ padding: "22px 24px", overflowX: "auto" }}>
            <Cabecalho titulo="Por corretor" nota="Leads que chegaram no período, por quem é o responsável hoje." />
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", minWidth: "560px" }}>
              <thead>
                <tr style={{ color: "var(--text-muted)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  <th style={th}>Responsável</th>
                  <th style={thNum}>Leads</th>
                  <th style={thNum}>Em aberto</th>
                  <th style={thNum} title={`Sem registro há mais de ${rotuloPrazo}`}>Parados</th>
                  <th style={thNum}>Ganhos</th>
                  <th style={thNum}>Perdidos</th>
                  <th style={thNum}>1º retorno</th>
                </tr>
              </thead>
              <tbody>
                {dados.porResponsavel.map((p) => (
                  <tr key={p.id || "sem"} style={{ borderTop: "1px solid var(--linha-07, rgba(255,255,255,0.07))" }}>
                    <td style={{ ...td, color: p.id ? "inherit" : "#fbbf24" }}>
                      {p.id ? (
                        <Link to={`/relatorios?ver=leads&responsavel=${p.id}`} style={{ color: "inherit", textDecoration: "none" }}>{p.nome}</Link>
                      ) : (
                        <Link to="/relatorios?ver=leads&responsavel=sem" style={{ color: "inherit", textDecoration: "none" }}>{p.nome}</Link>
                      )}
                    </td>
                    <td style={tdNum}>{p.total}</td>
                    <td style={tdNum}>{p.abertos}</td>
                    <td style={{ ...tdNum, color: p.parados > 0 ? "#f87171" : "var(--text-muted)", fontWeight: p.parados > 0 ? 700 : 400 }}>{p.parados}</td>
                    <td style={{ ...tdNum, color: "#34d399" }}>{p.ganhos}</td>
                    <td style={{ ...tdNum, color: "#fca5a5" }}>{p.perdidos}</td>
                    <td style={tdNum}>{minutosLegiveis(p.tempoMedioPrimeiroContatoMin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </CascaDeRelatorio>
  );
}

const th = { textAlign: "left", padding: "6px 8px", fontWeight: 600 };
const thNum = { ...th, textAlign: "right" };
const td = { padding: "9px 8px" };
const tdNum = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };

function Cabecalho({ titulo, nota }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700 }}>{titulo}</h3>
      {nota ? <p style={{ margin: "3px 0 0", fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.5 }}>{nota}</p> : null}
    </div>
  );
}

function Numero({ rotulo, valor, cor, dica }) {
  return (
    <div title={dica}>
      <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "3px" }}>{rotulo}</span>
      <span style={{ fontSize: "20px", fontWeight: 700, color: cor || "inherit" }}>{valor}</span>
    </div>
  );
}
