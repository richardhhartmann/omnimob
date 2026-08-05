import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../api";
import { useConfirm } from "../components/ConfirmModal";
import { SelectCustom } from "../components/SelectCustom";
import {
  ACCENT_SOFT,
  Alert,
  Button,
  DomusStyles,
  Eyebrow,
  Field,
  LogoLockup,
  MINT,
  Reveal,
  StatValue,
  useReveal,
} from "../styles/domusKit";

/* Painel super-admin — mesma identidade da landing: fundo quase-preto, topbar
   de vidro, grid de hairline com contagem progressiva, micro-labels em mono e
   botões pill. A lógica é a mesma de antes; só a camada visual mudou. */

const STATUS_META = {
  TRIAL: { label: "Trial", color: "#a5b4fc", bg: "rgba(129,140,248,0.14)", border: "rgba(129,140,248,0.30)" },
  EM_DIA: { label: "Em dia", color: "#86efac", bg: "rgba(52,211,153,0.14)", border: "rgba(52,211,153,0.30)" },
  ATRASADO: { label: "Atrasado", color: "#fca5a5", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.30)" },
  CANCELADO: { label: "Cancelado", color: "#cbd5e1", bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.25)" },
};
const STATUS_OPCOES = Object.keys(STATUS_META);

const EMPTY_FORM = {
  name: "", slug: "", email: "", whatsapp: "", plano: "",
  statusPagamento: "TRIAL", valorMensal: "", proximoVencimento: "",
  adminLogin: "", adminSenha: "",
};

