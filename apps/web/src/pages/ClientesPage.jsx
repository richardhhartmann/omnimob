import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { PerfisDeBusca } from "../components/PerfisDeBusca.jsx";
import { useOutletContext } from "react-router-dom";
import { BtnAtivar, BtnDesativar, BtnEditar, BtnExcluir, BtnNovo } from "../components/ActionIcons";
import { useConfirm } from "../components/ConfirmModal";
import { Avatar, Chip, EmptyState, FilterTabs, SearchInput, StatCard, StatGrid, StatusPill } from "../components/adminUi";
import { SkeletonStats, SkeletonListRows } from "../components/Skeleton";
import { formatCep, formatCpf, formatPhone, formatRg, onlyDigits } from "../utils/masks";

const FORM_EMPTY = {
  nome: "", cpf: "", rg: "", nascimento: "", email: "", telefone: "", whatsapp: "",
  cep: "", endereco: "", bairro: "", cidade: "", estado: "", observacoes: "", ativo: true,
  aceitaDivulgacao: false,
};

function IconAlvo() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.4" />
    </svg>
  );
}

function formatarData(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

const IconWhats = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" /></svg>
);
const IconMail = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" /></svg>
);
const IconPin = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
);
const IconMegafone = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></svg>
);

export function ClientesPage({ session }) {
  const tenantSlug = session?.tenant?.slug;
  const { confirm, modal: confirmModal } = useConfirm();
  const showToast = useOutletContext()?.showToast;
  const [clientes, setClientes] = useState([]);
  const [view, setView] = useState("list");
  const [editando, setEditando] = useState(null);
  /* Um cliente por vez com os perfis abertos. Vários abertos ao mesmo tempo
     transformariam a lista numa parede de formulários — e a pergunta "o que
     este cliente procura" é sempre sobre UM cliente. */
  const [perfisDe, setPerfisDe] = useState(null);
  const [tiposImovel, setTiposImovel] = useState([]);
  const [form, setForm] = useState(FORM_EMPTY);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | inactive
  const [soDivulgacao, setSoDivulgacao] = useState(false);  // só contatos que recebem divulgação
  const [cepLoading, setCepLoading] = useState(false);
  const searchTimer = useRef(null);
  const lastCepRef = useRef("");

  /* Só a PRIMEIRA carga anuncia quantos vieram. `carregarClientes` também roda
     a cada tecla da busca (com debounce) — sem esta trava, digitar "ana" daria
     três toasts de contagem no caminho. */
  const jaContou = useRef(false);

  function carregarClientes(searchTerm = "") {
    if (!tenantSlug) return;
    api.listClientes(tenantSlug, { search: searchTerm })
      .then((lista) => {
        setClientes(lista);
        if (!jaContou.current) {
          jaContou.current = true;
          const n = Array.isArray(lista) ? lista.length : 0;
          showToast?.(
            n === 0 ? "Nenhum cliente cadastrado ainda."
            : n === 1 ? "1 cliente carregado."
            : `${n} clientes carregados.`,
          );
        }
      })
      .catch(() => {})
      .finally(() => setInitialLoading(false));
  }

  useEffect(() => {
    carregarClientes();
  }, [tenantSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  /* O catálogo de tipos alimenta o seletor do perfil de busca. Uma vez por
     tela, e não por perfil aberto — ele não muda no meio do atendimento. */
  useEffect(() => {
    if (!tenantSlug) return;
    api.getTiposImovel(tenantSlug)
      .then((r) => setTiposImovel(Array.isArray(r) ? r : r?.tipos || []))
      .catch(() => {});
  }, [tenantSlug]);

  function handleSearchChange(e) {
    const val = e.target.value;
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => carregarClientes(val), 350);
  }

  function abrirCriar() {
    setEditando(null);
    setForm(FORM_EMPTY);
    setError("");
    setView("form");
  }

  function abrirEditar(c) {
    setEditando(c);
    setForm({
      nome: c.nome || "", cpf: formatCpf(c.cpf || ""), rg: formatRg(c.rg || ""),
      nascimento: c.nascimento ? c.nascimento.slice(0, 10) : "",
      email: c.email || "", telefone: formatPhone(c.telefone || ""), whatsapp: formatPhone(c.whatsapp || ""),
      cep: formatCep(c.cep || ""), endereco: c.endereco || "", bairro: c.bairro || "",
      cidade: c.cidade || "", estado: c.estado || "", observacoes: c.observacoes || "",
      ativo: c.ativo,
      aceitaDivulgacao: Boolean(c.aceitaDivulgacao),
    });
    setError("");
    setView("form");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = { ...form };
      if (!payload.nascimento) payload.nascimento = null;
      if (editando) {
        const updated = await api.updateCliente(tenantSlug, editando.id, payload);
        setClientes((prev) => prev.map((c) => c.id === updated.id ? updated : c));
        showToast?.(`${updated.nome} atualizado.`);
      } else {
        const created = await api.createCliente(tenantSlug, payload);
        setClientes((prev) => [...prev, created].sort((a, b) => a.nome.localeCompare(b.nome)));
        showToast?.(`${created.nome} cadastrado.`);
      }
      setView("list");
    } catch (err) {
      setError(err.message);
      showToast?.(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function toggleAtivo(c) {
    try {
      if (c.ativo) {
        await api.desativarCliente(tenantSlug, c.id);
        setClientes((prev) => prev.map((x) => x.id === c.id ? { ...x, ativo: false } : x));
        showToast?.(`${c.nome} foi desativado.`);
      } else {
        const updated = await api.updateCliente(tenantSlug, c.id, { ativo: true });
        setClientes((prev) => prev.map((x) => x.id === updated.id ? updated : x));
        showToast?.(`${updated.nome} foi reativado.`);
      }
    } catch (err) {
      showToast ? showToast(err.message, "error") : alert(err.message);
    }
  }

  /* Excluir apaga a linha e não tem desfazer. A confirmação nomeia quem vai
     sumir e lembra que parar aqui já resolve: quem chega neste botão acabou de
     desativar a pessoa, então "deixar inativa" é a saída que ele ainda tem. */
  async function excluir(c) {
    const ok = await confirm(
      `Excluir ${c.nome} definitivamente? O cadastro é apagado, com contato, endereço e histórico de divulgação, sem como recuperar. ` +
      "Deixá-lo inativo já tira o cliente das listagens e preserva os dados.",
      "Excluir definitivamente",
    );
    if (!ok) return;
    try {
      await api.excluirCliente(tenantSlug, c.id);
      setClientes((prev) => prev.filter((x) => x.id !== c.id));
      showToast?.(`${c.nome} foi excluído.`);
    } catch (err) {
      // Recusa por histórico de vendas volta explicada pela API.
      showToast ? showToast(err.message, "error") : alert(err.message);
    }
  }

  function setField(k, v) { setForm((p) => ({ ...p, [k]: v })); }

  // Autopreenche UF, logradouro, bairro e cidade a partir do CEP (mesma API do
  // cadastro de imóveis — ViaCEP).
  async function handleCepBlur() {
    const cleanCep = onlyDigits(form.cep);
    if (cleanCep.length !== 8 || cleanCep === lastCepRef.current) return;
    setCepLoading(true);
    setError("");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      if (!response.ok) throw new Error("Falha ao consultar CEP.");
      const data = await response.json();
      if (data.erro) throw new Error("CEP não encontrado.");
      lastCepRef.current = cleanCep;
      setForm((prev) => ({
        ...prev,
        cep: formatCep(cleanCep),
        endereco: data.logradouro || prev.endereco,
        bairro: data.bairro || prev.bairro,
        cidade: data.localidade || prev.cidade,
        estado: data.uf || prev.estado,
      }));
    } catch (err) {
      setError(err.message || "Não foi possível buscar o CEP.");
    } finally {
      setCepLoading(false);
    }
  }

  const stats = useMemo(() => {
    const mesAtual = new Date().getMonth();
    return {
      total: clientes.length,
      ativos: clientes.filter((c) => c.ativo).length,
      inativos: clientes.filter((c) => !c.ativo).length,
      divulgacao: clientes.filter((c) => c.aceitaDivulgacao).length,
      aniversariantes: clientes.filter((c) => c.nascimento && new Date(c.nascimento).getUTCMonth() === mesAtual).length,
    };
  }, [clientes]);

  const visiveis = useMemo(() => clientes.filter((c) => {
    const passaStatus = statusFilter === "all" || (statusFilter === "active" ? c.ativo : !c.ativo);
    const passaDivulgacao = !soDivulgacao || c.aceitaDivulgacao;
    return passaStatus && passaDivulgacao;
  }), [clientes, statusFilter, soDivulgacao]);

  /* Vazio por falta de cadastro ou por filtro? Só o primeiro caso merece o
     convite a cadastrar — com a busca preenchida, "o primeiro cliente" pode ser
     o quadragésimo. A busca conta aqui apesar de ser feita no servidor: para
     quem olha a tela, ela filtra igual. */
  const filtrando = Boolean(search) || statusFilter !== "all" || soDivulgacao;

  if (view === "form") {
    return (
      <section className="main-content glass-panel" style={{ maxWidth: "1100px", animation: "fadeIn 0.3s ease-in-out" }}>
        <h2 style={{ marginBottom: "24px" }}>{editando ? "Editar Cliente" : "Novo Cliente"}</h2>
        {error ? <div className="error">{error}</div> : null}
        <form className="grid" onSubmit={handleSubmit}>

          <div style={{ marginBottom: "4px", fontSize: "11px", fontWeight: "600", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Dados Pessoais
          </div>
          <input data-tour="cliente-nome" placeholder="Nome completo *" value={form.nome} onChange={(e) => setField("nome", e.target.value)} required disabled={loading} />
          <div className="grid grid-2">
            <input data-tour="cliente-cpf" placeholder="CPF" inputMode="numeric" value={form.cpf} onChange={(e) => setField("cpf", formatCpf(e.target.value))} disabled={loading} />
            <input placeholder="RG" value={form.rg} onChange={(e) => setField("rg", formatRg(e.target.value))} disabled={loading} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "12px", opacity: 0.55 }}>Data de Nascimento</label>
            <input type="date" value={form.nascimento} onChange={(e) => setField("nascimento", e.target.value)} disabled={loading} />
          </div>

          <div style={{ marginTop: "8px", marginBottom: "4px", fontSize: "11px", fontWeight: "600", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Contato
          </div>
          <input data-tour="cliente-email" type="email" placeholder="E-mail" value={form.email} onChange={(e) => setField("email", e.target.value)} disabled={loading} />
          <div className="grid grid-2">
            <input placeholder="Telefone" inputMode="tel" value={form.telefone} onChange={(e) => setField("telefone", formatPhone(e.target.value))} disabled={loading} />
            <input data-tour="cliente-whatsapp" placeholder="WhatsApp" inputMode="tel" value={form.whatsapp} onChange={(e) => setField("whatsapp", formatPhone(e.target.value))} disabled={loading} />
          </div>

          <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "12px 14px", borderRadius: "10px", background: "rgba(37,211,102,0.06)", border: "1px solid rgba(37,211,102,0.25)", cursor: form.whatsapp ? "pointer" : "not-allowed", opacity: form.whatsapp ? 1 : 0.6, marginTop: "4px" }}>
            <input type="checkbox" checked={form.aceitaDivulgacao} onChange={(e) => setField("aceitaDivulgacao", e.target.checked)} disabled={loading || !form.whatsapp} style={{ marginTop: "2px" }} />
            <span style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <span style={{ fontSize: "14px", fontWeight: 600 }}>Recebe divulgações de imóveis pelo WhatsApp</span>
              <span style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.5 }}>
                {form.whatsapp
                  ? "O contato entra na lista que recebe novos imóveis por WhatsApp. Marque apenas com o consentimento dele."
                  : "Preencha o WhatsApp acima para habilitar esta opção."}
              </span>
            </span>
          </label>

          <div style={{ marginTop: "8px", marginBottom: "4px", fontSize: "11px", fontWeight: "600", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Endereço
          </div>
          <div className="grid grid-2">
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <input
                placeholder="CEP"
                inputMode="numeric"
                value={form.cep}
                onChange={(e) => setField("cep", formatCep(e.target.value))}
                onBlur={handleCepBlur}
                disabled={loading || cepLoading}
              />
              {cepLoading && <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Buscando endereço…</span>}
            </div>
            <input placeholder="Estado (UF)" value={form.estado} onChange={(e) => setField("estado", e.target.value.toUpperCase())} maxLength={2} disabled={loading} />
          </div>
          <input placeholder="Endereço (rua e número)" value={form.endereco} onChange={(e) => setField("endereco", e.target.value)} disabled={loading} />
          <div className="grid grid-2">
            <input placeholder="Bairro" value={form.bairro} onChange={(e) => setField("bairro", e.target.value)} disabled={loading} />
            <input placeholder="Cidade" value={form.cidade} onChange={(e) => setField("cidade", e.target.value)} disabled={loading} />
          </div>

          <div style={{ marginTop: "8px", marginBottom: "4px", fontSize: "11px", fontWeight: "600", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Observações
          </div>
          <textarea
            placeholder="Anotações internas sobre o cliente…"
            value={form.observacoes}
            onChange={(e) => setField("observacoes", e.target.value)}
            disabled={loading}
            rows={3}
            style={{ resize: "vertical" }}
          />

          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px", marginTop: "4px" }}>
            <input type="checkbox" checked={form.ativo} onChange={(e) => setField("ativo", e.target.checked)} disabled={loading} />
            Cliente ativo
          </label>

          <div className="actions" style={{ marginTop: "24px" }}>
            <button type="submit" disabled={loading} style={{ width: "auto", padding: "10px 20px" }}>
              {loading ? "Salvando…" : editando ? "Salvar Alterações" : "Criar Cliente"}
            </button>
            <button type="button" className="button-secondary" onClick={() => setView("list")} disabled={loading} style={{ width: "auto", padding: "10px 20px" }}>
              Cancelar
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <div className="main-content" style={{ maxWidth: "1100px", animation: "fadeIn 0.3s ease-in-out" }}>
      {confirmModal}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <header data-tour="clientes-cabecalho">
          <h1 style={{ fontSize: "28px", margin: "0 0 6px" }}>Clientes</h1>
          <p style={{ color: "var(--text-muted)", margin: 0 }}>Sua base de clientes e contatos.</p>
        </header>
        <span data-tour="clientes-novo">
          <BtnNovo onClick={abrirCriar} label="Novo Cliente" />
        </span>
      </div>

      {initialLoading ? <SkeletonStats count={4} /> : (
      <StatGrid>
        <StatCard label="Total" value={stats.total} accent="#6366f1" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /></svg>} />
        <StatCard label="Ativos" value={stats.ativos} accent="#10b981" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>} />
        <StatCard label="Inativos" value={stats.inativos} accent="#94a3b8" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>} />
        <StatCard label="Recebem divulgação" value={stats.divulgacao} accent="#25d366" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></svg>} />
        <StatCard label="Aniversários no mês" value={stats.aniversariantes} accent="#f59e0b" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" /><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1" /><path d="M2 21h20" /><path d="M7 8v3M12 8v3M17 8v3M7 4h.01M12 4h.01M17 4h.01" /></svg>} />
      </StatGrid>
      )}

      <div className="glass-panel" style={{ padding: "16px", marginBottom: "20px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
        <SearchInput value={search} onChange={handleSearchChange} placeholder="Buscar por nome, CPF, e-mail ou telefone…" />
        <FilterTabs value={statusFilter} onChange={setStatusFilter} options={[
          { key: "all", label: "Todos" },
          { key: "active", label: "Ativos" },
          { key: "inactive", label: "Inativos" },
        ]} />
        <button
          type="button"
          onClick={() => setSoDivulgacao((v) => !v)}
          title="Mostrar apenas contatos que recebem divulgação"
          style={{
            width: "auto", display: "inline-flex", alignItems: "center", gap: "7px", padding: "8px 14px",
            borderRadius: "9px", fontSize: "13px", fontWeight: 600, cursor: "pointer",
            background: soDivulgacao ? "rgba(37,211,102,0.16)" : "transparent",
            border: `1px solid ${soDivulgacao ? "rgba(37,211,102,0.5)" : "var(--glass-border)"}`,
            color: soDivulgacao ? "#4ade80" : "var(--text-muted)",
          }}
        >
          <IconMegafone /> Recebem divulgação
        </button>
      </div>

      {initialLoading ? (
        <SkeletonListRows count={5} />
      ) : visiveis.length === 0 ? (
        <EmptyState
          mensagem={filtrando ? "Nenhum cliente encontrado com estes filtros." : "Nenhum cliente cadastrado."}
          acaoLabel={filtrando ? undefined : "Cadastrar o primeiro cliente"}
          onAcao={filtrando ? undefined : abrirCriar}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {visiveis.map((c) => {
            const whats = (c.whatsapp || c.telefone || "").replace(/\D/g, "");
            const local = c.cidade && c.estado ? `${c.cidade}/${c.estado}` : (c.cidade || c.estado);
            return (
              <div key={c.id} className="glass-panel" style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px",
                padding: "14px 18px", opacity: c.ativo ? 1 : 0.6,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0, flex: 1 }}>
                  <Avatar name={c.nome} size={42} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: "600", fontSize: "15px" }}>{c.nome}</span>
                      {c.cpf ? <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>CPF {c.cpf}</span> : null}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
                      {whats ? <Chip color="#25d366" href={`https://wa.me/${whats}`}><IconWhats /> {c.whatsapp || c.telefone}</Chip> : null}
                      {c.email ? <Chip color="#0ea5e9" href={`mailto:${c.email}`}><IconMail /> {c.email}</Chip> : null}
                      {local ? <Chip color="#a78bfa"><IconPin /> {local}</Chip> : null}
                      {c.aceitaDivulgacao ? <Chip color="#25d366"><IconMegafone /> Recebe divulgações</Chip> : null}
                      {!whats && !c.email && !local ? <span style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>Sem informações de contato</span> : null}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {/* O que a pessoa procura fica ao lado do que ela é: mesma
                      ficha, mesma linha de ações. */}
                  <button
                    type="button"
                    className="pfb__abrir"
                    aria-expanded={perfisDe === c.id}
                    onClick={() => setPerfisDe((atual) => (atual === c.id ? null : c.id))}
                  >
                    <IconAlvo /> {perfisDe === c.id ? "Fechar busca" : "O que procura"}
                  </button>
                  <StatusPill active={c.ativo} />
                  <BtnEditar onClick={() => abrirEditar(c)} />
                  {/* Mesma regra da tela de Usuários: a lixeira só existe para
                      quem já está inativo. Desativar vira degrau obrigatório do
                      excluir, e as duas ações nunca ficam lado a lado para
                      levar um clique trocado. */}
                  {c.ativo ? (
                    <BtnDesativar onClick={() => toggleAtivo(c)} />
                  ) : (
                    <>
                      <BtnAtivar onClick={() => toggleAtivo(c)} />
                      <BtnExcluir onClick={() => excluir(c)} />
                    </>
                  )}
                </div>

                {perfisDe === c.id ? (
                  <div style={{ flexBasis: "100%" }}>
                    <PerfisDeBusca
                      cliente={c}
                      tenantSlug={tenantSlug}
                      tiposImovel={tiposImovel}
                      showToast={showToast}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
