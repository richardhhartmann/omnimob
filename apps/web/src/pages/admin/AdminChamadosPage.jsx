import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../../api";
import { Alert, Button, Eyebrow, Reveal } from "../../styles/domusKit";

/* ────────────────────────────────────────────────────────────────────────────
   Caixa de entrada do suporte.

   Ordem: abertos primeiro, depois por data — a mesma que a API devolve. Não
   ordenamos por prioridade na frente porque a prioridade não é escolhida pela
   pessoa que abriu (ver `prioridadeDaCategoria` em utils/suporte.js): ela é
   derivada da categoria, e serve para colorir, não para furar fila. O que fura
   fila é estar aberto há mais tempo.
   ──────────────────────────────────────────────────────────────────────────── */

const PRIORIDADE_META = {
  URGENTE: { label: "Urgente", cor: "#fca5a5", fundo: "rgba(248,113,113,0.14)", borda: "rgba(248,113,113,0.32)" },
  ALTA:    { label: "Alta",    cor: "#fbbf24", fundo: "rgba(251,191,36,0.12)",  borda: "rgba(251,191,36,0.30)" },
  MEDIA:   { label: "Média",   cor: "#a5b4fc", fundo: "rgba(129,140,248,0.12)", borda: "rgba(129,140,248,0.28)" },
  BAIXA:   { label: "Baixa",   cor: "#94a3b8", fundo: "rgba(148,163,184,0.10)", borda: "rgba(148,163,184,0.24)" },
};

const CATEGORIA_ROTULO = {
  duvida: "Dúvida de uso",
  problema: "Algo não funciona",
  cobranca: "Plano e cobrança",
  sugestao: "Sugestão",
};

const FILTROS = [
  { chave: "abertos", rotulo: "Abertos" },
  { chave: "resolvidos", rotulo: "Resolvidos" },
  { chave: "todos", rotulo: "Todos" },
];