function fmtMoney(v) {
  if (v == null || v === "") return "—";
  return `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(v) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("pt-BR");
}
function toDateInput(v) {
  if (!v) return "";
  return new Date(v).toISOString().slice(0, 10);
}

// Grid de métricas com um observer só: os quatro números contam juntos
// enquanto as células entram em cascata.
function StatsGrid({ stats, pronto }) {
  const [ref, visivel] = useReveal();
  const CELULAS = [
    { label: "Tenants", value: stats.total, cor: "var(--strong)" },
    { label: "Em dia", value: stats.emDia, cor: MINT },
    { label: "Atrasados", value: stats.atrasado, cor: "#fca5a5" },
    { label: "Trial", value: stats.trial, cor: ACCENT_SOFT },
  ];

  return (
    <div className="dl-grid-hair dl-grid-hair--4 sa-stats" ref={ref}>
      {CELULAS.map((c, i) => (
        <div
          key={c.label}
          className={`dl-reveal${visivel ? " is-visible" : ""} dl-cell dl-stat`}
          style={{ transitionDelay: `${i * 110}ms` }}
        >
          <span className="dl-mono dl-index">[{String(i + 1).padStart(2, "0")}]</span>
          <strong className="dl-stat__n" style={{ color: c.cor }}>
            <StatValue raw={String(c.value)} ativo={visivel && pronto} />
          </strong>
          <span className="dl-stat__l">{c.label}</span>
        </div>
      ))}
    </div>
  );
}

export function SuperAdminPage({ session, onLogout }) {
  const { confirm, modal: confirmModal } = useConfirm();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setTenants(await adminApi.listTenants());
    } catch (err) {
      setError(err.message || "Erro ao carregar tenants.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const by = (s) => tenants.filter((t) => t.statusPagamento === s).length;
    return { total: tenants.length, emDia: by("EM_DIA"), atrasado: by("ATRASADO"), trial: by("TRIAL") };
  }, [tenants]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter((t) => `${t.name} ${t.slug} ${t.email}`.toLowerCase().includes(q));
  }, [tenants, search]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(t) {
    setEditingId(t.id);
    setForm({
      name: t.name || "", slug: t.slug || "", email: t.email || "", whatsapp: t.whatsapp || "",
      plano: t.plano || "", statusPagamento: t.statusPagamento || "TRIAL",
      valorMensal: t.valorMensal ?? "", proximoVencimento: toDateInput(t.proximoVencimento),
      adminLogin: "", adminSenha: "",
    });
    setFormError("");
    setModalOpen(true);
  }

  function setField(k, v) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        name: form.name, email: form.email, whatsapp: form.whatsapp, plano: form.plano,
        statusPagamento: form.statusPagamento,
        valorMensal: form.valorMensal === "" ? null : Number(form.valorMensal),
        proximoVencimento: form.proximoVencimento || null,
      };
      if (editingId) {
        await adminApi.updateTenant(editingId, payload);
      } else {
        const createPayload = { ...payload, slug: form.slug };
        if (form.adminLogin && form.adminSenha) {
          createPayload.adminLogin = form.adminLogin;
          createPayload.adminSenha = form.adminSenha;
        }
        const res = await adminApi.createTenant(createPayload);
        if (res?.warning) alert(res.warning);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(t) {
    if (!await confirm(`Excluir o tenant "${t.name}"? Isso remove usuários, imóveis e leads. Esta ação é irreversível.`, "Excluir")) return;
    try {
      await adminApi.deleteTenant(t.id);
      await load();
    } catch (err) {
      alert(err.message || "Erro ao excluir.");
    }
  }

  return (
    <div className="dl-root dl-page sa-root">
      <DomusStyles extra={CSS} />
      {confirmModal}

      {/* ── Topbar ── */}
      <header className="sa-top">
        <div className="dl-wrap sa-top__inner">
          <Link to="/" className="dl-logo" aria-label="Domus — início">
            <LogoLockup height={32} />
          </Link>
          <span className="dl-mono sa-top__tag">● SUPER-ADMIN</span>

          <div className="sa-top__actions">
            <span className="dl-mono sa-top__user">{session?.nome || session?.email}</span>
            <Button as="button" type="button" variant="ghost" className="dl-btn--sm" arrow={false} onClick={onLogout}>
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="dl-wrap sa-main">
        {/* ── Cabeçalho ── */}
        <Reveal className="sa-head">
          <Eyebrow>ADMINISTRAÇÃO DA PLATAFORMA</Eyebrow>
          <h1 className="dl-h2 sa-title">
            <span className="dl-h2__strong">Tenants da Domus</span>
            <span className="dl-h2__soft">e situação de cobrança.</span>
          </h1>
        </Reveal>

        <StatsGrid stats={stats} pronto={!loading} />
        <p className="dl-mono dl-note sa-note">// {tenants.length} imobiliárias provisionadas nesta instância</p>

        {/* ── Busca + ação ── */}
        <div className="sa-bar">
          <input
            className="dl-input sa-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, slug ou e-mail…"
          />
          <Button as="button" type="button" variant="accent" onClick={openCreate}>
            Novo tenant
          </Button>
        </div>

        {error ? <Alert tone="danger">{error}</Alert> : null}
        {loading ? <p className="dl-mono sa-loading">// carregando tenants…</p> : null}

        {!loading && filtered.length === 0 ? (
          <div className="sa-empty">
            <p className="sa-empty__title">Nenhum tenant encontrado</p>
            <p className="sa-empty__desc">
              {search ? "Ajuste a busca ou limpe o filtro." : "Cadastre a primeira imobiliária para começar."}
            </p>
          </div>
        ) : null}

        {/* ── Lista ── */}
        <div className="sa-list">
          {filtered.map((t, i) => {
            const sm = STATUS_META[t.statusPagamento] || STATUS_META.TRIAL;
            return (
              <Reveal key={t.id} className="sa-row" delay={Math.min(i, 8) * 55}>
                <div className="sa-row__main">
                  <div className="sa-row__title">
                    <span className="sa-row__name">{t.name}</span>
                    <span className="dl-mono sa-row__slug">/{t.slug}</span>
                    <span
                      className="dl-pill"
                      style={{ background: sm.bg, color: sm.color, borderColor: sm.border }}
                    >
                      {sm.label}
                    </span>
                    {!t.ativo ? (
                      <span className="dl-pill" style={{ background: "rgba(148,163,184,0.12)", color: "#cbd5e1", borderColor: "rgba(148,163,184,0.25)" }}>
                        Inativo
                      </span>
                    ) : null}
                  </div>

                  <dl className="sa-meta">
                    <div><dt className="dl-mono">PLANO</dt><dd>{t.plano || "—"}</dd></div>
                    <div><dt className="dl-mono">MENSAL</dt><dd>{fmtMoney(t.valorMensal)}</dd></div>
                    <div><dt className="dl-mono">VENCE</dt><dd>{fmtDate(t.proximoVencimento)}</dd></div>
                    <div><dt className="dl-mono">USO</dt><dd>{t.usuarios} usuários · {t.properties} imóveis</dd></div>
                  </dl>
                </div>

                <div className="sa-row__actions">
                  <Button href={`/vitrine/${t.slug}`} target="_blank" rel="noreferrer" variant="ghost" className="dl-btn--sm" arrow={false}>
                    Vitrine
                  </Button>
                  <Button as="button" type="button" variant="outline" className="dl-btn--sm" arrow={false} onClick={() => openEdit(t)}>
                    Editar
                  </Button>
                  <Button as="button" type="button" variant="danger" className="dl-btn--sm" arrow={false} onClick={() => handleDelete(t)}>
                    Excluir
                  </Button>
                </div>
              </Reveal>
            );
          })}
        </div>
      </main>

      {/* ── Modal de cadastro/edição ── */}
      {modalOpen ? (
        <div className="sa-modal" onClick={() => setModalOpen(false)}>
          <form className="sa-modal__card" onClick={(e) => e.stopPropagation()} onSubmit={handleSave}>
            <div className="sa-modal__head">
              <Eyebrow>{editingId ? "EDITAR" : "PROVISIONAR"}</Eyebrow>
              <h2 className="sa-modal__title">{editingId ? "Editar tenant" : "Novo tenant"}</h2>
            </div>

            {formError ? <Alert tone="danger">{formError}</Alert> : null}

            <div className="sa-form-grid">
              <Field label="Nome *">
                <input className="dl-input" required value={form.name} onChange={(e) => setField("name", e.target.value)} />
              </Field>
              <Field label="Slug *" hint={editingId ? "O slug não muda depois de criado." : undefined}>
                <input
                  className="dl-input"
                  required
                  value={form.slug}
                  onChange={(e) => setField("slug", e.target.value.toLowerCase())}
                  disabled={!!editingId}
                  placeholder="ex: imobiliaria-x"
                />
              </Field>
              <Field label="E-mail">
                <input className="dl-input" type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} />
              </Field>
              <Field label="WhatsApp">
                <input className="dl-input" value={form.whatsapp} onChange={(e) => setField("whatsapp", e.target.value)} placeholder="5511999999999" />
              </Field>
              <Field label="Plano">
                <input className="dl-input" value={form.plano} onChange={(e) => setField("plano", e.target.value)} placeholder="Básico / Profissional…" />
              </Field>
              <Field label="Status pagamento">
                <SelectCustom
                  value={form.statusPagamento}
                  options={STATUS_OPCOES.map((s) => ({ value: s, label: STATUS_META[s].label, color: STATUS_META[s].color }))}
                  onChange={(v) => setField("statusPagamento", v)}
                />
              </Field>
              <Field label="Valor mensal (R$)">
                <input className="dl-input" type="number" step="0.01" value={form.valorMensal} onChange={(e) => setField("valorMensal", e.target.value)} />
              </Field>
              <Field label="Próximo vencimento">
                <input className="dl-input" type="date" value={form.proximoVencimento} onChange={(e) => setField("proximoVencimento", e.target.value)} />
              </Field>
            </div>

            {!editingId ? (
              <div className="sa-modal__extra">
                <span className="dl-mono sa-modal__extra-label">// usuário admin inicial (opcional)</span>
                <div className="sa-form-grid">
                  <Field label="Login do admin">
                    <input className="dl-input" value={form.adminLogin} onChange={(e) => setField("adminLogin", e.target.value)} />
                  </Field>
                  <Field label="Senha do admin">
                    <input className="dl-input" type="text" value={form.adminSenha} onChange={(e) => setField("adminSenha", e.target.value)} />
                  </Field>
                </div>
              </div>
            ) : null}

            <div className="sa-modal__foot">
              <Button as="button" type="button" variant="ghost" arrow={false} onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button as="button" type="submit" variant="primary" disabled={saving}>
                {saving ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

const CSS = `
.sa-root { position: relative; }
.sa-root::before {
  content: ""; position: absolute; inset: 0 0 auto 0; height: 620px; pointer-events: none; z-index: 0;
  background:
    radial-gradient(820px 420px at 78% -8%, rgba(99,102,241,0.16), transparent 70%),
    radial-gradient(560px 340px at 4% 6%, rgba(212,175,55,0.07), transparent 70%);
}

/* ── Topbar ── */
.sa-top {
  position: sticky; top: 0; z-index: 40;
  background: rgba(10,10,11,0.72);
  backdrop-filter: blur(16px) saturate(140%); -webkit-backdrop-filter: blur(16px) saturate(140%);
  border-bottom: 1px solid var(--line-soft);
}
.sa-top__inner { display: flex; align-items: center; gap: 16px; height: 66px; }
.sa-top__tag {
  color: var(--accent-soft); font-size: 9px; letter-spacing: 0.16em;
  padding: 4px 10px; border-radius: 999px;
  background: rgba(99,102,241,0.10); border: 1px solid rgba(99,102,241,0.22);
}
.sa-top__actions { margin-left: auto; display: flex; align-items: center; gap: 14px; }
.sa-top__user { color: var(--placeholder); font-size: 9.5px; letter-spacing: 0.08em; text-transform: none; }

/* ── Conteúdo ── */
.sa-main { padding-top: 44px; padding-bottom: 72px; }
.sa-head { margin-bottom: 34px; }
.sa-title { max-width: 22ch; }
.sa-stats { margin-top: 4px; }
.sa-note { margin-top: 16px; margin-bottom: 34px; }

.sa-bar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 20px; }
.dl-root .sa-search { max-width: 340px; flex: 1 1 240px; }
.sa-loading { color: var(--placeholder); text-transform: none; letter-spacing: 0.05em; padding: 18px 0; }

