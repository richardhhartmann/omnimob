import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../../api";
import { useConfirm } from "../../components/ConfirmModal";
import { SelectCustom } from "../../components/SelectCustom";
import { Alert, Button, Eyebrow, Field, Reveal } from "../../styles/omnimobKit";

/* ────────────────────────────────────────────────────────────────────────────
   Usuários da plataforma — quem entra no painel da Omnimob.

   É a tela de Usuários do Hub repetida aqui, e não uma segunda ideia: lista,
   cadastro em modal, desativar em vez de apagar, e o cargo escolhido num
   seletor cuja lista vem do servidor.

   ── A SENHA NÃO É ESCOLHIDA POR QUEM CRIA ──

   A conta nasce sem senha e a pessoa recebe um link de uso único por e-mail
   (o mesmo mecanismo do "esqueci a senha"). Não há campo de senha aqui de
   propósito: quem cria a conta não deve conhecer a senha da outra pessoa — é
   o mesmo motivo de a reemissão de senha do tenant gerar uma temporária em
   vez de aceitar uma digitada. Em ambiente sem e-mail configurado (dev) o
   servidor devolve o link, e a tela o mostra para copiar.

   ── O QUE ESTA TELA NÃO DECIDE ──

   Se o botão aparece. Quem tem `verUsuarios` sem `gerenciarUsuarios` vê a
   lista e nada mais — os botões somem, não ficam desabilitados. A permissão
   chega por propriedade (`podeGerenciar`), lida do servidor pelo painel.
   ──────────────────────────────────────────────────────────────────────────── */

const FORM_VAZIO = { nome: "", email: "", cargoId: "", ativo: true };

function quando(iso) {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
}

