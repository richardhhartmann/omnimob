import { useEffect, useState } from "react";
import { api } from "../api";
import { planoLiberaRelatorioMensal } from "../utils/planos";
import { SkeletonRelatorioMensal } from "./Skeleton";
import { CascaDeRelatorio } from "./CascaDeRelatorio.jsx";
import { Eye, ChatCircleText, Handshake, Buildings } from "@phosphor-icons/react";

/* ────────────────────────────────────────────────────────────────────────────
   Relatório mensal — Profissional e Premium.

   O mesmo relatório que sai por e-mail no começo de cada mês, aqui na tela.
   Não é duplicação: o e-mail chega uma vez e some na caixa de entrada; esta
   tela é onde alguém confere um mês específico quando precisa — e é onde dá
   para VER antes de mandar, que é a única forma de descobrir que o número está
   errado sem ser pelo cliente.

   O período padrão é o último mês FECHADO. O mês corrente dá um número que muda
   a cada visita e não se compara com nada.
   ──────────────────────────────────────────────────────────────────────────── */

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Os últimos 12 meses fechados, do mais recente para o mais antigo. */
function mesesDisponiveis() {
  const hoje = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1 - i, 1);
    return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
  });
}

function Numero({ rotulo, valor, sufixo = "", destaque }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "104px" }}>
      <span style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "-0.03em", color: destaque || "inherit" }}>
        {valor}{sufixo}
      </span>
      <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>{rotulo}</span>
    </div>
  );
}

