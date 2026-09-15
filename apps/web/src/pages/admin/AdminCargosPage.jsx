import { useEffect, useState } from "react";
import { adminApi } from "../../api";
import { useConfirm } from "../../components/ConfirmModal";
import { Alert, Button, Eyebrow, Field, Reveal } from "../../styles/omnimobKit";

/* ────────────────────────────────────────────────────────────────────────────
   Cargos da plataforma — o que cada pessoa da Omnimob alcança no painel.

   O desenho é o da tela de Cargos do Hub: uma grade de permissões por cargo,
   com as chaves da casa travadas no Administrador. O que muda é a FORMA da
   grade, porque as permissões daqui têm dois níveis: a ABA (o que aparece no
   menu) e a AÇÃO dentro dela (o que o botão faz). Cada aba é um bloco com o
   interruptor, e as ações moram debaixo dela — desligar a aba desliga as
   ações, porque uma ação sem a aba é um estado que nenhuma tela consegue
   mostrar (o servidor também a desliga ao gravar; ver
   `normalizarPermissoes`).

   ── O CATÁLOGO VEM DO SERVIDOR ──

   `GET /api/admin/cargos` devolve, junto com os cargos, a lista de abas e
   ações e quais chaves são travadas. Uma cópia aqui divergiria de lá na
   primeira permissão nova — e o sintoma seria uma caixa que a tela mostra e
   o servidor ignora ao gravar (o Hub já pagou esse defeito uma vez).
   ──────────────────────────────────────────────────────────────────────────── */

function cargoVazio(catalogo) {
  const f = { nome: "" };
  for (const aba of catalogo) {
    f[aba.chave] = false;
    for (const a of aba.acoes) f[a.chave] = false;
  }
  return f;
}