export function AdminUsuariosPage({ podeGerenciar = false, euId }) {
  const { confirm, modal: confirmModal } = useConfirm();
  const [usuarios, setUsuarios] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [busca, setBusca] = useState("");

  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState("");
  /* O convite recém-enviado. O modal não fecha sozinho depois de criar: é a
     única vez em que o link aparece (quando aparece), e fechar por cima dele
     seria o mesmo beco da senha temporária do tenant. */
  const [convite, setConvite] = useState(null);
  // Qual linha está reenviando o convite agora. Trava só o botão dela.
  const [reenviando, setReenviando] = useState(null);

  async function carregar() {
    setCarregando(true);
    setErro("");
    try {
      const [lista, r] = await Promise.all([adminApi.listUsuarios(), adminApi.listCargos()]);
      setUsuarios(lista);
      setCargos(r.cargos || []);
    } catch (e) {
      setErro(e.message || "Erro ao carregar os usuários.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((u) => `${u.nome} ${u.email} ${u.cargo || ""}`.toLowerCase().includes(q));
  }, [usuarios, busca]);

  const opcoesDeCargo = useMemo(
    () => cargos.map((c) => ({ value: String(c.id), label: c.nome, description: `${c.usuarios} usuário(s)` })),
    [cargos],
  );

  function abrirCriar() {
    setEditandoId(null);
    setForm(FORM_VAZIO);
    setErroForm("");
    setConvite(null);
    setModalAberto(true);
  }

  function abrirEditar(u) {
    setEditandoId(u.id);
    setForm({ nome: u.nome, email: u.email, cargoId: u.cargoId ? String(u.cargoId) : "", ativo: u.ativo });
    setErroForm("");
    setConvite(null);
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setConvite(null);
  }

  const setCampo = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErroForm("");
    try {
      const payload = { nome: form.nome, email: form.email, cargoId: Number(form.cargoId) };
      if (editandoId) {
        await adminApi.atualizarUsuario(editandoId, { ...payload, ativo: form.ativo });
        setModalAberto(false);
        setOk("Usuário atualizado.");
      } else {
        const r = await adminApi.criarUsuario(payload);
        setConvite({ nome: r.nome, email: r.email, ...r.convite });
      }
      await carregar();
    } catch (e2) {
      setErroForm(e2.message || "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function reenviar(u) {
    setReenviando(u.id);
    setErro("");
    setOk("");
    try {
      const r = await adminApi.reenviarConvite(u.id);
      if (r.convite?.link) {
        setConvite({ nome: u.nome, email: u.email, ...r.convite });
        setEditandoId(null);
        setModalAberto(true);
      } else {
        setOk(`Convite reenviado para ${u.email}.`);
      }
    } catch (e) {
      setErro(e.message || "Não consegui reenviar o convite.");
    } finally {
      setReenviando(null);
    }
  }

  /* Desativar pede confirmação; reativar não. Desativar tira o acesso na
     requisição seguinte da pessoa — é o tipo de clique que se quer ter certeza. */
  async function alternarAtivo(u) {
    if (u.ativo) {
      const sim = await confirm(
        `Desativar ${u.nome}? A pessoa perde o acesso ao painel na próxima requisição. Dá para reativar depois.`,
        "Desativar",
      );
      if (!sim) return;
    }
    setErro("");
    try {
      await adminApi.atualizarUsuario(u.id, { ativo: !u.ativo });
      await carregar();
    } catch (e) {
      setErro(e.message || "Erro ao atualizar.");
    }
  }

  function copiar(texto) {
    navigator.clipboard?.writeText(texto).then(
      () => setOk("Link copiado."),
      () => setErro("O navegador não deixou copiar. Selecione e copie à mão."),
    );
  }

  return (
    <>
      {confirmModal}

      <Reveal className="sa-head">
        <Eyebrow>EQUIPE DA PLATAFORMA</Eyebrow>
        <h1 className="dl-h2 sa-title">
          <span className="dl-h2__strong">Usuários</span>
          <span className="dl-h2__soft">de quem opera a Omnimob.</span>
        </h1>
      </Reveal>

      <p className="dl-mono dl-note sa-note">
        // {usuarios.filter((u) => u.ativo).length} ativos · o cargo decide o que cada um alcança
      </p>

      <div className="sa-bar">
        <input
          className="dl-input sa-search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, e-mail ou cargo…"
        />
        {podeGerenciar ? (
          <Button as="button" type="button" variant="accent" onClick={abrirCriar}>
            Novo usuário
          </Button>
        ) : null}
      </div>

      {erro ? <Alert tone="danger">{erro}</Alert> : null}
      {ok ? <Alert tone="info">{ok}</Alert> : null}
      {carregando ? <p className="dl-mono sa-loading">// carregando usuários…</p> : null}

      {!carregando && visiveis.length === 0 ? (
        <div className="sa-empty">
          <p className="sa-empty__title">Nenhum usuário encontrado</p>
          <p className="sa-empty__desc">{busca ? "Ajuste a busca ou limpe o filtro." : "Convide a primeira pessoa da equipe."}</p>
        </div>
      ) : null}

      <div className="sa-list">
        {visiveis.map((u, i) => (
          <Reveal key={u.id} className="sa-row" delay={Math.min(i, 8) * 55}>
            <div className="sa-row__main">
              <div className="sa-row__title">
                <span className="sa-row__name">{u.nome}</span>
                <span className="dl-mono sa-row__slug">{u.email}</span>
                {u.cargo ? (
                  <span className="dl-pill su-pill--cargo">{u.cargo}</span>
                ) : (
                  <span className="dl-pill su-pill--alerta">Sem cargo</span>
                )}
                {u.aguardandoConvite ? <span className="dl-pill su-pill--alerta">Aguardando convite</span> : null}
                {u.segundoFator ? <span className="dl-pill su-pill--ok">2 etapas</span> : null}
                {!u.ativo ? <span className="dl-pill su-pill--off">Inativo</span> : null}
                {u.id === euId ? <span className="dl-mono su-voce">você</span> : null}
              </div>
              <dl className="sa-meta">
                <div><dt className="dl-mono">DESDE</dt><dd>{quando(u.createdAt)}</dd></div>
              </dl>
            </div>

            {podeGerenciar ? (
              <div className="sa-row__actions">
                <Button as="button" type="button" variant="outline" className="dl-btn--sm" arrow={false} onClick={() => abrirEditar(u)}>
                  Editar
                </Button>
                {u.aguardandoConvite && u.ativo ? (
                  <Button
                    as="button" type="button" variant="outline" className="dl-btn--sm" arrow={false}
                    disabled={reenviando === u.id}
                    onClick={() => reenviar(u)}
                  >
                    {reenviando === u.id ? "Enviando…" : "Reenviar convite"}
                  </Button>
                ) : null}
                {/* Desativar a si mesmo é se trancar para fora. O servidor
                    recusa; a tela nem oferece. */}
                {u.id !== euId ? (
                  <Button
                    as="button" type="button" variant={u.ativo ? "danger" : "ghost"} className="dl-btn--sm" arrow={false}
                    onClick={() => alternarAtivo(u)}
                  >
                    {u.ativo ? "Desativar" : "Reativar"}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </Reveal>
        ))}
      </div>

      {modalAberto ? (
        <div className="sa-modal" onClick={fecharModal}>
          <form className="sa-modal__card" onClick={(e) => e.stopPropagation()} onSubmit={salvar}>
            {convite ? (
              /* Convite enviado. Com transporte de e-mail o link nunca chega
                 aqui — só o aviso. Sem transporte (dev), o link aparece uma
                 vez, como a senha temporária do tenant. */
              <>
                <div className="sa-modal__head">
                  <Eyebrow>{convite.enviado ? "CONVITE ENVIADO" : "CONVITE GERADO"}</Eyebrow>
                  <h2 className="sa-modal__title">{convite.nome}</h2>
                </div>

                {convite.enviado ? (
                  <p className="su-nota">
                    Mandamos um e-mail para <strong>{convite.email}</strong> com o link para definir a senha.
                    Ele vale por 24 horas e funciona uma vez só. Se não chegar, use "Reenviar convite" na lista.
                  </p>
                ) : (
                  <div className="sa-credenciais">
                    <span className="dl-mono sa-modal__extra-label">// sem e-mail configurado — passe o link à pessoa</span>
                    <dl className="sa-credenciais__lista">
                      <div>
                        <dt className="dl-mono">LINK DE ACESSO</dt>
                        <dd className="su-link">{convite.link}</dd>
                      </div>
                    </dl>
                    <p className="sa-credenciais__nota">
                      Vale por 24 horas e uma vez só. Depois que {convite.nome} definir a senha, o link morre sozinho.
                    </p>
                    <div className="seg-acoes">
                      <Button as="button" type="button" variant="ghost" arrow={false} onClick={() => copiar(convite.link)}>
                        Copiar link
                      </Button>
                    </div>
                  </div>
                )}

                <div className="sa-modal__foot">
                  <Button as="button" type="button" variant="primary" arrow={false} onClick={fecharModal}>
                    Concluir
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="sa-modal__head">
                  <Eyebrow>{editandoId ? "EDITAR" : "CONVIDAR"}</Eyebrow>
                  <h2 className="sa-modal__title">{editandoId ? "Editar usuário" : "Novo usuário"}</h2>
                </div>

                {erroForm ? <Alert tone="danger">{erroForm}</Alert> : null}

                <div className="sa-form-grid">
                  <div className="sa-nome">
                    <Field label="Nome *">
                      <input className="dl-input" required value={form.nome} onChange={(e) => setCampo("nome", e.target.value)} />
                    </Field>
                  </div>
                  <Field label="E-mail *" hint={editandoId ? undefined : "É para cá que vai o convite."}>
                    <input className="dl-input" type="email" required value={form.email} onChange={(e) => setCampo("email", e.target.value)} />
                  </Field>
                  <Field label="Cargo *">
                    <SelectCustom
                      value={form.cargoId}
                      options={opcoesDeCargo}
                      onChange={(v) => setCampo("cargoId", v)}
                      placeholder="Escolha o cargo"
                    />
                  </Field>
                </div>

                {editandoId ? (
                  editandoId !== euId ? (
                    <label className="sa-addon">
                      <input type="checkbox" className="sw" checked={form.ativo} onChange={(e) => setCampo("ativo", e.target.checked)} />
                      <span>
                        <strong>Usuário ativo</strong>
                        <small>Desligado, a pessoa perde o acesso na próxima requisição — sem apagar nada.</small>
                      </span>
                    </label>
                  ) : null
                ) : (
                  /* Não é uma escolha, e por isso não é uma caixa: a senha é
                     sempre definida pela própria pessoa, no primeiro acesso. */
                  <p className="su-nota">
                    <strong>Senha definida no primeiro acesso.</strong> A pessoa recebe por e-mail um link de
                    uso único, válido por 24 horas, e escolhe a própria senha. Ninguém daqui fica sabendo.
                  </p>
                )}

                <div className="sa-modal__foot">
                  <Button as="button" type="button" variant="ghost" arrow={false} onClick={fecharModal} disabled={salvando}>
                    Cancelar
                  </Button>
                  <Button as="button" type="submit" variant="primary" arrow={false} disabled={salvando || !form.cargoId}>
                    {salvando ? "Salvando…" : editandoId ? "Salvar" : "Enviar convite"}
                  </Button>
                </div>
              </>
            )}
          </form>
        </div>
      ) : null}
    </>
  );
}

export const USUARIOS_CSS = `
.su-pill--cargo { background: rgba(99,102,241,0.12); color: #a5b4fc; border-color: rgba(129,140,248,0.30); }
.su-pill--ok { background: rgba(52,211,153,0.12); color: #86efac; border-color: rgba(52,211,153,0.30); }
.su-pill--alerta { background: rgba(251,191,36,0.10); color: #fbbf24; border-color: rgba(251,191,36,0.28); }
.su-pill--off { background: rgba(148,163,184,0.12); color: #cbd5e1; border-color: rgba(148,163,184,0.25); }
.su-voce { color: var(--placeholder); font-size: 9px; letter-spacing: 0.12em; }
.su-nota { margin: 0; font-size: 12.5px; line-height: 1.7; color: var(--subtle); }
.su-nota strong { color: var(--strong); }
.su-link { word-break: break-all; font-size: 12px !important; letter-spacing: 0 !important; user-select: all; }
`;
