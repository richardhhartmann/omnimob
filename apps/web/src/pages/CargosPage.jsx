import { useOutletContext } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { BtnEditar, BtnExcluir, BtnNovo } from "../components/ActionIcons";
import { Avatar, EmptyState, SearchInput, StatCard, StatGrid } from "../components/adminUi";
import { SkeletonStats, SkeletonListRows } from "../components/Skeleton";
import { useConfirm } from "../components/ConfirmModal";
import { ModalCiencia } from "../components/ModalCiencia";
import { planoLiberaRedes } from "../utils/planos";
import { IconeRelatorios } from "../utils/iconesRelatorios";
import {
  House, PencilSimple, Buildings, UserSquare, UserCircle, Shield, ShareNetwork,
} from "@phosphor-icons/react";

/* Cada permissão carrega o ÍCONE do lugar que ela abre — o mesmo da barra
   lateral e do painel inicial. Marcar "Ver Relatórios" e reconhecer ali o
   gráfico que aparece no menu é o que liga a caixa de seleção à consequência
   dela; só o texto obriga a pessoa a traduzir sozinha.

   `verConfiguracoes` não está na lista, e é de propósito — ver o comentário
   logo abaixo. */
const PERMISSOES = [
  { key: "acessarPainel",     label: "Acessar Painel",     Icon: House },
  { key: "editarPagina",      label: "Editar Vitrine",     Icon: PencilSimple },
  { key: "gerenciarImoveis",  label: "Gerenciar Imóveis",  Icon: Buildings },
  { key: "gerenciarUsuarios", label: "Gerenciar Usuários", Icon: UserSquare },
  { key: "gerenciarClientes", label: "Gerenciar Clientes", Icon: UserCircle },
  { key: "gerenciarCargos",   label: "Gerenciar Cargos",   Icon: Shield },
  /* "Ver Relatórios" absorveu o antigo "Gerenciar Leads": ela abre a página
     Relatórios inteira — leads, relatório mensal, funil e comissões. */
  { key: "verRelatorios",     label: "Ver Relatórios",     Icon: IconeRelatorios },
  { key: "publicarRedes",     label: "Publicar em Redes",  Icon: ShareNetwork },
];

/* `verConfiguracoes` NÃO está na lista acima, e é de propósito: ela não é uma
   escolha, é uma consequência de ser o Administrador. O servidor a recalcula a
   cada gravação a partir do nome do cargo (ver `cargoRoutes`), então não há o
   que marcar, desmarcar ou exibir aqui — nem para o Administrador. */

// Permissões que o usuário NÃO pode remover do próprio cargo (senão se tranca
// para fora do painel / da gestão de cargos).
const LOCKED_NO_PROPRIO_CARGO = ["acessarPainel", "gerenciarCargos"];

/* Conceder isto é entregar a chave de todas as outras portas: quem gerencia
   cargos pode editar o próprio cargo e se dar qualquer permissão que falte —
   inclusive as que o Administrador não deu. Daí o modal de ciência. */
const PERMISSAO_DE_RISCO = "gerenciarCargos";

/* ─── Permissões que o plano precisa liberar antes ───────────────────────────
   Marcar uma permissão de recurso que o plano não tem produz a pior forma de
   erro: a que não avisa. A pessoa marca "Publicar em Redes", a tela confirma
   com um selo azul, e só na hora de publicar é que nada acontece — sem nenhuma
   pista de que o problema é o plano, e não a permissão.

   Por isso a permissão some da tela inteira (formulário E selos) enquanto o
   plano não a libera. Não é ocultar um recurso para vender: é não oferecer um
   botão que não liga em nada.

   O valor guardado no banco NÃO é apagado — quem já tinha a permissão marcada e
   caiu de plano volta a vê-la marcada ao subir de novo. Fica invisível, não
   perdida.

   Contas em teste rodam como PREMIUM, então veem tudo — que é o certo: o teste
   existe para experimentar o produto inteiro. */
const DEPENDE_DO_PLANO = {
  publicarRedes: planoLiberaRedes,
};

/** As permissões que fazem sentido oferecer neste plano. */
function permissoesDoPlano(plano) {
  return PERMISSOES.filter((p) => {
    const exige = DEPENDE_DO_PLANO[p.key];
    return exige ? exige(plano) : true;
  });
}

function emptyForm() {
  const f = { descricao: "" };
  for (const p of PERMISSOES) f[p.key] = false;
  return f;
}

