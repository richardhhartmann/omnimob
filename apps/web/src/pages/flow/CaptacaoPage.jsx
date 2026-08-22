import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, Copy, Trash, Broadcast, CheckCircle, XCircle, Eye } from "@phosphor-icons/react";
import { api } from "../../api";
import { PageHeader, EmptyState } from "../../components/adminUi";
import { CANAIS_FLOW, canalRotulo, dataCurta, desdeQuando } from "../../utils/flow";

/* ────────────────────────────────────────────────────────────────────────────
   FONTES DE CAPTAÇÃO — os endereços que os portais chamam.

   ── UMA FONTE POR CANAL, E NÃO UM ENDEREÇO SÓ ──

   É a decisão que molda esta tela inteira. Com um webhook único, vazar a URL do
   ZAP daria a quem a tivesse o poder de injetar lead falso dizendo que veio do
   Facebook. Com uma fonte por canal, revogar o ZAP não derruba o resto — e o
   diagnóstico consegue responder "qual portal parou".

   ── O DIAGNÓSTICO É METADE DA TELA ──

   Toda integração por webhook quebra em silêncio. O portal muda o formato do
   corpo, ninguém avisa, e o sintoma é "paramos de receber leads" descoberto
   três semanas depois. Por isso guardamos o corpo CRU de cada chamada e a tela
   o mostra: sem ele não há como descobrir o que mudou, e os leads daquelas
   semanas estão perdidos.
   ──────────────────────────────────────────────────────────────────────────── */

