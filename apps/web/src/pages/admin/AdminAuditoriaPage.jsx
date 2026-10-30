import { useEffect, useState } from "react";
import { adminApi } from "../../api";
import { Alert, Button, Eyebrow, Reveal } from "../../styles/omnimobKit";
import { ACOES, camposAlterados, horaCompleta, quando } from "../AuditoriaPage";

/* ────────────────────────────────────────────────────────────────────────────
   AUDITORIA DA PLATAFORMA — quem da Omnimob mexeu em quê.

   São as linhas da `Auditoria` com `tenantId` nulo: usuários e cargos deste
   painel, e as imobiliárias criadas, editadas ou excluídas por ele. A régua de leitura (ação, campos, "há 3 min") é a da trilha da
   imobiliária, importada de `AuditoriaPage` — duas telas de trilha com dois
   jeitos de dizer "alterou" seriam um lugar a mais para divergir.

   As chaves de permissão aparecem com o nome que a aba Cargos usa, pelo mesmo
   catálogo (`catalogo`, do `GET /api/admin/eu`).
   ──────────────────────────────────────────────────────────────────────────── */

const ENTIDADES = {
  SuperAdmin: "usuário da plataforma",
  CargoSuperAdmin: "cargo da plataforma",
  Tenant: "imobiliária",
};

function rotulosDoCatalogo(catalogo) {
  const mapa = {};
  for (const aba of catalogo || []) {
    mapa[aba.chave] = `Ver ${aba.rotulo}`;
    for (const acao of aba.acoes || []) mapa[acao.chave] = acao.rotulo;
  }
  return mapa;
}

