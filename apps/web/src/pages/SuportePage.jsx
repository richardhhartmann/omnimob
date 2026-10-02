import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import {
  ArrowLeft, ArrowsClockwise, CheckCircle, Lifebuoy, PaperPlaneRight, Plus,
} from "@phosphor-icons/react";
import { api } from "../api";
import { TextoDoChamado } from "../components/TextoDoChamado.jsx";
import {
  EVENTO_CHAMADOS, ROTULO_CATEGORIA, STATUS_CHAMADO, avisarQueChamadosMudaram, quandoChamado as quando,
} from "../utils/suporte";

/* ────────────────────────────────────────────────────────────────────────────
   MEUS CHAMADOS — o lado do cliente na conversa do chamado.

   O chamado nasce no modal de Ajuda e é resolvido pelo suporte; o que esta
   tela dá é o MEIO: ver o que você abriu, saber se alguém leu, ler a resposta
   e responder.

   Lista e conversa são a MESMA página; a rota diz qual das duas
   (`/suporte` e `/suporte/:numero`) — o mesmo arranjo de Cargos e Clientes.
   Separar em dois componentes faria a conversa precisar de um jeito próprio de
   voltar para a lista quando o número não existe.

   ── O QUE ESTA TELA NÃO FAZ ──

   Formulário de chamado. O botão "Abrir chamado" chama o modal de Ajuda (pelo
   contexto do layout), que já sabe capturar a tela, anexar imagem e guardar o
   rascunho. Um segundo formulário aqui seria a mesma regra em dois lugares —
   o defeito que o editor de vitrine teve duas vezes.

   ── AQUI TODO MUNDO É CLIENTE ──

   Inclusive o Administrador da imobiliária. Esta tela nunca oferece "responder
   ao cliente" nem "marcar resolvido pelo suporte": seria ele respondendo a si
   mesmo. O que ele ganha a mais é VISIBILIDADE — ver os chamados dos colegas
   (`podeVerTodos`) —, e não autoridade.

   Encerrar continua sendo de quem abriu: "já resolvi sozinho" é uma resposta
   legítima, e sem isso a lista de quem abre muito chamado nunca esvazia.
   ──────────────────────────────────────────────────────────────────────────── */

function Selo({ status }) {
  const m = STATUS_CHAMADO[status] || STATUS_CHAMADO.ABERTO;
  return (
    <span className="sup-selo" style={{ "--cor": m.cor }} title={m.dica}>{m.rotulo}</span>
  );
}

/** O selo do chamado interno, com quem da equipe o abriu. */
function SeloInterno({ c }) {
  if (!c?.interno) return null;
  return (
    <span className="sup-selo" style={{ "--cor": "#a855f7" }} title="Da equipe da Omnimob para o desenvolvimento">
      Interno{c.abertoPor ? ` · ${c.abertoPor}` : ""}
    </span>
  );
}

export function SuportePage({ session }) {
  const { numero } = useParams();
  return numero ? <Conversa session={session} numero={Number(numero)} /> : <Lista session={session} />;
}

