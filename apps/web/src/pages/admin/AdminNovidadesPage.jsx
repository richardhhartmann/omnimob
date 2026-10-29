import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../../api";
import { Alert, Button, Eyebrow, Reveal } from "../../styles/omnimobKit";
import { Apresentacao } from "../../components/novidades/Apresentacao";
import { ICONES } from "../../components/novidades/icones";
import { ROTULO_DO_TIPO, printsDe, rotuloDaSemana } from "../../components/novidades/tipos";
import { diaEmSaoPaulo, situacaoDa, tercaDaSemana } from "../../components/novidades/situacao";
import { PERMISSOES, PERMISSOES_FLOW } from "../../utils/permissoesCargo";
import { uploadToCloudinary } from "../../utils/uploadToCloudinary";

/* ────────────────────────────────────────────────────────────────────────────
   NOVIDADES — a revisão antes de ir para os clientes. Porte da aba do VYA.

   Toda terça às 15h a rotina lê o que entrou na semana (uma versão
   MAIOR.SEMANA, `api/services/versao.js`) e deixa aqui o RASCUNHO. Aqui se
   reescreve o texto clicando nele no próprio slide, escolhe quem vê cada
   novidade (módulo e permissão), anexa os prints e publica: a apresentação
   abre uma vez para cada pessoa no painel e, se marcado, vai por e-mail.

   As antigas ficam todas aqui, para o suporte consultar. Ver: `verNovidades`;
   publicar e despublicar: `publicarNovidades` (o servidor confere).
   ──────────────────────────────────────────────────────────────────────────── */

const RECENTES = 6;
const TIPOS = Object.keys(ROTULO_DO_TIPO);
const OPCOES_DE_PERMISSAO = [
  ...PERMISSOES.map((p) => ({ key: p.key, label: p.label })),
  { key: "verConfiguracoes", label: "Configurações (Administrador)" },
  ...PERMISSOES_FLOW.filter((p) => p.key !== "acessarFlow").map((p) => ({ key: p.key, label: `${p.label} (Omniflow)` })),
];
const TOM = {
  neutro: { color: "#cbd5e1", background: "rgba(148,163,184,0.12)", borderColor: "rgba(148,163,184,0.25)" },
  verde: { color: "#86efac", background: "rgba(52,211,153,0.14)", borderColor: "rgba(52,211,153,0.30)" },
  ambar: { color: "#fcd34d", background: "rgba(251,191,36,0.12)", borderColor: "rgba(251,191,36,0.30)" },
  rosa: { color: "#fda4af", background: "rgba(244,63,94,0.12)", borderColor: "rgba(244,63,94,0.30)" },
  azul: { color: "#c7cbff", background: "rgba(99,102,241,0.14)", borderColor: "rgba(99,102,241,0.30)" },
};
const Selo = ({ s }) => <span className="dl-pill" style={TOM[s.tom]} title={s.detalhe}>{s.rotulo}</span>;
const dataHora = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const duracao = (seg) => (seg < 60 ? `${seg}s` : `${Math.floor(seg / 60)}min ${seg % 60}s`);

/** O ponto de partida de uma semana sem rotina: textos para reescrever no slide. */
const modeloDaSemana = (chave) => ({
  mes: chave,
  titulo: "Novidades da semana",
  subtitulo: `Omnimob · ${rotuloDaSemana(chave)}`,
  chamada: "Escreva aqui, numa frase, o espírito da semana.",
  encerramento: { titulo: "Dúvidas? Fale com a gente", texto: "O suporte está pronto para ajudar a sua equipe a começar a usar cada novidade. Na próxima semana tem mais." },
  secoes: [{ id: "area-1", titulo: "Área do painel", icone: "Sparkle", resumo: "O que mudou nesta área.", itens: [itemNovo(1)] }],
});
function itemNovo(n) {
  return { id: `novidade-${n}`, tipo: "novo", titulo: "Nome da novidade", icone: "Sparkle", paraQue: "Para que serve, em uma ou duas frases.", passos: ["Primeiro passo.", "Segundo passo.", "Terceiro passo."], onde: "Menu › Tela" };
}
const proximoId = (c, prefixo) => {
  const usados = new Set(c.secoes.flatMap((s) => [s.id, ...s.itens.map((i) => i.id)]));
  let n = 1;
  while (usados.has(`${prefixo}-${n}`)) n += 1;
  return n;
};

