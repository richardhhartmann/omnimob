import { useEffect, useState } from "react";
import { api } from "../api";
import { planoLiberaFunil } from "../utils/planos";
import { RegistrarVenda } from "./RegistrarVenda";
import { SkeletonFunil, SkeletonComissoes } from "./Skeleton";

/* ────────────────────────────────────────────────────────────────────────────
   Funil de vendas e comissões — Profissional e Premium.

   Os dois leem o MESMO endpoint (`/api/vendas/resumo`). Não é economia: é a
   garantia de que "quantas vendas" dá o mesmo número nas duas telas. Dois
   cálculos para o mesmo fato é como se produz duas verdades.

   O período é um filtro de datas simples, e o padrão é o ano corrente — venda
   é evento raro comparado a visita, e uma janela de 30 dias mostraria zero na
   maioria das imobiliárias.
   ──────────────────────────────────────────────────────────────────────────── */

function brl(n) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function inicioDoAno() {
  return `${new Date().getFullYear()}-01-01`;
}
function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Aviso comum às duas telas quando o plano não libera. */
function SemPlano() {
  return (
    <div className="glass-panel" style={{ padding: "28px", textAlign: "center" }}>
      <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: 600 }}>
        Disponível no plano Profissional
      </p>
      <p style={{ margin: 0, fontSize: "13.5px", color: "var(--text-muted)", lineHeight: 1.6 }}>
        O funil e as comissões acompanham o caminho do interessado até o fechamento,
        e quanto cada corretor produziu no período.
      </p>
    </div>
  );
}

/** Filtro de período compartilhado. */
function Periodo({ de, ate, setDe, setAte }) {
  const campo = {
    width: "auto", padding: "6px 10px", borderRadius: "8px", fontSize: "13px",
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "inherit",
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "9px", flexWrap: "wrap", marginBottom: "18px" }}>
      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Período</span>
      <input type="date" value={de} onChange={(e) => setDe(e.target.value)} style={campo} />
      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>até</span>
      <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} style={campo} />
    </div>
  );
}

/** Carrega o resumo. Devolve `[dados, carregando, erro, Periodo]`. */
function useResumo(session) {
  const tenantSlug = session?.tenant?.slug || "";
  const liberado = planoLiberaFunil(session?.tenant?.plano);
  const [de, setDe] = useState(inicioDoAno());
  const [ate, setAte] = useState(hojeISO());
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  // Contador, e não flag: registrar duas vendas seguidas tem de recarregar as
  // duas vezes, e uma flag booleana só dispararia a primeira.
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    if (!liberado || !tenantSlug) return;
    let vivo = true;
    setCarregando(true);
    setErro("");
    api
      .resumoVendas(tenantSlug, { de, ate })
      .then((r) => vivo && setDados(r))
      .catch((e) => vivo && setErro(e.message))
      .finally(() => vivo && setCarregando(false));
    return () => { vivo = false; };
  }, [tenantSlug, liberado, de, ate, recarga]);

  return {
    liberado, dados, carregando, erro,
    filtro: { de, ate, setDe, setAte },
    recarregar: () => setRecarga((n) => n + 1),
  };
}

// ─── Funil ───────────────────────────────────────────────────────────────────

