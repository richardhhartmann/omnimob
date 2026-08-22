import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { Plus, WarningCircle } from "@phosphor-icons/react";
import { api } from "../../api";
import { PageHeader, SearchInput, FilterTabs, EmptyState, Chip } from "../../components/adminUi";
import { ESTAGIOS_FLOW, ESTAGIO_PERDIDO, estagioInfo, reais, desdeQuando, canalRotulo } from "../../utils/flow";

/* ────────────────────────────────────────────────────────────────────────────
   TODOS OS NEGÓCIOS — a lista, quando o funil não serve.

   O funil responde "como está o pipeline"; esta tela responde "cadê aquele
   negócio". São perguntas diferentes e por isso são duas telas: uma lista
   ordenável com filtros dentro de um kanban seria as duas coisas pela metade.

   Ela é também o destino de `?parados=1`, o link do alerta da tela inicial —
   e é por isso que os filtros vêm da URL e não de estado local: o alerta
   precisa poder apontar para um recorte específico, e a pessoa precisa poder
   compartilhar esse link com o colega.
   ──────────────────────────────────────────────────────────────────────────── */

export function NegociosPage({ session }) {
  const tenantSlug = session?.tenant?.slug;
  const navigate = useNavigate();
  const showToast = useOutletContext()?.showToast;
  const [params, setParams] = useSearchParams();

  const estagio = params.get("estagio") || "";
  const parados = params.get("parados") === "1";
  const escopo = params.get("responsavel") || "";

  const [negocios, setNegocios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");

  const carregar = useCallback(() => {
    if (!tenantSlug) return;
    setCarregando(true);
    api.listarNegocios(tenantSlug, { estagio, parados: parados ? "1" : "", responsavel: escopo })
      .then((r) => setNegocios(r.negocios || []))
      .catch((e) => showToast?.(e.message || "Não consegui carregar.", "error"))
      .finally(() => setCarregando(false));
  }, [tenantSlug, estagio, parados, escopo]);

  useEffect(() => { carregar(); }, [carregar]);

  function trocarParam(chave, valor) {
    const p = new URLSearchParams(params);
    if (valor) p.set(chave, valor); else p.delete(chave);
    setParams(p, { replace: true });
  }

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return negocios;
    return negocios.filter((n) =>
      [n.titulo, n.comprador?.nome, n.property?.title, String(n.codigo)]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));
  }, [negocios, busca]);

  const opcoesEstagio = [
    { key: "", label: "Todos" },
    ...[...ESTAGIOS_FLOW, ESTAGIO_PERDIDO].map((e) => ({ key: e.key, label: e.rotulo })),
  ];

  return (
    <div data-tour="flow-negocios">
      <PageHeader
        title={parados ? "Negócios parados" : "Todos os negócios"}
        subtitle={
          parados
            ? "Sem nenhum registro de contato nos últimos dias. Um deles ainda pode ser salvo com uma ligação."
            : "A carteira inteira, com busca e filtro. Para trabalhar por etapa, use o funil."
        }
        action={
          <button type="button" className="btn-primary" onClick={() => navigate("/flow/negocios/novo")}>
            <Plus size={15} weight="bold" style={{ marginRight: 6 }} /> Novo negócio
          </button>
        }
      />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        <SearchInput value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" />
        <FilterTabs value={escopo} onChange={(v) => trocarParam("responsavel", v)}
          options={[{ key: "", label: "Da casa" }, { key: "meus", label: "Meus" }]} />
        <button
          type="button"
          className={`flow-chip-filtro${parados ? " is-on" : ""}`}
          onClick={() => trocarParam("parados", parados ? "" : "1")}
        >
          <WarningCircle size={13} weight="fill" /> Só os parados
        </button>
      </div>

      <div className="flow-filtro-estagios">
        {opcoesEstagio.map((o) => (
          <button
            key={o.key || "todos"}
            type="button"
            className={`flow-chip-estagio${estagio === o.key ? " is-on" : ""}`}
            style={o.key ? { "--cor": estagioInfo(o.key).cor } : undefined}
            onClick={() => trocarParam("estagio", o.key)}
          >
            {o.label}
          </button>
        ))}
      </div>

      {carregando ? (
        <div className="skeleton-block" style={{ height: 300, borderRadius: 14 }} />
      ) : visiveis.length === 0 ? (
        <EmptyState
          mensagem={
            busca || estagio || parados
              ? "Nenhum negócio bate com este recorte."
              : "Nenhum negócio ainda. Eles chegam sozinhos pelas fontes de captação, ou você cria um aqui."
          }
          acaoLabel={busca || estagio || parados ? null : "Criar o primeiro"}
          onAcao={() => navigate("/flow/negocios/novo")}
        />
      ) : (
        <div className="glass-panel" style={{ overflow: "hidden" }}>
          <table className="flow-tabela">
            <thead>
              <tr>
                <th>Negócio</th>
                <th>Etapa</th>
                <th>Imóvel</th>
                <th>Valor</th>
                <th>Responsável</th>
                <th>Último contato</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((n) => {
                const info = estagioInfo(n.estagio);
                const dias = Math.floor((Date.now() - new Date(n.ultimoContatoEm || n.createdAt).getTime()) / 86400000);
                return (
                  <tr key={n.id} onClick={() => navigate(`/flow/negocios/${n.id}`)}>
                    <td>
                      <strong>#{n.codigo}</strong>
                      <span className="flow-tabela__sub">{n.titulo}</span>
                    </td>
                    <td><Chip color={info.cor}>{info.rotulo}</Chip></td>
                    <td>
                      {n.property?.title || <span className="flow-tabela__vazio">—</span>}
                      {n.property?.city ? <span className="flow-tabela__sub">{n.property.city}</span> : null}
                    </td>
                    <td>{reais(n.valorFechado ?? n.valorProposta)}</td>
                    <td>{n.responsavel?.nome || <span className="flow-tabela__vazio">sem dono</span>}</td>
                    <td className={dias >= 5 && !["GANHO", "PERDIDO"].includes(n.estagio) ? "is-alerta" : ""}>
                      {desdeQuando(n.ultimoContatoEm || n.createdAt)}
                      <span className="flow-tabela__sub">{canalRotulo(n.canal)}</span>
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