export function AdminNovidadesPage({ podePublicar, tenantId = "" }) {
  const [lista, setLista] = useState(null);
  const [erroLista, setErroLista] = useState("");
  const [escolhida, setEscolhida] = useState(null);
  const [detalhe, setDetalhe] = useState(null); // como está no servidor
  const [rascunho, setRascunho] = useState(null); // como está na tela
  const [vistos, setVistos] = useState(null);
  const [ocupado, setOcupado] = useState("");
  const [aviso, setAviso] = useState(null); // { tom, texto }
  const [porEmail, setPorEmail] = useState(true);

  const hoje = diaEmSaoPaulo(new Date());
  const semanaAtual = tercaDaSemana(hoje);

  async function carregarLista(manter) {
    setErroLista("");
    try {
      const r = await adminApi.listNovidades();
      setLista(r.novidades);
      if (!manter) setEscolhida((e) => e ?? r.novidades[0]?.chave ?? null);
    } catch (e) {
      setErroLista(e.message || "Erro ao carregar as novidades.");
    }
  }
  useEffect(() => { carregarLista(); }, []);

  useEffect(() => {
    if (!escolhida || !lista?.some((n) => n.chave === escolhida)) { setDetalhe(null); setRascunho(null); return; }
    let vivo = true;
    setAviso(null);
    adminApi.lerNovidadeAdmin(escolhida).then((d) => { if (vivo) { setDetalhe(d); setRascunho(d.conteudo); } }).catch((e) => setAviso({ tom: "danger", texto: e.message }));
    adminApi.vistosNovidade(escolhida, tenantId).then((v) => { if (vivo) setVistos(v); }).catch(() => setVistos(null));
    return () => { vivo = false; };
  }, [escolhida, lista, tenantId]);

  const sujo = useMemo(() => Boolean(detalhe && rascunho && JSON.stringify(rascunho) !== JSON.stringify(detalhe.conteudo)), [detalhe, rascunho]);
  const resumo = lista?.find((n) => n.chave === escolhida) || null;
  const semRascunho = lista && !lista.some((n) => n.chave === semanaAtual) ? situacaoDa(semanaAtual, null, hoje) : null;

  async function rodar(rotulo, fn) {
    setOcupado(rotulo);
    setAviso(null);
    try {
      await fn();
    } catch (e) {
      setAviso({ tom: "danger", texto: e.message || "Não deu certo." });
    } finally {
      setOcupado("");
    }
  }

  const salvar = () => rodar("salvar", async () => {
    const d = await adminApi.salvarNovidade(escolhida, rascunho);
    setDetalhe(d);
    setRascunho(d.conteudo);
    await carregarLista(true);
    setAviso({ tom: "info", texto: "Revisão salva." });
  });

  const criarSemana = () => rodar("criar", async () => {
    await adminApi.salvarNovidade(semanaAtual, modeloDaSemana(semanaAtual));
    await carregarLista(true);
    setEscolhida(semanaAtual);
  });

  const publicar = () => rodar("publicar", async () => {
    if (sujo) await adminApi.salvarNovidade(escolhida, rascunho);
    const r = await adminApi.publicarNovidade(escolhida, { email: porEmail });
    await carregarLista(true);
    setDetalhe((d) => ({ ...d, ...r, conteudo: rascunho }));
    setAviso({
      tom: "info",
      texto: `Publicada. ${r.email ? (r.email.motivo ? `E-mail não enviado: ${r.email.motivo}.` : `E-mail a caminho de ${r.email.destinatarios} pessoas.`) : "Sem e-mail."}`,
    });
  });

  const despublicar = () => rodar("despublicar", async () => {
    await adminApi.despublicarNovidade(escolhida);
    await carregarLista(true);
    setAviso({ tom: "info", texto: "Voltou a rascunho: saiu do comunicado e das Notas de versão." });
  });

  const baixar = () => rodar("pptx", async () => {
    const { baixarPptx } = await import("../../components/novidades/baixarPptx");
    await baixarPptx(rascunho);
  });

  // ── Edição de um item, pelos controles abaixo do slide ──
  const noItem = (id, mudar) =>
    setRascunho((c) => ({ ...c, secoes: c.secoes.map((s) => ({ ...s, itens: s.itens.map((i) => (i.id === id ? mudar(i) : i)) })) }));
  const removerItem = (id) => {
    if (!window.confirm("Tirar esta novidade da apresentação?")) return;
    setRascunho((c) => ({ ...c, secoes: c.secoes.map((s) => ({ ...s, itens: s.itens.filter((i) => i.id !== id) })).filter((s) => s.itens.length) }));
  };
  const anexarPrint = async (item, arquivo) => {
    if (!arquivo) return;
    await rodar("print", async () => {
      const { url } = await uploadToCloudinary(arquivo);
      noItem(item.id, (i) => {
        const prints = [...printsDe(i), url].slice(-2);
        return { ...i, print: prints.length > 1 ? prints : prints[0] };
      });
    });
  };
  const tirarPrint = (item, url) =>
    noItem(item.id, (i) => {
      const prints = printsDe(i).filter((p) => p !== url);
      const { print: _fora, ...resto } = i;
      return prints.length ? { ...resto, print: prints.length > 1 ? prints : prints[0] } : resto;
    });
  const adicionarNovidade = () =>
    setRascunho((c) => {
      const novo = itemNovo(proximoId(c, "novidade"));
      return { ...c, secoes: c.secoes.map((s, k) => (k === c.secoes.length - 1 ? { ...s, itens: [...s.itens, novo] } : s)) };
    });
  const adicionarArea = () =>
    setRascunho((c) => {
      const n = proximoId(c, "area");
      return { ...c, secoes: [...c.secoes, { id: `area-${n}`, titulo: "Área do painel", icone: "Sparkle", resumo: "O que mudou nesta área.", itens: [itemNovo(proximoId(c, "novidade"))] }] };
    });

  const controlesDoItem = (itens) =>
    itens.length ? (
      <div className="nv-controles">
        {itens.map((item) => (
          <div key={item.id} className="nv-item">
            <strong className="nv-item__nome">{item.titulo}</strong>
            <label>
              Tipo
              <select className="dl-input" value={item.tipo || "novo"} onChange={(e) => noItem(item.id, (i) => ({ ...i, tipo: e.target.value }))}>
                {TIPOS.map((t) => <option key={t} value={t}>{ROTULO_DO_TIPO[t]}</option>)}
              </select>
            </label>
            <label>
              Módulo
              <select className="dl-input" value={item.modulo || ""} onChange={(e) => noItem(item.id, ({ modulo: _m, ...i }) => (e.target.value ? { ...i, modulo: e.target.value } : i))}>
                <option value="">Todos</option>
                <option value="FLOW">Só quem tem o Omniflow</option>
              </select>
            </label>
            <label>
              Só para quem tem
              <select className="dl-input" value={item.permissao || ""} onChange={(e) => noItem(item.id, ({ permissao: _p, ...i }) => (e.target.value ? { ...i, permissao: e.target.value } : i))}>
                <option value="">Qualquer cargo</option>
                {OPCOES_DE_PERMISSAO.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </label>
            <label>
              Ícone
              <select className="dl-input" value={item.icone} onChange={(e) => noItem(item.id, (i) => ({ ...i, icone: e.target.value }))}>
                {Object.keys(ICONES).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <div className="nv-prints">
              {printsDe(item).map((url) => (
                <span key={url} className="nv-print">
                  <img src={url} alt="" />
                  <button type="button" onClick={() => tirarPrint(item, url)} aria-label="Tirar o print">×</button>
                </span>
              ))}
              {printsDe(item).length < 2 ? (
                <label className="nv-anexar">
                  {ocupado === "print" ? "Enviando…" : "+ Print"}
                  <input type="file" accept="image/*" hidden onChange={(e) => { anexarPrint(item, e.target.files?.[0]); e.target.value = ""; }} />
                </label>
              ) : null}
            </div>
            <button type="button" className="nv-tirar" onClick={() => removerItem(item.id)}>Tirar novidade</button>
          </div>
        ))}
      </div>
    ) : null;

  return (
    <>
      <Reveal className="sa-head">
        <Eyebrow>NOVIDADES</Eyebrow>
        <h1 className="dl-h2 sa-title">
          <span className="dl-h2__strong">O que mudou na semana</span>
          <span className="dl-h2__soft">revisado antes de ir para os clientes.</span>
        </h1>
      </Reveal>
      <p className="dl-mono dl-note sa-note">
        // toda terça, às 15h, chega o rascunho da rotina · clique no texto do slide para reescrever · a apresentação abre uma vez para cada pessoa
      </p>

      {erroLista ? <Alert tone="danger">{erroLista}</Alert> : null}
      {!lista && !erroLista ? <p className="dl-mono sa-loading">// lendo as novidades…</p> : null}

      {lista ? (
        <div className="nv-semanas">
          {semRascunho ? (
            <span className="nv-semana nv-semana--vazia" title={semRascunho.detalhe}>
              <span>{rotuloDaSemana(semanaAtual)}</span>
              <Selo s={semRascunho} />
              <button type="button" className="nv-link" disabled={!!ocupado} onClick={criarSemana}>Começar à mão</button>
            </span>
          ) : null}
          {lista.slice(0, RECENTES).map((n) => (
            <button key={n.chave} type="button" className={`nv-semana${n.chave === escolhida ? " is-on" : ""}`} onClick={() => setEscolhida(n.chave)}>
              <span>{n.versao ? `${n.versao} · ` : ""}{rotuloDaSemana(n.chave)}</span>
              <Selo s={situacaoDa(n.chave, n, hoje)} />
              <span className="dl-mono nv-semana__qtd">{n.itens} itens</span>
            </button>
          ))}
          {lista.length > RECENTES ? (
            <select className="dl-input nv-anteriores" value={lista.slice(RECENTES).some((n) => n.chave === escolhida) ? escolhida : ""} onChange={(e) => e.target.value && setEscolhida(e.target.value)}>
              <option value="">Anteriores…</option>
              {lista.slice(RECENTES).map((n) => <option key={n.chave} value={n.chave}>{n.versao ? `${n.versao} · ` : ""}{rotuloDaSemana(n.chave)}</option>)}
            </select>
          ) : null}
        </div>
      ) : null}

      {lista && !lista.length && !semRascunho ? (
        <div className="sa-empty">
          <p className="sa-empty__title">Nenhuma apresentação ainda</p>
          <p className="sa-empty__desc">O primeiro rascunho chega na terça, às 15h.</p>
        </div>
      ) : null}

      {resumo && rascunho ? (
        <section className="nv-detalhe">
          <div className="nv-cabeca">
            <div>
              <strong>{resumo.versao ? `Versão ${resumo.versao} · ` : ""}{rotuloDaSemana(resumo.chave)}</strong>{" "}
              <Selo s={situacaoDa(resumo.chave, resumo, hoje)} />
              <p className="dl-mono nv-meta">
                {resumo.origem === "agendamento" ? "veio da rotina" : "criado no painel"} · atualizado {dataHora(resumo.atualizadoEm)}
                {resumo.atualizadoPor ? ` por ${resumo.atualizadoPor}` : ""}
                {resumo.publicadoEm ? ` · publicado ${dataHora(resumo.publicadoEm)}${resumo.publicadoPor ? ` por ${resumo.publicadoPor}` : ""}` : ""}
              </p>
            </div>
            <div className="nv-acoes">
              <button type="button" className="nv-link" onClick={adicionarNovidade}>+ Novidade</button>
              <button type="button" className="nv-link" onClick={adicionarArea}>+ Área</button>
              {sujo ? (
                <>
                  <Button as="button" type="button" variant="ghost" className="dl-btn--sm" arrow={false} disabled={!!ocupado} onClick={() => setRascunho(detalhe.conteudo)}>Desfazer</Button>
                  <Button as="button" type="button" variant="outline" className="dl-btn--sm" arrow={false} disabled={!!ocupado} onClick={salvar}>
                    {ocupado === "salvar" ? "Salvando…" : "Salvar"}
                  </Button>
                </>
              ) : null}
              <Button as="button" type="button" variant="ghost" className="dl-btn--sm" arrow={false} disabled={!!ocupado} onClick={baixar}>
                {ocupado === "pptx" ? "Gerando…" : "Baixar PPTX"}
              </Button>
              {podePublicar ? (
                resumo.status === "PUBLICADO" ? (
                  <Button as="button" type="button" variant="ghost" className="dl-btn--sm" arrow={false} disabled={!!ocupado} onClick={despublicar}>Despublicar</Button>
                ) : (
                  <>
                    <label className="nv-email">
                      <input type="checkbox" checked={porEmail} onChange={(e) => setPorEmail(e.target.checked)} /> mandar por e-mail
                    </label>
                    <Button as="button" type="button" variant="accent" className="dl-btn--sm" arrow={false} disabled={!!ocupado} onClick={publicar}>
                      {ocupado === "publicar" ? "Publicando…" : "Publicar"}
                    </Button>
                  </>
                )
              ) : null}
            </div>
          </div>

          {aviso ? <Alert tone={aviso.tom}>{aviso.texto}</Alert> : null}

          <div className="nv-palco">
            <Apresentacao key={resumo.chave} conteudo={rascunho} editar={(mudar) => setRascunho((c) => mudar(c))} abaixoDoSlide={controlesDoItem} />
          </div>

          <div className="nv-vistos">
            <h3>Quem viu{vistos ? ` · ${vistos.total}` : ""}</h3>
            {!vistos?.pessoas?.length ? (
              <p className="dl-mono nv-meta">// ninguém abriu ainda{tenantId ? " neste cliente" : ""}. A revisão aqui não conta.</p>
            ) : (
              <div className="nv-tabela">
                <table>
                  <thead>
                    <tr><th>Pessoa</th><th>Imobiliária</th><th>Primeira vez</th><th>Última</th><th>Vezes</th><th>Até onde</th><th>Tempo</th><th>Aparelho</th></tr>
                  </thead>
                  <tbody>
                    {vistos.pessoas.map((p) => (
                      <tr key={p.usuarioId}>
                        <td>{p.usuarioNome}</td>
                        <td>{p.tenant?.name}</td>
                        <td>{dataHora(p.primeiraEm)}</td>
                        <td>{dataHora(p.ultimaEm)}</td>
                        <td>{p.vezes}</td>
                        <td>{p.chegouAoFim ? "Até o fim" : `Slide ${p.slideMax} de ${p.totalSlides || "?"}`}</td>
                        <td>{duracao(p.segundos)}</td>
                        <td>{p.dispositivos.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      ) : null}
    </>
  );
}

export const NOVIDADES_CSS = `
.nv-semanas { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
.dl-root .nv-semana {
  display: inline-flex; align-items: center; gap: 10px; padding: 9px 14px; border-radius: 12px; cursor: pointer;
  background: var(--surface); border: 1px solid var(--line); color: var(--default); font-family: inherit; font-size: 13px;
  box-shadow: none; transform: none;
}
.dl-root .nv-semana:hover { border-color: #34343c; background: var(--surface); box-shadow: none; transform: none; }
.dl-root .nv-semana.is-on { border-color: rgba(99,102,241,0.55); background: rgba(99,102,241,0.08); }
.nv-semana--vazia { border-style: dashed; cursor: default; }
.nv-semana__qtd { color: var(--placeholder); font-size: 9px; text-transform: none; }
.nv-anteriores { max-width: 260px; }
.nv-detalhe { display: grid; gap: 14px; }
.nv-cabeca { display: flex; justify-content: space-between; gap: 14px; flex-wrap: wrap; align-items: flex-start; }
.nv-cabeca strong { color: var(--strong); font-size: 15px; }
.nv-meta { color: var(--placeholder); font-size: 9px; text-transform: none; letter-spacing: 0.04em; margin-top: 6px; }
.nv-acoes { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.nv-email { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--subtle); cursor: pointer; }
.dl-root .nv-link {
  font-family: inherit; font-size: 12px; color: var(--accent-soft); background: none; border: none; padding: 0; cursor: pointer; box-shadow: none; transform: none;
}
.dl-root .nv-link:hover { text-decoration: underline; background: none; box-shadow: none; transform: none; }
.nv-palco { padding: 18px; border-radius: 18px; background: var(--surface); border: 1px solid var(--line); }
.nv-controles { display: grid; gap: 10px; }
.nv-item { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; padding: 12px 14px; border-radius: 12px; background: var(--bg-alt); border: 1px solid var(--line); }
.nv-item__nome { flex: 1 1 100%; color: var(--strong); font-size: 13px; }
.nv-item label { display: grid; gap: 4px; font-size: 11px; color: var(--placeholder); }
.nv-item select { min-width: 150px; padding-top: 7px; padding-bottom: 7px; }
.nv-prints { display: flex; gap: 8px; align-items: center; }
.nv-print { position: relative; width: 64px; height: 40px; border-radius: 6px; overflow: hidden; border: 1px solid var(--line); }
.nv-print img { width: 100%; height: 100%; object-fit: cover; }
.nv-print button { position: absolute; top: 1px; right: 1px; width: 16px; height: 16px; border-radius: 50%; border: none; background: rgba(0,0,0,0.7); color: #fff; font-size: 11px; line-height: 1; cursor: pointer; }
.dl-root .nv-anexar { display: inline-flex; align-items: center; padding: 8px 12px; border-radius: 10px; border: 1px dashed var(--line); color: var(--subtle); font-size: 12px; cursor: pointer; }
.dl-root .nv-tirar { margin-left: auto; font-family: inherit; font-size: 12px; color: #fca5a5; background: none; border: none; cursor: pointer; padding: 0; box-shadow: none; transform: none; }
.nv-vistos h3 { margin: 0 0 8px; font-size: 14px; color: var(--strong); }
.nv-tabela { overflow-x: auto; }
.nv-tabela table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.nv-tabela th { text-align: left; font-weight: 600; color: var(--placeholder); padding: 8px 10px; border-bottom: 1px solid var(--line); white-space: nowrap; }
.nv-tabela td { padding: 8px 10px; border-bottom: 1px solid var(--line-soft); color: var(--default); white-space: nowrap; }
`;

export default AdminNovidadesPage;
