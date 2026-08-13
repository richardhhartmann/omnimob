import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../api";
import { BtnAtivar, BtnDesativar, BtnEditar, BtnExcluir, BtnNovo } from "../components/ActionIcons";
import { Avatar, Chip, EmptyState, FilterTabs, SearchInput, StatCard, StatGrid, StatusPill } from "../components/adminUi";
import { useConfirm } from "../components/ConfirmModal";
import { SelectCustom } from "../components/SelectCustom";
import { SkeletonStats, SkeletonListRows } from "../components/Skeleton";

const FORM_EMPTY = { nome: "", login: "", email: "", cargoCodigo: "", ativo: true, forcaAlterarSenha: false };

/* ─── Sufixo de tenant no login ───────────────────────────────────────────────
   A tela de login é uma só para todos os clientes, então o login precisa ser
   único no sistema inteiro — não dentro da imobiliária. "richard" da Centro e
   "richard" da Casa Nobre colidiriam. Todo login novo sai como
   `richard-imobiliaria-centro`, e o campo mostra o sufixo colado ao lado para
   ninguém descobrir isso só na hora de entrar.

   Quem digita mexe na BASE; o sufixo é do sistema. Guardamos a base no estado e
   remontamos o login inteiro no envio — assim editar um usuário não empilha
   sufixo em cima de sufixo.

   Logins anteriores a esta regra (o `admin` do seed, por exemplo) não são
   renomeados: reescrever o login de alguém durante uma edição de cargo tiraria
   a pessoa do ar sem aviso. Eles aparecem inteiros, sem sufixo, e continuam
   valendo. ────────────────────────────────────────────────────────────────── */

function separarLogin(login, slug) {
  const sufixo = `-${slug}`;
  if (slug && login.endsWith(sufixo) && login.length > sufixo.length) {
    return { base: login.slice(0, -sufixo.length), temSufixo: true };
  }
  return { base: login, temSufixo: false };
}

function juntarLogin(base, slug, temSufixo) {
  const limpa = base.trim();
  if (!temSufixo || !slug) return limpa;
  // Alguém que digita o sufixo à mão não pode acabar com ele duas vezes.
  if (limpa.endsWith(`-${slug}`)) return limpa;
  return `${limpa}-${slug}`;
}

/* O login vira parte de um identificador único e é digitado na tela de acesso:
   espaço, acento e maiúscula só rendem erro de digitação na hora de entrar. */
function normalizarBaseLogin(valor) {
  return valor
    .toLowerCase()
    // NFD separa "é" em "e" + acento, e a faixa abaixo remove só o acento. Sem
    // esse passo o filtro seguinte comeria a letra junto: "josé" viraria "jos".
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9._-]/g, "");
}

