import { useOutletContext, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { BtnEditar, BtnExcluir, BtnNovo } from "../components/ActionIcons";
import { Avatar, EmptyState, SearchInput, StatCard, StatGrid } from "../components/adminUi";
import { SkeletonStats, SkeletonListRows } from "../components/Skeleton";
import { useConfirm } from "../components/ConfirmModal";
import { ModalCiencia } from "../components/ModalCiencia";
import {
  TODAS_AS_PERMISSOES, PERMISSOES_DE_RISCO, TRAVADAS_NO_ADMINISTRADOR, gruposDePermissao, cargoVazio,
} from "../utils/permissoesCargo.jsx";
import { GradeDePermissoes } from "../components/GradeDePermissoes.jsx";
import { FLOW, modulosDoTenant } from "../utils/modulos";
import { ConviteDeCriacao } from "../components/ConviteDeCriacao.jsx";
import { ShieldPlus, PlusCircle, PencilSimple } from "@phosphor-icons/react";
import { Trilha } from "../components/Trilha.jsx";
import { degrausAte } from "../utils/trilhaDoPainel";
import { useSaidaDaTela } from "../components/useSaidaDaTela";
import { useTituloDaTela } from "../utils/contextoDeCabecalho.jsx";

/* Cada permissão carrega o ÍCONE do lugar que ela abre — o mesmo da barra
   lateral e do painel inicial. Marcar "Ver Relatórios" e reconhecer ali o
   gráfico que aparece no menu é o que liga a caixa de seleção à consequência
   dela; só o texto obriga a pessoa a traduzir sozinha.

   `verConfiguracoes` não está na lista, e é de propósito — ver o comentário
   logo abaixo. */
// A lista de permissões mora em utils/permissoesCargo — o cadastro de usuário
// também a usa, para criar cargo em linha. Ver o cabeçalho de lá.

/* Estas duas NÃO foram para `utils/permissoesCargo`, e é de propósito: as duas
   falam de EDITAR um cargo que já existe, e o cadastro de usuário só cria. */

/* Permissões que o usuário NÃO pode remover do PRÓPRIO cargo — senão se tranca
   para fora da gestão de cargos e não consegue mais se desfazer disso.

   `acessarPainel` saiu daqui porque saiu da tela: ela deixou de ser uma caixa
   marcável e passou a ser sempre verdadeira (ver `utils/permissoesCargo.jsx`).
   Travar o que não existe mais só confundiria quem lesse esta lista. */
const LOCKED_NO_PROPRIO_CARGO = ["gerenciarCargos"];


export function CargosPage({ session, onSessionUpdate }) {
  const navigate = useNavigate();
  /* Aviso de sucesso no mesmo canal do resto do painel (o toast do
     AdminLayout, via contexto do Outlet). Antes esta tela só falava quando dava
     ERRADO — e um `alert()` do navegador no caso de exclusão. Salvar em
     silêncio deixa a dúvida de sempre: gravou? */
  const showToast = useOutletContext()?.showToast;
  const tenantSlug = session?.tenant?.slug;
  const temFlow = modulosDoTenant(session?.tenant).includes(FLOW);

  /* ── A LISTA PRECISA INCLUIR O FLOW ────────────────────────────────────────

     Uma lista só para a tela inteira: os selos, a contagem de permissões e o
     aviso de "sem permissões" precisam concordar sobre o que existe nesta
     conta.

     Ela vinha de `permissoesDoPlano()`, que filtra apenas o array do HUB — as
     sete do Flow moram num array separado, e ficavam de fora das três coisas
     ao mesmo tempo. O sintoma era o pior possível porque parecia outro
     defeito: marcar "Validar (Financeiro)" gravava no banco e o selo nunca
     aparecia, então a leitura natural era "a permissão não está sendo salva".
     E um cargo SÓ de Flow — o Jurídico e o Financeiro do catálogo nascem
     assim — era exibido como "Sem permissões", que é o contrário do que ele é.

     `gruposDePermissao` já resolve o plano e a presença do módulo; achatar os
     grupos dá a lista completa sem uma segunda regra para divergir. */
  const permissoesVisiveis = useMemo(
    () => gruposDePermissao(session?.tenant?.plano, { temFlow }).flatMap((g) => g.itens),
    [session?.tenant?.plano, temFlow],
  );
  const { confirm, modal: confirmModal } = useConfirm();
  const [cargos, setCargos] = useState([]);
  const [view, setView] = useState("list");
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(cargoVazio());
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  /* O form como estava ao abrir. É contra ele que se sabe se há algo a perder
     — comparar com o cargo da lista não serviria, porque a lista guarda campos
     que o form não tem. */
  const [formOriginal, setFormOriginal] = useState(cargoVazio());
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

  /* Vazio de verdade: nenhum cargo, e não é a busca escondendo. Troca a tela
     inteira pelo convite — ver `ConviteDeCriacao`. */
  const semNenhum = !initialLoading && cargos.length === 0 && !search.trim();

  /* O nome da tela sobe para a faixa do painel. A rota já saberia o título
     sozinha (`trilhaDoPainel`), mas o SUBTÍTULO só esta tela conhece — e sem
     declará-lo aqui ele se perderia na mudança. Ver `contextoDeCabecalho`. */
  useTituloDaTela({ titulo: "Cargos e Permissões", subtitulo: "O que cada cargo alcança dentro do painel." });

  function abrirCriar() {
    setEditando(null);
    const f = cargoVazio();
    setForm(f);
    setFormOriginal(f);
    setError("");
    setView("form");
  }

  function abrirEditar(c) {
    setEditando(c);
    const f = { descricao: c.descricao };
    /* `TODAS_AS_PERMISSOES`, e não `permissoesVisiveis` nem `PERMISSOES`.

       Duas razões, e as duas já produziram estrago:

       1. Não `permissoesVisiveis`: o salvamento manda o form INTEIRO.
          Carregando só o que está à vista, uma permissão escondida pelo plano
          viria ausente do form e o servidor a gravaria como false — apagando,
          ao salvar qualquer outra coisa, algo que a pessoa nem sabia que
          estava lá.

       2. Não `PERMISSOES`: essa é a lista do HUB. As sete do Flow moram em
          `PERMISSOES_FLOW`, e ficavam de fora daqui — reabrir um cargo mostrava
          todas as caixas do Flow desmarcadas, mesmo com elas gravadas no banco.
          E como o form inteiro é o que vai ao servidor, salvar APAGAVA de
          verdade o que a tela tinha mentido não existir. */
    for (const p of TODAS_AS_PERMISSOES) f[p.key] = Boolean(c[p.key]);
    setForm(f);
    setFormOriginal(f);
    setError("");
    setView("form");
  }

  /* Comparação por conteúdo: as chaves saem sempre da mesma lista, na mesma
     ordem, então o JSON basta e não precisa de um laço à mão. */
  const sujo = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(formOriginal),
    [form, formOriginal],
  );

  /* Sair sem gravar. Antes não havia o que perder — tudo já estava no banco —,
     então o "Cancelar" podia voltar direto. Agora ele é a única forma de
     descartar, e descartar por engano é o estrago que o novo arranjo cria. */
  async function sair() {
    if (sujo && !await confirm(
      "Você mexeu nas permissões e ainda não salvou. Deseja sair mesmo assim?",
      "Sair sem salvar",
    )) return;
    setView("list");
  }

  function atualizarSessaoSeProprioCargoFoi(updatedCargo) {
    if (updatedCargo.id === session?.usuario?.cargo?.id && onSessionUpdate) {
      onSessionUpdate({
        ...session,
        usuario: { ...session.usuario, cargo: updatedCargo },
      });
    }
  }

  /* ── A CAIXA MARCADA NÃO É UMA GRAVAÇÃO ──────────────────────────────────

     Esta tela gravava a cada clique — o cargo saía do banco alterado antes de a
     pessoa dizer "pronto". Três coisas vinham junto:

     · não havia como desistir. "Cancelar" voltava para a lista com tudo já
       gravado, e o botão só prometia salvar o NOME;
     · quem abria um cargo para CONFERIR as permissões e esbarrava numa caixa
       mudava o cargo sem querer, sem nada para desfazer;
     · e cada clique mandava o form inteiro, então uma resposta perdida no meio
       do caminho gravava um estado que ninguém tinha pedido.

     Agora a marcação só mexe no `form`. Quem grava é o "Salvar Alterações",
     uma vez, com tudo — igual a Clientes, Usuários e Tipos de Imóvel. */
  /* O cargo em edição é o Administrador?

     `ehAdministrador` vem CALCULADO do servidor (`cargoRoutes` o anexa a cada
     cargo devolvido), e não de uma comparação de nome aqui. O próprio arquivo
     de rotas pede isso: a regra de quem é o Administrador é decidida lá, e a
     tela tem de ler a MESMA resposta. Comparar `descricao === "Administrador"`
     por conta própria seria a segunda definição da mesma coisa. */
  const ehOCargoAdministrador = Boolean(editando?.ehAdministrador);

  function alternarPermissao(key, value) {
    const ehProprioCargoDoUsuario = editando?.id === session?.usuario?.cargo?.id;
    if (LOCKED_NO_PROPRIO_CARGO.includes(key) && ehProprioCargoDoUsuario) return; // bloqueado
    /* As chaves da casa não saem do Administrador. O servidor as deriva a cada
       gravação (ver `cargoRoutes`), então o clique seria desfeito na resposta —
       o form pisca desmarcado e volta marcado, que é pior que não responder. */
    if (ehOCargoAdministrador && TRAVADAS_NO_ADMINISTRADOR.includes(key)) return;

    /* Conceder "Gerenciar Cargos" para no modal de ciência. Tirar não para:
       desfazer uma concessão de risco tem de ser tão fácil quanto possível. E o
       próprio cargo também não — quem está editando já tem a permissão, então
       não há nada sendo concedido ali. */
    if (PERMISSOES_DE_RISCO[key] && value === true && !ehProprioCargoDoUsuario) {
      setConcessaoPendente({ key, value });
      return;
    }
    setForm((p) => ({ ...p, [key]: value }));
  }

  /* O "estou ciente" do modal. Um caminho só desde que a tela parou de gravar
     na hora: criando ou editando, o que a confirmação faz é marcar a caixa. */
  function confirmarConcessao() {
    const pendente = concessaoPendente;
    setConcessaoPendente(null);
    if (!pendente) return;
    setForm((p) => ({ ...p, [pendente.key]: true }));
  }

  /* Uma gravação, com o cargo inteiro — nome e permissões. Editar mandava só a
     descrição porque as permissões já tinham ido, uma a uma, no clique. */
  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (editando) {
        const updated = await api.updateCargo(tenantSlug, editando.id, form);
        setCargos((prev) => prev.map((c) => c.id === updated.id ? updated : c));
        atualizarSessaoSeProprioCargoFoi(updated);
        showToast?.(`Cargo "${updated.descricao}" atualizado.`);
        setFormOriginal(form);
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

  /* Esc pede a saída, e quem decide é o `sair`: com permissão mexida e não
     salva, ele pergunta antes de descartar. */
  useSaidaDaTela(() => sair(), view === "form");

  if (view === "form") {
    const ehProprioCargoDoUsuario = editando?.id === session?.usuario?.cargo?.id;
    /* O nome do cargo, para o aviso falar dele e não de "este cargo". Sai do
       cargo em edição ou do que já foi digitado no formulário. */
    const nomeDoCargo = (editando?.descricao || form.descricao || "").trim();
    /* Sem nome ainda — dá para marcar a permissão antes de digitar — o aviso
       cai numa forma que continua correta em português, em vez de mostrar um
       `"este cargo"` entre aspas como se fosse o nome. */
    const alvoDoAviso = nomeDoCargo ? `ao cargo "${nomeDoCargo}"` : "a este cargo";
    const risco = concessaoPendente ? PERMISSOES_DE_RISCO[concessaoPendente.key] : null;

    return (
      <section className="glass-panel" style={{ animation: "fadeIn 0.3s ease-in-out" }}>
        {/* Aqui também, e não só na lista: é o "Cancelar" com alterações
            pendentes que pergunta, e o modal precisa estar montado nesta tela
            para a pergunta aparecer. */}
        {confirmModal}
        <ModalCiencia
          aberto={Boolean(risco)}
          titulo={risco?.titulo}
          descricao={`Você está prestes a dar ${alvoDoAviso} ${risco?.verbo}.`}
          riscos={risco?.riscos || []}
          textoCiencia={risco?.textoCiencia}
          confirmarLabel="Conceder mesmo assim"
          aoConfirmar={confirmarConcessao}
          aoCancelar={() => setConcessaoPendente(null)}
        />
        <div style={{ marginBottom: "24px" }}>
          <Trilha
            itens={[
              /* O primeiro degrau é o mesmo destino do "Cancelar" — e passa
                 pela mesma pergunta quando há alteração pendente. */
              ...degrausAte("/cargos", navigate, sair),
              {
                chave: "form",
                rotulo: editando ? "Editar Cargo" : "Novo Cargo",
                Icone: editando ? PencilSimple : PlusCircle,
                aoIr: () => setView("form"),
              },
            ]}
          />
        </div>
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
              {loading ? "Salvando…" : editando ? "Salvar Alterações" : "Criar Cargo"}
            </button>
            <button type="button" className="button-secondary" onClick={sair} disabled={loading} style={{ width: "auto", padding: "10px 16px", flexShrink: 0 }}>
              Cancelar
            </button>
          </div>

          <div style={{ marginTop: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <span style={{ fontSize: "14px", fontWeight: "600" }}>Permissões</span>
              {/* Era "Salvo automaticamente", e agora nada é. O aviso só aparece
                  quando há o que perder — um rótulo permanente vira paisagem e
                  ninguém o lê no momento em que importa. */}
              {sujo && (
                <span style={{ fontSize: "12px", color: "#fbbf24" }}>
                  Alterações não salvas
                </span>
              )}
            </div>
            {/* O DESENHO das caixas mora em `GradeDePermissoes`, junto com o do
                `+` do cadastro de usuário. O que fica aqui é só o que é DESTA
                tela: auto-save ao editar e o modal da permissão de risco. */}
            <GradeDePermissoes
              plano={session?.tenant?.plano}
              /* As sete permissões do Flow só aparecem para quem contratou o
                 módulo. Oferecer caixas de um produto que a conta não tem
                 produz a pior conversa possível com o suporte — "marquei e não
                 funciona". Ver `gruposDePermissao`. */
              temFlow={temFlow}
              valores={form}
              desabilitado={loading}
              /* Duas travas somadas, com motivos diferentes. A do Administrador
                 vem primeiro na mensagem porque é a mais ampla: quando as duas
                 valem — o administrador editando o próprio cargo — ela é a que
                 explica por que a caixa nunca vai abrir, para ninguém. */
              travadas={[
                ...(ehOCargoAdministrador ? TRAVADAS_NO_ADMINISTRADOR : []),
                ...(ehProprioCargoDoUsuario ? LOCKED_NO_PROPRIO_CARGO : []),
              ]}
              motivoTravada={
                ehOCargoAdministrador
                  ? "O Administrador não abre mão desta permissão — sem ela, a imobiliária fica sem ninguém para reabrir a porta"
                  : "Você não pode remover esta permissão do seu próprio cargo"
              }
              dataTour="cargo-permissoes"
              /* Criando ou editando, o caminho é o mesmo: junta no form. A
                 permissão de risco passa pelo modal nos dois — senão bastava
                 criar o cargo já com ela marcada para contornar o aviso. */
              aoAlternar={alternarPermissao}
            />
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
        <header data-tour="cargos-cabecalho">
          {/* Título subiu para a faixa do painel. */}
          <p style={{ color: "var(--text-muted)", margin: 0 }}>Defina o que cada cargo pode fazer no painel.</p>
        </header>
        {/* Vazio: o convite já traz o botão, a tecla e a âncora do tour. */}
        {semNenhum ? null : (
          <span data-tour="cargos-novo">
            <BtnNovo onClick={abrirCriar} label="Novo Cargo" />
          </span>
        )}
      </div>

      {semNenhum ? (
        <ConviteDeCriacao
          plena
          accent="#e04212"
          icone={<ShieldPlus size={34} weight="duotone" />}
          titulo="Pronto para criar seu primeiro cargo?"
          texto="O cargo é o que decide o que cada pessoa alcança: quem edita a vitrine, quem vê relatórios, quem mexe na cobrança."
          acaoLabel="Cadastrar cargo"
          onAcao={abrirCriar}
          tourId="cargos-novo"
        />
      ) : (
      <>
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
        /* Só a busca que não achou: a coleção vazia já saiu por cima. */
        <EmptyState mensagem="Nenhum cargo encontrado." />
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
      </>
      )}
    </div>
  );
}
