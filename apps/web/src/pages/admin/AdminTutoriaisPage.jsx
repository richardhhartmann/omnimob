import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../../api";
import { Alert, Button, Eyebrow, Reveal } from "../../styles/domusKit";
import { chavesDoFluxo, montarFluxoTour } from "../../utils/tourFluxo";
import { chavesDasTelas } from "../../utils/tourTelas";

/* ────────────────────────────────────────────────────────────────────────────
   Quanto do tutorial cada pessoa percorreu.

   O CÁLCULO É FEITO AQUI, e não na API, porque o denominador depende do fluxo
   declarado em `utils/tourFluxo.js` — que por sua vez depende das permissões do
   cargo. Um corretor que não enxerga Leads nem Cargos tem um tour mais curto, e
   medi-lo contra o roteiro do administrador diria "40%" para quem viu tudo que
   existia para ele. A API manda o cargo junto justamente para isto.

   DUAS MEDIDAS, porque são duas coisas diferentes:

     apresentação — o tour global do primeiro acesso, que passa por todas as
                    telas. É o que todo mundo deveria ter visto.
     aulas        — os tours de tela, que só abrem quando a pessoa entra naquela
                    tela por vontade própria. Zero aqui não é abandono: é alguém
                    que ainda não precisou cadastrar um imóvel.

   `PULADO` conta como resolvido, não como concluído. Quem pulou decidiu — e
   misturar isso com quem terminou esconderia exatamente o que a métrica existe
   para mostrar.
   ──────────────────────────────────────────────────────────────────────────── */

function medir(chavesEsperadas, porEtapa) {
  const total = chavesEsperadas.length;
  let finalizadas = 0;
  let puladas = 0;
  for (const chave of chavesEsperadas) {
    const status = porEtapa.get(chave);
    if (status === "FINALIZADO") finalizadas += 1;
    else if (status === "PULADO") puladas += 1;
  }
  return {
    total,
    finalizadas,
    puladas,
    pct: total ? Math.round((finalizadas / total) * 100) : 0,
  };
}

function analisarUsuario(usuario, tenantSlug) {
  const porEtapa = new Map((usuario.etapas || []).map((e) => [e.etapa, e.status]));

  // O fluxo global já sai filtrado pelas permissões deste cargo.
  const fluxo = montarFluxoTour({ cargo: usuario.cargo, tenantSlug });
  const apresentacao = medir(chavesDoFluxo(fluxo), porEtapa);
  const aulas = medir(chavesDasTelas(), porEtapa);

  const total = apresentacao.total + aulas.total;
  const finalizadas = apresentacao.finalizadas + aulas.finalizadas;

  // Onde a pessoa parou: a última etapa que ela abriu e não terminou.
  const emAndamento = (usuario.etapas || []).find((e) => e.status === "EM_ANDAMENTO");

  return {
    apresentacao,
    aulas,
    geral: total ? Math.round((finalizadas / total) * 100) : 0,
    tocou: (usuario.etapas || []).length > 0,
    emAndamento,
  };
}

function corDoProgresso(pct) {
  if (pct >= 80) return "#34d399";
  if (pct >= 40) return "#d4af37";
  if (pct > 0) return "#fbbf24";
  return "#55555f";
}

function Barra({ pct, titulo }) {
  return (
    <span className="tt-barra" title={titulo} role="img" aria-label={titulo}>
      <span className="tt-barra__cheio" style={{ width: `${pct}%`, background: corDoProgresso(pct) }} />
    </span>
  );
}

