import { useEffect, useState } from "react";
import { adminApi } from "../../api";
import { Alert, Button, Eyebrow, Reveal } from "../../styles/omnimobKit";

/* ────────────────────────────────────────────────────────────────────────────
   AVALIAÇÕES — o que os usuários das imobiliárias acham do painel.

   Porte da aba do VYA. As mais recentes primeiro, paginadas no servidor, com a
   média e a distribuição do filtro, e o total de NÃO LIDAS de todos os
   clientes, que acende o contador do menu. Abrir a aba não marca nada como
   lido: é o botão de cada uma, ou "todas".

   `tenantId` filtra um cliente (o cliente em foco do painel).
   ──────────────────────────────────────────────────────────────────────────── */

const estrelas = (n) => "★".repeat(n) + "☆".repeat(5 - n);
const COR = { 1: "#f87171", 2: "#fb923c", 3: "#fbbf24", 4: "#a3e635", 5: "#34d399" };

export function AdminAvaliacoesPage({ aoContar, tenantId = "" }) {
  const [dados, setDados] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [filtros, setFiltros] = useState({ nota: "", naoLidas: false });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  async function carregar() {
    setCarregando(true);
    setErro("");
    try {
      const r = await adminApi.listAvaliacoes({ ...filtros, naoLidas: filtros.naoLidas ? "1" : "", tenantId, page: pagina });
      setDados(r);
      aoContar?.(r.naoLidas);
    } catch (e) {
      setErro(e.message || "Erro ao carregar as avaliações.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, [pagina, filtros, tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function marcar(ids) {
    try {
      await adminApi.marcarAvaliacoesLidas(ids);
      await carregar();
    } catch (e) {
      setErro(e.message || "Erro ao marcar como lida.");
    }
  }

  const mudar = (campo, valor) => {
    setPagina(1);
    setFiltros((f) => ({ ...f, [campo]: valor }));
  };
  const paginas = dados ? Math.max(1, Math.ceil(dados.total / (dados.limit || 30))) : 1;
  const totalDistribuicao = dados ? Object.values(dados.distribuicao).reduce((s, n) => s + n, 0) : 0;

  return (
    <>
      <Reveal className="sa-head">
        <Eyebrow>AVALIAÇÕES</Eyebrow>
        <h1 className="dl-h2 sa-title">
          <span className="dl-h2__strong">O que os usuários acham</span>
          <span className="dl-h2__soft">do painel da Omnimob.</span>
        </h1>
      </Reveal>

      {dados ? (
        <div className="av-resumo">
          <div className="av-media">
            <strong>{dados.media != null ? dados.media.toFixed(1).replace(".", ",") : "—"}</strong>
            <span className="dl-mono">média · {totalDistribuicao} respostas</span>
          </div>
          <div className="av-barras">
            {[5, 4, 3, 2, 1].map((n) => {
              const q = dados.distribuicao[n] || 0;
              const pct = totalDistribuicao ? Math.round((q / totalDistribuicao) * 100) : 0;
              return (
                <button
                  key={n}
                  type="button"
                  className={`av-barra${String(n) === filtros.nota ? " is-on" : ""}`}
                  onClick={() => mudar("nota", String(n) === filtros.nota ? "" : String(n))}
                  title={String(n) === filtros.nota ? "Mostrar todas as notas" : `Só as de ${n} estrela${n > 1 ? "s" : ""}`}
                >
                  <span className="av-barra__n">{n}★</span>
                  <span className="av-barra__trilho"><span style={{ width: `${pct}%`, background: COR[n] }} /></span>
                  <span className="dl-mono av-barra__q">{q}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="sa-bar">
        <label className="av-check">
          <input type="checkbox" checked={filtros.naoLidas} onChange={(e) => mudar("naoLidas", e.target.checked)} />
          Só as não lidas{dados ? ` (${dados.naoLidas})` : ""}
        </label>
        {dados?.naoLidas ? (
          <Button as="button" type="button" variant="outline" className="dl-btn--sm" arrow={false} onClick={() => marcar(null)}>
            Marcar todas como lidas
          </Button>
        ) : null}
        <Button as="button" type="button" variant="ghost" className="dl-btn--sm" arrow={false} onClick={carregar}>
          Atualizar
        </Button>
      </div>

      {erro ? <Alert tone="danger">{erro}</Alert> : null}
      {carregando && !dados ? <p className="dl-mono sa-loading">// lendo as avaliações…</p> : null}
      {dados && !dados.avaliacoes.length ? (
        <div className="sa-empty">
          <p className="sa-empty__title">Nenhuma avaliação {filtros.nota || filtros.naoLidas ? "neste filtro" : "ainda"}</p>
          <p className="sa-empty__desc">O pedido aparece no painel do cliente a cada 5 operações, uma vez por pessoa.</p>
        </div>
      ) : null}

      <div className="sa-list">
        {(dados?.avaliacoes || []).map((a) => (
          <div key={a.id} className={`av-item${a.lidaEm ? "" : " is-nova"}`}>
            <div className="av-item__topo">
              <span className="av-estrelas" style={{ color: COR[a.nota] }} aria-label={`${a.nota} de 5`}>{estrelas(a.nota)}</span>
              <strong className="av-item__quem">{a.usuarioNome || "—"}</strong>
              <span className="dl-mono av-item__onde">{a.tenant?.name || "?"} · /{a.tenant?.slug}{a.tela ? ` · ${a.tela}` : ""}</span>
              <span className="dl-mono av-item__quando">{new Date(a.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
              {a.lidaEm ? null : (
                <button type="button" className="av-lida" onClick={() => marcar([a.id])}>Marcar como lida</button>
              )}
            </div>
            {a.comentario ? <p className="av-item__texto">“{a.comentario}”</p> : null}
          </div>
        ))}
      </div>

      {paginas > 1 ? (
        <div className="au-paginas">
          <Button as="button" type="button" variant="ghost" className="dl-btn--sm" arrow={false} disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
          <span className="dl-mono">página {pagina} de {paginas}</span>
          <Button as="button" type="button" variant="ghost" className="dl-btn--sm" arrow={false} disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>Próxima</Button>
        </div>
      ) : null}
    </>
  );
}

export const AVALIACOES_CSS = `
.av-resumo { display: flex; gap: 28px; flex-wrap: wrap; align-items: center; margin: 4px 0 18px; padding: 16px 20px; border-radius: 16px; background: var(--surface); border: 1px solid var(--line); }
.av-media { display: grid; gap: 4px; }
.av-media strong { font-size: 34px; font-weight: 800; letter-spacing: -0.03em; color: var(--strong); }
.av-media span { color: var(--placeholder); font-size: 9px; text-transform: none; }
.av-barras { display: grid; gap: 4px; flex: 1 1 280px; max-width: 460px; }
.dl-root .av-barra {
  display: flex; align-items: center; gap: 10px; padding: 2px 6px; border-radius: 8px; cursor: pointer;
  background: none; border: 1px solid transparent; box-shadow: none; transform: none; font-family: inherit; color: var(--subtle);
}
.dl-root .av-barra:hover { background: var(--bg-alt); box-shadow: none; transform: none; }
.dl-root .av-barra.is-on { border-color: var(--line); background: var(--bg-alt); }
.av-barra__n { width: 26px; font-size: 12px; text-align: right; }
.av-barra__trilho { flex: 1; height: 6px; border-radius: 999px; background: rgba(255,255,255,0.07); overflow: hidden; display: block; }
.av-barra__trilho span { display: block; height: 100%; border-radius: 999px; }
.av-barra__q { width: 30px; font-size: 9.5px; text-transform: none; }
.av-check { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--subtle); cursor: pointer; }
.av-item { padding: 14px 18px; border-radius: 14px; background: var(--surface); border: 1px solid var(--line); }
.av-item.is-nova { border-color: rgba(212,175,55,0.45); }
.av-item__topo { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.av-estrelas { font-size: 15px; letter-spacing: 1px; }
.av-item__quem { font-size: 13.5px; color: var(--strong); }
.av-item__onde, .av-item__quando { color: var(--placeholder); font-size: 9px; text-transform: none; }
.av-item__quando { margin-left: auto; }
.av-item__texto { margin: 10px 0 0; font-size: 13.5px; line-height: 1.55; color: var(--default); white-space: pre-wrap; }
.dl-root .av-lida {
  font-family: inherit; font-size: 11.5px; color: var(--accent-soft); background: none; border: none; padding: 0; cursor: pointer; box-shadow: none; transform: none;
}
.dl-root .av-lida:hover { text-decoration: underline; background: none; box-shadow: none; transform: none; }
`;

export default AdminAvaliacoesPage;