export function UsuariosPage({ session }) {
  const tenantSlug = session?.tenant?.slug;
  /* Ninguém se desativa. Seria o único caminho para um tenant ficar sem
     administrador nenhum — o próprio se derruba, perde o acesso e não sobra
     quem reative. E, mesmo quando há outro admin, o efeito imediato é a pessoa
     se trancar para fora no meio do trabalho. A API recusa também: esconder o
     botão resolve o engano, não o pedido feito na mão. */
  const meuId = session?.usuario?.id;
  const { confirm, modal: confirmModal } = useConfirm();
  const showToast = useOutletContext()?.showToast;
  const [usuarios, setUsuarios] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [view, setView] = useState("list"); // "list" | "form"
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(FORM_EMPTY);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | inactive

  useEffect(() => {
    if (!tenantSlug) return;
    Promise.all([
      api.listUsuarios(tenantSlug),
      api.listCargos(tenantSlug),
    ]).then(([u, c]) => {
      setUsuarios(u);
      setCargos(c);
      // Roda uma vez por entrada na tela (a dependência é só o slug), então
      // não precisa da trava de "primeira carga" que Clientes e Imóveis usam.
      const n = Array.isArray(u) ? u.length : 0;
      showToast?.(
        n === 1 ? "1 usuário carregado." : `${n} usuários carregados.`,
      );
    }).catch(() => {}).finally(() => setInitialLoading(false));
  }, [tenantSlug]);

  const stats = useMemo(() => ({
    total: usuarios.length,
    ativos: usuarios.filter((u) => u.ativo).length,
    inativos: usuarios.filter((u) => !u.ativo).length,
    cargos: new Set(usuarios.map((u) => u.cargo?.descricao).filter(Boolean)).size,
  }), [usuarios]);

  const visiveis = useMemo(() => {
    const q = search.trim().toLowerCase();
    return usuarios.filter((u) => {
      const matchesSearch = !q || [u.nome, u.login, u.cargo?.descricao].filter(Boolean).some((v) => v.toLowerCase().includes(q));
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? u.ativo : !u.ativo);
      return matchesSearch && matchesStatus;
    });
  }, [usuarios, search, statusFilter]);

  // Lista vazia por FALTA DE CADASTRO ou por filtro? A resposta muda o texto e
  // decide se convidar a cadastrar faz sentido.
  const filtrando = Boolean(search) || statusFilter !== "all";

  function abrirCriar() {
    setEditando(null);
    // Usuário novo sempre nasce com o sufixo do tenant.
    setForm({ ...FORM_EMPTY, comSufixo: true });
    setError("");
    setView("form");
  }

  function abrirEditar(u) {
    const { base, temSufixo } = separarLogin(u.login, tenantSlug);
    setEditando(u);
    setForm({
      nome: u.nome,
      login: base,
      // `?? ""` porque o campo é controlado: `null` do banco viraria input
      // não-controlado e o React reclamaria na primeira digitação.
      email: u.email ?? "",
      comSufixo: temSufixo,
      cargoCodigo: String(u.cargoCodigo),
      ativo: u.ativo,
      forcaAlterarSenha: u.forcaAlterarSenha,
    });
    setError("");
    setView("form");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    // O combo é um botão, então o `required` do HTML não se aplica: validamos aqui.
    if (!form.cargoCodigo) {
      setError("Selecione o cargo do usuário.");
      return;
    }
    if (!form.login.trim()) {
      setError("Informe o login do usuário.");
      return;
    }
    // O que vai para a API é sempre o login completo; o campo mostra só a base.
    const loginFinal = juntarLogin(form.login, tenantSlug, form.comSufixo);
    setLoading(true);
    setError("");
    try {
      if (editando) {
        // Na edição, a senha não é alterável pelo painel — só nome/login/cargo/
        // status e a flag de forçar troca de senha.
        const payload = {
          nome: form.nome,
          login: loginFinal,
          // Vazio vira null: string vazia no banco faria a busca da recuperação
          // de senha casar dois usuários "sem e-mail" como se fossem o mesmo.
          email: form.email.trim() || null,
          cargoCodigo: Number(form.cargoCodigo),
          ativo: form.ativo,
          forcaAlterarSenha: form.forcaAlterarSenha,
        };
        const updated = await api.updateUsuario(tenantSlug, editando.id, payload);
        setUsuarios((prev) => prev.map((u) => u.id === updated.id ? updated : u));
        showToast?.(`${updated.nome} atualizado.`);
      } else {
        // Novo usuário: sem senha; ele define a própria no primeiro acesso.
        const created = await api.createUsuario(tenantSlug, {
          nome: form.nome,
          login: loginFinal,
          email: form.email.trim() || null,
          cargoCodigo: Number(form.cargoCodigo),
          ativo: form.ativo,
        });
        setUsuarios((prev) => [...prev, created]);
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

  async function toggleAtivo(u) {
    try {
      if (u.ativo) {
        await api.desativarUsuario(tenantSlug, u.id);
        setUsuarios((prev) => prev.map((x) => x.id === u.id ? { ...x, ativo: false } : x));
        showToast?.(`${u.nome} foi desativado.`);
      } else {
        const updated = await api.updateUsuario(tenantSlug, u.id, { ativo: true });
        setUsuarios((prev) => prev.map((x) => x.id === updated.id ? updated : x));
        showToast?.(`${updated.nome} foi reativado.`);
      }
    } catch (err) {
      showToast ? showToast(err.message, "error") : alert(err.message);
    }
  }

  /* Excluir apaga a linha e não tem desfazer. A confirmação diz o nome e o
     login que vão sumir, e lembra que parar aqui já resolve o acesso — quem
     chega neste botão acabou de desativar a pessoa, então "deixar inativo" é a
     saída que ele ainda tem. */
  async function excluir(u) {
    const ok = await confirm(
      `Excluir ${u.nome} definitivamente? O cadastro e o login "${u.login}" são apagados, sem como recuperar. ` +
      "Sem acesso a pessoa já está: deixá-la inativa preserva o histórico e permite reativar depois.",
      "Excluir definitivamente",
    );
    if (!ok) return;
    try {
      await api.excluirUsuario(tenantSlug, u.id);
      setUsuarios((prev) => prev.filter((x) => x.id !== u.id));
      showToast?.(`${u.nome} foi excluído.`);
    } catch (err) {
      // Recusa por histórico ou por ser o último gestor volta explicada pela
      // API; o toast repassa a frase dela em vez de inventar outra.
      showToast ? showToast(err.message, "error") : alert(err.message);
    }
  }

  if (view === "form") {
    return (
      <section className="main-content glass-panel" style={{ maxWidth: "1100px", animation: "fadeIn 0.3s ease-in-out" }}>
        <h2 style={{ marginBottom: "24px" }}>{editando ? "Editar Usuário" : "Novo Usuário"}</h2>
        {error ? <div className="error">{error}</div> : null}
        <form className="grid" onSubmit={handleSubmit}>
          <input
            data-tour="usuario-nome"
            placeholder="Nome completo"
            value={form.nome}
            onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
            required disabled={loading}
          />

          {/* Opcional, mas é o que permite a pessoa recuperar a própria senha.
              Sem e-mail, quem esquece a senha depende de alguém redefinir por
              ela — daí a legenda dizer isso em vez de só "opcional". */}
          <div>
            <input
              type="email"
              placeholder="E-mail (para recuperação de senha)"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              disabled={loading}
              autoComplete="off"
            />
            <p style={{ margin: "5px 2px 0", fontSize: "11.5px", color: "var(--text-muted)", lineHeight: 1.5 }}>
              {form.email.trim()
                ? "É para cá que vai o link de redefinir senha."
                : "Sem e-mail, esta pessoa não consegue recuperar a senha sozinha."}
            </p>
          </div>
          {/* Campo composto: a pessoa digita a base e vê o sufixo do tenant
              colado, para o login final não ser surpresa na tela de entrada. */}
          <div data-tour="usuario-login">
            <div style={{ display: "flex", alignItems: "stretch" }}>
              <input
                placeholder="Login"
                value={form.login}
                onChange={(e) => setForm((p) => ({ ...p, login: normalizarBaseLogin(e.target.value) }))}
                required disabled={loading}
                style={form.comSufixo ? {
                  borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: "none", minWidth: 0,
                } : undefined}
                aria-describedby={form.comSufixo ? "usu-login-sufixo" : undefined}
              />
              {form.comSufixo ? (
                <span
                  id="usu-login-sufixo"
                  style={{
                    display: "flex", alignItems: "center", flexShrink: 0,
                    padding: "14px 16px", borderRadius: "0 12px 12px 0",
                    border: "1px solid var(--glass-border)",
                    background: "rgba(255,255,255,0.04)",
                    color: "var(--text-muted)", fontSize: "14px", whiteSpace: "nowrap",
                  }}
                >
                  -{tenantSlug}
                </span>
              ) : null}
            </div>
            <p style={{ margin: "6px 2px 0", fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.5 }}>
              {form.comSufixo ? (
                <>
                  O login de entrada será{" "}
                  <strong style={{ color: "var(--text-main)" }}>
                    {(form.login.trim() || "seu.login")}-{tenantSlug}
                  </strong>
                  .
                </>
              ) : (
                <>
                  Login anterior ao padrão com sufixo. Mantivemos como está para não tirar esta
                  pessoa do ar — ele continua válido na tela de acesso.
                </>
              )}
            </p>
          </div>
          {/* Invólucro só para o tour ter onde ancorar o holofote: o combo em si
              é um botão, e destacar apenas ele deixaria o rótulo de fora. */}
          <div data-tour="usuario-cargo">
            <SelectCustom
              value={form.cargoCodigo}
              placeholder="Selecione o cargo"
              disabled={loading}
              options={cargos.map((c) => ({ value: String(c.id), label: c.descricao }))}
              onChange={(v) => setForm((p) => ({ ...p, cargoCodigo: v }))}
            />
          </div>

          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "center" }}>
            {/* Mesma regra da lista: desmarcar aqui seria desativar a si mesmo
                pela porta dos fundos. Editando o próprio cadastro, o campo
                simplesmente não existe. */}
            {editando?.id === meuId ? null : (
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px" }}>
                <input type="checkbox" className="sw" checked={form.ativo} onChange={(e) => setForm((p) => ({ ...p, ativo: e.target.checked }))} disabled={loading} />
                Usuário ativo
              </label>
            )}
            {/* Forçar troca só faz sentido na edição; novos usuários já definem
                a senha no primeiro acesso (força troca é sempre true). */}
            {editando && (
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px" }}>
                <input type="checkbox" className="sw" checked={form.forcaAlterarSenha} onChange={(e) => setForm((p) => ({ ...p, forcaAlterarSenha: e.target.checked }))} disabled={loading} />
                Forçar alteração de senha no próximo acesso
              </label>
            )}
          </div>

          {!editando && (
            <p data-tour="usuario-senha" style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5 }}>
              O usuário não recebe senha aqui. No primeiro acesso, ele informa o login e
              define a própria senha na tela seguinte.
            </p>
          )}

          <div className="actions" data-tour="usuario-salvar" style={{ marginTop: "24px" }}>
            <button type="submit" disabled={loading} style={{ width: "auto", padding: "10px 20px" }}>
              {editando ? "Salvar Alterações" : "Criar Usuário"}
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
        <header data-tour="usuarios-cabecalho">
          <h1 style={{ fontSize: "28px", margin: "0 0 6px" }}>Usuários</h1>
          <p style={{ color: "var(--text-muted)", margin: 0 }}>Quem tem acesso ao painel e com qual cargo.</p>
        </header>
        <span data-tour="usuarios-novo">
          <BtnNovo onClick={abrirCriar} label="Novo Usuário" />
        </span>
      </div>

      {initialLoading ? <SkeletonStats count={4} /> : (
      <StatGrid>
        <StatCard label="Total" value={stats.total} accent="#6366f1" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /></svg>} />
        <StatCard label="Ativos" value={stats.ativos} accent="#10b981" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>} />
        <StatCard label="Inativos" value={stats.inativos} accent="#94a3b8" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>} />
        <StatCard label="Cargos em uso" value={stats.cargos} accent="#a78bfa" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>} />
      </StatGrid>
      )}

      <div className="glass-panel" style={{ padding: "16px", marginBottom: "20px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, login ou cargo…" />
        <FilterTabs value={statusFilter} onChange={setStatusFilter} options={[
          { key: "all", label: "Todos" },
          { key: "active", label: "Ativos" },
          { key: "inactive", label: "Inativos" },
        ]} />
      </div>

      {initialLoading ? (
        <SkeletonListRows count={5} />
      ) : visiveis.length === 0 ? (
        <EmptyState
          mensagem={filtrando ? "Nenhum usuário encontrado com estes filtros." : "Nenhum usuário cadastrado."}
          acaoLabel={filtrando ? undefined : "Cadastrar o primeiro usuário"}
          onAcao={filtrando ? undefined : abrirCriar}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {visiveis.map((u) => (
            <div key={u.id} className="glass-panel" style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px",
              padding: "14px 18px", opacity: u.ativo ? 1 : 0.6,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0, flex: 1 }}>
                <Avatar name={u.nome} size={42} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: "600", fontSize: "15px" }}>{u.nome}</span>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>@{u.login}</span>
                    {/* Sem isto a linha do próprio usuário parece apenas ter
                        perdido um botão; a marca explica a falta. */}
                    {u.id === meuId ? <Chip color="#6366f1">você</Chip> : null}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
                    {u.cargo?.descricao ? <Chip color="#a78bfa">{u.cargo.descricao}</Chip> : null}
                    {u.forcaAlterarSenha ? <Chip color="#f59e0b" title="O usuário deverá trocar a senha no próximo acesso">Trocar senha</Chip> : null}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <StatusPill active={u.ativo} />
                <BtnEditar onClick={() => abrirEditar(u)} />
                {/* Nada de ação destrutiva na própria linha — nem a
                    reversível, nem a definitiva. */}
                {u.id === meuId ? null : u.ativo ? (
                  <BtnDesativar onClick={() => toggleAtivo(u)} />
                ) : (
                  <>
                    <BtnAtivar onClick={() => toggleAtivo(u)} />
                    {/* A lixeira só existe para quem já está inativo. Desativar
                        vira degrau obrigatório do excluir: a pessoa perde o
                        acesso primeiro, dá tempo de perceber que ainda precisa
                        dela, e só depois a linha pode ser apagada. Some também
                        o risco de a lixeira estar a um pixel da desativação e
                        levar um clique que era para a outra. */}
                    <BtnExcluir onClick={() => excluir(u)} />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
