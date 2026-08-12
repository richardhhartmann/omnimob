import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Buildings, GraduationCap, Lifebuoy } from "@phosphor-icons/react";
import { api, adminApi } from "../api";
import { AdminShell } from "../components/AdminShell";
import { useConfirm } from "../components/ConfirmModal";
import { SelectCustom } from "../components/SelectCustom";
import { PLANOS } from "../utils/planos";
import { slugify, motivoLocal, MOTIVO_SLUG } from "../utils/slug";
import { AdminChamadosPage, CHAMADOS_CSS } from "./admin/AdminChamadosPage";
import { AdminTutoriaisPage, TUTORIAIS_CSS } from "./admin/AdminTutoriaisPage";
import {
  ACCENT_SOFT,
  Alert,
  Button,
  Eyebrow,
  Field,
  MINT,
  Reveal,
  StatValue,
  useReveal,
} from "../styles/omnimobKit";

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

/* O plano deixou de ser texto livre: escrever "Profissional" com acento, sem
   acento ou abreviado gerava tenants que o `planoMiddleware` não reconhece e
   que caem no Básico sem ninguém perceber. A lista é a mesma de `planos.js`, e
   o resumo sai dos próprios flags do plano para não desencontrar da tabela. */
const PLANO_OPCOES = PLANOS.map((p) => ({
  value: p.key,
  label: p.nome,
  color: p.cor,
  description:
    [p.redes && "redes sociais", p.tour360 && "tour 360°", p.ia && "IA"].filter(Boolean).join(" · ") ||
    "recursos essenciais",
}));

const EMPTY_FORM = {
  name: "", slug: "", email: "", whatsapp: "", plano: "",
  statusPagamento: "TRIAL", valorMensal: "", proximoVencimento: "",
};

// ─── Endereço da vitrine ─────────────────────────────────────────────────────
/* Mesmo comportamento do cadastro da landing (`TrialModal`): o slug nasce do
   nome, não é digitado, e a disponibilidade aparece enquanto se escreve. Duas
   portas de entrada que compusessem o endereço de formas diferentes dariam
   endereços diferentes para o mesmo nome. */
const ESPERA_SLUG = 450;
const SLUG_VAZIO = { valor: "", estado: "vazio", mensagem: "" };
const HOST_VITRINE =
  typeof window !== "undefined" ? `${window.location.host}/vitrine` : "omnimob.app/vitrine";
