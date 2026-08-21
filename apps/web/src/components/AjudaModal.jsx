import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { abrirChamado, CATEGORIAS_CHAMADO, EMAIL_SUPORTE } from "../utils/suporte";
import { uploadToCloudinary } from "../utils/uploadToCloudinary";
import { capturarTela, printComoArquivo } from "../utils/capturarTela";

/* ────────────────────────────────────────────────────────────────────────────
   Modal do botão de Ajuda — duas saídas, nesta ordem.

   1. REVER O TOUR DESTA TELA. Vem primeiro porque resolve na hora e sem
      ninguém do outro lado: quem esqueceu onde ficava alguma coisa acha em
      trinta segundos. Só aparece quando a tela atual TEM tour (`tourDaTela`);
      sem isso a opção seria um botão que promete e não entrega.
   2. ABRIR UM CHAMADO. O caminho de quem já sabe que o problema não é falta de
      explicação.

   O chamado é gravado de verdade (`POST /api/chamados`) e aparece para o
   super-admin em Administração › Chamados. Se a requisição falhar, o texto não
   se perde — ver a rede de proteção em `utils/suporte.js` —, e a confirmação
   diz qual dos dois aconteceu, sem prometer o que não houve.
   ──────────────────────────────────────────────────────────────────────────── */

