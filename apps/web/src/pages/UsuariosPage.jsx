import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext, useNavigate, useParams, useLocation } from "react-router-dom";
import { api } from "../api";
import { BtnAtivar, BtnDesativar, BtnEditar, BtnExcluir, BtnNovo } from "../components/ActionIcons";
import { Avatar, Chip, EmptyState, FilterTabs, SearchInput, StatCard, StatGrid, StatusPill } from "../components/adminUi";
import { useConfirm } from "../components/ConfirmModal";
import { SelectCustom } from "../components/SelectCustom";
import { CargoEmLinha } from "../components/CargoEmLinha.jsx";
import { FLOW, modulosDoTenant } from "../utils/modulos";
import { SkeletonStats, SkeletonListRows } from "../components/Skeleton";
import { uploadToCloudinary } from "../utils/uploadToCloudinary";
import { ConviteDeCriacao } from "../components/ConviteDeCriacao.jsx";
import { UserPlus, PlusCircle, PencilSimple } from "@phosphor-icons/react";
import { degrausAte } from "../utils/trilhaDoPainel";
import { useSaidaDaTela } from "../components/useSaidaDaTela";
import { useTituloDaTela } from "../utils/contextoDeCabecalho.jsx";
import { mesmoId } from "../utils/mesmoId";

const FORM_EMPTY = {
  nome: "", login: "", email: "", cargoCodigo: "", ativo: true, forcaAlterarSenha: false,
  /* ── O que esta pessoa mostra na vitrine ──────────────────────────────────
     `exibirNaVitrine` começa FALSO. Aparecer com nome e foto numa página
     pública é decisão de quem aparece, não consequência de ter login — e o
     painel tem gente que não atende cliente nenhum (financeiro, o dono). */
  exibirNaVitrine: false, foto: "", creci: "", whatsapp: "", cargoVitrine: "",
};

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

/* O login como ele aparece na lista.

   O sufixo da imobiliária sai em tom mais fraco: junto, "richard-paper" lê como
   um texto hifenizado qualquer; separado, lê como "richard, da paper" — que é o
   que ele é. Quem precisa passar a credencial para alguém enxerga as duas
   partes de uma vez.

   Logins sem sufixo (os anteriores à regra, como o `admin` do seed) aparecem
   como estão. Colar um `-slug` decorativo neles mostraria uma credencial que
   NÃO funciona na tela de acesso — o oposto do que esta linha existe para
   fazer. */