const SELO_SLUG = {
  vazio: "",
  checando: "verificando…",
  livre: "✓ disponível",
  indisponivel: "✕ indisponível",
  erro: "não verificado",
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

/* Abas do painel. A ordem é a da rotina: primeiro quem são os clientes, depois
   o que eles estão pedindo, depois se eles entenderam o produto. */
const ABAS = [
  {
    chave: "tenants",
    rotulo: "Tenants",
    nota: "imobiliárias provisionadas, cobrança e provisionamento",
    icone: <Buildings size={16} />,
  },
  {
    chave: "chamados",
    rotulo: "Chamados",
    nota: "suporte aberto pelo botão de Ajuda dentro dos painéis",
    icone: <Lifebuoy size={16} />,
  },
  {
    chave: "tutoriais",
    rotulo: "Tutoriais",
    nota: "quanto do tour cada pessoa percorreu",
    icone: <GraduationCap size={16} />,
  },
];

export function SuperAdminPage({ session, onLogout }) {
  const navegar = useNavigate();
  const [aba, setAba] = useState("tenants");
  // Contado pela aba de chamados quando ela carrega, e exibido no menu — é o
  // único número do painel que pede ação imediata.
  const [chamadosAbertos, setChamadosAbertos] = useState(0);

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
  /* Endereço derivado do nome. estado: "vazio" | "checando" | "livre" |
     "indisponivel" | "erro" */
  const [slug, setSlug] = useState(SLUG_VAZIO);
  /* Credenciais do admin recém-criado. Só existem nesta resposta — depois disto
     o banco guarda apenas o hash —, então o modal para no lugar e mostra o que
     precisa ser repassado à imobiliária. */
  const [criado, setCriado] = useState(null);

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

  /* O contador do menu é buscado na entrada, não quando a aba de chamados
     abre: um badge que só aparece depois de você clicar no item não avisa
     nada. É uma requisição pequena, e só conta os abertos. */
  useEffect(() => {
    adminApi.listChamados({ resolvido: false })
      .then((l) => setChamadosAbertos(l.length))
      .catch(() => {});
  }, []);

  /* O que dá para julgar sem rede (tamanho, caracteres, nomes reservados) é
     julgado na hora; só o "esse já é de alguém" pergunta ao servidor, e espera
     a digitação parar. A resposta anterior é abortada a cada tecla, então uma
     consulta lenta nunca sobrescreve uma mais nova. Na edição não roda: o slug
     de um tenant existente não muda, mesmo que o nome mude. */
  const nomeDigitado = form.name;
  useEffect(() => {
    if (!modalOpen || editingId || criado) return undefined;

    const bruto = nomeDigitado.trim();
    const valor = slugify(bruto);

    if (bruto.length < 2) {
      setSlug({ valor, estado: "vazio", mensagem: "" });
      return undefined;
    }

    const motivo = motivoLocal(bruto);
    if (motivo) {
      setSlug({ valor, estado: "indisponivel", mensagem: MOTIVO_SLUG[motivo] });
      return undefined;
    }

    setSlug({ valor, estado: "checando", mensagem: "" });

    const controle = new AbortController();
    const timer = setTimeout(() => {
      api
        .verificarSlugOmnimob(bruto, { signal: controle.signal })
        .then((r) =>
          setSlug({
            valor: r.slug || valor,
            estado: r.disponivel ? "livre" : "indisponivel",
            mensagem: r.mensagem || "",
          }),
        )
        .catch((erro) => {
          if (erro.name === "AbortError") return;
          // Sem resposta não dá para afirmar nada, e travar o cadastro por causa
          // de uma consulta que caiu seria pior: o servidor confere de novo no
          // envio.
          setSlug({ valor, estado: "erro", mensagem: "" });
        });
    }, ESPERA_SLUG);

    return () => {
      clearTimeout(timer);
      controle.abort();
    };
  }, [modalOpen, editingId, criado, nomeDigitado]);

  /* Planos fora da lista aparecem como estão: tenants criados antes do combo
     têm o plano escrito à mão, e abrir o cadastro para mexer no vencimento não
     pode trocar silenciosamente o plano de quem já paga. */
  const planoOpcoes = useMemo(() => {
    if (!form.plano || PLANO_OPCOES.some((o) => o.value === form.plano)) return PLANO_OPCOES;
    return [...PLANO_OPCOES, { value: form.plano, label: form.plano, description: "valor atual, fora da lista" }];
  }, [form.plano]);

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
    setSlug(SLUG_VAZIO);
    setCriado(null);
    setModalOpen(true);
  }

  function openEdit(t) {
    setEditingId(t.id);
    setForm({
      name: t.name || "", slug: t.slug || "", email: t.email || "", whatsapp: t.whatsapp || "",
      plano: t.plano || "", statusPagamento: t.statusPagamento || "TRIAL",
      valorMensal: t.valorMensal ?? "", proximoVencimento: toDateInput(t.proximoVencimento),
    });
    setFormError("");
    setSlug(SLUG_VAZIO);
    setCriado(null);
    setModalOpen(true);
  }

  function fecharModal() {
    setModalOpen(false);
    setCriado(null);
  }

  function setField(k, v) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function handleSave(e) {
    e.preventDefault();
    // O botão já fica desligado nestes casos; a trava aqui é para o Enter, que
    // envia o formulário sem passar por ele.
    if (!editingId && (slug.estado === "indisponivel" || slug.estado === "checando")) return;
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
        setModalOpen(false);
        await load();
      } else {
        // O slug não vai no envio: quem o compõe é o servidor, a partir do nome.
        const res = await adminApi.createTenant(payload);
        // O modal não fecha — as credenciais do admin só existem nesta resposta.
        setCriado({ slug: res.slug, admin: res.admin || null, warning: res.warning || "" });
        await load();
      }
    } catch (err) {
      setFormError(err.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(t) {
    const ok = await confirm(
      `Excluir o tenant "${t.name}"? Isso remove usuários, imóveis, leads e chamados — e cancela ` +
      "no Stripe qualquer assinatura ativa desta imobiliária. A ação é irreversível.",
      "Excluir",
    );
    if (!ok) return;
    try {
      const r = await adminApi.deleteTenant(t.id);
      await load();

      /* O que sobrou no Stripe precisa ser dito. Uma assinatura que resistiu ao
         cancelamento continua cobrando todo mês por um ambiente que não existe
         mais, e depois da exclusão não há nada no painel apontando para ela —
         se este aviso não aparecer, ninguém descobre até a fatura. */
      const s = r?.stripe;
      if (s?.falhas?.length) {
        alert(
          `Tenant excluído, mas ${s.falhas.length} assinatura(s) no Stripe NÃO foram canceladas:\n` +
          `${s.falhas.map((f) => `· ${f.id || "?"}: ${f.motivo}`).join("\n")}\n\n` +
          `Cancele à mão no painel do Stripe (slug "${r.slug}").`,
        );
      }
    } catch (err) {
      alert(err.message || "Erro ao excluir.");
    }
  }

  const abas = ABAS.map((a) => (a.chave === "chamados" ? { ...a, badge: chamadosAbertos } : a));

  return (
    <AdminShell
      session={session}
      onLogout={onLogout}
      abas={abas}
      aba={aba}
      aoTrocarAba={setAba}
      css={`${CSS}\n${CHAMADOS_CSS}\n${TUTORIAIS_CSS}`}
    >
      {confirmModal}

      {aba === "chamados" ? <AdminChamadosPage aoContarAbertos={setChamadosAbertos} /> : null}
      {aba === "tutoriais" ? <AdminTutoriaisPage /> : null}

      {aba === "tenants" ? (
        <>
        {/* ── Cabeçalho ── */}
        <Reveal className="sa-head">
          <Eyebrow>ADMINISTRAÇÃO DA PLATAFORMA</Eyebrow>
          <h1 className="dl-h2 sa-title">
            <span className="dl-h2__strong">Tenants da Omnimob</span>
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
        </>
      ) : null}

      {/* ── Modal de cadastro/edição ── */}
      {modalOpen ? (
        <div className="sa-modal" onClick={fecharModal}>
          <form className="sa-modal__card" onClick={(e) => e.stopPropagation()} onSubmit={handleSave}>
            {criado ? (
              /* Ambiente criado. A senha aparece uma vez só — daqui em diante o
                 banco tem apenas o hash dela. */
              <>
                <div className="sa-modal__head">
                  <Eyebrow>PROVISIONADO</Eyebrow>
                  <h2 className="sa-modal__title">{form.name} está no ar</h2>
                </div>

                {criado.warning ? <Alert tone="danger">{criado.warning}</Alert> : null}

                <p className="sa-endereco sa-endereco--fixo">
                  <span className="dl-mono sa-endereco__url">
                    {HOST_VITRINE}/<b>{criado.slug}</b>
                  </span>
                  <span className="sa-endereco__nota">Endereço da vitrine pública.</span>
                </p>

                {criado.admin ? (
                  <div className="sa-credenciais">
                    <span className="dl-mono sa-modal__extra-label">// acesso do administrador</span>
                    <dl className="sa-credenciais__lista">
                      <div>
                        <dt className="dl-mono">LOGIN</dt>
                        <dd>{criado.admin.login}</dd>
                      </div>
                      <div>
                        <dt className="dl-mono">SENHA PROVISÓRIA</dt>
                        <dd>{criado.admin.senha}</dd>
                      </div>
                    </dl>
                    <p className="sa-credenciais__nota">
                      Anote agora: a senha não volta a ser exibida. No primeiro acesso o sistema
                      obriga a definir uma nova.
                    </p>
                  </div>
                ) : null}

                <div className="sa-modal__foot">
                  {criado.admin ? (
                    /* Leva ao login com os campos já preenchidos.

                       As credenciais viajam no state do roteador, NÃO na URL:
                       query string vai parar no histórico do navegador, no
                       Referer e em qualquer log pelo caminho — e isto aqui é
                       uma senha. A LoginPage lê o state e o apaga em seguida,
                       então nem o botão "voltar" a traz de volta.

                       Sem `target="_blank"`: o state do roteador não atravessa
                       aba nova, e o link abriria com os campos vazios. */
                    <Button
                      as="button"
                      type="button"
                      variant="ghost"
                      arrow={false}
                      onClick={() =>
                        navegar("/login", {
                          state: {
                            credenciais: { login: criado.admin.login, senha: criado.admin.senha },
                            origem: "provisionamento",
                          },
                        })
                      }
                    >
                      Ir para o login
                    </Button>
                  ) : null}
                  <Button as="button" type="button" variant="primary" arrow={false} onClick={fecharModal}>
                    Concluir
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="sa-modal__head">
                  <Eyebrow>{editingId ? "EDITAR" : "PROVISIONAR"}</Eyebrow>
                  <h2 className="sa-modal__title">{editingId ? "Editar tenant" : "Novo tenant"}</h2>
                </div>

                {formError ? <Alert tone="danger">{formError}</Alert> : null}

                <div className="sa-form-grid">
                  {/* O nome não é só um rótulo: é dele que sai o endereço da
                      vitrine, único entre todas as imobiliárias. Por isso o campo
                      ocupa a linha inteira e mostra o endereço se formando. */}
                  <div className="sa-nome">
                    <Field label="Nome *">
                      <input className="dl-input" required value={form.name} onChange={(e) => setField("name", e.target.value)} />
                    </Field>

                    {editingId ? (
                      <p className="sa-endereco sa-endereco--fixo">
                        <span className="dl-mono sa-endereco__url">
                          {HOST_VITRINE}/<b>{form.slug}</b>
                        </span>
                        <span className="sa-endereco__nota">
                          O endereço da vitrine não muda depois de criado, mesmo que o nome mude.
                        </span>
                      </p>
                    ) : form.name.trim() ? (
                      <span className={`sa-endereco is-${slug.estado}`} aria-live="polite">
                        <span className="sa-endereco__linha">
                          <span className="dl-mono sa-endereco__url">
                            {HOST_VITRINE}/<b>{slug.valor}</b>
                          </span>
                          <span className="sa-endereco__selo">{SELO_SLUG[slug.estado]}</span>
                        </span>
                        <span className="sa-endereco__nota">
                          {slug.mensagem || "Endereço da vitrine, gerado a partir do nome."}
                        </span>
                      </span>
                    ) : null}
                  </div>

                  <Field label="E-mail">
                    <input className="dl-input" type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} />
                  </Field>
                  <Field label="WhatsApp">
                    <input className="dl-input" value={form.whatsapp} onChange={(e) => setField("whatsapp", e.target.value)} placeholder="5511999999999" />
                  </Field>
                  <Field label="Plano">
                    <SelectCustom
                      value={form.plano}
                      options={planoOpcoes}
                      onChange={(v) => setField("plano", v)}
                      placeholder="Selecione o plano"
                    />
                  </Field>
                  <Field label="Status pagamento">
                    <SelectCustom
                      value={form.statusPagamento}
                      options={STATUS_OPCOES.map((s) => ({ value: s, label: STATUS_META[s].label, color: STATUS_META[s].color }))}
                      onChange={(v) => setField("statusPagamento", v)}
                    />
                  </Field>

                  {/* Plano e status são eixos independentes, e isso não era
                      óbvio: dá para ter Premium em teste e Básico pagante. Já
                      aconteceu de um tenant Premium ser criado com o status
                      padrão (Trial) e a pessoa estranhar o painel tratá-lo como
                      teste — estava certo, só não estava dito em lugar nenhum.
                      Esta linha diz, em uma frase, o que será criado. */}
                  <p className="sa-resumo">
                    <span className="dl-mono sa-modal__extra-label">// o que será criado</span>
                    <strong>
                      {(PLANO_OPCOES.find((o) => o.value === form.plano)?.label) || "Básico"}
                      {" · "}
                      {form.statusPagamento === "TRIAL"
                        ? "em teste — não cobra, e o painel mostra contagem regressiva"
                        : form.statusPagamento === "EM_DIA"
                          ? "pagante — recebe as boas-vindas de assinante"
                          : STATUS_META[form.statusPagamento]?.label}
                    </strong>
                  </p>
                  <Field label="Valor mensal (R$)">
                    <input className="dl-input" type="number" step="0.01" value={form.valorMensal} onChange={(e) => setField("valorMensal", e.target.value)} />
                  </Field>
                  <Field label="Próximo vencimento">
                    <input className="dl-input" type="date" value={form.proximoVencimento} onChange={(e) => setField("proximoVencimento", e.target.value)} />
                  </Field>
                </div>

                {!editingId ? (
                  <p className="dl-mono sa-modal__extra-label">
                    // o acesso do administrador é criado junto, com senha provisória e troca
                    obrigatória no primeiro login
                  </p>
                ) : null}

                <div className="sa-modal__foot">
                  <Button as="button" type="button" variant="ghost" arrow={false} onClick={fecharModal}>
                    Cancelar
                  </Button>
                  {/* Desligado enquanto o endereço não fecha: seguir com um slug
                      ocupado só adiaria a mesma recusa para o fim do cadastro. */}
                  <Button
                    as="button"
                    type="submit"
                    variant="primary"
                    disabled={saving || (!editingId && (slug.estado === "indisponivel" || slug.estado === "checando"))}
                  >
                    {saving ? "Salvando…" : editingId ? "Salvar" : "Criar tenant"}
                  </Button>
                </div>
              </>
            )}
          </form>
        </div>
      ) : null}
    </AdminShell>
  );
}