export function CaptacaoPage({ session }) {
  const tenantSlug = session?.tenant?.slug;
  const showToast = useOutletContext()?.showToast;

  const [fontes, setFontes] = useState([]);
  const [liberado, setLiberado] = useState(true);
  const [eventos, setEventos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [criando, setCriando] = useState(false);
  const [nova, setNova] = useState({ nome: "", canal: "ZAP", abrirNegocio: true });

  const carregar = useCallback(() => {
    if (!tenantSlug) return;
    Promise.all([
      api.listarFontesCaptacao(tenantSlug),
      api.eventosCaptacao(tenantSlug).catch(() => ({ eventos: [] })),
    ])
      .then(([f, e]) => { setFontes(f.fontes || []); setLiberado(f.liberado); setEventos(e.eventos || []); })
      .catch((err) => showToast?.(err.message || "Não consegui carregar.", "error"))
      .finally(() => setCarregando(false));
  }, [tenantSlug]);

  useEffect(() => { carregar(); }, [carregar]);

  async function criar(e) {
    e.preventDefault();
    if (!nova.nome.trim()) { showToast?.("Dê um nome à fonte.", "error"); return; }
    try {
      await api.criarFonteCaptacao(tenantSlug, nova);
      setNova({ nome: "", canal: "ZAP", abrirNegocio: true });
      setCriando(false);
      showToast?.("Fonte criada. Copie a URL e cole no painel do portal.");
      carregar();
    } catch (err) {
      showToast?.(err.message || "Não consegui criar a fonte.", "error");
    }
  }

  async function copiar(texto, oque) {
    try {
      await navigator.clipboard.writeText(texto);
      showToast?.(`${oque} copiado.`);
    } catch {
      /* Área de transferência bloqueada (http, permissão negada). Um prompt com
         o texto selecionável é a saída que sempre funciona — melhor que um
         toast de erro para uma operação que a pessoa consegue fazer à mão. */
      window.prompt(`Copie o ${oque.toLowerCase()}:`, texto);
    }
  }

  return (
    <div data-tour="flow-captacao">
      <PageHeader
        title="Fontes de captação"
        subtitle="Cada portal e cada campanha ganha um endereço próprio. O lead entra sozinho, vira negócio e cai na fila do corretor."
        action={
          liberado ? (
            <button type="button" className="btn-primary" onClick={() => setCriando((c) => !c)}>
              <Plus size={15} weight="bold" style={{ marginRight: 6 }} /> Nova fonte
            </button>
          ) : null
        }
      />

      {!liberado ? (
        <div className="flow-aviso">
          <span className="flow-aviso__icone"><Broadcast size={16} weight="fill" /></span>
          <span>
            A captação automática entra a partir do plano <strong>Profissional</strong>. No seu plano
            atual os negócios continuam sendo criados à mão, e o funil funciona igual.
          </span>
        </div>
      ) : null}

      {criando && liberado ? (
        <form className="glass-panel flow-form" onSubmit={criar} style={{ marginBottom: 18 }}>
          <div className="flow-form__dupla">
            <label className="flow-campo">
              <span>Nome da fonte</span>
              <input
                value={nova.nome}
                onChange={(e) => setNova((n) => ({ ...n, nome: e.target.value }))}
                placeholder="Ex.: ZAP — anúncios de venda"
                autoFocus
              />
            </label>
            <label className="flow-campo">
              <span>Canal</span>
              <select value={nova.canal} onChange={(e) => setNova((n) => ({ ...n, canal: e.target.value }))}>
                {CANAIS_FLOW.map((c) => <option key={c.key} value={c.key}>{c.rotulo}</option>)}
              </select>
            </label>
          </div>
          <label className="flow-check">
            <input
              type="checkbox" className="sw"
              checked={nova.abrirNegocio}
              onChange={(e) => setNova((n) => ({ ...n, abrirNegocio: e.target.checked }))}
            />
            <span>
              Abrir um negócio no funil para cada lead
              {/* Desligar é o caso da campanha de captação de PROPRIETÁRIO —
                  ela encheria o funil de vendas de gente que quer anunciar. */}
              <small>Desligue em campanhas de captação de imóvel: elas trazem quem quer anunciar, não comprar.</small>
            </span>
          </label>
          <div className="flow-form__acoes">
            <button type="submit" className="btn-primary">Criar fonte</button>
            <button type="button" className="flow-btn-fantasma" onClick={() => setCriando(false)}>Cancelar</button>
          </div>
        </form>
      ) : null}

      {carregando ? (
        <div className="skeleton-block" style={{ height: 220, borderRadius: 14 }} />
      ) : fontes.length === 0 ? (
        <EmptyState
          mensagem="Nenhuma fonte cadastrada. Crie uma para cada portal e cole a URL no painel deles."
          acaoLabel={liberado ? "Criar a primeira" : null}
          onAcao={() => setCriando(true)}
        />
      ) : (
        <div className="flow-fontes">
          {fontes.map((f) => (
            <article key={f.id} className="glass-panel flow-fonte">
              <header>
                <div>
                  <strong>{f.nome}</strong>
                  <span className="flow-fonte__canal">{canalRotulo(f.canal)}</span>
                </div>
                <label className="flow-fonte__interruptor" title={f.ativa ? "Desativar" : "Ativar"}>
                  <input
                    type="checkbox" className="sw" checked={f.ativa}
                    onChange={async (e) => {
                      try { await api.salvarFonteCaptacao(tenantSlug, f.id, { ativa: e.target.checked }); carregar(); }
                      catch (err) { showToast?.(err.message, "error"); }
                    }}
                  />
                </label>
              </header>

              <div className="flow-fonte__campo">
                <span>URL do webhook</span>
                <code>{f.url}</code>
                <button type="button" onClick={() => copiar(f.url, "Endereço")}><Copy size={13} /></button>
              </div>
              <div className="flow-fonte__campo">
                <span>Segredo de assinatura</span>
                {/* Recuperável, ao contrário da chave de API. Ver o comentário em
                    `GET /flow/captacao/fontes`: ele ASSINA, não autentica
                    sozinho, e quem configura volta semanas depois para
                    reconfigurar. */}
                <code className="is-segredo">{f.segredo}</code>
                <button type="button" onClick={() => copiar(f.segredo, "Segredo")}><Copy size={13} /></button>
              </div>

              <footer>
                <span>
                  {f.totalRecebido} aceito(s) · {f.totalRecusado} recusado(s)
                  {f.ultimoEventoEm ? ` · último ${desdeQuando(f.ultimoEventoEm)}` : " · nunca chamado"}
                </span>
                <span className="flow-fonte__acoes">
                  {!f.abrirNegocio ? <em>só registra lead</em> : null}
                  <button
                    type="button" className="is-perigo"
                    onClick={async () => {
                      if (!window.confirm(`Remover "${f.nome}"? O portal vai começar a receber 404 nesta URL.`)) return;
                      try { await api.removerFonteCaptacao(tenantSlug, f.id); carregar(); }
                      catch (err) { showToast?.(err.message, "error"); }
                    }}
                  ><Trash size={13} /></button>
                </span>
              </footer>
            </article>
          ))}
        </div>
      )}

      {/* ── O diagnóstico ─────────────────────────────────────────────────── */}
      {eventos.length ? (
        <section className="glass-panel flow-bloco" style={{ marginTop: 20 }}>
          <h3>Últimas chamadas recebidas</h3>
          <p className="flow-bloco__nota">
            O corpo cru de cada chamada fica guardado por 90 dias. É ele que responde por que um
            portal parou de entregar lead — sem isso, a resposta seria um palpite.
          </p>
          <ul className="flow-eventos">
            {eventos.map((ev) => (
              <li key={ev.id} className={`is-${ev.status.toLowerCase()}`}>
                <span className="flow-eventos__marca">
                  {ev.status === "ACEITO" ? <CheckCircle size={14} weight="fill" />
                    : ev.status === "DUPLICADO" ? <Eye size={14} />
                    : <XCircle size={14} weight="fill" />}
                </span>
                <span className="flow-eventos__fonte">{ev.fonte?.nome || "—"}</span>
                <span className="flow-eventos__quando">{dataCurta(ev.createdAt)}</span>
                <span className="flow-eventos__status">{ev.erro || ev.status.toLowerCase()}</span>
                <details className="flow-eventos__corpo">
                  <summary>corpo recebido</summary>
                  <pre>{JSON.stringify(ev.payload, null, 2)}</pre>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
