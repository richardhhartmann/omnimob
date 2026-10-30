import { useEffect, useState } from "react";
import { adminApi } from "../../api";
import { Alert, Button, Eyebrow, Reveal } from "../../styles/omnimobKit";

/* ────────────────────────────────────────────────────────────────────────────
   E-MAILS DOS USUÁRIOS — de todos os clientes juntos. Porte da aba do VYA.

   Sem e-mail, a pessoa não recebe as Novidades nem recupera a senha sozinha.
   Em cima, quem USA o painel sem ter (sessão nos últimos 30 dias): é quem
   mais perde. Só leitura — o painel já pede o e-mail a essa pessoa (o
   `PedidoDeEmail`), e trocar um e-mail é do administrador da imobiliária.
   ──────────────────────────────────────────────────────────────────────────── */

const haQuanto = (iso) => {
  if (!iso) return "sem uso nos últimos 30 dias";
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  return dias <= 0 ? "usou hoje" : dias === 1 ? "usou ontem" : `usou há ${dias} dias`;
};

export function AdminEmailsPage({ tenantId = "" }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");

  async function carregar() {
    setErro("");
    try {
      setDados(await adminApi.listEmails(tenantId));
    } catch (e) {
      setErro(e.message || "Erro ao listar os e-mails.");
    }
  }
  useEffect(() => { carregar(); }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  const r = dados?.resumo;
  return (
    <>
      <Reveal className="sa-head">
        <Eyebrow>E-MAILS DOS USUÁRIOS</Eyebrow>
        <h1 className="dl-h2 sa-title">
          <span className="dl-h2__strong">Quem está sem e-mail</span>
          <span className="dl-h2__soft">e não recebe as novidades.</span>
        </h1>
      </Reveal>

      {r ? (
        <div className="us-resumo">
          <div className="us-cartao"><strong>{r.usuarios}</strong><span>Usuários ativos</span><small className="dl-mono">em imobiliárias ativas</small></div>
          <div className="us-cartao"><strong style={{ color: "#86efac" }}>{r.comEmail}</strong><span>Com e-mail</span><small className="dl-mono">recebem as Novidades</small></div>
          <div className="us-cartao"><strong style={{ color: "#fcd34d" }}>{r.semEmail}</strong><span>Sem e-mail</span><small className="dl-mono">o painel já pede a eles</small></div>
          <div className="us-cartao"><strong style={{ color: "#fda4af" }}>{r.usandoSemEmail}</strong><span>Usando sem e-mail</span><small className="dl-mono">com sessão nos últimos 30 dias</small></div>
        </div>
      ) : null}

      <div className="sa-bar">
        <Button as="button" type="button" variant="ghost" className="dl-btn--sm" arrow={false} onClick={carregar}>Atualizar</Button>
      </div>
      {erro ? <Alert tone="danger">{erro}</Alert> : null}

      {dados?.semEmail?.length ? (
        <div className="us-tabela">
          <table>
            <thead><tr><th>Pessoa</th><th>Imobiliária</th><th>Cargo</th><th>Uso</th></tr></thead>
            <tbody>
              {dados.semEmail.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.nome}</strong><span className="dl-mono">@{u.login}</span></td>
                  <td>{u.tenant?.name}<span className="dl-mono">/{u.tenant?.slug}</span></td>
                  <td>{u.cargo || "—"}</td>
                  <td>{haQuanto(u.ultimoUsoEm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : dados ? (
        <div className="sa-empty">
          <p className="sa-empty__title">Todo mundo tem e-mail</p>
          <p className="sa-empty__desc">Nenhum usuário ativo sem e-mail{tenantId ? " neste cliente" : ""}.</p>
        </div>
      ) : null}
    </>
  );
}

export default AdminEmailsPage;