export function CargosPage({ session, onSessionUpdate }) {
  /* Aviso de sucesso no mesmo canal do resto do painel (o toast do
     AdminLayout, via contexto do Outlet). Antes esta tela só falava quando dava
     ERRADO — e um `alert()` do navegador no caso de exclusão. Salvar em
     silêncio deixa a dúvida de sempre: gravou? */
  const showToast = useOutletContext()?.showToast;
  const tenantSlug = session?.tenant?.slug;
  /* Uma lista só para a tela inteira: formulário, selos e a contagem de
     "sem permissões" precisam concordar sobre o que existe neste plano. */
  const permissoesVisiveis = useMemo(
    () => permissoesDoPlano(session?.tenant?.plano),
    [session?.tenant?.plano],
  );
  const { confirm, modal: confirmModal } = useConfirm();
  const [cargos, setCargos] = useState([]);
  const [view, setView] = useState("list");
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  /* Concessão de `gerenciarCargos` esperando a ciência do administrador.
     Guarda a mudança inteira (não só a chave) para poder aplicá-la tal e qual
     quando ele confirmar — reconstruir a partir do form depois abriria espaço
     para aplicar uma coisa diferente da que foi mostrada no modal. */
  const [concessaoPendente, setConcessaoPendente] = useState(null);

  useEffect(() => {
    if (!tenantSlug) return;
    api.listCargos(tenantSlug)
      .then((lista) => {
        setCargos(lista);
        const n = Array.isArray(lista) ? lista.length : 0;
        showToast?.(n === 1 ? "1 cargo carregado." : `${n} cargos carregados.`);
      })
      .catch(() => {})
      .finally(() => setInitialLoading(false));
  }, [tenantSlug]);

  const stats = useMemo(() => ({
    total: cargos.length,
    usuarios: cargos.reduce((sum, c) => sum + (c._count?.usuarios || 0), 0),
    // Conta pelo que a tela mostra: um cargo cuja única permissão é invisível
    // neste plano aparece sem nenhum selo, e dizer que ele tem uma contradiria
    // o que está à vista.
    semPermissao: cargos.filter((c) => permissoesVisiveis.every((p) => !c[p.key])).length,
  }), [cargos, permissoesVisiveis]);

  const visiveis = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cargos;
    return cargos.filter((c) => c.descricao?.toLowerCase().includes(q));
  }, [cargos, search]);

  function abrirCriar() {
    setEditando(null);
    setForm(emptyForm());
    setError("");
    setView("form");
  }

  function abrirEditar(c) {
    setEditando(c);
    const f = { descricao: c.descricao };
    /* `PERMISSOES` (a lista COMPLETA), não `permissoesVisiveis`.

       O auto-save manda o form inteiro a cada clique. Carregando só o que está
       à vista, uma permissão escondida pelo plano viria ausente do form e o
       servidor a gravaria como false — apagando, ao mexer em qualquer outra
       caixa, algo que a pessoa nem sabia que estava lá. Assim ela viaja intacta
       e volta a aparecer marcada quando o plano subir. */
    for (const p of PERMISSOES) f[p.key] = Boolean(c[p.key]);
    setForm(f);
    setError("");
    setView("form");
  }

  function atualizarSessaoSeProprioCargoFoi(updatedCargo) {
    if (updatedCargo.id === session?.usuario?.cargo?.id && onSessionUpdate) {
      onSessionUpdate({
        ...session,
        usuario: { ...session.usuario, cargo: updatedCargo },
      });
    }
  }

  // Grava a permissão de fato. Separado do handler porque o modal de ciência
  // precisa chamar exatamente isto depois do "estou ciente".
  async function aplicarPermissao(key, value) {
    const newForm = { ...form, [key]: value };
    setForm(newForm);
    setSaving(true);
    try {
      const updated = await api.updateCargo(tenantSlug, editando.id, newForm);
      setCargos((prev) => prev.map((c) => c.id === updated.id ? updated : c));
      atualizarSessaoSeProprioCargoFoi(updated);
    } catch (err) {
      setForm(form); // reverte
      /* Era `alert()`. Aqui o toast importa mais que nos outros: a caixa de
         seleção VOLTA sozinha ao estado anterior, e sem aviso a pessoa vê o
         próprio clique se desfazer sem explicação. */
      showToast?.(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  // Auto-save ao tickar um checkbox (só quando editando)
  async function handlePermissaoChange(key, value) {
    const ehProprioCargoDoUsuario = editando?.id === session?.usuario?.cargo?.id;
    if (LOCKED_NO_PROPRIO_CARGO.includes(key) && ehProprioCargoDoUsuario) return; // bloqueado

    /* Conceder "Gerenciar Cargos" a OUTRO cargo para no modal de ciência.
       Tirar não para: desfazer uma concessão de risco tem de ser tão fácil
       quanto possível. E o próprio cargo também não — quem está editando já
       tem a permissão, então não há nada sendo concedido ali. */
    if (key === PERMISSAO_DE_RISCO && value === true && !ehProprioCargoDoUsuario) {
      setConcessaoPendente({ key, value, modo: "salvar" });
      return;
    }
    await aplicarPermissao(key, value);
  }

  /* Confirmação do modal. Os dois modos existem porque a tela grava de duas
     formas: editando um cargo é auto-save a cada clique; criando, o valor só
     entra no form e vai junto no "Criar Cargo". */
  async function confirmarConcessao() {
    const pendente = concessaoPendente;
    setConcessaoPendente(null);
    if (!pendente) return;
    if (pendente.modo === "form") {
      setForm((p) => ({ ...p, [pendente.key]: true }));
      return;
    }
    await aplicarPermissao(pendente.key, pendente.value);
  }

  // Salva somente a descrição (ou cria novo cargo com tudo)
  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (editando) {
        const updated = await api.updateCargo(tenantSlug, editando.id, { descricao: form.descricao });
        setCargos((prev) => prev.map((c) => c.id === updated.id ? { ...c, descricao: updated.descricao } : c));
        atualizarSessaoSeProprioCargoFoi({ ...session?.usuario?.cargo, descricao: updated.descricao });
        showToast?.(`Cargo "${updated.descricao}" atualizado.`);
        setView("list");
      } else {
        const created = await api.createCargo(tenantSlug, form);
        setCargos((prev) => [...prev, created]);
        showToast?.(`Cargo "${created.descricao}" criado.`);
        setView("list");
      }
    } catch (err) {
      setError(err.message);
      showToast?.(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(c) {
    if (!await confirm(`Excluir o cargo "${c.descricao}"?`, "Excluir")) return;
    try {
      await api.deleteCargo(tenantSlug, c.id);
      setCargos((prev) => prev.filter((x) => x.id !== c.id));
      showToast?.(`Cargo "${c.descricao}" excluído.`);
    } catch (err) {
      // Era `alert()` — caixa do navegador no meio de um painel que tem toast.
      showToast?.(err.message, "error");
    }
  }

  if (view === "form") {
    const ehProprioCargoDoUsuario = editando?.id === session?.usuario?.cargo?.id;
    const nomeDoCargo = (editando?.descricao || form.descricao || "este cargo").trim();

    return (
      <section className="main-content glass-panel" style={{ maxWidth: "1100px", animation: "fadeIn 0.3s ease-in-out" }}>
        <ModalCiencia
          aberto={Boolean(concessaoPendente)}
          titulo="Conceder Gerenciar Cargos?"
          descricao={`Você está prestes a dar a "${nomeDoCargo}" o poder de editar cargos e permissões desta imobiliária.`}
          riscos={[
            "Quem tem esta permissão pode editar o PRÓPRIO cargo e se conceder qualquer outra permissão — inclusive as que você não deu.",
            "Pode alterar as permissões de todos os outros cargos, e remover acessos de quem trabalha aqui.",
            "Pode conceder este mesmo poder a mais cargos, sem passar por você.",
            "Na prática, é um segundo administrador: você deixa de ser o único a decidir quem pode o quê.",
          ]}
          textoCiencia="Estou ciente de que este cargo poderá alterar permissões — inclusive as dele mesmo — e quero conceder assim mesmo."
          confirmarLabel="Conceder mesmo assim"
          aoConfirmar={confirmarConcessao}
          aoCancelar={() => setConcessaoPendente(null)}
        />
        <h2 style={{ marginBottom: "24px" }}>{editando ? "Editar Cargo" : "Novo Cargo"}</h2>
        {error ? <div className="error">{error}</div> : null}
        <form className="grid" onSubmit={handleSubmit}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              data-tour="cargo-nome"
              placeholder="Nome do cargo (ex: Corretor, Gerente)"
              value={form.descricao}
              onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
              required disabled={loading}
              style={{ flex: 1 }}
            />
            <button type="submit" data-tour="cargo-salvar" disabled={loading} style={{ width: "auto", padding: "10px 20px", flexShrink: 0 }}>
              {editando ? "Salvar nome" : "Criar Cargo"}
            </button>
            <button type="button" className="button-secondary" onClick={() => setView("list")} disabled={loading} style={{ width: "auto", padding: "10px 16px", flexShrink: 0 }}>
              Cancelar
            </button>
          </div>

          <div style={{ marginTop: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <span style={{ fontSize: "14px", fontWeight: "600" }}>Permissões</span>
              {editando && (
                <span style={{ fontSize: "12px", opacity: 0.45 }}>
                  {saving ? "Salvando…" : "Salvo automaticamente"}
                </span>
              )}
            </div>
            <div data-tour="cargo-permissoes" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "8px" }}>
              {permissoesVisiveis.map(({ key, label, Icon }) => {
                const locked = LOCKED_NO_PROPRIO_CARGO.includes(key) && ehProprioCargoDoUsuario;
                const checked = locked ? true : Boolean(form[key]);
                const isAutoSaving = editando !== null;
                /* Criando um cargo, conceder a permissão de risco também passa
                   pelo modal — senão bastava criar já com ela marcada para
                   contornar o aviso inteiro. */
                const aoMarcar = (marcado) => {
                  if (isAutoSaving) return handlePermissaoChange(key, marcado);
                  if (key === PERMISSAO_DE_RISCO && marcado) {
                    return setConcessaoPendente({ key, value: true, modo: "form" });
                  }
                  return setForm((p) => ({ ...p, [key]: marcado }));
                };

                return (
                  <label
                    key={key}
                    title={locked ? "Você não pode remover esta permissão do seu próprio cargo" : undefined}
                    style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      padding: "10px 14px", borderRadius: "10px",
                      cursor: locked || saving ? "not-allowed" : "pointer",
                      border: checked ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.1)",
                      background: checked ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.03)",
                      transition: "all 0.15s ease", fontSize: "13px", userSelect: "none",
                      opacity: locked ? 0.55 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => aoMarcar(e.target.checked)}
                      disabled={loading || locked || saving}
                      style={{ accentColor: "#6366f1", width: "14px", height: "14px", flexShrink: 0 }}
                    />
                    {Icon ? (
                      <Icon
                        size={16}
                        weight={checked ? "fill" : "regular"}
                        style={{ flexShrink: 0, color: checked ? "#a5b4fc" : "var(--text-muted)" }}
                      />
                    ) : null}
                    {label}
                  </label>
                );
              })}
            </div>
          </div>
        </form>
      </section>
    );
  }

  return (
    <div className="main-content" style={{ maxWidth: "1100px", animation: "fadeIn 0.3s ease-in-out" }}>
      {confirmModal}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <header data-tour="cargos-cabecalho">
          <h1 style={{ fontSize: "28px", margin: "0 0 6px" }}>Cargos e Permissões</h1>
          <p style={{ color: "var(--text-muted)", margin: 0 }}>Defina o que cada cargo pode fazer no painel.</p>
        </header>
        <span data-tour="cargos-novo">
          <BtnNovo onClick={abrirCriar} label="Novo Cargo" />
        </span>
      </div>

      {initialLoading ? <SkeletonStats count={3} /> : (
      <StatGrid>
        <StatCard label="Cargos" value={stats.total} accent="#6366f1" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>} />
        <StatCard label="Usuários vinculados" value={stats.usuarios} accent="#10b981" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /></svg>} />
        <StatCard label="Sem permissões" value={stats.semPermissao} accent="#f59e0b" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>} />
      </StatGrid>
      )}

      <div className="glass-panel" style={{ padding: "16px", marginBottom: "20px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cargo…" />
      </div>

      {initialLoading ? (
        <SkeletonListRows count={4} />
      ) : visiveis.length === 0 ? (
        <EmptyState
          mensagem={search ? "Nenhum cargo encontrado." : "Nenhum cargo cadastrado."}
          acaoLabel={search ? undefined : "Cadastrar o primeiro cargo"}
          onAcao={search ? undefined : abrirCriar}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {visiveis.map((c) => (
            <div key={c.id} className="glass-panel" style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <Avatar name={c.descricao} size={38} />
                  <div>
                    <div style={{ fontWeight: "600", fontSize: "15px" }}>{c.descricao}</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                      {c._count?.usuarios > 0 ? `${c._count.usuarios} usuário${c._count.usuarios !== 1 ? "s" : ""}` : "Nenhum usuário"}
                      {" · "}
                      {permissoesVisiveis.filter((p) => c[p.key]).length} permiss{permissoesVisiveis.filter((p) => c[p.key]).length !== 1 ? "ões" : "ão"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <BtnEditar onClick={() => abrirEditar(c)} />
                  <BtnExcluir onClick={() => handleDelete(c)} />
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {permissoesVisiveis.filter((p) => c[p.key]).map((p) => (
                  <span key={p.key} style={{
                    fontSize: "11px", fontWeight: "600", padding: "2px 9px", borderRadius: "20px",
                    background: "rgba(99,102,241,0.15)", color: "#a5b4fc",
                  }}>
                    {p.label}
                  </span>
                ))}
                {permissoesVisiveis.every((p) => !c[p.key]) && (
                  <span style={{ fontSize: "12px", opacity: 0.4 }}>Sem permissões</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
