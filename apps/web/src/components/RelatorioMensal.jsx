import { useEffect, useState } from "react";
import { api } from "../api";
import { planoLiberaRelatorioMensal } from "../utils/planos";
import { SkeletonRelatorioMensal } from "./Skeleton";

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
  const liberado = planoLiberaRelatorioMensal(session?.tenant?.plano);

  const opcoes = mesesDisponiveis();
  const [indice, setIndice] = useState(0);
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState("");

  const periodo = opcoes[indice];

  useEffect(() => {
    if (!liberado || !tenantSlug || !cargo?.verRelatorios) return;
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
  }, [tenantSlug, liberado, cargo?.verRelatorios, periodo.ano, periodo.mes]);

  /* Sem permissão ou sem slug o bloco não existe.

     SEM PLANO é diferente, e mudou junto com a mudança de lugar: quando este
     bloco morava na tela Início, devolver `null` era o certo — ele era um
     pedaço a mais numa tela que já tinha conteúdo. Agora ele é o DESTINO de um
     cartão, e sumir deixaria a pessoa olhando para uma tela vazia depois de
     clicar. Aqui ela precisa saber por que não há nada. */
  if (!cargo?.verRelatorios || !tenantSlug) return null;
  if (!liberado) {
    return (
      <div className="glass-panel" style={{ padding: "28px", textAlign: "center" }}>
        <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: 600 }}>
          Disponível no plano Profissional
        </p>
        <p style={{ margin: 0, fontSize: "13.5px", color: "var(--text-muted)", lineHeight: 1.6 }}>
          Um resumo do mês com visitas, leads, vendas e conversão — na tela e no e-mail
          da imobiliária, no começo de cada mês.
        </p>
      </div>
    );
  }

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

  return (
    <div className="glass-panel" style={{ padding: "22px 24px", marginBottom: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: dados ? "18px" : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.13em", color: "#a5b4fc" }}>
            RELATÓRIO MENSAL
          </span>
          <select
            value={indice}
            onChange={(e) => setIndice(Number(e.target.value))}
            style={{
              width: "auto", padding: "5px 10px", borderRadius: "8px", fontSize: "13px",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "inherit",
            }}
          >
            {opcoes.map((o, i) => (
              <option key={`${o.ano}-${o.mes}`} value={i}>{MESES[o.mes - 1]} de {o.ano}</option>
            ))}
          </select>
        </div>

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
      </div>

      {carregando ? (
        <SkeletonRelatorioMensal />
      ) : erro ? (
        <p style={{ margin: 0, fontSize: "13px", color: "#fca5a5" }}>{erro}</p>
      ) : !dados ? null : vazio ? (
        <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>
          Nenhuma visita, lead ou venda registrada em {MESES[periodo.mes - 1].toLowerCase()}.
        </p>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "26px", marginBottom: "14px" }}>
            <Numero rotulo="Visitas à vitrine" valor={dados.visitas} />
            <Numero rotulo="Leads recebidos" valor={dados.leads} destaque="#a5b4fc" />
            <Numero rotulo="Vendas no mês" valor={dados.vendas} />
            <Numero rotulo="Imóveis ativos" valor={dados.imoveisAtivos} />
            {dados.conversao !== null ? (
              <Numero rotulo="Visitas que viraram lead" valor={dados.conversao} sufixo="%" destaque="#6ee7b7" />
            ) : null}
          </div>

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
  );
}
