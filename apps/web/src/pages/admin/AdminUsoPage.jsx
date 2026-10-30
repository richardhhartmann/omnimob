import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../../api";
import { Alert, Button, Eyebrow, Reveal } from "../../styles/omnimobKit";

/* ────────────────────────────────────────────────────────────────────────────
   CONTROLE DE USO — quem usa a Omnimob, quem esfriou e quem parou.

   Porte da aba do VYA, tirado da trilha de auditoria (`api/services/
   controleDeUso.js`): a última vez que alguém da imobiliária cadastrou ou mudou
   algo, quantas escritas e quantas pessoas nos últimos 30 dias, e os leads que
   chegaram. Consultar não deixa rastro — "parada" é "ninguém mexeu em nada".
   O consumo de IA do VYA não veio: aqui ele não é registrado por conta.
   ──────────────────────────────────────────────────────────────────────────── */

const SITUACOES = {
  ativa: { rotulo: "Ativa", detalhe: "mexeu nos últimos 7 dias", cor: "#86efac", fundo: "rgba(52,211,153,0.14)", borda: "rgba(52,211,153,0.30)" },
  esfriando: { rotulo: "Esfriando", detalhe: "entre 7 e 30 dias", cor: "#fcd34d", fundo: "rgba(251,191,36,0.12)", borda: "rgba(251,191,36,0.30)" },
  parada: { rotulo: "Parada", detalhe: "mais de 30 dias", cor: "#fda4af", fundo: "rgba(244,63,94,0.12)", borda: "rgba(244,63,94,0.30)" },
  nunca: { rotulo: "Nunca usou", detalhe: "nenhuma escrita registrada", cor: "#cbd5e1", fundo: "rgba(148,163,184,0.12)", borda: "rgba(148,163,184,0.25)" },
};

function haQuanto(iso) {
  if (!iso) return "—";
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${dias} dias`;
}

export function AdminUsoPage({ tenantSlug = "" }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState("");
  const [busca, setBusca] = useState("");

  async function carregar() {
    setCarregando(true);
    setErro("");
    try {
      setDados(await adminApi.uso());
    } catch (e) {
      setErro(e.message || "Erro ao medir o uso.");
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => { carregar(); }, []);

  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (dados?.tenants || []).filter((t) =>
      (!tenantSlug || t.slug === tenantSlug) &&
      (!filtro || (t.ativo && t.situacao === filtro)) &&
      (!q || `${t.name} ${t.slug}`.toLowerCase().includes(q)));
  }, [dados, filtro, busca, tenantSlug]);

  return (
    <>
      <Reveal className="sa-head">
        <Eyebrow>CONTROLE DE USO</Eyebrow>
        <h1 className="dl-h2 sa-title">
          <span className="dl-h2__strong">Quem usa, quem esfriou</span>
          <span className="dl-h2__soft">e quem parou de mexer.</span>
        </h1>
      </Reveal>
      <p className="dl-mono dl-note sa-note">// tirado da trilha de auditoria: cadastrar ou mudar algo conta; só consultar, não</p>

      {dados ? (
        <div className="us-resumo">
          {Object.entries(SITUACOES).map(([chave, s]) => (
            <button
              key={chave}
              type="button"
              className={`us-cartao${filtro === chave ? " is-on" : ""}`}
              onClick={() => setFiltro(filtro === chave ? "" : chave)}
              title={filtro === chave ? "Mostrar todas" : `Só as ${s.rotulo.toLowerCase()}`}
            >
              <strong style={{ color: s.cor }}>{dados.resumo[chave]}</strong>
              <span>{s.rotulo}</span>
              <small className="dl-mono">{s.detalhe}</small>
            </button>
          ))}
        </div>
      ) : null}

      <div className="sa-bar">
        <input className="dl-input sa-search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar imobiliária…" />
        <Button as="button" type="button" variant="ghost" className="dl-btn--sm" arrow={false} onClick={carregar}>Atualizar</Button>
      </div>

      {erro ? <Alert tone="danger">{erro}</Alert> : null}
      {carregando && !dados ? <p className="dl-mono sa-loading">// medindo o uso…</p> : null}

      {dados ? (
        <div className="us-tabela">
          <table>
            <thead>
              <tr>
                <th>Imobiliária</th><th>Situação</th><th>Última atividade</th><th>Escritas (30d)</th>
                <th>Pessoas (30d)</th><th>Usuários</th><th>Leads (30d)</th><th>Imóveis ativos</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((t) => {
                const s = SITUACOES[t.situacao];
                return (
                  <tr key={t.id} className={t.ativo ? "" : "is-inativa"}>
                    <td>
                      <strong>{t.name}</strong>
                      <span className="dl-mono">/{t.slug} · {t.plano || "—"}{t.ativo ? "" : " · inativa"}</span>
                    </td>
                    <td><span className="dl-pill" style={{ color: s.cor, background: s.fundo, borderColor: s.borda }}>{s.rotulo}</span></td>
                    <td title={t.ultimaAtividade ? new Date(t.ultimaAtividade).toLocaleString("pt-BR") : ""}>{haQuanto(t.ultimaAtividade)}</td>
                    <td>{t.escritas30}</td>
                    <td>{t.pessoas30}</td>
                    <td>{t.usuarios}</td>
                    <td>{t.leads30}</td>
                    <td>{t.imoveisAtivos}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!linhas.length ? <p className="dl-mono sa-loading">// nenhuma imobiliária neste filtro</p> : null}
        </div>
      ) : null}
    </>
  );
}

export const USO_CSS = `
.us-resumo { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 4px 0 18px; }
.dl-root .us-cartao {
  display: grid; gap: 2px; text-align: left; width: auto; padding: 14px 16px; border-radius: 14px; cursor: pointer;
  background: var(--surface); border: 1px solid var(--line); color: var(--default); font-family: inherit; box-shadow: none; transform: none;
}
.dl-root .us-cartao:hover { border-color: #34343c; background: var(--surface); box-shadow: none; transform: none; }
.dl-root .us-cartao.is-on { border-color: rgba(99,102,241,0.55); background: rgba(99,102,241,0.08); }
.us-cartao strong { font-size: 26px; font-weight: 800; letter-spacing: -0.03em; }
.us-cartao span { font-size: 13px; color: var(--strong); }
.us-cartao small { color: var(--placeholder); font-size: 9px; text-transform: none; }
.us-tabela { overflow-x: auto; border-radius: 14px; border: 1px solid var(--line); background: var(--surface); }
.us-tabela table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.us-tabela th { text-align: left; font-weight: 600; color: var(--placeholder); padding: 10px 12px; border-bottom: 1px solid var(--line); white-space: nowrap; }
.us-tabela td { padding: 10px 12px; border-bottom: 1px solid var(--line-soft); color: var(--default); white-space: nowrap; font-variant-numeric: tabular-nums; }
.us-tabela td strong { display: block; color: var(--strong); font-size: 13px; }
.us-tabela td .dl-mono { color: var(--placeholder); font-size: 9px; text-transform: none; }
.us-tabela tr.is-inativa td { opacity: 0.55; }
@media (max-width: 720px) { .us-resumo { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
`;

export default AdminUsoPage;
