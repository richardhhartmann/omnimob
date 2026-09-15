import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { ArrowLeft, ArrowsClockwise, Lifebuoy, PaperPlaneRight } from "@phosphor-icons/react";
import { api } from "../api";

/* ────────────────────────────────────────────────────────────────────────────
   Suporte — o lado do cliente na conversa do chamado.

   O chamado já nascia aqui (modal de Ajuda) e era resolvido lá (super-admin);
   o que faltava era o meio: ver o que abriu, saber se alguém leu, ler a
   resposta e responder. Esta tela é o meio.

   Lista e conversa são a MESMA página; a rota diz qual das duas
   (`/suporte` e `/suporte/:numero`) — o mesmo arranjo de Cargos e Clientes.
   Separar em dois componentes faria a conversa precisar de um jeito próprio de
   voltar para a lista quando o número não existe.

   ── O QUE ESTA TELA NÃO FAZ ──

   Abrir chamado. O botão leva ao modal de Ajuda, que já sabe capturar a tela
   e guardar o texto quando a rede cai. Um segundo formulário aqui seria o
   defeito que o editor de vitrine teve duas vezes.
   ──────────────────────────────────────────────────────────────────────────── */

const STATUS = {
  ABERTO:             { rotulo: "Aberto",               cor: "#a5b4fc", dica: "Recebido. O suporte ainda vai responder." },
  EM_ATENDIMENTO:     { rotulo: "Em atendimento",       cor: "#fbbf24", dica: "Alguém do suporte está com o seu chamado." },
  AGUARDANDO_CLIENTE: { rotulo: "Aguardando você",      cor: "#f472b6", dica: "O suporte respondeu e espera a sua resposta." },
  RESOLVIDO:          { rotulo: "Resolvido",            cor: "#86efac", dica: "Fechado. Se voltou a acontecer, é só reabrir." },
};

const CATEGORIA = {
  duvida: "Dúvida de uso",
  problema: "Algo não funciona",
  cobranca: "Plano e cobrança",
  sugestao: "Sugestão",
};

function quando(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const dias = Math.floor((Date.now() - d.getTime()) / 86400000);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (dias <= 0) return `hoje, ${hora}`;
  if (dias === 1) return `ontem, ${hora}`;
  return `${d.toLocaleDateString("pt-BR")} ${hora}`;
}

function Status({ status }) {
  const m = STATUS[status] || STATUS.ABERTO;
  return (
    <span className="chip sup-status" style={{ color: m.cor, background: `${m.cor}1f` }} title={m.dica}>
      {m.rotulo}
    </span>
  );
}

export function SuportePage({ session }) {
  const { numero } = useParams();
  return numero ? <Conversa session={session} numero={Number(numero)} /> : <Lista session={session} />;
}

