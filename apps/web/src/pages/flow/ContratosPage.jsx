import { useCallback, useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { ArrowsClockwise, FileText } from "@phosphor-icons/react";
import { api } from "../../api";
import { PageHeader, EmptyState, Chip } from "../../components/adminUi";
import { STATUS_CONTRATO, dataCurta, desdeQuando } from "../../utils/flow";
import { AvisoDePlanoFlow } from "../../components/flow/AvisoDePlanoFlow.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   TODOS OS CONTRATOS — a visão de quem cobra assinatura.

   O contrato é editado DENTRO do negócio (ver `PainelDeContrato`), porque lá
   ele tem contexto: as partes, o imóvel, o que falta validar. Esta tela existe
   para a pergunta oposta, que é feita uma vez por dia e não por negócio: "o que
   está esperando alguém assinar?".

   Por isso ela abre filtrada em ENVIADO e PARCIAL. Abrir em "todos" faria os
   contratos assinados — que são a maioria com o tempo — empurrarem para baixo
   os três que precisam de um telefonema hoje.
   ──────────────────────────────────────────────────────────────────────────── */

const FILTROS = [
  { key: "abertos", rotulo: "Aguardando" },
  { key: "ASSINADO", rotulo: "Assinados" },
  { key: "RASCUNHO", rotulo: "Rascunhos" },
  { key: "", rotulo: "Todos" },
];

export function ContratosPage({ session }) {
  const tenantSlug = session?.tenant?.slug;
  const navigate = useNavigate();
  const showToast = useOutletContext()?.showToast;

  const [contratos, setContratos] = useState([]);
  const [configurado, setConfigurado] = useState(true);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState("abertos");
  const [sincronizando, setSincronizando] = useState(null);

  const carregar = useCallback(() => {
    if (!tenantSlug) return;
    setCarregando(true);
    /* "abertos" é dois status, e a API filtra por um. Buscar tudo e filtrar
       aqui é o certo enquanto a lista cabe numa página — e ela cabe: o teto do
       servidor é 300. Um parâmetro `status=ENVIADO,PARCIAL` seria uma sintaxe
       nova na API por causa de um filtro de tela. */
    api.listarContratos(tenantSlug, { status: filtro === "abertos" ? "" : filtro })
      .then((r) => {
        const lista = r.contratos || [];
        setContratos(filtro === "abertos"
          ? lista.filter((c) => c.status === "ENVIADO" || c.status === "PARCIAL")
          : lista);
        setConfigurado(r.configurado);
      })
      .catch((e) => showToast?.(e.message || "Não consegui carregar.", "error"))
      .finally(() => setCarregando(false));
  }, [tenantSlug, filtro]);

  useEffect(() => { carregar(); }, [carregar]);

  async function sincronizar(c) {
    setSincronizando(c.id);
    try {
      await api.sincronizarContrato(tenantSlug, c.id);
      showToast?.("Situação atualizada na fonte.");
      carregar();
    } catch (e) {
      showToast?.(e.message || "Não consegui falar com o provedor.", "error");
    } finally { setSincronizando(null); }
  }

  return (
    <div data-tour="flow-contratos">
      <PageHeader
        title="Contratos"
        subtitle="O que está esperando assinatura. Para gerar ou editar, abra o negócio — é lá que o contrato tem contexto."
      />

      <AvisoDePlanoFlow
        recursos={{ assinaturaDigital: true, captacaoWebhook: true, assinaturaPronta: configurado }}
        plano={session?.tenant?.plano}
        compacto
      />

      <div className="flow-filtro-estagios" style={{ marginBottom: 16 }}>
        {FILTROS.map((f) => (
          <button
            key={f.key || "todos"}
            type="button"
            className={`flow-chip-estagio${filtro === f.key ? " is-on" : ""}`}
            onClick={() => setFiltro(f.key)}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      {carregando ? (
        <div className="skeleton-block" style={{ height: 260, borderRadius: 14 }} />
      ) : contratos.length === 0 ? (
        <EmptyState
          mensagem={
            filtro === "abertos"
              ? "Nenhum contrato esperando assinatura no momento."
              : "Nenhum contrato neste recorte."
          }
        />
      ) : (
        <div className="glass-panel" style={{ overflow: "hidden" }}>
          <table className="flow-tabela">
            <thead>
              <tr>
                <th>Contrato</th><th>Negócio</th><th>Situação</th>
                <th>Assinaturas</th><th>Enviado</th><th />
              </tr>
            </thead>
            <tbody>
              {contratos.map((c) => {
                const s = STATUS_CONTRATO[c.status] || { rotulo: c.status, cor: "#64748b" };
                const total = c.signatarios?.length || 0;
                const feitas = (c.signatarios || []).filter((x) => x.status === "ASSINADO").length;
                return (
                  <tr key={c.id}>
                    <td onClick={() => navigate(`/flow/negocios/${c.negocioId}`)} style={{ cursor: "pointer" }}>
                      <strong><FileText size={13} style={{ marginRight: 5 }} />{c.titulo}</strong>
                      {c.ultimoErro ? <span className="flow-tabela__sub is-erro">{c.ultimoErro}</span> : null}
                    </td>
                    <td onClick={() => navigate(`/flow/negocios/${c.negocioId}`)} style={{ cursor: "pointer" }}>
                      #{c.negocio?.codigo}
                      <span className="flow-tabela__sub">{c.negocio?.property?.title || c.negocio?.titulo}</span>
                    </td>
                    <td><Chip color={s.cor}>{s.rotulo}</Chip></td>
                    <td>{total ? `${feitas} de ${total}` : "—"}</td>
                    <td>
                      {c.enviadoEm ? dataCurta(c.enviadoEm) : "—"}
                      {c.enviadoEm && c.status !== "ASSINADO"
                        ? <span className="flow-tabela__sub">{desdeQuando(c.enviadoEm)}</span>
                        : null}
                    </td>
                    <td>
                      {c.documentoExterno ? (
                        <button
                          type="button"
                          className="flow-btn-fantasma"
                          disabled={sincronizando === c.id}
                          onClick={() => sincronizar(c)}
                          title="Perguntar ao provedor como está agora"
                        >
                          <ArrowsClockwise size={13} />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