export function AjudaModal({ open, passoInicial = "menu", onClose, tourDaTela, aoReverTour, contexto }) {
  // "menu" → "chamado" → "feito"
  const [vista, setVista] = useState("menu");
  const [form, setForm] = useState({ assunto: "", categoria: "duvida", descricao: "" });
  /* Um print só, tirado automaticamente: `{ blob, dataUrl }` enquanto vive no
     navegador. A URL do Cloudinary só existe depois do envio — não faz sentido
     subir imagem de chamado que talvez nunca seja mandado. */
  const [print, setPrint] = useState(null);
  const [capturando, setCapturando] = useState(false);
  const [incluirPrint, setIncluirPrint] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [recibo, setRecibo] = useState(null);

  /* Abrir JÁ NO CHAMADO quando quem chamou pediu isso.

     O menu do perfil oferece "Abrir um chamado" e "Central de ajuda" como itens
     separados. Cair na central depois de clicar no primeiro seria cobrar um
     passo por uma escolha que a pessoa já fez. */
  useEffect(() => {
    if (open && passoInicial === "chamado") setVista("chamado");
  }, [open, passoInicial]);

  /* Reabrir tem que reabrir do começo: sem isto, quem mandou um chamado e
     voltou depois encontraria a tela de recibo do chamado anterior. */
  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => {
      setVista("menu");
      setForm({ assunto: "", categoria: "duvida", descricao: "" });
      setPrint(null);
      setIncluirPrint(true);
      setErro("");
      setRecibo(null);
    }, 220); // depois da animação de saída
    return () => clearTimeout(t);
  }, [open]);

  /* A CAPTURA ACONTECE NA ABERTURA DO MODAL, não quando a pessoa chega no
     formulário — e é isso que faz o print valer alguma coisa.

     Se esperássemos o passo do chamado, a tela já estaria coberta pelo modal e
     por dois cliques de distância do problema. Aqui o `html2canvas` roda no
     primeiro quadro em que o modal existe e ignora os nós dele (ver
     `ehSobreposicao`), então o que sai é a tela como ela estava um instante
     antes de a pessoa pedir ajuda. */
  useEffect(() => {
    if (!open) return undefined;
    let vivo = true;
    setCapturando(true);
    capturarTela()
      .then((r) => { if (vivo) setPrint(r); })
      .finally(() => { if (vivo) setCapturando(false); });
    return () => { vivo = false; };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const aoTeclar = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", aoTeclar);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  async function enviar(e) {
    e.preventDefault();
    setErro("");
    if (form.assunto.trim().length < 4) { setErro("Escreva um assunto de pelo menos 4 caracteres."); return; }
    if (form.descricao.trim().length < 15) { setErro("Conte um pouco mais — o que aconteceu, e o que você esperava que acontecesse."); return; }
    setEnviando(true);
    try {
      /* O print sobe para o Cloudinary direto do navegador, como as fotos de
         imóvel: o binário não passa pela nossa API, e o chamado guarda a URL.
         Só agora, no envio — subir na captura encheria a conta de imagens de
         chamados que a pessoa desistiu de mandar. */
      let prints = [];
      if (incluirPrint && print?.blob) {
        try {
          const enviado = await uploadToCloudinary(printComoArquivo(print.blob));
          // `uploadToCloudinary` devolve { url, publicId }; o chamado guarda só
          // o endereço.
          if (enviado?.url) prints = [enviado.url];
        } catch (falhaUpload) {
          // Print é acessório. Perder o chamado inteiro porque a imagem não
          // subiu seria trocar o essencial pelo enfeite.
          console.warn("[ajuda] print não subiu:", falhaUpload?.message || falhaUpload);
        }
      }

      const r = await abrirChamado(contexto?.tenantSlug, {
        titulo: form.assunto,
        descricao: form.descricao,
        categoria: form.categoria,
        prints,
        rota: contexto?.rota,
      });
      setRecibo(r);
      setVista("feito");
    } catch (err) {
      // 400 é recusa de validação e volta com a frase do servidor, que diz o
      // que faltou; o resto já virou fila local dentro de `abrirChamado`.
      setErro(err?.message || "Não foi possível registrar agora. Tente de novo em instantes.");
    } finally {
      setEnviando(false);
    }
  }

  function reverTour() {
    onClose?.();
    // Deixa o modal sair de cena antes de o holofote subir; abrir os dois no
    // mesmo quadro faria o tour medir o alvo por trás do backdrop.
    setTimeout(() => aoReverTour?.(), 240);
  }

  return createPortal(
    <>
      <style>{CSS}</style>

      <div
        className={`aj-fundo${open ? " is-aberto" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <div className={`aj-palco${open ? " is-aberto" : ""}`} role="presentation">
        <div className="aj-caixa" role="dialog" aria-modal="true" aria-label="Ajuda">
          <div className="aj-topo">
            <span className="aj-selo" aria-hidden="true">
              <img src="/logo_alt.webp" alt="" />
            </span>
            <div className="aj-topo__texto">
              <span className="aj-eyebrow">AJUDA</span>
              <p className="aj-titulo">
                {vista === "chamado"
                  ? "Abrir um chamado"
                  : vista === "feito"
                    ? (recibo?.enviado ? "Chamado registrado" : "Guardamos o seu texto")
                    : "Como podemos ajudar?"}
              </p>
            </div>
            <button type="button" className="aj-fechar" onClick={onClose} aria-label="Fechar">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                <line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" />
              </svg>
            </button>
          </div>

          {/* ── Escolha ───────────────────────────────────────────────────── */}
          {vista === "menu" ? (
            <div className="aj-opcoes">
              {tourDaTela ? (
                <button type="button" className="aj-opcao" onClick={reverTour}>
                  <span className="aj-opcao__icone" aria-hidden="true">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M9.2 9.2a3 3 0 1 1 4 2.8v1.4" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </span>
                  <span className="aj-opcao__texto">
                    <strong>Rever o tour desta tela</strong>
                    <small>
                      O passo a passo de <em>{tourDaTela.titulo}</em>, do começo. Leva menos de um minuto
                      e você pode sair a qualquer momento.
                    </small>
                  </span>
                  <span className="aj-opcao__seta" aria-hidden="true">→</span>
                </button>
              ) : null}

              <button type="button" className="aj-opcao" onClick={() => setVista("chamado")}>
                <span className="aj-opcao__icone" aria-hidden="true">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-3.9-.9L3 21l1.9-5A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z" />
                  </svg>
                </span>
                <span className="aj-opcao__texto">
                  <strong>Abrir um chamado</strong>
                  <small>Achou um erro, algo não funcionou como deveria ou você tem uma sugestão?</small>
                </span>
                <span className="aj-opcao__seta" aria-hidden="true">→</span>
              </button>
            </div>
          ) : null}

          {/* ── Formulário do chamado ─────────────────────────────────────── */}
          {vista === "chamado" ? (
            <form className="aj-form" onSubmit={enviar}>
              <div className="aj-campo">
                <span className="aj-rotulo">Sobre o quê?</span>
                <div className="aj-categorias">
                  {CATEGORIAS_CHAMADO.map((cat) => (
                    <button
                      key={cat.valor}
                      type="button"
                      title={cat.dica}
                      className={`aj-cat${form.categoria === cat.valor ? " is-ativa" : ""}`}
                      onClick={() => setForm((p) => ({ ...p, categoria: cat.valor }))}
                    >
                      {cat.rotulo}
                    </button>
                  ))}
                </div>
              </div>

              <div className="aj-campo">
                <span className="aj-rotulo">Assunto</span>
                <input
                  className="aj-input"
                  placeholder="Em uma linha: o que aconteceu"
                  value={form.assunto}
                  maxLength={120}
                  disabled={enviando}
                  onChange={(e) => setForm((p) => ({ ...p, assunto: e.target.value }))}
                  autoFocus
                />
              </div>

              <div className="aj-campo">
                <span className="aj-rotulo">O que aconteceu</span>
                <textarea
                  className="aj-input aj-area"
                  rows={5}
                  maxLength={2000}
                  placeholder="Descreva o passo a passo: o que você fez, o que apareceu e o que você esperava que acontecesse."
                  value={form.descricao}
                  disabled={enviando}
                  onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
                />
              </div>

              {/* Print da tela — já capturado, nada para a pessoa fazer além
                  de decidir se manda. O clique na miniatura abre em tamanho
                  real, para ela conferir o que está enviando antes de enviar. */}
              <div className="aj-campo">
                <span className="aj-rotulo">Print da tela</span>

                {capturando ? (
                  <div className="aj-print-caixa is-esperando">
                    <span className="aj-print__girando" aria-hidden="true" />
                    <span className="aj-print-caixa__texto">
                      <strong>Capturando a sua tela…</strong>
                    </span>
                  </div>
                ) : print ? (
                  <>
                    <label className={`aj-print-caixa${incluirPrint ? " is-on" : ""}`}>
                      <input
                        type="checkbox"
                        checked={incluirPrint}
                        onChange={(e) => setIncluirPrint(e.target.checked)}
                        disabled={enviando}
                      />
                      <a
                        href={print.dataUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="aj-print-mini"
                        title="Abrir o print em tamanho real"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <img src={print.dataUrl} alt="Print da tela capturado automaticamente" />
                      </a>
                      <span className="aj-print-caixa__texto">
                        <strong>Anexar esta imagem</strong>
                        <small>
                          Tiramos sozinhos, da tela em que você estava. Clique na miniatura para
                          ver em tamanho real.
                        </small>
                      </span>
                    </label>
                    <span className="aj-dica">
                      Uma imagem do problema poupa várias mensagens de ida e volta. Desmarque se
                      houver algo na tela que você prefere não enviar.
                    </span>
                  </>
                ) : (
                  <span className="aj-dica">
                    Não consegui capturar a tela neste navegador — descreva o problema abaixo com o
                    máximo de detalhe que puder.
                  </span>
                )}
              </div>

              <p className="aj-nota">
                Enviamos junto a tela em que você está e o seu login,
                para o suporte não precisar perguntar.
              </p>

              {erro ? <p className="aj-erro">{erro}</p> : null}

              <div className="aj-acoes">
                <button type="button" className="aj-btn aj-btn--fantasma" onClick={() => setVista("menu")} disabled={enviando}>
                  Voltar
                </button>
                <button type="submit" className="aj-btn aj-btn--primario" disabled={enviando}>
                  {enviando ? "Registrando…" : "Enviar chamado"}
                </button>
              </div>
            </form>
          ) : null}

          {/* ── Recibo ────────────────────────────────────────────────────── */}
          {vista === "feito" ? (
            <div className="aj-feito">
              {recibo?.enviado ? (
                <>
                  <p className="aj-feito__protocolo">
                    <span>CHAMADO</span>
                    <code>#{recibo.numero}</code>
                  </p>
                  <p className="aj-feito__texto">
                    Recebemos. Guarde este número — é por ele que a gente se acha em qualquer
                    conversa. Você acompanha a resposta pelo e-mail cadastrado na imobiliária.
                  </p>
                </>
              ) : (
                /* Falhou a rede. Dizer "recebemos" aqui seria a única parte
                   desta interface a mentir, e justamente para quem pediu ajuda. */
                <>
                  <p className="aj-feito__texto">
                    <strong>Não conseguimos falar com o servidor agora</strong>, mas o seu texto{" "}
                    {recibo?.guardado
                      ? "ficou guardado neste navegador e será enviado sozinho na próxima vez que você abrir o painel."
                      : "não pôde ser guardado — copie o que você escreveu antes de fechar."}
                  </p>
                  <p className="aj-feito__texto">
                    Se for urgente, escreva para{" "}
                    <a href={`mailto:${EMAIL_SUPORTE}?subject=${encodeURIComponent(form.assunto)}`}>
                      {EMAIL_SUPORTE}
                    </a>.
                  </p>
                </>
              )}
              <div className="aj-acoes">
                <button type="button" className="aj-btn aj-btn--primario" onClick={onClose}>
                  Entendi
                </button>
              </div>
            </div>
          ) : null}

          {/* Rodapé fixo do modal: os documentos da Omnimob alcançáveis de
              dentro do painel. Sem isto, um cliente logado não tinha caminho
              nenhum até os Termos — a landing fica atrás do login. */}
          <div className="aj-legal">
            <Link to="/termos" target="_blank" rel="noreferrer">Termos de Uso</Link>
            <span aria-hidden="true">·</span>
            <Link to="/privacidade" target="_blank" rel="noreferrer">Política de Privacidade</Link>
            <span aria-hidden="true">·</span>
            <Link to="/sobre" target="_blank" rel="noreferrer">Sobre a Omnimob</Link>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

/* ── Estilos ─────────────────────────────────────────────────────────────────
   Escopados em `.aj-*` e com `box-shadow/transform: none` nos botões, porque o
   styles.css global estiliza `button` e `input` por elemento e venceria a
   classe solta. Mesma paleta roxo + dourado do cartão do tour: é a mesma
   conversa, só que num modal.
   ────────────────────────────────────────────────────────────────────────── */

const CSS = `
.aj-fundo {
  position: fixed; inset: 0; z-index: 9500;
  background: rgba(6,4,12,0.6);
  opacity: 0; pointer-events: none;
  transition: opacity 0.22s ease, backdrop-filter 0.22s ease;
}
.aj-fundo.is-aberto {
  opacity: 1; pointer-events: auto;
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
}

.aj-palco {
  position: fixed; inset: 0; z-index: 9501;
  display: flex; align-items: center; justify-content: center; padding: 24px;
  pointer-events: none;
}
.aj-palco.is-aberto { pointer-events: auto; }

.aj-caixa {
  width: 100%; max-width: 460px; max-height: calc(100vh - 48px); overflow-y: auto;
  padding: 20px 22px 20px; border-radius: 18px;
  /* Mesmo par da landing e do cartão do tour: --bg sobre --line. */
  background: #0a0a0b;
  border: 1px solid #232326;
  box-shadow: 0 28px 70px -22px rgba(0,0,0,0.9), inset 0 1px 0 rgba(212,175,55,0.14);
  font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
  color: #e8e8ee;
  opacity: 0; transform: scale(0.96) translateY(10px);
  transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.22,1,0.36,1);
}
.aj-palco.is-aberto .aj-caixa { opacity: 1; transform: none; }

.aj-topo { display: flex; align-items: flex-start; gap: 11px; margin-bottom: 18px; }
/* Sem moldura, como no cartão do tour: o símbolo dourado basta. */
.aj-selo {
  width: 26px; height: 30px; flex-shrink: 0;
  display: grid; place-items: center;
}
.aj-selo img { width: 100%; height: 100%; object-fit: contain; display: block; }
.aj-topo__texto { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.aj-eyebrow {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 8.5px; letter-spacing: 0.16em; text-transform: uppercase; color: #d4af37;
}
.aj-titulo { margin: 0; font-size: 16px; font-weight: 700; letter-spacing: -0.02em; color: #f8fafc; }

.aj-caixa .aj-fechar {
  flex-shrink: 0; width: 24px; height: 24px; padding: 0; margin-top: 2px;
  display: inline-flex; align-items: center; justify-content: center; line-height: 0;
  border: none; border-radius: 999px; background: rgba(167,139,250,0.16);
  color: #cbc3e0; cursor: pointer; box-shadow: none; transform: none;
  transition: background 0.15s ease, color 0.15s ease;
}
.aj-caixa .aj-fechar svg { display: block; }
.aj-caixa .aj-fechar:hover { background: rgba(212,175,55,0.26); color: #fff; box-shadow: none; transform: none; }

/* ── Opções ── */
.aj-opcoes { display: flex; flex-direction: column; gap: 10px; }
.aj-caixa .aj-opcao {
  display: flex; align-items: flex-start; gap: 12px; width: 100%; text-align: left;
  padding: 14px; border-radius: 13px; cursor: pointer;
  background: rgba(139,92,246,0.07); border: 1px solid rgba(167,139,250,0.16);
  color: inherit; font-family: inherit; box-shadow: none; transform: none;
  transition: background 0.16s ease, border-color 0.16s ease;
}
.aj-caixa .aj-opcao:hover {
  background: rgba(139,92,246,0.15); border-color: rgba(212,175,55,0.38);
  box-shadow: none; transform: none;
}
.aj-opcao__icone {
  width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0;
  display: grid; place-items: center;
  background: rgba(139,92,246,0.22); color: #c4b5fd;
}
.aj-caixa .aj-opcao:hover .aj-opcao__icone { color: #d4af37; }
.aj-opcao__texto { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.aj-opcao__texto strong { font-size: 13.5px; font-weight: 650; color: #f1edf9; }
.aj-opcao__texto small { font-size: 12px; line-height: 1.6; color: #a9a3ba; }
.aj-opcao__texto em { color: #c4b5fd; }
.aj-opcao__seta { flex-shrink: 0; align-self: center; color: #7c748f; font-size: 14px; }
.aj-caixa .aj-opcao:hover .aj-opcao__seta { color: #d4af37; }

.aj-vazio {
  margin: 0; padding: 13px 14px; border-radius: 12px;
  font-size: 12.2px; line-height: 1.65; color: #a9a3ba;
  background: rgba(212,175,55,0.08); border: 1px solid rgba(212,175,55,0.20);
}

/* ── Formulário ── */
.aj-form { display: flex; flex-direction: column; gap: 14px; }
.aj-campo { display: flex; flex-direction: column; gap: 7px; }
.aj-rotulo {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 8.5px; letter-spacing: 0.14em; text-transform: uppercase; color: #7c748f;
}
.aj-categorias { display: flex; flex-wrap: wrap; gap: 6px; }
.aj-caixa .aj-cat {
  width: auto; padding: 6px 11px; border-radius: 999px; cursor: pointer;
  font-family: inherit; font-size: 12px; font-weight: 500;
  background: var(--sup-04, rgba(255,255,255,0.04)); border: 1px solid rgba(167,139,250,0.16);
  color: #a9a3ba; box-shadow: none; transform: none;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.aj-caixa .aj-cat:hover { background: rgba(139,92,246,0.14); color: #ede9f6; box-shadow: none; transform: none; }
.aj-caixa .aj-cat.is-ativa {
  background: rgba(139,92,246,0.24); border-color: rgba(212,175,55,0.42); color: #f8fafc;
}

.aj-caixa .aj-input {
  width: 100%; padding: 11px 13px; border-radius: 11px;
  background: var(--sup-04, rgba(255,255,255,0.04)); border: 1px solid rgba(167,139,250,0.18);
  color: #f1edf9; font-family: inherit; font-size: 13px; line-height: 1.55;
  box-shadow: none; transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.aj-caixa .aj-input::placeholder { color: #6f6883; }
.aj-caixa .aj-input:focus {
  outline: none; border-color: #a78bfa;
  box-shadow: 0 0 0 3px rgba(139,92,246,0.18);
}
.aj-caixa .aj-area { resize: vertical; min-height: 96px; }

.aj-nota { margin: 0; font-size: 11.5px; line-height: 1.6; color: #7c748f; }
.aj-dica { font-size: 11px; line-height: 1.55; color: #6f6883; }

/* ── Print automático ── */
.aj-print-caixa {
  display: flex; align-items: center; gap: 12px;
  padding: 11px 13px; border-radius: 12px; cursor: pointer;
  background: var(--sup-03, rgba(255,255,255,0.03)); border: 1px solid rgba(167,139,250,0.16);
  transition: background 0.16s ease, border-color 0.16s ease;
}
.aj-print-caixa:hover { background: rgba(139,92,246,0.10); }
/* Marcado = vai junto. O fio dourado é o mesmo sinal de "isto está ativo" que
   o resto do painel usa. */
.aj-print-caixa.is-on { border-color: rgba(212,175,55,0.36); background: rgba(212,175,55,0.07); }
.aj-print-caixa.is-esperando { cursor: default; }
.aj-print-caixa input[type="checkbox"] { accent-color: #d4af37; width: 15px; height: 15px; flex-shrink: 0; }
.aj-print-caixa__texto { display: grid; gap: 3px; min-width: 0; }
.aj-print-caixa__texto strong { font-size: 12.8px; font-weight: 650; color: #f1edf9; }
.aj-print-caixa__texto small { font-size: 11.5px; line-height: 1.55; color: #a9a3ba; }

/* Miniatura larga: o print é de uma tela, e um quadrado cortaria justamente as
   laterais onde costumam estar o menu e o botão que não funcionou. */
.aj-print-mini {
  width: 96px; height: 60px; border-radius: 8px; overflow: hidden; flex-shrink: 0;
  border: 1px solid var(--linha-10, rgba(255,255,255,0.10)); display: block;
  transition: border-color 0.15s ease;
}
.aj-print-mini:hover { border-color: #d4af37; }
.aj-print-mini img { width: 100%; height: 100%; object-fit: cover; object-position: top left; display: block; }

.aj-print__girando {
  width: 17px; height: 17px; border-radius: 999px;
  border: 2px solid var(--linha-16, rgba(255,255,255,0.16)); border-top-color: #d4af37;
  animation: ajGira 0.8s linear infinite;
}
@keyframes ajGira { to { transform: rotate(360deg); } }
.aj-erro {
  margin: 0; padding: 10px 12px; border-radius: 10px;
  font-size: 12.2px; line-height: 1.55; color: #fca5a5;
  background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.26);
}

/* ── Recibo ── */
.aj-feito { display: flex; flex-direction: column; gap: 12px; }
.aj-feito__protocolo {
  margin: 0; display: flex; align-items: center; gap: 10px;
  padding: 11px 14px; border-radius: 11px;
  background: rgba(212,175,55,0.10); border: 1px solid rgba(212,175,55,0.26);
}
.aj-feito__protocolo span {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 8.5px; letter-spacing: 0.14em; color: #d4af37;
}
.aj-feito__protocolo code {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 13px; color: #f8fafc;
}
.aj-feito__texto { margin: 0; font-size: 12.6px; line-height: 1.7; color: #a9a3ba; }
.aj-feito__texto strong { color: #ede9f6; font-weight: 600; }
.aj-feito__texto a { color: #c4b5fd; text-decoration: underline; text-underline-offset: 2px; }
.aj-feito__texto a:hover { color: #d4af37; }

/* ── Ações ── */
.aj-acoes { display: flex; justify-content: flex-end; gap: 8px; margin-top: 2px; }

.aj-legal {
  display: flex; gap: 8px; align-items: center; justify-content: center; flex-wrap: wrap;
  padding: 12px 20px 16px; border-top: 1px solid var(--linha-07, rgba(255,255,255,0.07));
  font-size: 11.5px; color: var(--text-muted);
}
.aj-legal a { color: var(--text-muted); text-decoration: none; }
.aj-legal a:hover { color: var(--text-main); text-decoration: underline; }
.aj-caixa .aj-btn {
  width: auto; padding: 9px 16px; border-radius: 10px; cursor: pointer;
  font-family: inherit; font-size: 12.5px; font-weight: 600;
  box-shadow: none; transform: none; border: 1px solid transparent;
  transition: filter 0.15s ease, background 0.15s ease, color 0.15s ease;
}
.aj-caixa .aj-btn--primario { background: #d4af37; color: #17130a; font-weight: 700; }
.aj-caixa .aj-btn--primario:hover { background: #e5c158; filter: none; box-shadow: none; transform: none; }
.aj-caixa .aj-btn--fantasma {
  background: transparent; border-color: rgba(167,139,250,0.22); color: #a9a3ba;
}
.aj-caixa .aj-btn--fantasma:hover { background: rgba(139,92,246,0.16); color: #ede9f6; box-shadow: none; transform: none; }
.aj-caixa .aj-btn:disabled { opacity: 0.55; cursor: default; filter: none; }

@media (prefers-reduced-motion: reduce) {
  .aj-fundo, .aj-caixa { transition: none; }
}
`;

export default AjudaModal;