function LoginDoUsuario({ login, slug }) {
  const { base, temSufixo } = separarLogin(login, slug);
  return (
    <span
      style={{ fontSize: "12px", color: "var(--text-muted)" }}
      title={`Login de acesso: ${login}`}
    >
      @{base}
      {temSufixo ? (
        <span style={{ opacity: 0.62 }}>-{slug}</span>
      ) : null}
    </span>
  );
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

/* Os campos que só a vitrine usa, juntos, para criação e edição mandarem
   exatamente a mesma coisa. A API normaliza de novo do lado dela (o WhatsApp
   vira só dígitos lá) — aqui é só o recorte. */
function camposDeVitrine(form) {
  return {
    /* `exibirNaVitrine` NÃO viaja mais daqui. Quem aparece na vitrine passou a
       ser escolhido dentro do widget de Equipe, no editor — ver
       `SeletorDeEquipe`. Mandar `false` a cada salvamento apagaria a marcação
       antiga, e ela ainda é a reserva das vitrines que nunca usaram o seletor
       (ver `equipeDaVitrine`). O que não se envia, o Prisma não toca. */
    foto: form.foto.trim(),
    creci: form.creci.trim(),
    whatsapp: form.whatsapp.trim(),
    cargoVitrine: form.cargoVitrine.trim(),
  };
}

export function UsuariosPage({ session }) {
  const navigate = useNavigate();
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
  /* ── A VISTA SAI DA ROTA ─────────────────────────────────────────────────
     Era `useState("list" | "form")`. Ver o bloco de rotas em `App.jsx` e a
     mesma migração em `ClientesPage`. */
  const { usuarioId } = useParams();
  const criando = useLocation().pathname.endsWith("/novo");
  const view = criando || usuarioId ? "form" : "list";
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(FORM_EMPTY);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | inactive
  const [enviandoFoto, setEnviandoFoto] = useState(false);

  /* A foto vai direto do navegador para o Cloudinary, como a do imóvel e a
     logo — o backend nunca vê o arquivo. O que fica no formulário é a URL. */
  async function enviarFoto(arquivo) {
    if (!arquivo) return;
    setEnviandoFoto(true);
    setError("");
    try {
      const { url } = await uploadToCloudinary(arquivo);
      setForm((p) => ({ ...p, foto: url }));
    } catch {
      setError("Não consegui enviar a foto. Tente de novo.");
    } finally {
      setEnviandoFoto(false);
    }
  }

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
  /* Vazio de verdade: nenhum usuário, e não é filtro escondendo. Troca a tela
     inteira pelo convite — ver `ConviteDeCriacao`. */
  const semNenhum = !initialLoading && usuarios.length === 0 && !filtrando;

  /* O nome da tela sobe para a faixa do painel. A rota já saberia o título
     sozinha (`trilhaDoPainel`), mas o SUBTÍTULO só esta tela conhece — e sem
     declará-lo aqui ele se perderia na mudança. Ver `contextoDeCabecalho`. */
  /* O título e a trilha acompanham a sub-tela — antes a faixa dizia "Usuários"
     com um cadastro aberto, e a página compensava com uma segunda trilha. */
  useTituloDaTela({
    titulo: view === "form" ? (editando ? "Editar Usuário" : "Novo Usuário") : "Usuários",
    subtitulo: view === "form"
      ? (editando?.nome || "Preencha os dados do novo usuário.")
      : "Quem tem acesso ao painel e com qual cargo.",
    trilha: view === "form" ? [
      ...degrausAte("/usuarios", navigate),
      {
        chave: "form",
        rotulo: editando ? "Editar Usuário" : "Novo Usuário",
        Icone: editando ? PencilSimple : PlusCircle,
        aoIr: () => {},
      },
    ] : undefined,
  });

  function abrirCriar() {
    navigate("/usuarios/novo");
  }

  /* Preenche o formulário a partir de um usuário já em mãos. Separado de
     `abrirEditar` porque o efeito abaixo precisa da mesma coisa quando ninguém
     clicou em nada — F5 ou link colado. */
  function preencherCom(u) {
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
      // `?? ""` pelo mesmo motivo do e-mail: os quatro são anuláveis no banco
      // e os campos são controlados.
      exibirNaVitrine: u.exibirNaVitrine ?? false,
      foto: u.foto ?? "",
      creci: u.creci ?? "",
      whatsapp: u.whatsapp ?? "",
      cargoVitrine: u.cargoVitrine ?? "",
    });
    setError("");
  }

  function abrirEditar(u) {
    preencherCom(u);
    preenchidoPara.current = u.id;
    navigate(`/usuarios/${u.id}`);
  }

  /* ── O FORMULÁRIO SE PREENCHE A PARTIR DA URL ────────────────────────────
     `/usuarios/:id` pode ser aberta sem passar pela lista: F5, favorito, link
     colado. Aqui não há `GET /api/usuarios/:id` no servidor — e não precisa:
     `listUsuarios` traz todos, sem filtro nem paginação, então basta esperar a
     lista chegar. Só depois de ela ter chegado (`initialLoading` falso) é que
     um id não encontrado significa id inválido.

     `preenchidoPara` impede o efeito de reescrever o que a pessoa está
     digitando quando a lista recarregar. */
  const preenchidoPara = useRef(null);
  useEffect(() => {
    if (criando) {
      if (preenchidoPara.current === "novo") return;
      preenchidoPara.current = "novo";
      setEditando(null);
      // Usuário novo sempre nasce com o sufixo do tenant.
      setForm({ ...FORM_EMPTY, comSufixo: true });
      setError("");
      return;
    }
    if (!usuarioId) { preenchidoPara.current = null; return; }
    if (preenchidoPara.current === usuarioId) return;

    const achado = usuarios.find((u) => mesmoId(u.id, usuarioId));
    if (achado) { preenchidoPara.current = usuarioId; preencherCom(achado); return; }
    if (initialLoading) return;   // a lista ainda não chegou

    showToast?.("Não encontrei este usuário.", "error");
    navigate("/usuarios", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioId, criando, usuarios, initialLoading]);

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
          ...camposDeVitrine(form),
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
          ...camposDeVitrine(form),
        });
        setUsuarios((prev) => [...prev, created]);
        showToast?.(`${created.nome} cadastrado.`);
      }
      navigate("/usuarios");
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

  /* Esc fecha o cadastro e volta à lista — o mesmo que o "Cancelar". A vista
     trocou por estado e não por rota, então o atalho global não tinha o que
     fazer aqui. */
  /* Esc fecha o cadastro e volta à lista. Continua necessário mesmo com rota
     própria: o Esc global recusa agir com o foco num campo de texto, e num
     formulário ele quase sempre está. Ver `useSaidaDaTela`. */
  useSaidaDaTela(() => navigate("/usuarios"), view === "form");

  if (view === "form") {
    return (
      <section className="glass-panel" style={{ animation: "fadeIn 0.3s ease-in-out" }}>
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
                    background: "var(--sup-04, rgba(255,255,255,0.04))",
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
            {/* O + ao lado abre a criação de cargo aqui mesmo. Descobrir no
                meio do cadastro que o cargo certo não existe custava sair da
                tela, criar em Cargos e refazer este formulário do zero. */}
            <CargoEmLinha
              valor={form.cargoCodigo}
              cargos={cargos}
              plano={session?.tenant?.plano}
              temFlow={modulosDoTenant(session?.tenant).includes(FLOW)}
              tenantSlug={tenantSlug}
              disabled={loading}
              aoTrocar={(v) => setForm((p) => ({ ...p, cargoCodigo: v }))}
              aoCriar={(c) => setCargos((atuais) => [...atuais, c])}
              aoAvisar={(msg) => showToast?.(msg)}
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

          {/* ── Dados para a vitrine ───────────────────────────────────────
              O widget "Equipe" da vitrine lê exatamente estes campos. Ele
              nasceu com três corretores INVENTADOS no código ("Ana Souza",
              "João Lima", "Marina Alves") porque não havia de onde tirar os
              reais — o cadastro guardava quem ENTRA no painel, não quem ATENDE
              o cliente.

              ── O INTERRUPTOR "APARECER NO SITE" SAIU DAQUI ──

              Ele decidia quem entrava na seção de equipe, e decidia no lugar
              errado: para montar a vitrine era preciso vir a esta tela, abrir
              pessoa por pessoa e marcar uma caixa, sem nunca ver o resultado.
              Quem aparece agora se escolhe DENTRO do widget, olhando para a
              peça.

              Os CAMPOS ficaram — eles são o que a vitrine mostra quando a
              pessoa for escolhida —, e agora sempre visíveis: sem o
              interruptor, escondê-los atrás de outra coisa só criaria uma
              segunda porta para o mesmo dado. */}
          <div className="usuario-vitrine">
            <div className="usuario-vitrine__aviso">
              <strong>Dados para a vitrine</strong>
              <small>
                Preencher aqui não publica ninguém. Quem aparece no site é escolhido no widget
                de Equipe, dentro do editor de vitrine.
              </small>
            </div>

            <div className="usuario-vitrine__campos">
                <div className="usuario-vitrine__foto">
                  <div className="usuario-vitrine__avatar">
                    {form.foto
                      ? <img src={form.foto} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      : <span>{(form.nome || "?").charAt(0).toUpperCase()}</span>}
                  </div>
                  <div className="usuario-vitrine__foto-acoes">
                    <label className="button-secondary" style={{ width: "auto", cursor: enviandoFoto ? "default" : "pointer", opacity: enviandoFoto ? 0.6 : 1 }}>
                      {enviandoFoto ? "Enviando…" : form.foto ? "Trocar foto" : "Enviar foto"}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={enviandoFoto || loading}
                        onChange={(e) => { enviarFoto(e.target.files?.[0]); e.target.value = ""; }}
                        style={{ display: "none" }}
                      />
                    </label>
                    {form.foto ? (
                      <button type="button" className="button-secondary" style={{ width: "auto" }} onClick={() => setForm((p) => ({ ...p, foto: "" }))} disabled={loading}>
                        Remover
                      </button>
                    ) : null}
                    <small>Sem foto, a vitrine mostra as iniciais.</small>
                  </div>
                </div>

                <div className="usuario-vitrine__grade">
                  <label>
                    <span>Cargo na vitrine</span>
                    <input
                      value={form.cargoVitrine}
                      onChange={(e) => setForm((p) => ({ ...p, cargoVitrine: e.target.value }))}
                      placeholder="Ex: Corretora de imóveis"
                      disabled={loading}
                    />
                    {/* O cargo do PAINEL é uma peça de permissão. Apresentar
                        alguém ao cliente como "Administrador" não diz nada
                        sobre o que essa pessoa faz por ele. */}
                    <small>Vazio usa o cargo do sistema, que costuma ser técnico demais para o cliente.</small>
                  </label>
                  <label>
                    <span>CRECI</span>
                    <input
                      value={form.creci}
                      onChange={(e) => setForm((p) => ({ ...p, creci: e.target.value }))}
                      placeholder="Ex: CRECI-SP 123456"
                      disabled={loading}
                    />
                    <small>O da pessoa, não o da imobiliária — é esse que o cliente confere.</small>
                  </label>
                  <label>
                    <span>WhatsApp</span>
                    <input
                      value={form.whatsapp}
                      onChange={(e) => setForm((p) => ({ ...p, whatsapp: e.target.value }))}
                      placeholder="Ex: 11999998888"
                      inputMode="tel"
                      disabled={loading}
                    />
                    <small>Sem número, o botão cai no WhatsApp geral da imobiliária.</small>
                  </label>
                </div>
            </div>
          </div>

          <div className="actions" data-tour="usuario-salvar" style={{ marginTop: "24px" }}>
            <button type="submit" disabled={loading} style={{ width: "auto", padding: "10px 20px" }}>
              {editando ? "Salvar Alterações" : "Criar Usuário"}
            </button>
            <button type="button" className="button-secondary" onClick={() => navigate("/usuarios")} disabled={loading} style={{ width: "auto", padding: "10px 20px" }}>
              Cancelar
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <div style={{ animation: "fadeIn 0.3s ease-in-out" }}>
      {confirmModal}
      {/* A trilha vale na lista também, e não só nas sub-telas: ela começa no
          Dashboard, então até a tela de primeiro nível tem de onde ter descido. */}
      {/* A trilha subiu para a faixa do painel, que a desenha a partir da rota —
          uma só, no mesmo lugar em toda tela. Ver `CabecalhoDoPainel`. */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        {/* O título subiu para a faixa do painel; a âncora do tour fica, porque
            um passo do primeiro acesso aponta para ela. */}
        <header data-tour="usuarios-cabecalho" />
        {/* Vazio: o convite já traz o botão, a tecla e a âncora do tour. */}
        {semNenhum ? null : (
          <span data-tour="usuarios-novo">
            <BtnNovo onClick={abrirCriar} label="Novo Usuário" />
          </span>
        )}
      </div>

      {semNenhum ? (
        <ConviteDeCriacao
          plena
          accent="#f59e0b"
          icone={<UserPlus size={34} weight="duotone" />}
          titulo="Pronto para cadastrar seu primeiro usuário?"
          texto="Cada pessoa da equipe entra com o próprio acesso, e o cargo dela decide o que alcança no painel."
          acaoLabel="Cadastrar usuário"
          onAcao={abrirCriar}
          tourId="usuarios-novo"
        />
      ) : (
      <>
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
        /* Só o filtro que não achou: a coleção vazia já saiu por cima. */
        <EmptyState mensagem="Nenhum usuário encontrado com estes filtros." />
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
                    <LoginDoUsuario login={u.login} slug={tenantSlug} />
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
      </>
      )}
    </div>
  );
}