export function AdminAuditoriaPage({ catalogo }) {
  const [dados, setDados] = useState({ registros: [], total: 0, limit: 40, usuarios: [] });
  const [pagina, setPagina] = useState(1);
  const [filtros, setFiltros] = useState({ usuarioId: "", acao: "", busca: "" });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState(null);
  const rotulos = rotulosDoCatalogo(catalogo);

  async function carregar() {
    setCarregando(true);
    setErro("");
    try {
      setDados(await adminApi.listAuditoria({ ...filtros, page: pagina }));
    } catch (e) {
      setErro(e.message || "Erro ao carregar a trilha.");
    } finally {
      setCarregando(false);
    }
  }

  // A busca espera a digitação parar; os outros filtros valem na hora.
  useEffect(() => {
    const t = setTimeout(carregar, filtros.busca ? 350 : 0);
    return () => clearTimeout(t);
  }, [pagina, filtros]); // eslint-disable-line react-hooks/exhaustive-deps

  const mudar = (campo) => (e) => {
    setPagina(1);
    setFiltros((f) => ({ ...f, [campo]: e.target.value }));
  };
  const paginas = Math.max(1, Math.ceil(dados.total / (dados.limit || 40)));

  return (
    <>
      <Reveal className="sa-head">
        <Eyebrow>AUDITORIA</Eyebrow>
        <h1 className="dl-h2 sa-title">
          <span className="dl-h2__strong">Quem fez o quê</span>
          <span className="dl-h2__soft">neste painel, e quando.</span>
        </h1>
      </Reveal>

      <p className="dl-mono dl-note sa-note">// usuários, cargos e imobiliárias mexidos pela equipe da Omnimob · {dados.total} registros</p>

      <div className="sa-bar">
        <input className="dl-input sa-search" value={filtros.busca} onChange={mudar("busca")} placeholder="Buscar por nome ou registro…" />
        <select className="dl-input au-select" value={filtros.usuarioId} onChange={mudar("usuarioId")} aria-label="Pessoa">
          <option value="">Todas as pessoas</option>
          {dados.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome} ({u.total})</option>)}
        </select>
        <select className="dl-input au-select" value={filtros.acao} onChange={mudar("acao")} aria-label="Ação">
          <option value="">Todas as ações</option>
          {Object.entries(ACOES).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
        </select>
        <Button as="button" type="button" variant="ghost" className="dl-btn--sm" arrow={false} onClick={carregar}>
          Atualizar
        </Button>
      </div>

      {erro ? <Alert tone="danger">{erro}</Alert> : null}
      {carregando && !dados.registros.length ? <p className="dl-mono sa-loading">// lendo a trilha…</p> : null}
      {!carregando && !dados.registros.length && !erro ? (
        <div className="sa-empty">
          <p className="sa-empty__title">Nada registrado</p>
          <p className="sa-empty__desc">Criar ou alterar um usuário, um cargo ou uma imobiliária neste painel deixa uma linha aqui.</p>
        </div>
      ) : null}

      <ul className="au-lista">
        {dados.registros.map((r) => {
          const meta = ACOES[r.acao] || { rotulo: r.acao, cor: "#64748b" };
          const campos = camposAlterados(r.dados);
          const expandido = aberto === r.id;
          return (
            <li key={r.id} className="au-item">
              <button type="button" className="au-linha" onClick={() => setAberto(expandido ? null : r.id)} aria-expanded={expandido} title={horaCompleta(r.createdAt)}>
                <span className="au-ponto" style={{ background: meta.cor }} aria-hidden="true" />
                <span className="au-texto">
                  <strong>{r.usuarioNome || "Sistema"}</strong>{" "}
                  <span style={{ color: meta.cor, fontWeight: 600 }}>{meta.rotulo.toLowerCase()}</span>{" "}
                  {ENTIDADES[r.entidade] || r.entidade}
                  {r.resumo ? <> — <em>{r.resumo}</em></> : null}
                </span>
                <span className="dl-mono au-quando">{quando(r.createdAt)}</span>
              </button>
              {expandido ? (
                <div className="au-detalhe">
                  <p className="dl-mono au-ficha">
                    {horaCompleta(r.createdAt)}{r.rota ? ` · ${r.rota}` : ""}{r.ip ? ` · IP ${r.ip}` : ""}
                  </p>
                  {campos.length ? (
                    <ul className="au-campos">
                      {campos.map((c) => (
                        <li key={c.campo}>
                          <span>{rotulos[c.campo] || c.campo}</span>
                          <strong>{c.texto === "true" ? "sim" : c.texto === "false" ? "não" : c.texto}</strong>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {paginas > 1 ? (
        <div className="au-paginas">
          <Button as="button" type="button" variant="ghost" className="dl-btn--sm" arrow={false} disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
            Anterior
          </Button>
          <span className="dl-mono">página {pagina} de {paginas}</span>
          <Button as="button" type="button" variant="ghost" className="dl-btn--sm" arrow={false} disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>
            Próxima
          </Button>
        </div>
      ) : null}
    </>
  );
}

export const AUDITORIA_CSS = `
.au-select { max-width: 220px; }
.au-lista { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.au-item { border-radius: 12px; background: var(--surface); border: 1px solid var(--line); }
.dl-root .au-linha {
  display: flex; align-items: center; gap: 12px; width: 100%; text-align: left;
  padding: 12px 16px; background: none; border: none; box-shadow: none; transform: none; cursor: pointer;
  font-family: inherit; font-size: 13px; color: var(--default);
}
.dl-root .au-linha:hover { background: none; box-shadow: none; transform: none; }
.au-ponto { width: 8px; height: 8px; border-radius: 999px; flex-shrink: 0; }
.au-texto { flex: 1; min-width: 0; }
.au-texto em { color: var(--subtle); }
.au-quando { color: var(--placeholder); font-size: 9px; text-transform: none; flex-shrink: 0; }
.au-detalhe { padding: 0 16px 14px 36px; display: grid; gap: 8px; }
.au-ficha { color: var(--placeholder); font-size: 9px; text-transform: none; letter-spacing: 0.04em; }
.au-campos { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.au-campos li { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; color: var(--subtle); }
.au-campos strong { color: var(--default); font-weight: 600; overflow-wrap: anywhere; text-align: right; }
.au-paginas { display: flex; align-items: center; justify-content: center; gap: 14px; margin-top: 16px; color: var(--placeholder); font-size: 10px; }
`;

export default AdminAuditoriaPage;
