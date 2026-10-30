import { useEffect, useState } from "react";
import { adminApi } from "../../api";
import { Alert, Button, Eyebrow, Reveal } from "../../styles/omnimobKit";

/* ────────────────────────────────────────────────────────────────────────────
   CONTAS E ACESSO — porte da aba do VYA.

   As sessões abertas do painel (registradas no primeiro uso, pelo jti do
   token: `api/services/sessoes.js`), quem ainda não ativou a conta pelo
   convite e quantos entram com o Google. "Encerrar" é o mesmo "sair" do
   painel, feito daqui: a pessoa cai no login na requisição seguinte — o
   remédio para o celular perdido ou o computador compartilhado. Precisa da
   ação `encerrarSessoes`.
   ──────────────────────────────────────────────────────────────────────────── */

const TIPO = { painel: "", demo: "demonstração", reativacao: "conta suspensa", suporte: "suporte da Omnimob" };
const quando = (iso) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function AdminAcessosPage({ tenantId = "", podeEncerrar = false }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");

  async function carregar() {
    setErro("");
    try {
      setDados(await adminApi.listAcessos(tenantId));
    } catch (e) {
      setErro(e.message || "Erro ao listar os acessos.");
    }
  }
  useEffect(() => { carregar(); }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function encerrar(s) {
    if (!window.confirm(`Encerrar a sessão de ${s.usuario.nome} (${s.dispositivo})? A pessoa vai precisar entrar de novo.`)) return;
    try {
      await adminApi.encerrarSessao(s.jti);
      await carregar();
    } catch (e) {
      setErro(e.message || "Não deu para encerrar.");
    }
  }

  const r = dados?.resumo;
  return (
    <>
      <Reveal className="sa-head">
        <Eyebrow>CONTAS E ACESSO</Eyebrow>
        <h1 className="dl-h2 sa-title">
          <span className="dl-h2__strong">Quem está conectado</span>
          <span className="dl-h2__soft">e quem ainda não entrou.</span>
        </h1>
      </Reveal>

      {r ? (
        <div className="us-resumo">
          <div className="us-cartao"><strong>{r.sessoes}</strong><span>Sessões abertas</span><small className="dl-mono">ainda no prazo do token</small></div>
          <div className="us-cartao"><strong>{r.pessoas}</strong><span>Pessoas</span><small className="dl-mono">com ao menos uma sessão</small></div>
          <div className="us-cartao"><strong style={{ color: "#fcd34d" }}>{r.convitesPendentes}</strong><span>Convites pendentes</span><small className="dl-mono">conta criada, senha não definida</small></div>
          <div className="us-cartao"><strong>{r.comGoogle}</strong><span>Entram com o Google</span><small className="dl-mono">conta Google vinculada</small></div>
        </div>
      ) : null}

      <div className="sa-bar">
        <Button as="button" type="button" variant="ghost" className="dl-btn--sm" arrow={false} onClick={carregar}>Atualizar</Button>
      </div>
      {erro ? <Alert tone="danger">{erro}</Alert> : null}

      {dados?.sessoes?.length ? (
        <div className="us-tabela">
          <table>
            <thead><tr><th>Pessoa</th><th>Imobiliária</th><th>Aparelho</th><th>Último uso</th><th>Desde</th><th /></tr></thead>
            <tbody>
              {dados.sessoes.map((s) => (
                <tr key={s.jti}>
                  <td><strong>{s.usuario.nome}</strong><span className="dl-mono">@{s.usuario.login}{TIPO[s.tipo] ? ` · ${TIPO[s.tipo]}` : ""}</span></td>
                  <td>{s.tenant?.name}<span className="dl-mono">/{s.tenant?.slug}</span></td>
                  <td>{s.dispositivo}<span className="dl-mono">{s.ip || ""}</span></td>
                  <td>{quando(s.ultimoUsoEm)}</td>
                  <td>{quando(s.criadaEm)}</td>
                  <td>{podeEncerrar ? <button type="button" className="av-lida" onClick={() => encerrar(s)}>Encerrar</button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : dados ? (
        <div className="sa-empty">
          <p className="sa-empty__title">Nenhuma sessão registrada</p>
          <p className="sa-empty__desc">As sessões aparecem aqui a partir do primeiro uso depois desta versão.</p>
        </div>
      ) : null}

      {dados?.convites?.length ? (
        <>
          <h3 className="ac-titulo">Convites pendentes</h3>
          <div className="sa-list">
            {dados.convites.map((u) => (
              <div key={u.id} className="av-item">
                <div className="av-item__topo">
                  <strong className="av-item__quem">{u.nome}</strong>
                  <span className="dl-mono av-item__onde">{u.tenant?.name} · {u.email || "sem e-mail"}</span>
                  <span className="dl-mono av-item__quando">criada {new Date(u.createdAt).toLocaleDateString("pt-BR")}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

export const ACESSOS_CSS = `
.ac-titulo { margin: 22px 0 10px; font-size: 14px; color: var(--strong); }
.us-tabela td .dl-mono { display: block; }
`;

export default AdminAcessosPage;