/* ── A lista ───────────────────────────────────────────────────────────────── */
function Lista({ session }) {
  const tenantSlug = session?.tenant?.slug || "";
  const showToast = useOutletContext()?.showToast;
  const [chamados, setChamados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState("abertos");

  useEffect(() => {
    if (!tenantSlug) return;
    let vivo = true;
    api.listarChamados(tenantSlug)
      .then((l) => { if (vivo) setChamados(l); })
      .catch((e) => showToast?.(e.message, "error"))
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [tenantSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  const visiveis = useMemo(
    () => chamados.filter((c) => (filtro === "abertos" ? !c.resolvido : filtro === "resolvidos" ? c.resolvido : true)),
    [chamados, filtro],
  );
  const aguardando = chamados.filter((c) => c.status === "AGUARDANDO_CLIENTE").length;

  return (
    <div style={{ animation: "fadeIn 0.3s ease-in-out", display: "flex", flexDirection: "column", gap: "20px" }}>
      <header className="sup-cabeca">
        <div>
          <h2 style={{ margin: "0 0 4px 0", fontSize: "24px", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px" }}>
            <Lifebuoy size={24} weight="duotone" />
            Suporte
          </h2>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)" }}>
            Seus chamados com a Omnimob — o que você abriu, o que já foi respondido e o que ainda está com a gente.
            {aguardando ? <strong style={{ color: "#f472b6" }}> {aguardando} esperando a sua resposta.</strong> : null}
          </p>
        </div>
        {/* Abrir chamado é o modal de Ajuda, no menu do perfil (Ajuda ›
            Abrir um chamado). A dica aponta para lá em vez de duplicar o
            formulário — ver o cabeçalho. */}
        <p className="sup-dica">Para abrir um chamado novo, use <strong>Ajuda › Abrir um chamado</strong> no menu do seu perfil.</p>
      </header>

      <div className="glass-panel sup-filtros">
        {[["abertos", "Abertos"], ["resolvidos", "Resolvidos"], ["todos", "Todos"]].map(([chave, rotulo]) => (
          <button key={chave} type="button" className={`sup-filtro${filtro === chave ? " is-on" : ""}`} onClick={() => setFiltro(chave)}>
            {rotulo}
          </button>
        ))}
      </div>

      <div className="glass-panel" style={{ padding: "8px 4px" }}>
        {carregando ? (
          <p className="aud-vazio">Carregando…</p>
        ) : visiveis.length === 0 ? (
          <p className="aud-vazio">
            {filtro === "abertos" && chamados.length
              ? "Nenhum chamado aberto. Tudo respondido."
              : "Nenhum chamado ainda. Quando você abrir um pelo menu de Ajuda, ele aparece aqui."}
          </p>
        ) : (
          <ul className="sup-lista">
            {visiveis.map((c) => (
              <li key={c.numero}>
                <Link to={`/suporte/${c.numero}`} className={`sup-item${c.status === "AGUARDANDO_CLIENTE" ? " is-sua-vez" : ""}`}>
                  <span className="sup-item__numero">#{c.numero}</span>
                  <span className="sup-item__meio">
                    <strong>{c.titulo}</strong>
                    <small>
                      {CATEGORIA[c.categoria] || c.categoria} · aberto por {c.usuario} · {quando(c.criadoEm)}
                      {c.mensagens ? ` · ${c.mensagens} ${c.mensagens === 1 ? "mensagem" : "mensagens"}` : ""}
                    </small>
                  </span>
                  <Status status={c.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ── A conversa ────────────────────────────────────────────────────────────── */
function Conversa({ session, numero }) {
  const tenantSlug = session?.tenant?.slug || "";
  const navigate = useNavigate();
  const showToast = useOutletContext()?.showToast;
  const [chamado, setChamado] = useState(null);
  const [erro, setErro] = useState("");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fimRef = useRef(null);

  async function carregar() {
    try {
      setChamado(await api.lerChamado(tenantSlug, numero));
      setErro("");
    } catch (e) {
      setErro(e.message || "Não foi possível abrir o chamado.");
    }
  }

  useEffect(() => {
    if (!tenantSlug || !Number.isInteger(numero)) return;
    carregar();
  }, [tenantSlug, numero]); // eslint-disable-line react-hooks/exhaustive-deps

  // A conversa abre no fim, como qualquer conversa.
  useEffect(() => { fimRef.current?.scrollIntoView({ block: "nearest" }); }, [chamado?.conversa?.length]);

  async function responder(e) {
    e.preventDefault();
    const limpo = texto.trim();
    if (!limpo) return;
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

  async function reabrir() {
    setEnviando(true);
    try {
      await api.reabrirChamado(tenantSlug, numero);
      await carregar();
      showToast?.("Chamado reaberto. O suporte foi avisado.", "success");
    } catch (e2) {
      showToast?.(e2.message || "Não foi possível reabrir.", "error");
    } finally {
      setEnviando(false);
    }
  }

  if (erro) {
    return (
      <div style={{ animation: "fadeIn 0.3s ease-in-out" }}>
        <div className="glass-panel" style={{ padding: "32px", textAlign: "center" }}>
          <p style={{ margin: "0 0 14px", color: "var(--text-muted)" }}>{erro}</p>
          <button type="button" className="button-secondary" style={{ width: "auto" }} onClick={() => navigate("/suporte")}>
            <ArrowLeft size={15} /> Voltar para os chamados
          </button>
        </div>
      </div>
    );
  }
  if (!chamado) return <p className="aud-vazio">Carregando…</p>;

  const m = STATUS[chamado.status] || STATUS.ABERTO;
  const resolvido = chamado.status === "RESOLVIDO";

  return (
    <div style={{ animation: "fadeIn 0.3s ease-in-out", display: "flex", flexDirection: "column", gap: "16px" }}>
      <header className="sup-cabeca">
        <div style={{ minWidth: 0 }}>
          <Link to="/suporte" className="sup-voltar"><ArrowLeft size={14} /> Meus chamados</Link>
          <h2 style={{ margin: "6px 0 4px 0", fontSize: "22px", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span className="sup-item__numero">#{chamado.numero}</span>
            {chamado.titulo}
            <Status status={chamado.status} />
          </h2>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>
            {CATEGORIA[chamado.categoria] || chamado.categoria} · aberto por {chamado.usuario} · {quando(chamado.criadoEm)} · {m.dica}
          </p>
        </div>
        <button type="button" className="button-secondary sup-atualizar" onClick={carregar} title="Atualizar">
          <ArrowsClockwise size={15} /> Atualizar
        </button>
      </header>

      <div className="glass-panel sup-fio">
        {/* A abertura: é a descrição do chamado, não uma mensagem — por isso
            fica no cabeçalho do fio e não duplicada na tabela de mensagens. */}
        <article className="sup-balao is-cliente">
          <header><strong>{chamado.usuario}</strong><time>{quando(chamado.criadoEm)}</time></header>
          <p>{chamado.descricao}</p>
          {chamado.prints?.length ? (
            <div className="sup-prints">
              {chamado.prints.map((url, n) => (
                <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Print ${n + 1}`} /></a>
              ))}
            </div>
          ) : null}
          {chamado.rota ? <small className="sup-rota">na tela {chamado.rota}</small> : null}
        </article>

        {chamado.conversa.map((msg) =>
          msg.autorTipo === "SISTEMA" ? (
            <p key={msg.id} className="sup-sistema"><span>{msg.texto}</span><time>{quando(msg.criadoEm)}</time></p>
          ) : (
            <article key={msg.id} className={`sup-balao ${msg.autorTipo === "SUPORTE" ? "is-suporte" : "is-cliente"}`}>
              <header>
                <strong>{msg.autorTipo === "SUPORTE" ? `${msg.autorNome} · Omnimob` : msg.autorNome}</strong>
                <time>{quando(msg.criadoEm)}</time>
              </header>
              <p>{msg.texto}</p>
              {msg.prints?.length ? (
                <div className="sup-prints">
                  {msg.prints.map((url, n) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Print ${n + 1}`} /></a>
                  ))}
                </div>
              ) : null}
            </article>
          ),
        )}
        <div ref={fimRef} />
      </div>

      {/* Responder num chamado resolvido o reabre; a tela avisa antes de a
          pessoa descobrir pelo status mudando. */}
      <form className="glass-panel sup-responder" onSubmit={responder}>
        {resolvido ? (
          <p className="sup-resolvido-aviso">
            Este chamado está resolvido. Escrever aqui o reabre — ou{" "}
            <button type="button" className="sup-link" onClick={reabrir} disabled={enviando}>reabra sem escrever</button>.
          </p>
        ) : null}
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={resolvido ? "Voltou a acontecer? Conte o que mudou…" : "Escreva sua resposta…"}
          rows={3}
          maxLength={4000}
          disabled={enviando}
        />
        <div className="sup-responder__acoes">
          <small>{texto.length}/4000</small>
          <button type="submit" style={{ width: "auto", padding: "10px 18px" }} disabled={enviando || !texto.trim()}>
            <PaperPlaneRight size={15} weight="bold" /> {enviando ? "Enviando…" : resolvido ? "Enviar e reabrir" : "Enviar"}
          </button>
        </div>
      </form>
    </div>
  );
}