export function AdminTutoriaisPage() {
  const [tenants, setTenants] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(null); // id do tenant expandido

  async function carregar() {
    setCarregando(true);
    setErro("");
    try {
      setTenants(await adminApi.listTutoriais());
    } catch (e) {
      setErro(e.message || "Erro ao carregar o progresso.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  const analisados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return tenants
      .map((t) => {
        const usuarios = t.usuarios.map((u) => ({ ...u, analise: analisarUsuario(u, t.slug) }));
        /* A média do tenant é a média simples dos usuários ATIVOS — a API já
           filtra os inativos. Ponderar por etapas daria mais peso ao cargo com
           mais permissões, e o que se quer saber aqui é "a equipe entendeu o
           sistema?", uma pessoa uma resposta. */
        const media = usuarios.length
          ? Math.round(usuarios.reduce((s, u) => s + u.analise.geral, 0) / usuarios.length)
          : 0;
        const intocados = usuarios.filter((u) => !u.analise.tocou).length;
        return { ...t, usuarios, media, intocados };
      })
      .filter((t) => {
        if (!q) return true;
        return [t.nome, t.slug, ...t.usuarios.map((u) => u.nome)]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(q));
      });
  }, [tenants, busca]);

  const totalUsuarios = analisados.reduce((s, t) => s + t.usuarios.length, 0);
  const mediaGeral = totalUsuarios
    ? Math.round(
        analisados.reduce((s, t) => s + t.usuarios.reduce((x, u) => x + u.analise.geral, 0), 0) / totalUsuarios,
      )
    : 0;

  return (
    <>
      <Reveal className="sa-head">
        <Eyebrow>ADOÇÃO</Eyebrow>
        <h1 className="dl-h2 sa-title">
          <span className="dl-h2__strong">Progresso do tutorial</span>
          <span className="dl-h2__soft">por imobiliária e por pessoa.</span>
        </h1>
      </Reveal>

      <p className="dl-mono dl-note sa-note">
        // {totalUsuarios} usuários ativos · {mediaGeral}% de conclusão média
      </p>

      <div className="sa-bar">
        <input
          className="dl-input sa-search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar imobiliária ou pessoa…"
        />
        <Button as="button" type="button" variant="ghost" className="dl-btn--sm" arrow={false} onClick={carregar}>
          Atualizar
        </Button>
      </div>

      {erro ? <Alert tone="danger">{erro}</Alert> : null}
      {carregando ? <p className="dl-mono sa-loading">// medindo progresso…</p> : null}

      {!carregando && analisados.length === 0 ? (
        <div className="sa-empty">
          <p className="sa-empty__title">Nada para medir</p>
          <p className="sa-empty__desc">Nenhuma imobiliária com usuários ativos encontrada.</p>
        </div>
      ) : null}

      <div className="sa-list">
        {analisados.map((t, i) => {
          const expandido = aberto === t.id;
          return (
            <Reveal key={t.id} className="tt-card" delay={Math.min(i, 8) * 45}>
              <button
                type="button"
                className="tt-topo"
                onClick={() => setAberto(expandido ? null : t.id)}
                aria-expanded={expandido}
              >
                <span className="tt-nome">{t.nome}</span>
                <span className="dl-mono tt-slug">/{t.slug}</span>
                <Barra pct={t.media} titulo={`${t.media}% de conclusão média`} />
                <strong className="tt-pct" style={{ color: corDoProgresso(t.media) }}>{t.media}%</strong>
                <span className="dl-mono tt-qtd">
                  {t.usuarios.length} {t.usuarios.length === 1 ? "pessoa" : "pessoas"}
                  {t.intocados ? ` · ${t.intocados} sem começar` : ""}
                </span>
                <span className={`ch-seta${expandido ? " is-on" : ""}`} aria-hidden="true">▾</span>
              </button>

              {expandido ? (
                <div className="tt-usuarios">
                  {t.usuarios.length === 0 ? (
                    <p className="dl-mono ch-sem-print">// nenhum usuário ativo</p>
                  ) : (
                    t.usuarios.map((u) => {
                      const a = u.analise;
                      return (
                        <div key={u.id} className="tt-linha">
                          <div className="tt-linha__quem">
                            <span className="tt-linha__nome">{u.nome}</span>
                            <span className="dl-mono tt-linha__cargo">
                              {u.cargo?.descricao || "sem cargo"} · @{u.login}
                            </span>
                          </div>

                          <div className="tt-linha__medidas">
                            <div className="tt-medida">
                              <span className="dl-mono tt-medida__rotulo">APRESENTAÇÃO</span>
                              <Barra pct={a.apresentacao.pct} titulo={`${a.apresentacao.finalizadas} de ${a.apresentacao.total} etapas`} />
                              <span className="tt-medida__num">
                                {a.apresentacao.finalizadas}/{a.apresentacao.total}
                                {a.apresentacao.puladas ? <em> · {a.apresentacao.puladas} pulada{a.apresentacao.puladas === 1 ? "" : "s"}</em> : null}
                              </span>
                            </div>

                            <div className="tt-medida">
                              <span className="dl-mono tt-medida__rotulo">AULAS DE TELA</span>
                              <Barra pct={a.aulas.pct} titulo={`${a.aulas.finalizadas} de ${a.aulas.total} telas`} />
                              <span className="tt-medida__num">
                                {a.aulas.finalizadas}/{a.aulas.total}
                                {a.aulas.puladas ? <em> · {a.aulas.puladas} pulada{a.aulas.puladas === 1 ? "" : "s"}</em> : null}
                              </span>
                            </div>
                          </div>

                          <div className="tt-linha__geral">
                            <strong style={{ color: corDoProgresso(a.geral) }}>{a.geral}%</strong>
                            {!a.tocou ? (
                              <span className="dl-mono tt-linha__aviso">nunca abriu</span>
                            ) : a.emAndamento ? (
                              <span className="dl-mono tt-linha__aviso">
                                parou em {a.emAndamento.etapa}
                                {a.emAndamento.passoParou ? ` (${a.emAndamento.passoParou}/${a.emAndamento.totalPassos || "?"})` : ""}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : null}
            </Reveal>
          );
        })}
      </div>
    </>
  );
}

export const TUTORIAIS_CSS = `
.tt-card {
  padding: 16px 20px; border-radius: 16px;
  background: var(--surface); border: 1px solid var(--line);
  transition: border-color 0.2s ease, transform 0.85s var(--ease-out), opacity 0.85s var(--ease-out);
}
.tt-card:hover { border-color: #34343c; }

.dl-root .tt-topo {
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap; width: 100%; text-align: left;
  padding: 0; background: none; border: none; box-shadow: none; transform: none; cursor: pointer;
  font-family: inherit; color: inherit;
}
.dl-root .tt-topo:hover { background: none; box-shadow: none; transform: none; }
.tt-nome { font-size: 15px; font-weight: 700; color: var(--strong); letter-spacing: -0.025em; }
.tt-slug { color: var(--placeholder); font-size: 9.5px; text-transform: none; }
.tt-pct { font-size: 14px; font-weight: 800; letter-spacing: -0.02em; flex-shrink: 0; min-width: 42px; text-align: right; }
.tt-qtd { color: var(--placeholder); font-size: 9px; text-transform: none; letter-spacing: 0.05em; margin-left: auto; }

.tt-barra {
  flex: 1 1 120px; min-width: 90px; max-width: 260px; height: 5px;
  border-radius: 999px; background: rgba(255,255,255,0.07); overflow: hidden; display: block;
}
.tt-barra__cheio { display: block; height: 100%; border-radius: 999px; transition: width 0.4s ease; }

.tt-usuarios { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--line-soft); display: grid; gap: 2px; }
.tt-linha {
  display: flex; align-items: center; gap: 18px; flex-wrap: wrap;
  padding: 12px 12px; border-radius: 11px;
  transition: background 0.15s ease;
}
.tt-linha:hover { background: var(--bg-alt); }
.tt-linha__quem { display: grid; gap: 3px; min-width: 170px; flex: 1 1 170px; }
.tt-linha__nome { font-size: 13.5px; font-weight: 600; color: var(--default); }
.tt-linha__cargo { color: var(--placeholder); font-size: 8.5px; text-transform: none; letter-spacing: 0.05em; }

.tt-linha__medidas { display: flex; gap: 22px; flex-wrap: wrap; flex: 2 1 320px; }
.tt-medida { display: grid; gap: 5px; flex: 1 1 140px; min-width: 130px; }
.tt-medida__rotulo { color: #55555f; font-size: 8px; letter-spacing: 0.14em; }
.tt-medida__num { font-size: 11px; color: var(--subtle); font-variant-numeric: tabular-nums; }
.tt-medida__num em { font-style: normal; color: var(--placeholder); }

.tt-linha__geral { display: grid; gap: 3px; justify-items: flex-end; text-align: right; min-width: 96px; }
.tt-linha__geral strong { font-size: 16px; font-weight: 800; letter-spacing: -0.02em; }
.tt-linha__aviso { color: var(--placeholder); font-size: 8px; text-transform: none; letter-spacing: 0.05em; }

@media (max-width: 780px) {
  .tt-linha { align-items: flex-start; }
  .tt-linha__geral { justify-items: flex-start; text-align: left; }
}
`;

export default AdminTutoriaisPage;