.sa-empty {
  padding: 56px 24px; text-align: center;
  border: 1px dashed var(--line); border-radius: 18px; background: var(--bg-alt);
}
.sa-empty__title { font-size: 15px; font-weight: 700; color: var(--strong); letter-spacing: -0.02em; }
.sa-empty__desc { font-size: 13px; line-height: 1.7; color: var(--subtle); margin-top: 8px; }

/* ── Lista de tenants ── */
.sa-list { display: grid; gap: 10px; }
.sa-row {
  display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap;
  padding: 20px 22px; border-radius: 16px;
  background: var(--surface); border: 1px solid var(--line);
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.85s var(--ease-out), opacity 0.85s var(--ease-out);
}
.sa-row:hover { border-color: #34343c; background: var(--surface-2); }
.sa-row__main { min-width: 240px; flex: 1; }
.sa-row__title { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.sa-row__name { font-size: 15.5px; font-weight: 700; color: var(--strong); letter-spacing: -0.025em; }
.sa-row__slug { color: var(--placeholder); font-size: 9.5px; text-transform: none; }

.sa-meta { display: flex; gap: 26px; flex-wrap: wrap; margin-top: 12px; }
.sa-meta dt { color: #55555f; font-size: 8.5px; letter-spacing: 0.13em; }
.sa-meta dd { margin: 3px 0 0; font-size: 12.5px; color: var(--subtle); }

.sa-row__actions { display: flex; gap: 8px; flex-shrink: 0; flex-wrap: wrap; }

/* ── Modal ── */
.sa-modal {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.72); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.sa-modal__card {
  width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto;
  padding: 30px; border-radius: 22px;
  background: #121214; border: 1px solid var(--line);
  box-shadow: 0 60px 120px -40px rgba(0,0,0,0.95);
  display: flex; flex-direction: column; gap: 18px;
}
.sa-modal__head { display: grid; gap: 10px; }
.sa-modal__title { font-size: 24px; font-weight: 800; letter-spacing: -0.035em; color: var(--strong); }
.sa-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.sa-modal__extra { border-top: 1px solid var(--line); padding-top: 18px; display: grid; gap: 14px; }
.sa-modal__extra-label { color: var(--placeholder); font-size: 9.5px; text-transform: none; letter-spacing: 0.05em; }
.sa-modal__foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }

@media (max-width: 720px) {
  .sa-form-grid { grid-template-columns: 1fr; }
  .sa-row { align-items: flex-start; }
  .sa-row__actions { width: 100%; }
  .sa-top__inner { height: auto; padding-top: 12px; padding-bottom: 12px; flex-wrap: wrap; }
  .sa-top__actions { width: 100%; justify-content: space-between; }
  .sa-meta { gap: 16px; }
}
`;
