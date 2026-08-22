import { useCallback, useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { SealCheck, Clock, Paperclip, Scales, CurrencyCircleDollar } from "@phosphor-icons/react";
import { api } from "../../api";
import { PageHeader, EmptyState } from "../../components/adminUi";
import { estagioInfo, reais, dataCurta, desdeQuando } from "../../utils/flow";

/* ────────────────────────────────────────────────────────────────────────────
   A FILA DE CONFERÊNCIA — a tela de quem valida.

   ── POR QUE ELA EXISTE COMO TELA PRÓPRIA ──

   Porque o trabalho do jurídico e do financeiro é EM LOTE. Eles não abrem um
   negócio por vez pelo funil: eles chegam de manhã, olham o que está esperando
   e despacham. Uma tela que os obrigasse a caçar negócios no kanban faria a
   conferência acontecer tarde — e é a demora da conferência que trava o
   fechamento, não a conferência em si.

   ── OS DOIS SETORES APARECEM PARA OS DOIS ──

   Quem só valida o financeiro vê também o estado do jurídico, e o botão dele
   fica desabilitado. Esconder metade faria cada setor trabalhar às cegas sobre
   o mesmo negócio — e a pergunta mais comum na mesa é justamente "o jurídico já
   olhou?".

   ── ORDENADO PELO MAIS ANTIGO ──

   `updatedAt: asc` no servidor. Uma fila que mostra o mais recente primeiro é
   uma pilha, e numa pilha o negócio do fundo nunca é atendido.
   ──────────────────────────────────────────────────────────────────────────── */

export function ValidacaoPage({ session }) {
  const tenantSlug = session?.tenant?.slug;
  const navigate = useNavigate();
  const showToast = useOutletContext()?.showToast;

  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState("pendentes");

  const carregar = useCallback(() => {
    if (!tenantSlug) return;
    api.filaDeValidacao(tenantSlug)
      .then(setDados)
      .catch((e) => showToast?.(e.message || "Não consegui carregar a fila.", "error"))
      .finally(() => setCarregando(false));
  }, [tenantSlug]);

  useEffect(() => { carregar(); }, [carregar]);

  async function validar(negocio, setor, aprovado) {
    const nota = aprovado
      ? (window.prompt("Observação (opcional):") ?? "")
      : (window.prompt("O que impede a liberação?") ?? "");
    if (!aprovado && !nota.trim()) {
      showToast?.("Diga o que falta — uma ressalva sem motivo não ajuda quem vai resolver.", "error");
      return;
    }
    try {
      await api.validarNegocio(tenantSlug, negocio.id, setor, { aprovado, nota });
      showToast?.(aprovado ? "Liberado." : "Ressalva registrada.");
      carregar();
    } catch (e) {
      showToast?.(e.message || "Não consegui registrar.", "error");
    }
  }

  if (carregando) return <div className="skeleton-block" style={{ height: 320, borderRadius: 14 }} />;
  if (!dados) return <p style={{ color: "var(--text-muted)" }}>Não consegui carregar a fila.</p>;

  const todos = dados.negocios || [];
  const pendentes = todos.filter((n) => !n.juridicoOk || !n.financeiroOk);
  const lista = filtro === "pendentes" ? pendentes : todos;

  return (
    <div data-tour="flow-validacao">
      <PageHeader
        title="Fila de validação"
        subtitle="Negócios em fechamento esperando a conferência do jurídico e do financeiro. Do mais antigo para o mais recente."
      />

      <div className="flow-filtro-estagios" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={`flow-chip-estagio${filtro === "pendentes" ? " is-on" : ""}`}
          onClick={() => setFiltro("pendentes")}
        >
          Esperando ({pendentes.length})
        </button>
        <button
          type="button"
          className={`flow-chip-estagio${filtro === "todos" ? " is-on" : ""}`}
          onClick={() => setFiltro("todos")}
        >
          Todos em fechamento ({todos.length})
        </button>
      </div>

      {lista.length === 0 ? (
        <EmptyState
          mensagem={
            filtro === "pendentes"
              ? "Nada esperando conferência. A fila está limpa."
              : "Nenhum negócio em fase de fechamento no momento."
          }
        />
      ) : (
        <div className="flow-fila">
          {lista.map((n) => {
            const info = estagioInfo(n.estagio);
            return (
              <article key={n.id} className="glass-panel flow-fila__item">
                <header className="flow-fila__topo">
                  <button type="button" className="flow-fila__abrir" onClick={() => navigate(`/flow/negocios/${n.id}`)}>
                    <span className="flow-fila__codigo">#{n.codigo}</span>
                    <strong>{n.titulo}</strong>
                  </button>
                  <span className="flow-fila__etapa" style={{ "--cor": info.cor }}>{info.rotulo}</span>
                </header>

                <dl className="flow-fila__dados">
                  <div><dt>Imóvel</dt><dd>{n.property?.title || "—"}</dd></div>
                  <div><dt>Comprador</dt><dd>{n.comprador?.nome || "—"}</dd></div>
                  <div><dt>Vendedor</dt><dd>{n.vendedor?.nome || "—"}</dd></div>
                  <div><dt>Valor</dt><dd>{reais(n.valorFechado ?? n.valorProposta)}</dd></div>
                  <div>
                    <dt>Documentos</dt>
                    <dd>
                      <Paperclip size={12} />{" "}
                      {n._count?.documentos || 0}
                    </dd>
                  </div>
                  <div><dt>Parado</dt><dd>{desdeQuando(n.updatedAt)}</dd></div>
                </dl>

                <div className="flow-fila__setores">
                  <BotaoSetor
                    Icon={Scales}
                    rotulo="Jurídico"
                    ok={n.juridicoOk}
                    por={n.juridicoPor?.nome}
                    em={n.juridicoEm}
                    nota={n.juridicoNota}
                    pode={dados.podeJuridico}
                    aoValidar={(v) => validar(n, "juridico", v)}
                  />
                  <BotaoSetor
                    Icon={CurrencyCircleDollar}
                    rotulo="Financeiro"
                    ok={n.financeiroOk}
                    por={n.financeiroPor?.nome}
                    em={n.financeiroEm}
                    nota={n.financeiroNota}
                    pode={dados.podeFinanceiro}
                    aoValidar={(v) => validar(n, "financeiro", v)}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BotaoSetor({ Icon, rotulo, ok, por, em, nota, pode, aoValidar }) {
  return (
    <div className={`flow-setor${ok ? " is-ok" : ""}`}>
      <span className="flow-setor__icone">
        {ok ? <SealCheck size={18} weight="fill" /> : <Icon size={18} />}
      </span>
      <div className="flow-setor__corpo">
        <strong>{rotulo}</strong>
        <span>
          {ok ? `Liberado${por ? ` por ${por}` : ""}${em ? ` · ${dataCurta(em)}` : ""}` : "Esperando"}
        </span>
        {nota ? <em>{nota}</em> : null}
      </div>
      {/* Desabilitado, e não escondido, para quem não é do setor: ver o estado
          do outro lado é metade do valor desta fila. */}
      <button
        type="button"
        className="flow-setor__botao"
        disabled={!pode}
        title={pode ? undefined : `Só quem tem a permissão de validar o ${rotulo.toLowerCase()} pode marcar isto.`}
        onClick={() => aoValidar(!ok)}
      >
        {ok ? "Retirar" : "Liberar"}
      </button>
    </div>
  );
}