export function RelatorioMensal({ session }) {
  const tenantSlug = session?.tenant?.slug || "";
  // `session.usuario.cargo`, e não `session.cargo`: é onde as outras quinze
  // telas leem. Escrito errado, o bloco caía no `return null` lá embaixo sem
  // erro nenhum — a permissão nunca chegava.
  const cargo = session?.usuario?.cargo;
  /* Não é "pode ver o relatório" — é "pode MANDAR por e-mail". A tela inteira
     é do Básico ("Relatórios e métricas de desempenho"); o que a tabela de
     planos vende no Profissional é a linha "Relatório mensal de desempenho POR
     E-MAIL". Antes esta variável escondia o painel todo, e o Básico clicava no
     cartão para chegar numa parede de venda. */
  const podeEnviarEmail = planoLiberaRelatorioMensal(session?.tenant?.plano);

  const opcoes = mesesDisponiveis();
  const [indice, setIndice] = useState(0);
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState("");

  const periodo = opcoes[indice];

  useEffect(() => {
    if (!tenantSlug || !cargo?.verRelatorios) return;
    let vivo = true;
    setCarregando(true);
    setErro("");
    setEnviado("");
    api
      .relatorioMensal(tenantSlug, periodo)
      .then((r) => vivo && setDados(r))
      .catch((e) => vivo && setErro(e.message))
      .finally(() => vivo && setCarregando(false));
    return () => { vivo = false; };
  }, [tenantSlug, cargo?.verRelatorios, periodo.ano, periodo.mes]);

  // Sem permissão ou sem slug o bloco não existe.
  if (!cargo?.verRelatorios || !tenantSlug) return null;

  async function enviarPorEmail() {
    setEnviando(true);
    setErro("");
    try {
      const r = await api.enviarRelatorioMensal(tenantSlug, periodo);
      setEnviado(`Enviado para ${r.para}.`);
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  }

  const vazio = dados?.vazio;

  /* Os quatro números de topo, no mesmo formato dos de Gestão de Leads. Mês
     sem movimento entrega `vazio`, e aí a faixa não aparece: quatro caixas
     zeradas dizem "não houve nada" com muito menos clareza que uma frase. */
  const metricas = !dados || vazio ? [] : [
    { label: "Visitas à vitrine", value: dados.visitas, accent: "#6366f1", icon: <Eye size={20} /> },
    { label: "Leads recebidos", value: dados.leads, accent: "#0ea5e9", icon: <ChatCircleText size={20} /> },
    { label: "Vendas no mês", value: dados.vendas, accent: "#10b981", icon: <Handshake size={20} /> },
    { label: "Imóveis ativos", value: dados.imoveisAtivos, accent: "#f59e0b", icon: <Buildings size={20} /> },
  ];

  return (
    <CascaDeRelatorio
      titulo="Relatório mensal"
      subtitulo="Visitas, leads, vendas e conversão do mês fechado — o mesmo resumo que sai por e-mail."
      metricas={metricas}
      carregando={carregando}
      erro={erro}
      filtros={
        <>
          <select
            value={indice}
            onChange={(e) => setIndice(Number(e.target.value))}
            style={{
              width: "auto", padding: "5px 10px", borderRadius: "8px", fontSize: "13px",
              background: "var(--sup-05, rgba(255,255,255,0.05))", border: "1px solid var(--linha-12, rgba(255,255,255,0.12))", color: "inherit",
            }}
          >
            {opcoes.map((o, i) => (
              <option key={`${o.ano}-${o.mes}`} value={i}>{MESES[o.mes - 1]} de {o.ano}</option>
            ))}
          </select>

          {/* Mandar por e-mail é do Profissional em diante. Escondido e não
              desabilitado: um botão cinzento no meio do relatório é anúncio no
              lugar errado — quem vende plano é a tela de planos. O relatório em
              si continua inteiro para o Básico. */}
          {podeEnviarEmail ? (
          <button
          type="button"
          onClick={enviarPorEmail}
          disabled={enviando || carregando || vazio}
          title={vazio ? "Mês sem movimento — não há o que enviar." : "Manda este resumo para o e-mail da imobiliária"}
          style={{
            width: "auto", padding: "7px 14px", borderRadius: "999px", fontSize: "12.5px", fontWeight: 600,
            cursor: enviando || vazio ? "default" : "pointer",
            opacity: enviando || vazio ? 0.5 : 1,
            background: "rgba(129,140,248,0.14)", border: "1px solid rgba(129,140,248,0.32)", color: "#c7d2fe",
          }}
        >
          {enviando ? "Enviando…" : "Enviar por e-mail"}
          </button>
          ) : null}
        </>
      }
    >
      <div className="glass-panel" style={{ padding: "22px 24px" }}>
      {carregando ? (
        <SkeletonRelatorioMensal />
      ) : erro ? null : !dados ? null : vazio ? (
        <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>
          Nenhuma visita, lead ou venda registrada em {MESES[periodo.mes - 1].toLowerCase()}.
        </p>
      ) : (
        <>
          {dados.conversao !== null ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "26px", marginBottom: "14px" }}>
              <Numero rotulo="Visitas que viraram lead" valor={dados.conversao} sufixo="%" destaque="#6ee7b7" />
            </div>
          ) : null}

          {dados.variacaoVisitas !== null ? (
            <p style={{ margin: "0 0 14px", fontSize: "12.5px", color: "var(--text-muted)" }}>
              <span style={{ color: dados.variacaoVisitas >= 0 ? "#6ee7b7" : "#fca5a5", fontWeight: 600 }}>
                {dados.variacaoVisitas >= 0 ? "+" : ""}{dados.variacaoVisitas}%
              </span>{" "}
              de visitas em relação ao mês anterior.
            </p>
          ) : null}

          {dados.destaques?.length ? (
            <div>
              <span style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "7px" }}>
                Imóveis mais vistos
              </span>
              <div style={{ display: "grid", gap: "5px" }}>
                {dados.destaques.map((d, i) => (
                  <div key={d.id} style={{ display: "flex", alignItems: "baseline", gap: "9px", fontSize: "13px" }}>
                    <span style={{ color: "var(--text-muted)", fontSize: "11px", minWidth: "14px" }}>{i + 1}.</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {d.title}
                      {d.local ? <span style={{ color: "var(--text-muted)" }}> · {d.local}</span> : null}
                    </span>
                    <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>{d.visitas} visitas</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}

      {enviado ? (
        <p style={{ margin: "12px 0 0", fontSize: "12.5px", color: "#6ee7b7" }}>{enviado}</p>
      ) : null}
      </div>
    </CascaDeRelatorio>
  );
}
