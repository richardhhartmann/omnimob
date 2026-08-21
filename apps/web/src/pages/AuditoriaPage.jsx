import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { ClockCounterClockwise, PlusCircle, PencilSimple, Trash, MagnifyingGlass, X } from "@phosphor-icons/react";
import { api } from "../api";

/* ────────────────────────────────────────────────────────────────────────────
   Trilha de auditoria.

   A tela existe para responder perguntas que aparecem depois do fato: "sumiu um
   imóvel, quem apagou?", "quem mudou este preço?", "o estagiário mexeu em
   cliente ontem?". Por isso ela é uma LINHA DO TEMPO e não uma tabela: a
   pergunta quase sempre começa por quando, e só depois se afunila por quem ou
   pelo quê.

   Só leitura — não há como editar nem apagar um registro, aqui nem na API.
   Trilha que o usuário pode reescrever não serve para o que ela existe.
   ──────────────────────────────────────────────────────────────────────────── */

const ACOES = {
  CRIOU:   { rotulo: "Criou",    cor: "#10b981", Icon: PlusCircle },
  ALTEROU: { rotulo: "Alterou",  cor: "#f59e0b", Icon: PencilSimple },
  EXCLUIU: { rotulo: "Excluiu",  cor: "#ef4444", Icon: Trash },
};

/* Nome do modelo → o que a pessoa chama aquilo.
   O log guarda o nome técnico porque é o que a camada de banco conhece; a
   tradução mora aqui, na única camada que fala com gente. */
const ENTIDADES = {
  Property: "Imóvel",
  PropertyImage: "Foto de imóvel",
  PropertyLead: "Lead",
  Cliente: "Cliente",
  Usuario: "Usuário",
  Cargo: "Cargo",
  TipoImovel: "Tipo de imóvel",
  ModeloAtributo: "Atributo de tipo",
  Venda: "Venda",
  Tenant: "Dados da imobiliária",
  PerfilBusca: "Perfil de busca",
};

const nomeDaEntidade = (e) => ENTIDADES[e] || e;

function quando(iso) {
  const d = new Date(iso);
  const agora = new Date();
  const min = Math.floor((agora - d) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const dias = Math.floor(h / 24);
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  return d.toLocaleDateString("pt-BR");
}

const horaCompleta = (iso) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });

/* Os campos alterados, em linguagem de gente e sem o ruído do ORM.
   `connect`, `increment` e afins são vocabulário do Prisma e não dizem nada a
   quem lê — mas o NOME do campo diz, e é ele que a pessoa procura. */
function camposAlterados(dados) {
  if (!dados || typeof dados !== "object") return [];
  return Object.entries(dados)
    .filter(([k]) => !["id", "tenantId", "updatedAt", "createdAt"].includes(k))
    .slice(0, 12)
    .map(([campo, valor]) => {
      let texto;
      if (valor === null) texto = "vazio";
      else if (typeof valor === "object") {
        if ("increment" in valor) texto = `+${valor.increment}`;
        else if ("set" in valor) texto = String(valor.set);
        else if ("connect" in valor) texto = "vinculado";
        else texto = Array.isArray(valor) ? `${valor.length} item(ns)` : "alterado";
      } else texto = String(valor);
      return { campo, texto: texto.length > 90 ? `${texto.slice(0, 90)}…` : texto };
    });
}

