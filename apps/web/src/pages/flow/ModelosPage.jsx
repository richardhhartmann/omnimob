import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, Trash, Scroll, Copy } from "@phosphor-icons/react";
import { api } from "../../api";
import { PageHeader, EmptyState } from "../../components/adminUi";

/* ────────────────────────────────────────────────────────────────────────────
   MODELOS DE MINUTA — o texto do contrato com marcadores no lugar dos dados.

   ── O CATÁLOGO DE MARCADORES VEM DO SERVIDOR ──

   `GET /flow/minutas/campos`. Uma lista escrita aqui divergiria do motor no
   primeiro marcador novo, e o sintoma seria a tela oferecer um campo que o
   contrato não preenche. Mesmo raciocínio do assistente de IA da vitrine, onde
   é o cliente que manda o vocabulário para a API — aqui é o contrário, e pela
   mesma razão: quem SABE é quem manda.

   ── O ERRO DE DIGITAÇÃO É PEGO AQUI, E NÃO NA HORA DE GERAR ──

   Salvar uma minuta com `{{comprador.cpj}}` é recusado com a lista dos
   marcadores errados. É agora que a pessoa está olhando para o texto e tem como
   corrigir — descobrir isso seis meses depois, com um negócio parado esperando
   assinatura, é tarde demais.
   ──────────────────────────────────────────────────────────────────────────── */

