import { useEffect, useState } from "react";
import { adminApi } from "../../api";
import { Alert, Button, Eyebrow, Field, Reveal } from "../../styles/omnimobKit";

/* ────────────────────────────────────────────────────────────────────────────
   COMUNICADOS — o aviso avulso da Omnimob, para um cliente ou para todos.

   Porte do comunicado do VYA. É o que NÃO é novidade de produto ("manutenção
   no sábado às 22h", "o boleto de outubro vai atrasar"): abre uma vez para
   cada pessoa ao entrar no painel, enquanto estiver ativo e no prazo. Não se
   edita — um aviso já visto por parte da equipe não muda por baixo da outra
   parte; encerra-se e manda-se outro.

   Com um cliente em foco, o formulário já nasce para ele.
   ──────────────────────────────────────────────────────────────────────────── */

const VAZIO = { titulo: "", texto: "", expiraEm: "" };

export function AdminComunicadosPage({ tenants = [], foco = null }) {
  const [lista, setLista] = useState(null);
  const [form, setForm] = useState(VAZIO);
  const [destino, setDestino] = useState(foco?.id || "");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null);

  useEffect(() => { setDestino(foco?.id || ""); }, [foco?.id]);

  async function carregar() {
    try {
      setLista((await adminApi.listComunicados()).comunicados);
    } catch (e) {
      setAviso({ tom: "danger", texto: e.message || "Erro ao listar." });
    }
  }
  useEffect(() => { carregar(); }, []);

  async function mandar(e) {
    e.preventDefault();
    const para = destino ? tenants.find((t) => t.id === destino)?.name || "esta imobiliária" : "TODOS os clientes";
    if (!window.confirm(`Mandar este aviso para ${para}? Ele abre para cada pessoa ao entrar no painel.`)) return;
    setEnviando(true);
    setAviso(null);
    try {
      await adminApi.criarComunicado({
        titulo: form.titulo,
        texto: form.texto,
        tenantId: destino || null,
        expiraEm: form.expiraEm ? new Date(`${form.expiraEm}T23:59:59`).toISOString() : null,
      });
      setForm(VAZIO);
      setAviso({ tom: "info", texto: `Comunicado no ar para ${para}.` });
      await carregar();
    } catch (e2) {
      setAviso({ tom: "danger", texto: e2.message || "Não deu para mandar." });
    } finally {
      setEnviando(false);
    }
  }

  async function encerrar(c) {
    if (!window.confirm(`Encerrar "${c.titulo}"? Quem ainda não viu não vai ver.`)) return;
    try {
      await adminApi.encerrarComunicado(c.id);
      await carregar();
    } catch (e) {
      setAviso({ tom: "danger", texto: e.message || "Não deu para encerrar." });
    }
  }

  const mudar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  return (
    <>
      <Reveal className="sa-head">
        <Eyebrow>COMUNICADOS</Eyebrow>
        <h1 className="dl-h2 sa-title">
          <span className="dl-h2__strong">Um aviso para os clientes</span>
          <span className="dl-h2__soft">que abre uma vez para cada pessoa.</span>
        </h1>
      </Reveal>
      <p className="dl-mono dl-note sa-note">// para o que não é novidade de produto: manutenção, cobrança, um recado da equipe</p>

      <form className="cm-form" onSubmit={mandar}>
        <div className="cm-linha">
          <Field label="Para">
            <select className="dl-input" value={destino} onChange={(e) => setDestino(e.target.value)}>
              <option value="">Todos os clientes</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Vale até (opcional)">
            <input className="dl-input" type="date" value={form.expiraEm} onChange={mudar("expiraEm")} />
          </Field>
        </div>
        <Field label="Título">
          <input className="dl-input" maxLength={80} required value={form.titulo} onChange={mudar("titulo")} placeholder="Manutenção no sábado" />
        </Field>
        <Field label="Texto">
          <textarea className="dl-input cm-texto" maxLength={1500} required rows={4} value={form.texto} onChange={mudar("texto")}
            placeholder="O painel fica fora do ar no sábado, das 22h à meia-noite, para uma atualização." />
        </Field>
        <div className="cm-acoes">
          <span className="dl-mono">{form.texto.length}/1500</span>
          <Button as="button" type="submit" variant="accent" className="dl-btn--sm" arrow={false} disabled={enviando}>
            {enviando ? "Mandando…" : "Mandar comunicado"}
          </Button>
        </div>
      </form>

      {aviso ? <Alert tone={aviso.tom}>{aviso.texto}</Alert> : null}

      <div className="sa-list">
        {(lista || []).map((c) => (
          <div key={c.id} className={`av-item${c.valendo ? " is-nova" : ""}`}>
            <div className="av-item__topo">
              <strong className="av-item__quem">{c.titulo}</strong>
              <span className="dl-mono av-item__onde">
                {c.tenant ? `para ${c.tenant.name}` : "para todos"} · {c.vistos} {c.vistos === 1 ? "pessoa viu" : "pessoas viram"}
                {c.expiraEm ? ` · até ${new Date(c.expiraEm).toLocaleDateString("pt-BR")}` : ""}
                {c.valendo ? "" : " · encerrado"}
              </span>
              <span className="dl-mono av-item__quando">{new Date(c.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}{c.criadoPor ? ` · ${c.criadoPor}` : ""}</span>
              {c.valendo ? <button type="button" className="av-lida" onClick={() => encerrar(c)}>Encerrar</button> : null}
            </div>
            <p className="av-item__texto">{c.texto}</p>
          </div>
        ))}
      </div>
      {lista && !lista.length ? (
        <div className="sa-empty">
          <p className="sa-empty__title">Nenhum comunicado ainda</p>
          <p className="sa-empty__desc">O primeiro aviso que você mandar aparece aqui, com quantas pessoas já viram.</p>
        </div>
      ) : null}
    </>
  );
}

// As linhas reaproveitam as da aba Avaliações (`av-*`); aqui só o formulário.
export const COMUNICADOS_CSS = `
.cm-form { display: grid; gap: 12px; margin-bottom: 18px; padding: 16px 20px; border-radius: 16px; background: var(--surface); border: 1px solid var(--line); }
.cm-linha { display: grid; grid-template-columns: 2fr 1fr; gap: 12px; }
.cm-texto { min-height: 96px; resize: vertical; font-family: inherit; }
.cm-acoes { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.cm-acoes .dl-mono { color: var(--placeholder); font-size: 9px; text-transform: none; }
@media (max-width: 720px) { .cm-linha { grid-template-columns: 1fr; } }
`;

export default AdminComunicadosPage;