function Registro({ r, aberto, aoAlternar }) {
  const meta = ACOES[r.acao] || { rotulo: r.acao, cor: "#64748b", Icon: PencilSimple };
  const campos = camposAlterados(r.dados);

  return (
    <li className="aud-item">
      <span className="aud-item__marca" style={{ background: `${meta.cor}22`, color: meta.cor }}>
        <meta.Icon size={15} weight="bold" />
      </span>

      <div className="aud-item__corpo">
        <button
          type="button"
          className="aud-item__linha"
          onClick={aoAlternar}
          aria-expanded={aberto}
          title={horaCompleta(r.createdAt)}
        >
          <span className="aud-item__texto">
            <strong>{r.usuarioNome || "Sistema"}</strong>{" "}
            <span style={{ color: meta.cor, fontWeight: 600 }}>{meta.rotulo.toLowerCase()}</span>{" "}
            {nomeDaEntidade(r.entidade).toLowerCase()}
            {r.resumo ? <> — <em>{r.resumo}</em></> : null}
          </span>
          <span className="aud-item__quando">{quando(r.createdAt)}</span>
        </button>

        {aberto ? (
          <div className="aud-item__detalhe">
            <dl className="aud-ficha">
              <dt>Quando</dt><dd>{horaCompleta(r.createdAt)}</dd>
              <dt>Registro</dt><dd>{nomeDaEntidade(r.entidade)}{r.entidadeId ? ` · ${r.entidadeId}` : ""}</dd>
              {r.rota ? <><dt>Origem</dt><dd>{r.rota}</dd></> : null}
              {r.ip ? <><dt>Endereço IP</dt><dd>{r.ip}</dd></> : null}
            </dl>

            {campos.length ? (
              <div className="aud-campos">
                <span className="aud-campos__titulo">
                  {r.acao === "EXCLUIU" ? "Filtro usado" : "Campos gravados"}
                </span>
                <ul>
                  {campos.map((c) => (
                    <li key={c.campo}>
                      <code>{c.campo}</code>
                      <span>{c.texto}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function AuditoriaPage({ session }) {
  const tenantSlug = session?.tenant?.slug || "";
  const showToast = useOutletContext()?.showToast;

  const [dados, setDados] = useState({ registros: [], total: 0, page: 1, limit: 40 });
  const [opcoes, setOpcoes] = useState({ entidades: [], usuarios: [] });
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [abertos, setAbertos] = useState(() => new Set());

  const [filtros, setFiltros] = useState({ acao: "", entidade: "", usuarioId: "", busca: "", desde: "", ate: "" });
  const [pagina, setPagina] = useState(1);
  /* A busca é debounced e o resto não: digitar dispara requisição a cada tecla,
     escolher num combo é uma decisão fechada. */
  const [buscaDigitada, setBuscaDigitada] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setFiltros((f) => ({ ...f, busca: buscaDigitada })), 400);
    return () => clearTimeout(t);
  }, [buscaDigitada]);

  useEffect(() => { setPagina(1); }, [filtros]);

  useEffect(() => {
    if (!tenantSlug) return;
    let vivo = true;
    setCarregando(true);
    setErro("");
    api.listarAuditoria(tenantSlug, { ...filtros, page: pagina, limit: 40 })
      .then((r) => { if (vivo) setDados(r); })
      .catch((e) => {
        if (!vivo) return;
        setErro(e.message);
        showToast?.(e.message, "error");
      })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [tenantSlug, filtros, pagina]);

  useEffect(() => {
    if (!tenantSlug) return;
    api.filtrosDaAuditoria(tenantSlug).then(setOpcoes).catch(() => {});
  }, [tenantSlug]);

  const paginas = Math.max(1, Math.ceil(dados.total / (dados.limit || 40)));
  const temFiltro = useMemo(
    () => Object.values(filtros).some((v) => v !== ""),
    [filtros]
  );

  function limparFiltros() {
    setFiltros({ acao: "", entidade: "", usuarioId: "", busca: "", desde: "", ate: "" });
    setBuscaDigitada("");
  }

  /* Agrupado por dia. É como a pergunta chega — "o que aconteceu ontem?" — e é
     o que transforma uma lista longa em algo percorrível. */
  const porDia = useMemo(() => {
    const mapa = new Map();
    for (const r of dados.registros) {
      const dia = new Date(r.createdAt).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
      if (!mapa.has(dia)) mapa.set(dia, []);
      mapa.get(dia).push(r);
    }
    return [...mapa.entries()];
  }, [dados.registros]);

  return (
    <div className="main-content" style={{ animation: "fadeIn 0.3s ease-in-out", display: "flex", flexDirection: "column", gap: "20px" }}>
      <header data-tour="auditoria-cabecalho">
        <h2 style={{ margin: "0 0 4px 0", fontSize: "24px", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px" }}>
          <ClockCounterClockwise size={24} weight="duotone" />
          Registro de atividade
        </h2>
        <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)" }}>
          Tudo que foi criado, alterado ou excluído na sua imobiliária — com autor, data e origem.
        </p>
      </header>

      {/* ── Filtros ── */}
      <div data-tour="auditoria-filtros" className="glass-panel aud-filtros">
        <label className="aud-busca">
          <MagnifyingGlass size={15} />
          <input
            value={buscaDigitada}
            onChange={(e) => setBuscaDigitada(e.target.value)}
            placeholder="Buscar…"
          />
        </label>

        <select value={filtros.acao} onChange={(e) => setFiltros((f) => ({ ...f, acao: e.target.value }))}>
          <option value="">Toda ação</option>
          <option value="CRIOU">Criou</option>
          <option value="ALTEROU">Alterou</option>
          <option value="EXCLUIU">Excluiu</option>
        </select>

        <select value={filtros.entidade} onChange={(e) => setFiltros((f) => ({ ...f, entidade: e.target.value }))}>
          <option value="">Todo registro</option>
          {opcoes.entidades.map((e) => (
            <option key={e.valor} value={e.valor}>{nomeDaEntidade(e.valor)} ({e.total})</option>
          ))}
        </select>

        <select value={filtros.usuarioId} onChange={(e) => setFiltros((f) => ({ ...f, usuarioId: e.target.value }))}>
          <option value="">Toda a equipe</option>
          {opcoes.usuarios.map((u) => (
            <option key={u.id} value={u.id}>{u.nome} ({u.total})</option>
          ))}
        </select>

        <label className="aud-data">
          De <input type="date" value={filtros.desde} onChange={(e) => setFiltros((f) => ({ ...f, desde: e.target.value }))} />
        </label>
        <label className="aud-data">
          até <input type="date" value={filtros.ate} onChange={(e) => setFiltros((f) => ({ ...f, ate: e.target.value }))} />
        </label>

        {temFiltro ? (
          <button type="button" className="aud-limpar" onClick={limparFiltros}>
            <X size={13} /> Limpar
          </button>
        ) : null}
      </div>

      {erro ? <div className="error">{erro}</div> : null}

      {/* ── Linha do tempo ── */}
      <div data-tour="auditoria-linha" className="glass-panel" style={{ padding: "8px 4px" }}>
        {carregando && dados.registros.length === 0 ? (
          <p className="aud-vazio">Carregando…</p>
        ) : dados.registros.length === 0 ? (
          <p className="aud-vazio">
            {temFiltro
              ? "Nada encontrado com esses filtros. Tente afrouxar o período."
              : "Nenhuma atividade registrada ainda. A partir de agora, tudo que a equipe fizer aparece aqui."}
          </p>
        ) : (
          porDia.map(([dia, itens]) => (
            <section key={dia} className="aud-dia">
              <h3 className="aud-dia__titulo">{dia}</h3>
              <ul className="aud-lista">
                {itens.map((r) => (
                  <Registro
                    key={r.id}
                    r={r}
                    aberto={abertos.has(r.id)}
                    aoAlternar={() =>
                      setAbertos((s) => {
                        const proximo = new Set(s);
                        if (proximo.has(r.id)) proximo.delete(r.id);
                        else proximo.add(r.id);
                        return proximo;
                      })
                    }
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      {paginas > 1 ? (
        <div className="aud-paginacao">
          <button type="button" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</button>
          <span>Página {pagina} de {paginas} · {dados.total} registros</span>
          <button type="button" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>Próxima</button>
        </div>
      ) : null}
    </div>
  );
}