/* Só o que é DESTA aba. A moldura — fundo, topbar, sidebar — mora no
   `AdminShell`, junto do JSX que a usa. */
const CSS = `
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
/* Ocupa a linha inteira do grid de dois campos: é uma frase, não um campo. */
.sa-resumo {
  grid-column: 1 / -1; margin: 0; display: grid; gap: 4px;
  padding: 10px 12px; border-radius: 10px;
  background: rgba(255,255,255,0.03); border: 1px solid var(--line);
}
.sa-resumo strong { font-size: 13px; font-weight: 600; color: var(--strong); line-height: 1.45; }
.sa-modal__title { font-size: 24px; font-weight: 800; letter-spacing: -0.035em; color: var(--strong); }
.sa-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.sa-modal__extra-label { color: var(--placeholder); font-size: 9.5px; text-transform: none; letter-spacing: 0.05em; line-height: 1.6; }
.sa-modal__foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }

/* ── Endereço da vitrine ──────────────────────────────────────────────────
   Colado no campo do nome, com respiro menor que o do próximo campo: é
   consequência do que foi digitado ali em cima, não um campo novo. A caixa
   troca de cor conforme o estado e o texto de apoio troca junto, sem a linha
   pular. Mesma peça do cadastro da landing. */
.sa-nome { grid-column: 1 / -1; display: grid; gap: 6px; }
.sa-endereco {
  display: grid; gap: 5px;
  padding: 9px 12px; border-radius: 10px;
  background: rgba(255,255,255,0.03); border: 1px solid var(--line);
  transition: background 0.22s ease, border-color 0.22s ease;
}
.sa-endereco__linha { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
/* Sem o caixa-alta do .dl-mono: o slug é minúsculo de verdade, e mostrá-lo em
   maiúsculas seria prometer um endereço que não é o que vai ser criado. */
.sa-endereco__url {
  flex: 1 1 auto; min-width: 0; font-size: 11px; color: var(--placeholder);
  text-transform: none; letter-spacing: 0.02em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.sa-endereco__url b { color: var(--subtle); font-weight: 600; }
.sa-endereco__selo {
  flex: 0 0 auto; font-size: 10.5px; font-weight: 600; letter-spacing: 0.01em;
  color: var(--placeholder);
}
.sa-endereco__nota { font-size: 11px; line-height: 1.5; color: var(--placeholder); }

.sa-endereco.is-checando .sa-endereco__selo { color: var(--subtle); }
.sa-endereco.is-livre { background: rgba(52,211,153,0.08); border-color: rgba(52,211,153,0.3); }
.sa-endereco.is-livre .sa-endereco__url b { color: #86efac; }
.sa-endereco.is-livre .sa-endereco__selo { color: #86efac; }
.sa-endereco.is-indisponivel { background: rgba(248,113,113,0.09); border-color: rgba(248,113,113,0.3); }
.sa-endereco.is-indisponivel .sa-endereco__selo { color: #fca5a5; }
.sa-endereco.is-indisponivel .sa-endereco__nota { color: #fca5a5; }

/* ── Credenciais do admin recém-criado ── */
.sa-credenciais {
  display: grid; gap: 12px; padding: 16px 18px; border-radius: 14px;
  background: rgba(212,175,55,0.07); border: 1px solid rgba(212,175,55,0.26);
}
.sa-credenciais__lista { display: grid; gap: 12px; }
.sa-credenciais__lista dt { color: #55555f; font-size: 8.5px; letter-spacing: 0.13em; }
.sa-credenciais__lista dd {
  margin: 4px 0 0; font-size: 15px; font-weight: 600; color: var(--strong);
  font-family: 'JetBrains Mono', ui-monospace, monospace; letter-spacing: 0.01em;
  word-break: break-all; user-select: all;
}
.sa-credenciais__nota { font-size: 11.5px; line-height: 1.6; color: var(--subtle); }

@media (max-width: 720px) {
  .sa-form-grid { grid-template-columns: 1fr; }
  .sa-row { align-items: flex-start; }
  .sa-row__actions { width: 100%; }
  .sa-meta { gap: 16px; }
}
`;