export function FunilDeVendas({ session }) {
  const { liberado, dados, carregando, erro, filtro, recarregar } = useResumo(session);
  if (!liberado) return <SemPlano />;

  const f = dados?.funil;
  /* A largura de cada degrau é proporcional à ETAPA MAIOR (as visitas), e não a
     um valor fixo. É o que faz o estreitamento ser visível: um funil desenhado
     com degraus iguais não é um funil, é uma lista. */
  const maior = Math.max(f?.visitas || 0, 1);
  const etapas = [
    { rotulo: "Visitas à vitrine", valor: f?.visitas ?? 0, cor: "#818cf8" },
    { rotulo: "Leads recebidos", valor: f?.leads ?? 0, cor: "#38bdf8", taxa: f?.visitaParaLead, deQuem: "das visitas" },
    { rotulo: "Vendas fechadas", valor: f?.vendas ?? 0, cor: "#34d399", taxa: f?.leadParaVenda, deQuem: "dos leads" },
  ];

  return (
    <div className="glass-panel" style={{ padding: "22px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
        <Periodo {...filtro} />
        {/* O que ALIMENTA o funil fica ao lado de onde ele é lido. */}
        <RegistrarVenda session={session} aoRegistrar={recarregar} />
      </div>
      {carregando ? (
        <SkeletonFunil />
      ) : erro ? (
        <p style={{ margin: 0, fontSize: "13px", color: "#fca5a5" }}>{erro}</p>
      ) : !dados ? null : (
        <>
          <div style={{ display: "grid", gap: "12px", marginBottom: "22px" }}>
            {etapas.map((e) => (
              <div key={e.rotulo}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "5px" }}>
                  <span style={{ fontSize: "13px" }}>{e.rotulo}</span>
                  <span style={{ fontSize: "13px", fontWeight: 700 }}>
                    {e.valor}
                    {e.taxa !== null && e.taxa !== undefined ? (
                      <span style={{ fontSize: "11.5px", fontWeight: 400, color: "var(--text-muted)" }}>
                        {"  "}· {e.taxa}% {e.deQuem}
                      </span>
                    ) : null}
                  </span>
                </div>
                <div style={{ height: "10px", borderRadius: "999px", background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                  <div style={{ width: `${Math.max((e.valor / maior) * 100, e.valor > 0 ? 2 : 0)}%`, height: "100%", borderRadius: "999px", background: e.cor, transition: "width 0.5s ease" }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "26px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            <Numero rotulo="Fechamentos" valor={dados.totais.quantidade} />
            <Numero rotulo="Valor movimentado" valor={brl(dados.totais.valor)} />
            <Numero rotulo="Comissões" valor={brl(dados.totais.comissao)} destaque="#e8cf7a" />
          </div>

          {dados.porTipo?.length ? (
            <div style={{ marginTop: "18px" }}>
              <span style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "8px" }}>
                Por tipo
              </span>
              {dados.porTipo.map((t) => (
                <div key={t.tipo} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "5px 0" }}>
                  <span>{t.tipo === "VENDA" ? "Vendas" : "Aluguéis"} ({t.quantidade})</span>
                  <span style={{ color: "var(--text-muted)" }}>{brl(t.valor)}</span>
                </div>
              ))}
            </div>
          ) : null}

          {dados.totais.quantidade === 0 ? (
            <p style={{ margin: "18px 0 0", fontSize: "12.5px", color: "var(--text-muted)" }}>
              Nenhuma venda registrada neste período. As duas primeiras etapas do funil
              continuam contando sozinhas — elas vêm das visitas e dos leads da vitrine.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

// ─── Comissões ───────────────────────────────────────────────────────────────

export function Comissoes({ session }) {
  const { liberado, dados, carregando, erro, filtro } = useResumo(session);
  if (!liberado) return <SemPlano />;

  const linhas = dados?.porCorretor || [];

  return (
    <div className="glass-panel" style={{ padding: "22px 24px" }}>
      <Periodo {...filtro} />
      {carregando ? (
        <SkeletonComissoes />
      ) : erro ? (
        <p style={{ margin: 0, fontSize: "13px", color: "#fca5a5" }}>{erro}</p>
      ) : !linhas.length ? (
        <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>
          Nenhuma venda registrada neste período.
        </p>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "26px", marginBottom: "20px" }}>
            <Numero rotulo="Total em comissões" valor={brl(dados.totais.comissao)} destaque="#e8cf7a" />
            <Numero rotulo="Valor movimentado" valor={brl(dados.totais.valor)} />
            <Numero rotulo="Corretores com venda" valor={linhas.length} />
          </div>

          <div style={{ display: "grid", gap: "2px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 130px 130px", gap: "10px", padding: "0 12px 7px", fontSize: "11px", fontWeight: 600, color: "var(--text-muted)" }}>
              <span>Corretor</span>
              <span style={{ textAlign: "right" }}>Vendas</span>
              <span style={{ textAlign: "right" }}>Movimentado</span>
              <span style={{ textAlign: "right" }}>Comissão</span>
            </div>
            {linhas.map((l) => (
              <div
                key={l.usuarioId}
                style={{
                  display: "grid", gridTemplateColumns: "1fr 80px 130px 130px", gap: "10px",
                  padding: "11px 12px", borderRadius: "9px", fontSize: "13.5px",
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.nome}</span>
                <span style={{ textAlign: "right", color: "var(--text-muted)" }}>{l.quantidade}</span>
                <span style={{ textAlign: "right", color: "var(--text-muted)" }}>{brl(l.valor)}</span>
                <span style={{ textAlign: "right", fontWeight: 600, color: "#e8cf7a" }}>{brl(l.comissao)}</span>
              </div>
            ))}
          </div>

          <p style={{ margin: "16px 0 0", fontSize: "11.5px", color: "var(--text-muted)" }}>
            A comissão é a que foi informada ao registrar cada venda. Vendas sem comissão
            preenchida entram no movimentado e não na coluna de comissão.
          </p>
        </>
      )}
    </div>
  );
}

function Numero({ rotulo, valor, destaque }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <span style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.03em", color: destaque || "inherit" }}>
        {valor}
      </span>
      <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>{rotulo}</span>
    </div>
  );
}