export function AdminCargosPage({ meuCargoId }) {
  const { confirm, modal: confirmModal } = useConfirm();
  const [cargos, setCargos] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [travadas, setTravadas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");

  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null); // o cargo em edição, ou null para criar
  const [form, setForm] = useState({ nome: "" });
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState("");

  async function carregar() {
    setCarregando(true);
    setErro("");
    try {
      const r = await adminApi.listCargos();
      setCargos(r.cargos || []);
      setCatalogo(r.catalogo || []);
      setTravadas(r.travadas || []);
    } catch (e) {
      setErro(e.message || "Erro ao carregar os cargos.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  function abrirCriar() {
    setEditando(null);
    setForm(cargoVazio(catalogo));
    setErroForm("");
    setModalAberto(true);
  }

  function abrirEditar(c) {
    setEditando(c);
    setForm({ ...cargoVazio(catalogo), ...c });
    setErroForm("");
    setModalAberto(true);
  }

  const ehAdmin = Boolean(editando?.ehAdministrador);
  const travada = (chave) => ehAdmin && travadas.includes(chave);
  /* Quem edita o PRÓPRIO cargo não tira `verCargos` dele: seria se trancar do
     lado de fora. O servidor recusa; a tela nem oferece. */
  const propria = (chave) => editando && editando.id === meuCargoId && chave === "verCargos";

  function alternar(chave, valor) {
    setForm((prev) => {
      const proximo = { ...prev, [chave]: valor };
      /* Desligar a aba desliga as ações dela na hora, para a tela não mostrar
         marcado o que o servidor vai gravar desmarcado. */
      if (!valor) {
        const aba = catalogo.find((a) => a.chave === chave);
        for (const acao of aba?.acoes || []) proximo[acao.chave] = false;
      }
      return proximo;
    });
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErroForm("");
    try {
      const payload = { ...form };
      // O nome do Administrador não muda; não mandar evita o 400 por engano.
      if (ehAdmin) delete payload.nome;
      if (editando) await adminApi.atualizarCargo(editando.id, payload);
      else await adminApi.criarCargo(payload);
      setModalAberto(false);
      setOk(editando ? "Cargo atualizado. Vale na próxima requisição de quem o tem." : "Cargo criado.");
      await carregar();
    } catch (e2) {
      setErroForm(e2.message || "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(c) {
    const sim = await confirm(`Excluir o cargo "${c.nome}"? Só é possível sem usuários nele.`, "Excluir");
    if (!sim) return;
    setErro("");
    try {
      await adminApi.excluirCargo(c.id);
      await carregar();
    } catch (e) {
      setErro(e.message || "Erro ao excluir.");
    }
  }

  /* Resumo de uma linha: as abas ligadas. É o que responde "o que este cargo
     vê?" sem abrir o modal. */
  function resumo(c) {
    const abas = catalogo.filter((a) => c[a.chave]).map((a) => a.rotulo);
    return abas.length ? abas.join(" · ") : "não vê nenhuma aba";
  }

  return (
    <>
      {confirmModal}

      <Reveal className="sa-head">
        <Eyebrow>EQUIPE DA PLATAFORMA</Eyebrow>
        <h1 className="dl-h2 sa-title">
          <span className="dl-h2__strong">Cargos</span>
          <span className="dl-h2__soft">e o que cada um alcança.</span>
        </h1>
      </Reveal>

      <p className="dl-mono dl-note sa-note">
        // por aba: o que aparece no menu · por ação: o que o botão faz
      </p>

      <div className="sa-bar">
        <Button as="button" type="button" variant="accent" onClick={abrirCriar} disabled={carregando}>
          Novo cargo
        </Button>
      </div>

      {erro ? <Alert tone="danger">{erro}</Alert> : null}
      {ok ? <Alert tone="info">{ok}</Alert> : null}
      {carregando ? <p className="dl-mono sa-loading">// carregando cargos…</p> : null}

      <div className="sa-list">
        {cargos.map((c, i) => (
          <Reveal key={c.id} className="sa-row" delay={Math.min(i, 8) * 55}>
            <div className="sa-row__main">
              <div className="sa-row__title">
                <span className="sa-row__name">{c.nome}</span>
                {c.ehAdministrador ? <span className="dl-pill cg-pill--admin">Chaves da casa</span> : null}
                <span className="dl-mono sa-row__slug">{c.usuarios} usuário(s)</span>
              </div>
              <dl className="sa-meta">
                <div><dt className="dl-mono">VÊ</dt><dd>{resumo(c)}</dd></div>
              </dl>
            </div>
            <div className="sa-row__actions">
              <Button as="button" type="button" variant="outline" className="dl-btn--sm" arrow={false} onClick={() => abrirEditar(c)}>
                Editar
              </Button>
              {/* Sem o Administrador ninguém reabre a porta; com gente dentro,
                  excluir deixaria essas pessoas sem acesso em silêncio. */}
              {!c.ehAdministrador && c.usuarios === 0 ? (
                <Button as="button" type="button" variant="danger" className="dl-btn--sm" arrow={false} onClick={() => excluir(c)}>
                  Excluir
                </Button>
              ) : null}
            </div>
          </Reveal>
        ))}
      </div>

      {modalAberto ? (
        <div className="sa-modal" onClick={() => setModalAberto(false)}>
          <form className="sa-modal__card cg-modal" onClick={(e) => e.stopPropagation()} onSubmit={salvar}>
            <div className="sa-modal__head">
              <Eyebrow>{editando ? "EDITAR" : "NOVO"}</Eyebrow>
              <h2 className="sa-modal__title">{editando ? editando.nome : "Novo cargo"}</h2>
            </div>

            {erroForm ? <Alert tone="danger">{erroForm}</Alert> : null}

            {ehAdmin ? (
              <p className="su-nota">
                As chaves da casa — Usuários e Cargos — ficam sempre ligadas neste cargo: sem elas a
                plataforma não teria ninguém capaz de reabrir a porta. O nome também não muda.
              </p>
            ) : (
              <Field label="Nome *">
                <input
                  className="dl-input"
                  required
                  value={form.nome}
                  onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex.: Suporte"
                />
              </Field>
            )}

            <div className="cg-grade">
              {catalogo.map((aba) => {
                const ligada = Boolean(form[aba.chave]) || travada(aba.chave);
                const presa = travada(aba.chave) || propria(aba.chave);
                return (
                  <div key={aba.chave} className={`cg-aba${ligada ? " is-on" : ""}`}>
                    <label className="cg-aba__porta" title={presa ? "Esta permissão não pode ser desligada aqui." : undefined}>
                      <span className="cg-aba__texto">
                        <strong>{aba.rotulo}</strong>
                        <small>aba no menu</small>
                      </span>
                      <input
                        type="checkbox"
                        className="sw"
                        checked={ligada}
                        disabled={presa || salvando}
                        onChange={(e) => alternar(aba.chave, e.target.checked)}
                      />
                    </label>
                    {aba.acoes.length ? (
                      <div className="cg-acoes">
                        {aba.acoes.map((acao) => {
                          const marcada = Boolean(form[acao.chave]) || travada(acao.chave);
                          return (
                            <label key={acao.chave} className={`cg-acao${marcada ? " is-on" : ""}`}>
                              <input
                                type="checkbox"
                                checked={marcada}
                                disabled={!ligada || travada(acao.chave) || salvando}
                                onChange={(e) => alternar(acao.chave, e.target.checked)}
                              />
                              <span>{acao.rotulo}</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="sa-modal__foot">
              <Button as="button" type="button" variant="ghost" arrow={false} onClick={() => setModalAberto(false)} disabled={salvando}>
                Cancelar
              </Button>
              <Button as="button" type="submit" variant="primary" arrow={false} disabled={salvando}>
                {salvando ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

export const CARGOS_CSS = `
.cg-pill--admin { background: rgba(212,175,55,0.12); color: #e8cf7a; border-color: rgba(212,175,55,0.34); }
.sa-modal__card.cg-modal { max-width: 720px; }

.cg-grade { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.cg-aba {
  display: grid; gap: 10px; padding: 14px 16px; border-radius: 14px;
  background: var(--surface); border: 1px solid var(--line);
  transition: border-color 0.15s ease, background 0.15s ease;
}
.cg-aba.is-on { border-color: rgba(129,140,248,0.38); background: rgba(99,102,241,0.07); }
.cg-aba__porta { display: flex; align-items: center; justify-content: space-between; gap: 12px; cursor: pointer; }
.cg-aba__texto { display: flex; flex-direction: column; gap: 2px; }
.cg-aba__texto strong { font-size: 13.5px; color: var(--strong); letter-spacing: -0.01em; }
.cg-aba__texto small { font-size: 10.5px; color: var(--placeholder); letter-spacing: 0.04em; }

.cg-acoes { display: grid; gap: 6px; padding-top: 8px; border-top: 1px solid var(--line-soft); }
.cg-acao {
  display: flex; align-items: center; gap: 10px; font-size: 12.5px; color: var(--subtle);
  cursor: pointer;
}
.cg-acao input { accent-color: #818cf8; width: 15px; height: 15px; }
.cg-acao.is-on { color: var(--strong); }
.cg-acao:has(input:disabled) { opacity: 0.55; cursor: not-allowed; }

@media (max-width: 640px) {
  .cg-grade { grid-template-columns: 1fr; }
}
`;
