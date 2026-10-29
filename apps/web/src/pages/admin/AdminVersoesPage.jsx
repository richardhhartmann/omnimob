import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../../api";
import { Alert, Button, Eyebrow, Reveal } from "../../styles/omnimobKit";

/* ────────────────────────────────────────────────────────────────────────────
   VERSIONAMENTO — as versões que a Omnimob já teve, para o suporte saber o que
   estava no ar quando um cliente reclamou.

   A versão é MAIOR.SEMANA.ENTREGA (`api/services/versao.js`, a mesma régua do
   VYA): a SEMANA vira toda terça às 15h01, junto com as Novidades, e cada PR
   que entra na `main` é uma entrega. Os dados vêm do git; no servidor, do
   `versoes.json` que o build grava.

   "Abrir a versão antiga" ficou de fora pelo mesmo motivo do VYA: subir um
   código velho pede um banco próprio, senão ele grava nos dados de produção.
   O que dá para ver de cada versão é o PR, o que mudou e o código, no GitHub.
   ──────────────────────────────────────────────────────────────────────────── */

const REPOSITORIO = "https://github.com/richardhhartmann/omnimob";
const SEMANA_MS = 7 * 864e5;
const diaMes = (ms) => new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
const dataHora = (iso) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/** As áreas que a entrega mexeu, pelo caminho dos arquivos. */
export function areasDe(arquivos) {
  const areas = new Set();
  for (const a of arquivos) {
    let m;
    if (/^apps\/(web\/src\/pages|api\/src\/services)\/flow\//.test(a)) areas.add("Omniflow");
    else if (/^apps\/web\/src\/pages\/(admin\/|SuperAdminPage)/.test(a) || /adminRoutes\.js$/.test(a)) areas.add("super-admin");
    else if (/^apps\/web\/src\/components\/(showcase|builder)\//.test(a)) areas.add("vitrine");
    else if (/^apps\/web\/src\/pages\/publicas\//.test(a) || /LandingPage\.jsx$/.test(a)) areas.add("site");
    else if ((m = a.match(/^apps\/web\/src\/pages\/(\w+?)Page\.jsx$/))) areas.add(m[1]);
    else if ((m = a.match(/^apps\/api\/src\/routes\/(\w+?)Routes\.js$/))) areas.add(m[1]);
    else if (a.startsWith("apps/api/prisma/")) areas.add("banco");
    else if (a.startsWith("docs/") || a.endsWith(".md")) areas.add("documentação");
  }
  return [...areas];
}

/** O PR do título ("… (#20)"), quando o merge foi por squash. */
const prDe = (titulo) => titulo?.match(/\(#(\d+)\)\s*$/)?.[1] || null;

export function AdminVersoesPage() {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [abertos, setAbertos] = useState(() => new Set());
  // O instante da abertura, para marcar a semana em andamento.
  const [agora] = useState(() => Date.now());

  async function carregar() {
    setCarregando(true);
    setErro("");
    try {
      setDados(await adminApi.listVersoes());
    } catch (e) {
      setErro(e.message || "Erro ao carregar as versões.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  const semanas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const casa = (v) =>
      !termo ||
      v.versao.startsWith(termo) ||
      v.commit.startsWith(termo) ||
      (v.titulo || "").toLowerCase().includes(termo) ||
      v.arquivos.some((a) => a.toLowerCase().includes(termo)) ||
      areasDe(v.arquivos).some((a) => a.toLowerCase().includes(termo));
    const grupos = [];
    for (const v of dados?.versoes || []) {
      if (!casa(v)) continue;
      const ultimo = grupos[grupos.length - 1];
      if (ultimo?.semana === v.semana) ultimo.versoes.push(v);
      else grupos.push({ semana: v.semana, versoes: [v] });
    }
    return grupos;
  }, [dados, busca]);

  const inicio = dados?.inicio ? new Date(dados.inicio).getTime() : null;
  const periodo = (semana) => {
    const n = Number(semana.split(".")[1]);
    const de = inicio + (n - 1) * SEMANA_MS;
    return { de, ate: de + SEMANA_MS, emAndamento: agora >= de && agora < de + SEMANA_MS };
  };
  const noAr = dados?.no_ar;

  function alternar(commit) {
    setAbertos((a) => {
      const novo = new Set(a);
      if (novo.has(commit)) novo.delete(commit);
      else novo.add(commit);
      return novo;
    });
  }

  return (
    <>
      <Reveal className="sa-head">
        <Eyebrow>VERSIONAMENTO</Eyebrow>
        <h1 className="dl-h2 sa-title">
          <span className="dl-h2__strong">Versões da Omnimob</span>
          <span className="dl-h2__soft">e o que cada uma mudou.</span>
        </h1>
      </Reveal>

      <p className="dl-mono dl-note sa-note">
        // no ar: v{noAr?.numero || "?"}{noAr?.commit ? ` · ${noAr.commit}` : ""} · a semana vira toda terça às 15h01 e cada PR na main é uma entrega
      </p>

      <div className="sa-bar">
        <input
          className="dl-input sa-search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Versão, commit, título, tela ou arquivo…"
        />
        <Button as="button" type="button" variant="ghost" className="dl-btn--sm" arrow={false} onClick={carregar}>
          Atualizar
        </Button>
      </div>

      {erro ? <Alert tone="danger">{erro}</Alert> : null}
      {dados?.indisponivel ? (
        <Alert tone="info">
          Este servidor não tem o histórico do git (o build não conseguiu gravar o versoes.json). A versão no ar aparece
          só pelo commit.
        </Alert>
      ) : null}
      {carregando && !dados ? <p className="dl-mono sa-loading">// lendo as versões…</p> : null}

      {dados && !dados.indisponivel && semanas.length === 0 ? (
        <div className="sa-empty">
          <p className="sa-empty__title">{busca ? "Nenhuma versão encontrada" : "Nenhuma versão desde o começo do versionamento"}</p>
          <p className="sa-empty__desc">{busca ? "Ajuste a busca." : "A primeira entrega na main já vira a 1.1.1."}</p>
        </div>
      ) : null}

      <div className="sa-list">
        {semanas.map((g) => {
          const p = periodo(g.semana);
          return (
            <section key={g.semana} className="vs-semana">
              <header className="vs-semana__topo">
                <strong className="vs-semana__nome">Versão {g.semana}</strong>
                <span className="dl-mono vs-semana__periodo">semana de {diaMes(p.de)} a {diaMes(p.ate)}</span>
                {p.emAndamento ? <span className="dl-pill vs-pill vs-pill--andamento">em andamento</span> : null}
                <span className="dl-mono vs-semana__qtd">
                  {g.versoes.length} {g.versoes.length === 1 ? "entrega" : "entregas"}
                </span>
              </header>

              {g.versoes.map((v) => {
                const pr = prDe(v.titulo);
                const aberto = abertos.has(v.commit);
                const areas = areasDe(v.arquivos);
                return (
                  <div key={v.commit} className="vs-versao">
                    <div className="vs-versao__linha">
                      <span className={`vs-numero${noAr?.numero === v.versao ? " is-no-ar" : ""}`}>{v.versao}</span>
                      <div className="vs-versao__texto">
                        <span className="vs-titulo">{v.titulo || "(sem título)"}</span>
                        <span className="dl-mono vs-meta">
                          {dataHora(v.data)} · {v.autor} · {v.commit.slice(0, 7)}
                          {noAr?.numero === v.versao ? " · no ar" : ""}
                        </span>
                        {areas.length ? (
                          <span className="vs-areas">
                            {areas.map((a) => <span key={a} className="vs-area">{a}</span>)}
                          </span>
                        ) : null}
                      </div>
                      <div className="vs-acoes">
                        {pr ? (
                          <a className="vs-link" href={`${REPOSITORIO}/pull/${pr}`} target="_blank" rel="noreferrer">PR #{pr}</a>
                        ) : null}
                        <a className="vs-link" href={`${REPOSITORIO}/commit/${v.commit}`} target="_blank" rel="noreferrer">O que mudou</a>
                        <a className="vs-link" href={`${REPOSITORIO}/tree/${v.commit}`} target="_blank" rel="noreferrer">Código</a>
                        <button type="button" className="vs-link" onClick={() => alternar(v.commit)} aria-expanded={aberto}>
                          {v.total_arquivos} {v.total_arquivos === 1 ? "arquivo" : "arquivos"} {aberto ? "▴" : "▾"}
                        </button>
                      </div>
                    </div>
                    {aberto ? (
                      <ul className="vs-arquivos">
                        {v.arquivos.map((a) => <li key={a} className="dl-mono">{a}</li>)}
                        {v.total_arquivos > v.arquivos.length ? (
                          <li className="dl-mono">… e mais {v.total_arquivos - v.arquivos.length}</li>
                        ) : null}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>

      {dados?.antes?.commits ? (
        <p className="dl-mono dl-note sa-note">
          // {dados.antes.versao}: os {dados.antes.commits} commits de {new Date(dados.antes.de).toLocaleDateString("pt-BR")} a{" "}
          {new Date(dados.antes.ate).toLocaleDateString("pt-BR")}, antes do versionamento
        </p>
      ) : null}
    </>
  );
}

export const VERSOES_CSS = `
.vs-semana {
  padding: 16px 20px; border-radius: 16px;
  background: var(--surface); border: 1px solid var(--line);
}
.vs-semana__topo { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding-bottom: 10px; border-bottom: 1px solid var(--line-soft); }
.vs-semana__nome { font-size: 15px; font-weight: 700; color: var(--strong); letter-spacing: -0.025em; }
.vs-semana__periodo, .vs-semana__qtd { color: var(--placeholder); font-size: 9.5px; text-transform: none; letter-spacing: 0.05em; }
.vs-semana__qtd { margin-left: auto; }
.vs-pill--andamento { background: rgba(52,211,153,0.12); color: #86efac; border-color: rgba(52,211,153,0.30); }

.vs-versao { padding: 12px 0; border-bottom: 1px solid var(--line-soft); }
.vs-versao:last-child { border-bottom: none; padding-bottom: 0; }
.vs-versao__linha { display: flex; align-items: flex-start; gap: 14px; flex-wrap: wrap; }
.vs-numero {
  flex-shrink: 0; min-width: 58px; padding: 3px 9px; border-radius: 999px; text-align: center;
  font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums;
  color: var(--subtle); background: var(--bg-alt); border: 1px solid var(--line);
}
.vs-numero.is-no-ar { color: #86efac; background: rgba(52,211,153,0.12); border-color: rgba(52,211,153,0.30); }
.vs-versao__texto { display: grid; gap: 4px; flex: 1 1 320px; min-width: 0; }
.vs-titulo { font-size: 13.5px; font-weight: 600; color: var(--default); overflow-wrap: anywhere; }
.vs-meta { color: var(--placeholder); font-size: 9px; text-transform: none; letter-spacing: 0.05em; }
.vs-areas { display: flex; gap: 6px; flex-wrap: wrap; }
.vs-area { font-size: 10.5px; color: var(--subtle); padding: 1px 8px; border-radius: 999px; border: 1px solid var(--line); }
.vs-acoes { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.dl-root .vs-link {
  width: auto; font-family: inherit; font-size: 11.5px; color: var(--accent-soft); text-decoration: none;
  background: none; border: none; padding: 0; cursor: pointer; box-shadow: none; transform: none;
}
.dl-root .vs-link:hover { text-decoration: underline; background: none; box-shadow: none; transform: none; }
.vs-arquivos { list-style: none; margin: 10px 0 0 72px; padding: 0; display: grid; gap: 3px; }
.vs-arquivos li { color: var(--subtle); font-size: 9.5px; text-transform: none; letter-spacing: 0.02em; overflow-wrap: anywhere; }

@media (max-width: 720px) {
  .vs-arquivos { margin-left: 0; }
}
`;

export default AdminVersoesPage;