function quando(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const dias = Math.floor((Date.now() - d.getTime()) / 86400000);
  const data = d.toLocaleDateString("pt-BR");
  if (dias <= 0) return `hoje · ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  if (dias === 1) return `ontem · ${data}`;
  return `há ${dias} dias · ${data}`;
}

export function AdminChamadosPage({ aoContarAbertos }) {
  const [chamados, setChamados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState("abertos");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(null);   // número do chamado expandido
  const [salvando, setSalvando] = useState(0);

  async function carregar() {
    setCarregando(true);
    setErro("");
    try {
      // Busca sempre TUDO e filtra na tela: são no máximo 300 registros, e
      // assim trocar de filtro é instantâneo em vez de uma ida ao servidor.
      const lista = await adminApi.listChamados();
      setChamados(lista);
      aoContarAbertos?.(lista.filter((c) => !c.resolvido).length);
    } catch (e) {
      setErro(e.message || "Erro ao carregar os chamados.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return chamados.filter((c) => {
      if (filtro === "abertos" && c.resolvido) return false;
      if (filtro === "resolvidos" && !c.resolvido) return false;
      if (!q) return true;
      return [c.titulo, c.descricao, c.tenantNome, c.tenantSlug, c.usuario, String(c.numero)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [chamados, filtro, busca]);

  const abertos = chamados.filter((c) => !c.resolvido).length;

  async function alternarResolvido(c) {
    setSalvando(c.numero);
    try {
      const r = await adminApi.atualizarChamado(c.numero, { resolvido: !c.resolvido });
      setChamados((prev) => {
        const proximo = prev.map((x) => (x.numero === c.numero ? { ...x, ...r } : x));
        aoContarAbertos?.(proximo.filter((x) => !x.resolvido).length);
        return proximo;
      });
    } catch (e) {
      setErro(e.message || "Não foi possível atualizar.");
    } finally {
      setSalvando(0);
    }
  }

  return (
    <>
      <Reveal className="sa-head">
        <Eyebrow>SUPORTE</Eyebrow>
        <h1 className="dl-h2 sa-title">
          <span className="dl-h2__strong">Chamados</span>
          <span className="dl-h2__soft">abertos pelas imobiliárias.</span>
        </h1>
      </Reveal>

      <p className="dl-mono dl-note sa-note">
        // {abertos} aberto{abertos === 1 ? "" : "s"} · {chamados.length} no total
      </p>

      <div className="sa-bar">
        <input
          className="dl-input sa-search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por número, título, imobiliária ou quem abriu…"
        />
        <div className="ch-filtros">
          {FILTROS.map((f) => (
            <button
              key={f.chave}
              type="button"
              className={`ch-filtro${filtro === f.chave ? " is-on" : ""}`}
              onClick={() => setFiltro(f.chave)}
            >
              {f.rotulo}
            </button>
          ))}
        </div>
        <Button as="button" type="button" variant="ghost" className="dl-btn--sm" arrow={false} onClick={carregar}>
          Atualizar
        </Button>
      </div>

      {erro ? <Alert tone="danger">{erro}</Alert> : null}
      {carregando ? <p className="dl-mono sa-loading">// carregando chamados…</p> : null}

      {!carregando && visiveis.length === 0 ? (
        <div className="sa-empty">
          <p className="sa-empty__title">
            {filtro === "abertos" ? "Nenhum chamado aberto" : "Nenhum chamado encontrado"}
          </p>
          <p className="sa-empty__desc">
            {filtro === "abertos"
              ? "A fila está limpa. Os chamados chegam pelo botão de Ajuda dentro do painel das imobiliárias."
              : "Ajuste a busca ou troque o filtro."}
          </p>
        </div>
      ) : null}

      <div className="sa-list">
        {visiveis.map((c, i) => {
          const pm = PRIORIDADE_META[c.prioridade] || PRIORIDADE_META.MEDIA;
          const expandido = aberto === c.numero;
          return (
            <Reveal key={c.numero} className={`ch-card${c.resolvido ? " is-resolvido" : ""}`} delay={Math.min(i, 8) * 45}>
              <button
                type="button"
                className="ch-topo"
                onClick={() => setAberto(expandido ? null : c.numero)}
                aria-expanded={expandido}
              >
                <span className="dl-mono ch-numero">#{c.numero}</span>
                <span className="ch-titulo">{c.titulo}</span>
                <span className="dl-pill" style={{ background: pm.fundo, color: pm.cor, borderColor: pm.borda }}>
                  {pm.label}
                </span>
                {c.resolvido ? (
                  <span className="dl-pill ch-pill--ok">Resolvido</span>
                ) : null}
                <span className="dl-mono ch-quando">{quando(c.criadoEm)}</span>
                <span className={`ch-seta${expandido ? " is-on" : ""}`} aria-hidden="true">▾</span>
              </button>

              <dl className="sa-meta ch-meta">
                <div><dt className="dl-mono">IMOBILIÁRIA</dt><dd>{c.tenantNome}</dd></div>
                <div><dt className="dl-mono">QUEM ABRIU</dt><dd>{c.usuario}</dd></div>
                <div><dt className="dl-mono">CATEGORIA</dt><dd>{CATEGORIA_ROTULO[c.categoria] || c.categoria}</dd></div>
                <div><dt className="dl-mono">TELA</dt><dd>{c.rota || "—"}</dd></div>
              </dl>

              {expandido ? (
                <div className="ch-corpo">
                  <p className="ch-descricao">{c.descricao}</p>

                  {c.prints?.length ? (
                    <div className="ch-prints">
                      {c.prints.map((url, n) => (
                        // Abre em aba nova em vez de lightbox: quem está
                        // atendendo quer a imagem em tamanho real, ao lado do
                        // painel, não sobreposta a ele.
                        <a key={url} href={url} target="_blank" rel="noreferrer" className="ch-print" title={`Print ${n + 1}`}>
                          <img src={url} alt={`Print ${n + 1} do chamado ${c.numero}`} />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="dl-mono ch-sem-print">// sem prints anexados</p>
                  )}

                  <div className="ch-acoes">
                    {c.tenantSlug ? (
                      <Button href={`/vitrine/${c.tenantSlug}`} target="_blank" rel="noreferrer" variant="ghost" className="dl-btn--sm" arrow={false}>
                        Ver vitrine
                      </Button>
                    ) : null}
                    <Button
                      as="button"
                      type="button"
                      variant={c.resolvido ? "outline" : "primary"}
                      className="dl-btn--sm"
                      arrow={false}
                      disabled={salvando === c.numero}
                      onClick={() => alternarResolvido(c)}
                    >
                      {salvando === c.numero
                        ? "Salvando…"
                        : c.resolvido ? "Reabrir chamado" : "Marcar como resolvido"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </Reveal>
          );
        })}
      </div>
    </>
  );
}

export const CHAMADOS_CSS = `
.ch-filtros { display: flex; gap: 4px; padding: 3px; border-radius: 11px; background: var(--bg-alt); border: 1px solid var(--line); }
.dl-root .ch-filtro {
  width: auto; padding: 7px 13px; border-radius: 8px; border: none; cursor: pointer;
  font-family: inherit; font-size: 12.5px; font-weight: 600;
  background: transparent; color: var(--placeholder); box-shadow: none; transform: none;
  transition: background 0.15s ease, color 0.15s ease;
}
.dl-root .ch-filtro:hover { color: var(--default); background: var(--surface); box-shadow: none; transform: none; }
.dl-root .ch-filtro.is-on { background: rgba(99,102,241,0.20); color: var(--strong); }

.ch-card {
  padding: 16px 20px; border-radius: 16px;
  background: var(--surface); border: 1px solid var(--line);
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.85s var(--ease-out), opacity 0.85s var(--ease-out);
}
.ch-card:hover { border-color: #34343c; }
/* Resolvido continua legível, só recua: a lista é histórico, não lixeira. */
.ch-card.is-resolvido { opacity: 0.62; }
.ch-card.is-resolvido:hover { opacity: 1; }

.dl-root .ch-topo {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap; width: 100%; text-align: left;
  padding: 0; background: none; border: none; box-shadow: none; transform: none; cursor: pointer;
  font-family: inherit; color: inherit;
}
.dl-root .ch-topo:hover { background: none; box-shadow: none; transform: none; }
.ch-numero { color: var(--gold); font-size: 10px; letter-spacing: 0.06em; flex-shrink: 0; }
.ch-titulo { font-size: 14.5px; font-weight: 700; color: var(--strong); letter-spacing: -0.02em; flex: 1; min-width: 160px; }
.ch-pill--ok { background: rgba(52,211,153,0.14); color: #86efac; border-color: rgba(52,211,153,0.30); }
.ch-quando { color: var(--placeholder); font-size: 9px; text-transform: none; letter-spacing: 0.05em; flex-shrink: 0; }
.ch-seta { color: var(--placeholder); font-size: 11px; transition: transform 0.2s ease; flex-shrink: 0; }
.ch-seta.is-on { transform: rotate(180deg); }

.ch-meta { margin-top: 12px; gap: 22px; }

.ch-corpo { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--line-soft); display: grid; gap: 14px; }
.ch-descricao { font-size: 13.5px; line-height: 1.75; color: var(--default); white-space: pre-wrap; margin: 0; }
.ch-prints { display: flex; flex-wrap: wrap; gap: 10px; }
.ch-print {
  width: 118px; height: 88px; border-radius: 11px; overflow: hidden; display: block;
  border: 1px solid var(--line); transition: border-color 0.15s ease, transform 0.15s ease;
}
.ch-print:hover { border-color: var(--gold); transform: translateY(-2px); }
.ch-print img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ch-sem-print { color: var(--placeholder); font-size: 9.5px; text-transform: none; letter-spacing: 0.05em; margin: 0; }
.ch-acoes { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
`;

export default AdminChamadosPage;