export function ModelosPage({ session }) {
  const tenantSlug = session?.tenant?.slug;
  const showToast = useOutletContext()?.showToast;

  const [modelos, setModelos] = useState([]);
  const [sugestao, setSugestao] = useState(null);
  const [campos, setCampos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(null); // { id?, nome, tipo, corpo }
  const [erros, setErros] = useState([]);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(() => {
    if (!tenantSlug) return;
    Promise.all([
      api.listarModelos(tenantSlug),
      api.camposDeMinuta(tenantSlug).catch(() => ({ campos: [] })),
    ])
      .then(([m, c]) => { setModelos(m.modelos || []); setSugestao(m.sugestao); setCampos(c.campos || []); })
      .catch((e) => showToast?.(e.message || "Não consegui carregar.", "error"))
      .finally(() => setCarregando(false));
  }, [tenantSlug]);

  useEffect(() => { carregar(); }, [carregar]);

  /* Agrupados pelo prefixo do marcador. Uma lista corrida de 45 campos é
     impossível de varrer; agrupada por "quem" (comprador, vendedor, imóvel) ela
     espelha como a pessoa pensa ao escrever a cláusula. */
  const grupos = useMemo(() => {
    const mapa = new Map();
    for (const c of campos) {
      const g = c.chave.split(".")[0];
      if (!mapa.has(g)) mapa.set(g, []);
      mapa.get(g).push(c);
    }
    return [...mapa.entries()];
  }, [campos]);

  async function salvar() {
    if (!editando?.nome?.trim()) { showToast?.("Dê um nome ao modelo.", "error"); return; }
    if (!editando?.corpo?.trim()) { showToast?.("A minuta está vazia.", "error"); return; }
    setSalvando(true);
    setErros([]);
    try {
      if (editando.id) await api.salvarModelo(tenantSlug, editando.id, editando);
      else await api.criarModelo(tenantSlug, editando);
      showToast?.("Modelo salvo.");
      setEditando(null);
      carregar();
    } catch (erro) {
      const ruins = erro?.body?.marcadoresDesconhecidos;
      if (Array.isArray(ruins) && ruins.length) {
        setErros(ruins);
        showToast?.("A minuta usa marcadores que não existem.", "error");
      } else {
        showToast?.(erro.message || "Não consegui salvar.", "error");
      }
    } finally { setSalvando(false); }
  }

  function inserir(chave) {
    /* Insere no fim, e não no cursor. Rastrear a posição do cursor num
       `<textarea>` que perde o foco a cada clique na lista exigiria um ref e um
       `selectionStart` guardado — e o ganho seria pequeno: quem escreve minuta
       copia o marcador e cola onde quer. Copiar é o gesto principal; inserir é
       a conveniência. */
    setEditando((e) => ({ ...e, corpo: `${e.corpo}{{${chave}}}` }));
  }

  if (carregando) return <div className="skeleton-block" style={{ height: 320, borderRadius: 14 }} />;

  return (
    <div data-tour="flow-modelos">
      <PageHeader
        title="Modelos de minuta"
        subtitle="O texto do contrato com marcadores no lugar dos dados. O sistema preenche cruzando comprador, vendedor e imóvel."
        action={
          !editando ? (
            <button
              type="button" className="btn-primary"
              onClick={() => setEditando({ nome: "", tipo: "VENDA", corpo: "", ativo: true })}
            >
              <Plus size={15} weight="bold" style={{ marginRight: 6 }} /> Nova minuta
            </button>
          ) : null
        }
      />

      {editando ? (
        <div className="flow-editor-minuta">
          <div className="glass-panel flow-bloco">
            <div className="flow-form__dupla">
              <label className="flow-campo">
                <span>Nome</span>
                <input
                  value={editando.nome}
                  onChange={(e) => setEditando((m) => ({ ...m, nome: e.target.value }))}
                  placeholder="Ex.: Compra e venda — padrão"
                />
              </label>
              <label className="flow-campo">
                <span>Tipo</span>
                <select value={editando.tipo} onChange={(e) => setEditando((m) => ({ ...m, tipo: e.target.value }))}>
                  <option value="VENDA">Compra e venda</option>
                  <option value="LOCACAO">Locação</option>
                  <option value="AUTORIZACAO">Autorização de venda</option>
                  <option value="OUTRO">Outro</option>
                </select>
              </label>
            </div>

            {erros.length ? (
              <div className="flow-pend-minuta">
                <strong>Estes marcadores não existem:</strong>
                <ul>{erros.map((m) => <li key={m}><code>{`{{${m}}}`}</code></li>)}</ul>
                <p>Confira a grafia na lista ao lado. Marcador errado sairia impresso no contrato.</p>
              </div>
            ) : null}

            <label className="flow-campo">
              <span>Texto da minuta</span>
              <textarea
                className="flow-minuta"
                value={editando.corpo}
                onChange={(e) => setEditando((m) => ({ ...m, corpo: e.target.value }))}
                rows={26}
                placeholder="Cole aqui a sua minuta e troque os dados variáveis pelos marcadores da lista ao lado."
              />
            </label>

            <div className="flow-form__acoes">
              <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
                {salvando ? "Salvando…" : "Salvar minuta"}
              </button>
              <button type="button" className="flow-btn-fantasma" onClick={() => { setEditando(null); setErros([]); }}>
                Cancelar
              </button>
              {sugestao && !editando.id ? (
                <button
                  type="button" className="flow-btn-fantasma"
                  onClick={() => setEditando((m) => ({ ...m, nome: m.nome || sugestao.nome, corpo: sugestao.corpo }))}
                >
                  Usar o modelo de exemplo
                </button>
              ) : null}
            </div>
          </div>

          {/* ── O vocabulário ─────────────────────────────────────────────── */}
          <aside className="glass-panel flow-bloco flow-marcadores">
            <h3>Marcadores</h3>
            <p className="flow-bloco__nota">
              Clique para inserir no fim do texto, ou copie e cole onde quiser. Marcador sem dado no
              cadastro <strong>impede</strong> o contrato de ser gerado — ele nunca vira espaço em branco.
            </p>
            {grupos.map(([grupo, itens]) => (
              <div key={grupo} className="flow-marcadores__grupo">
                <h4>{grupo}</h4>
                {itens.map((c) => (
                  <button key={c.chave} type="button" onClick={() => inserir(c.chave)} title={c.onde ? `Preenchido em ${c.onde}` : "Automático"}>
                    <code>{`{{${c.chave}}}`}</code>
                    <span>{c.rotulo}</span>
                  </button>
                ))}
              </div>
            ))}
          </aside>
        </div>
      ) : modelos.length === 0 ? (
        <EmptyState
          mensagem="Nenhuma minuta cadastrada. Comece pelo modelo de compra e venda que já vem pronto — ele é editável."
          acaoLabel="Começar pelo modelo pronto"
          onAcao={() => setEditando({ nome: sugestao?.nome || "", tipo: sugestao?.tipo || "VENDA", corpo: sugestao?.corpo || "", ativo: true })}
        />
      ) : (
        <div className="flow-modelos">
          {modelos.map((m) => (
            <article key={m.id} className={`glass-panel flow-modelo${m.ativo ? "" : " is-inativo"}`}>
              <span className="flow-modelo__icone"><Scroll size={18} weight="fill" /></span>
              <div className="flow-modelo__corpo">
                <strong>{m.nome}</strong>
                <span>{m.tipo} · {m.corpo.length.toLocaleString("pt-BR")} caracteres</span>
              </div>
              <div className="flow-modelo__acoes">
                <label className="flow-modelo__ativo" title={m.ativo ? "Ativo" : "Inativo"}>
                  <input
                    type="checkbox" className="sw" checked={m.ativo}
                    onChange={async (e) => {
                      try { await api.salvarModelo(tenantSlug, m.id, { ativo: e.target.checked }); carregar(); }
                      catch (err) { showToast?.(err.message, "error"); }
                    }}
                  />
                </label>
                <button type="button" onClick={() => setEditando({ ...m })}>Editar</button>
                <button
                  type="button" className="is-perigo"
                  onClick={async () => {
                    if (!window.confirm(
                      `Remover "${m.nome}"? Os contratos já gerados a partir dele continuam intactos — eles guardam o texto.`
                    )) return;
                    try { await api.removerModelo(tenantSlug, m.id); carregar(); }
                    catch (err) { showToast?.(err.message, "error"); }
                  }}
                ><Trash size={13} /></button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