/* ══ A lista ═══════════════════════════════════════════════════════════════ */
function Lista({ session }) {
  const tenantSlug = session?.tenant?.slug || "";
  const contexto = useOutletContext() || {};
  const { showToast, abrirChamado } = contexto;
  const [chamados, setChamados] = useState(null);
  const [podeVerTodos, setPodeVerTodos] = useState(false);
  const [todos, setTodos] = useState(false);
  const [filtro, setFiltro] = useState("abertos");
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (!tenantSlug) return undefined;
    let vivo = true;
    setChamados(null);
    api.listarChamados(tenantSlug, { todos })
      .then((d) => {
        if (!vivo) return;
        setChamados(d?.chamados || []);
        setPodeVerTodos(Boolean(d?.podeVerTodos));
      })
      .catch((e) => { if (vivo) { setChamados([]); showToast?.(e.message, "error"); } });
    return () => { vivo = false; };
  }, [tenantSlug, todos, versao]); // eslint-disable-line react-hooks/exhaustive-deps

  /* O chamado aberto pelo modal entra na lista sem a pessoa recarregar. */
  useEffect(() => {
    const recarregar = () => setVersao((v) => v + 1);
    window.addEventListener(EVENTO_CHAMADOS, recarregar);
    return () => window.removeEventListener(EVENTO_CHAMADOS, recarregar);
  }, []);

  const visiveis = useMemo(
    () => (chamados || []).filter((c) => (filtro === "abertos" ? !c.resolvido : filtro === "resolvidos" ? c.resolvido : true)),
    [chamados, filtro],
  );
  /* "Esperando você" é dos SEUS chamados: o Administrador olhando os da
     equipe não deve responder pelo colega. */
  const meuId = session?.usuario?.id;
  const aguardando = (chamados || []).filter((c) => c.status === "AGUARDANDO_CLIENTE" && (!meuId || c.usuarioId === meuId)).length;

  return (
    <div className="sup" style={{ animation: "fadeIn 0.3s ease-in-out" }}>
      <header className="sup-cabeca">
        <div>
          <h2 className="sup-cabeca__titulo"><Lifebuoy size={24} weight="duotone" /> Meus chamados</h2>
          <p className="sup-cabeca__sub">O que você abriu com o suporte, e as respostas.</p>
        </div>
        <div className="sup-cabeca__acoes">
          <button type="button" className="button-secondary sup-botao" onClick={() => setVersao((v) => v + 1)} title="Buscar de novo">
            <ArrowsClockwise size={14} weight="bold" /> Atualizar
          </button>
          {abrirChamado ? (
            <button type="button" className="sup-botao sup-botao--primario" onClick={abrirChamado}>
              <Plus size={14} weight="bold" /> Abrir chamado
            </button>
          ) : null}
        </div>
      </header>

      {aguardando ? (
        <p className="sup-aviso sup-aviso--alerta">
          <PaperPlaneRight size={14} weight="bold" />
          {aguardando === 1 ? "Um chamado está esperando a sua resposta." : `${aguardando} chamados estão esperando a sua resposta.`}
        </p>
      ) : null}

      <div className="sup-barra">
        <div className="sup-segmento" role="group" aria-label="Filtro">
          {[["abertos", "Em aberto"], ["resolvidos", "Resolvidos"], ["todos", "Todos"]].map(([id, rotulo]) => (
            <button key={id} type="button" className={`sup-segmento__botao${filtro === id ? " is-on" : ""}`} onClick={() => setFiltro(id)}>
              {rotulo}
            </button>
          ))}
        </div>
        {podeVerTodos ? (
          <label className="sup-marcar">
            <input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} />
            <span>Ver os chamados de todos os usuários</span>
          </label>
        ) : null}
      </div>

      {chamados === null ? (
        <div className="sup-esqueletos">
          {[0, 1, 2].map((i) => <span key={i} className="sup-esqueleto" style={{ width: `${85 - i * 14}%` }} />)}
        </div>
      ) : !visiveis.length ? (
        <section className="glass-panel sup-vazio">
          <Lifebuoy size={40} weight="duotone" />
          <h3>{filtro === "resolvidos" ? "Nenhum chamado resolvido" : filtro === "todos" ? "Nenhum chamado ainda" : "Nenhum chamado em aberto"}</h3>
          <p>Quando algo não funcionar, ou você tiver uma dúvida, abra um chamado — o suporte responde por aqui mesmo.</p>
          {abrirChamado ? (
            <button type="button" className="sup-botao sup-botao--primario" onClick={abrirChamado}>
              <Plus size={14} weight="bold" /> Abrir chamado
            </button>
          ) : null}
        </section>
      ) : (
        <ul className="sup-lista">
          {visiveis.map((c) => (
            <li key={c.numero}>
              <Link to={`/suporte/${c.numero}`} className={`glass-panel sup-item${c.status === "AGUARDANDO_CLIENTE" ? " is-esperando" : ""}`}>
                <span className="sup-item__topo">
                  <strong>#{c.numero} · {c.titulo}</strong>
                  <span className="sup-item__selos"><SeloInterno c={c} /><Selo status={c.status} /></span>
                </span>
                <span className="sup-item__meta">
                  {ROTULO_CATEGORIA[c.categoria] || c.categoria}
                  {todos && c.usuario ? ` · ${c.usuario}` : ""}
                  {` · aberto ${quando(c.criadoEm)}`}
                  {c.mensagens ? ` · ${c.mensagens} ${c.mensagens === 1 ? "resposta" : "respostas"}` : " · sem resposta ainda"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ══ A conversa ════════════════════════════════════════════════════════════ */
function Conversa({ session, numero }) {
  const tenantSlug = session?.tenant?.slug || "";
  const showToast = useOutletContext()?.showToast;
  const [chamado, setChamado] = useState(null);
  const [erro, setErro] = useState("");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fimRef = useRef(null);

  const carregar = useCallback(async () => {
    try {
      setChamado(await api.lerChamado(tenantSlug, numero));
      setErro("");
      /* Abrir o chamado marca o visto no servidor: o selo da foto do perfil
         desce agora, e não na próxima volta do relógio. */
      avisarQueChamadosMudaram();
    } catch (e) {
      setErro(e.message || "Não foi possível abrir o chamado.");
    }
  }, [tenantSlug, numero]);

  useEffect(() => {
    if (!tenantSlug || !Number.isInteger(numero)) return;
    carregar();
  }, [tenantSlug, numero, carregar]);

  // A conversa cresce para baixo: a fala nova tem de estar à vista.
  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [chamado?.conversa?.length]);

  async function responder(e) {
    e.preventDefault();
    const limpo = texto.trim();
    if (!limpo || enviando) return;
    setEnviando(true);
    try {
      await api.responderChamado(tenantSlug, numero, { texto: limpo });
      setTexto("");
      await carregar();
    } catch (e2) {
      showToast?.(e2.message || "Não foi possível enviar.", "error");
    } finally {
      setEnviando(false);
    }
  }

  async function mudarStatus(status) {
    setEnviando(true);
    try {
      await api.mudarStatusChamado(tenantSlug, numero, status);
      await carregar();
      showToast?.(status === "RESOLVIDO" ? "Chamado encerrado." : "Chamado reaberto. O suporte foi avisado.", "success");
    } catch (e2) {
      showToast?.(e2.message || "Não foi possível atualizar.", "error");
    } finally {
      setEnviando(false);
    }
  }

  const c = chamado;

  return (
    <div className="sup" style={{ animation: "fadeIn 0.3s ease-in-out" }}>
      <header className="sup-cabeca">
        <div style={{ minWidth: 0 }}>
          <h2 className="sup-cabeca__titulo">{c ? `Chamado #${c.numero}` : "Chamado"}</h2>
          {c ? <p className="sup-cabeca__sub">{c.titulo}</p> : null}
        </div>
        <div className="sup-cabeca__acoes">
          <Link to="/suporte" className="button-secondary sup-botao"><ArrowLeft size={14} weight="bold" /> Meus chamados</Link>
          {c && !c.resolvido ? (
            <button
              type="button"
              className="button-secondary sup-botao"
              onClick={() => mudarStatus("RESOLVIDO")}
              disabled={enviando}
              title="Se você mesmo resolveu, encerre — o suporte para de acompanhar"
            >
              <CheckCircle size={14} weight="bold" /> Já resolvi
            </button>
          ) : null}
          {c?.resolvido ? (
            <button type="button" className="button-secondary sup-botao" onClick={() => mudarStatus("ABERTO")} disabled={enviando}>
              Reabrir
            </button>
          ) : null}
        </div>
      </header>

      {erro ? (
        <p className="sup-aviso sup-aviso--erro">Este chamado não existe ou não é seu.</p>
      ) : !c ? (
        <div className="sup-esqueletos">
          {[0, 1, 2].map((i) => <span key={i} className="sup-esqueleto" style={{ width: `${80 - i * 15}%` }} />)}
        </div>
      ) : (
        <>
          <section className="glass-panel sup-ficha">
            <span className="sup-item__selos"><SeloInterno c={c} /><Selo status={c.status} /></span>
            <small>
              {ROTULO_CATEGORIA[c.categoria] || c.categoria} · aberto {quando(c.criadoEm)}
              {c.interno && c.abertoPor ? ` por ${c.abertoPor}` : c.usuario ? ` por ${c.usuario}` : ""}
            </small>
            {c.rota ? <p className="sup-ficha__rota">Aconteceu em <code>{c.rota}</code></p> : null}
          </section>

          <div className="sup-fio">
            {/* A descrição é a PRIMEIRA fala: separá-la da conversa faria a
                pessoa ler o problema num lugar e a resposta em outro. */}
            <Fala m={{ autorTipo: "CLIENTE", autorNome: c.interno ? c.abertoPor : c.usuario, texto: c.descricao, prints: c.prints, criadoEm: c.criadoEm }} />
            {(c.conversa || []).map((m) => <Fala key={m.id} m={m} />)}
            <div ref={fimRef} />
          </div>

          {c.resolvido ? (
            <p className="sup-aviso sup-aviso--ok">Este chamado está resolvido. Responder aqui o reabre.</p>
          ) : null}

          <form className="glass-panel sup-responder" onSubmit={responder}>
            <textarea
              value={texto}
              rows={3}
              maxLength={4000}
              disabled={enviando}
              placeholder={c.interno ? "Escreva a sua resposta ao desenvolvimento…" : "Escreva a sua resposta ao suporte…"}
              onChange={(e) => setTexto(e.target.value)}
            />
            <div className="sup-responder__acoes">
              <small>{texto.length}/4000</small>
              <button type="submit" className="sup-botao sup-botao--primario" disabled={!texto.trim() || enviando}>
                <PaperPlaneRight size={14} weight="bold" /> {enviando ? "Enviando…" : "Enviar"}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

function Fala({ m }) {
  if (m.autorTipo === "SISTEMA") return <p className="sup-nota">{m.texto}</p>;
  const suporte = m.autorTipo === "SUPORTE";
  return (
    <article className={`sup-fala${suporte ? " is-suporte" : ""}`}>
      <header>
        <strong>{m.autorNome || (suporte ? "Suporte" : "Você")}{suporte ? <span className="sup-fala__casa"> · Omnimob</span> : null}</strong>
        <small>{quando(m.criadoEm)}</small>
      </header>
      <p><TextoDoChamado texto={m.texto || ""} className="sup-tela" /></p>
      {m.prints?.length ? (
        <div className="sup-anexos">
          {m.prints.map((src, i) => (
            <a key={src + i} href={src} target="_blank" rel="noreferrer"><img src={src} alt={`Imagem ${i + 1}`} /></a>
          ))}
        </div>
      ) : null}
    </article>
  );
}
