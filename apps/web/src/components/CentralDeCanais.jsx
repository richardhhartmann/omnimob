import { useEffect, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useConfirm } from "./ConfirmModal";
import { IconeCheck } from "./Icones.jsx";
import { RssSimple, Storefront, WhatsappLogo } from "@phosphor-icons/react";

/* ────────────────────────────────────────────────────────────────────────────
   Onde meus imóveis aparecem.

   ── O PROBLEMA QUE ESTA TELA RESOLVE ──

   Havia uma seção "Portais imobiliários" que mostrava o endereço do feed e
   explicava o que fazer com ele. O que ela não dava era EVIDÊNCIA: quantos
   imóveis estavam no arquivo, se algum portal já tinha vindo buscar, quando.
   Cadastrar a URL lá e voltar aqui não respondia "funcionou?" — e essa é a
   única pergunta que a pessoa tem depois de cadastrar.

   Os outros canais também moravam cada um no seu canto: Facebook e Instagram
   numa caixa própria, Mercado Livre em lugar nenhum, status do WhatsApp só
   dentro do cadastro de imóvel. Não existia a resposta para "onde meus imóveis
   aparecem hoje?".

   Esta tela é essa resposta, e substitui a seção antiga inteira.

   ── OS TRÊS TIPOS, NUMA LISTA SÓ ──

   Portais VÊM BUSCAR; Facebook, Instagram e Mercado Livre são EMPURRADOS por
   nós; status do WhatsApp é MANUAL, porque não há API. São mecânicas
   completamente diferentes — e para quem divulga são todas "lugares onde meu
   imóvel aparece". A diferença é problema nosso, não dela; por isso a lista é
   uma só, e o que muda é a ação de cada linha.
   ──────────────────────────────────────────────────────────────────────────── */

/* O rosto de cada canal, num lugar só.

   Marca se reconhece pelo SÍMBOLO, não pelo nome — numa lista de cinco linhas,
   o ícone é o que o olho acha antes de ler.

   Facebook e Instagram usam os MESMOS desenhos da seção "Contas conectadas",
   logo abaixo nesta página: o `f` sobre o azul sólido e a câmera sobre o
   gradiente. Duas telas mostrando o mesmo Facebook com dois ícones diferentes é
   o tipo de detalhe que ninguém sabe nomear e todo mundo percebe.

   Os dois que não têm logotipo ganham o ícone do que FAZEM: os portais são um
   feed que alguém vem buscar, e o Mercado Livre é uma loja. Melhor um símbolo
   honesto da mecânica do que uma letra dentro de um quadrado.

   O ladrilho é sólido e o traço é branco, como o das contas conectadas — menos
   no Mercado Livre, cujo amarelo exige traço escuro para o símbolo existir. */
const FACEBOOK_SVG = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const INSTAGRAM_SVG = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

const ROSTO = {
  portais: { fundo: "#0ea5e9", glifo: <RssSimple size={16} weight="fill" color="#fff" /> },
  facebook: { fundo: "#1877f2", glifo: FACEBOOK_SVG },
  instagram: {
    fundo: "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
    glifo: INSTAGRAM_SVG,
  },
  // Amarelo do Mercado Livre com o azul deles no símbolo: branco sobre esse
  // amarelo não tem contraste nenhum.
  mercadolivre: { fundo: "#ffe600", glifo: <Storefront size={16} weight="fill" color="#2d3277" /> },
  "whatsapp-status": { fundo: "#25d366", glifo: <WhatsappLogo size={16} weight="fill" color="#fff" /> },
};

const bloco = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: "14px",
  padding: "16px 18px",
};

function BotaoCopiar({ texto }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      className="api-copiar"
      onClick={() => navigator.clipboard?.writeText(texto).then(
        () => { setCopiado(true); setTimeout(() => setCopiado(false), 1800); },
        () => {},
      )}
    >
      {copiado ? <><IconeCheck size={12} /> Copiado</> : "Copiar endereço"}
    </button>
  );
}

function quando(valor) {
  if (!valor) return null;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  const minutos = Math.round((Date.now() - d.getTime()) / 60000);
  if (minutos < 60) return `há ${Math.max(1, minutos)} min`;
  if (minutos < 60 * 48) return `há ${Math.round(minutos / 60)} h`;
  return d.toLocaleDateString("pt-BR");
}

export function CentralDeCanais({ session }) {
  const tenantSlug = session?.tenant?.slug || "";
  const showToast = useOutletContext()?.showToast;
  const { confirm, modal: confirmModal } = useConfirm();
  const [parametros, setParametros] = useSearchParams();

  const [canais, setCanais] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [conectando, setConectando] = useState(false);

  // A ponte não oficial, atrás do aviso.
  const [mostrarPonte, setMostrarPonte] = useState(false);
  const [ponteUrl, setPonteUrl] = useState("");
  const [ponteToken, setPonteToken] = useState("");
  const [salvandoPonte, setSalvandoPonte] = useState(false);

  async function carregar() {
    try {
      const r = await api.listarCanais(tenantSlug);
      setCanais(r.canais || []);
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (!tenantSlug) return;
    carregar();
  }, [tenantSlug]);

  /* O retorno do OAuth do Mercado Livre chega como parâmetro na URL. Limpamos o
     rastro depois de ler — deixá-lo faria a mensagem reaparecer a cada
     recarga, e o endereço na barra mostraria um estado que já passou. */
  useEffect(() => {
    const ml = parametros.get("ml");
    if (!ml) return;
    if (ml === "ok") {
      const conta = parametros.get("conta");
      showToast?.(conta ? `Mercado Livre conectado como ${conta}.` : "Mercado Livre conectado.");
    } else {
      setErro(parametros.get("msg") || "Não foi possível conectar o Mercado Livre.");
    }
    const limpo = new URLSearchParams(parametros);
    limpo.delete("ml"); limpo.delete("conta"); limpo.delete("msg");
    setParametros(limpo, { replace: true });
  }, []);

  async function conectarML() {
    setConectando(true);
    setErro("");
    try {
      const { url } = await api.conectarMercadoLivre(tenantSlug);
      // Sai da aplicação: a autorização acontece no domínio do Mercado Livre.
      window.location.href = url;
    } catch (err) {
      setErro(err.message);
      setConectando(false);
    }
  }

  async function desconectarML() {
    const ok = await confirm(
      "Desconectar o Mercado Livre? Os anúncios já publicados continuam no ar por lá, mas deixamos de conseguir atualizá-los ou encerrá-los daqui.",
      "Desconectar",
      "danger",
    );
    if (!ok) return;
    try {
      await api.desconectarMercadoLivre(tenantSlug);
      showToast?.("Mercado Livre desconectado.");
      carregar();
    } catch (err) {
      showToast?.(err.message, "error");
    }
  }

  async function salvarPonte(e) {
    e.preventDefault();
    /* Uma confirmação com o risco escrito por extenso. Não é cerimônia: o
       número de WhatsApp costuma ser o principal canal de vendas da
       imobiliária, e quem liga isto precisa saber que está apostando ele. */
    const ok = await confirm(
      "Conectar uma ponte automatiza a publicação no status — e viola os Termos de Serviço do WhatsApp. O número usado pode ser BANIDO pela Meta, sem aviso e sem recurso. Use um número secundário, nunca o principal da imobiliária.",
      "Entendi o risco, conectar",
      "danger",
    );
    if (!ok) return;

    setSalvandoPonte(true);
    setErro("");
    try {
      await api.salvarPonteWhatsapp(tenantSlug, { url: ponteUrl.trim(), token: ponteToken.trim() });
      showToast?.("Ponte conectada.");
      setPonteToken("");
      setMostrarPonte(false);
      carregar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvandoPonte(false);
    }
  }

  async function desligarPonte() {
    try {
      await api.salvarPonteWhatsapp(tenantSlug, { url: "", token: "" });
      showToast?.("Ponte desligada. A publicação volta a ser manual.");
      carregar();
    } catch (err) {
      showToast?.(err.message, "error");
    }
  }

  if (carregando) return <p className="api-ajuda">Carregando canais…</p>;

  const status = canais.find((c) => c.id === "whatsapp-status");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {confirmModal}
      {erro ? <div className="error">{erro}</div> : null}

      {canais.map((c) => {
        const rosto = ROSTO[c.id] || ROSTO.portais;
        return (
        <div key={c.id} style={bloco} className="canal">
          <div className="canal__topo">
            <div className="canal__identidade">
              <span className="canal__icone" style={{ background: rosto.fundo }}>
                {rosto.glifo}
              </span>
              <div>
              <strong>{c.nome}</strong>
              <span className={`canal__selo is-${c.conectado ? "on" : "off"}`}>
                {c.tipo === "puxado"
                  ? (c.conectado ? `${c.imoveis} imóveis no feed` : "nenhum imóvel marcado")
                  : c.tipo === "manual"
                    ? "sempre disponível"
                    : (c.conectado ? "conectado" : "não conectado")}
              </span>
              </div>
            </div>
            {c.conta ? <span className="canal__conta">{c.conta}</span> : null}
          </div>

          {c.instrucao ? <p className="api-ajuda" style={{ margin: "8px 0 0" }}>{c.instrucao}</p> : null}

          {/* O endereço do feed — a informação que faltava. Sem ela, a
              imobiliária não tinha o que cadastrar no painel do portal. */}
          {c.feedUrl ? (
            <>
              <div className="api-nova__valor" style={{ marginTop: "10px" }}>
                <code>{c.feedUrl}</code>
                <BotaoCopiar texto={c.feedUrl} />
              </div>
              <p className="api-ajuda" style={{ margin: "8px 0 0" }}>
                {c.ultimaLeitura
                  ? `Um portal veio buscar ${quando(c.ultimaLeitura)}.`
                  : "Nenhum portal veio buscar ainda. Depois de cadastrar o endereço lá, a primeira carga costuma levar algumas horas."}
              </p>
            </>
          ) : null}

          {c.publicados > 0 ? (
            <p className="api-ajuda" style={{ margin: "8px 0 0" }}>
              {c.publicados} {c.publicados === 1 ? "imóvel publicado" : "imóveis publicados"} por aqui.
            </p>
          ) : null}

          {c.id === "mercadolivre" ? (
            <>
              {/* O aviso do pacote vem ANTES da primeira tentativa. É a causa
                  mais comum de "conectei e não publica", e descobrir isso pelo
                  erro da API custa uma tarde. */}
              <p className="imp-aviso" style={{ marginTop: "10px" }}>{c.aviso}</p>
              {!c.disponivel ? (
                <p className="api-ajuda" style={{ margin: "8px 0 0" }}>
                  A integração não está configurada neste ambiente — faltam as credenciais do
                  aplicativo do Mercado Livre.
                </p>
              ) : (
                <div className="api-hook__acoes">
                  {c.conectado ? (
                    <button type="button" className="is-perigo" onClick={desconectarML}>Desconectar</button>
                  ) : (
                    <button type="button" onClick={conectarML} disabled={conectando}>
                      {conectando ? "Abrindo…" : "Conectar conta"}
                    </button>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
        );
      })}

      {/* ── A ponte, atrás de um aviso ────────────────────────────────────────
          Recolhida por padrão, e com o risco escrito. Não é um recurso
          escondido por vergonha: é um recurso que só faz sentido para quem
          aceita apostar um número de WhatsApp, e essa escolha não pode ser
          feita por engano no meio de uma lista de opções. */}
      {status ? (
        <div style={bloco}>
          <div className="canal__topo">
            <div>
              <strong>Publicar no status automaticamente</strong>
              <span className={`canal__selo is-${status.ponte ? "on" : "off"}`}>
                {status.ponte ? "ponte conectada" : "manual"}
              </span>
            </div>
          </div>
          <p className="api-ajuda" style={{ margin: "8px 0 0" }}>
            A Meta não oferece API para status do WhatsApp. Automatizar exige uma <strong>ponte não
            oficial</strong> — um serviço que você contrata (Whapi, Evolution API) e que mantém uma
            sessão do WhatsApp Web aberta.
          </p>

          {status.ponte ? (
            <div className="api-hook__acoes">
              <button type="button" className="is-perigo" onClick={desligarPonte}>Desligar ponte</button>
            </div>
          ) : !mostrarPonte ? (
            <div className="api-hook__acoes">
              <button type="button" onClick={() => setMostrarPonte(true)}>Configurar ponte…</button>
            </div>
          ) : (
            <form onSubmit={salvarPonte} className="api-form" style={{ marginTop: "12px" }}>
              <div className="canal__risco">
                <strong>Isto viola os Termos do WhatsApp</strong>
                <p>
                  O número conectado pode ser <strong>banido pela Meta</strong>, sem aviso e sem
                  recurso. Use um número secundário — nunca o principal da imobiliária. Nós não
                  hospedamos a sessão: o serviço é seu, e o risco também.
                </p>
              </div>
              <label>
                <span>Endereço da ponte</span>
                <input value={ponteUrl} onChange={(e) => setPonteUrl(e.target.value)} placeholder="https://gate.whapi.cloud" inputMode="url" />
                {/* Para o Whapi basta a base — nós montamos o endpoint. Pedir
                    que o cliente descubra o caminho certo era transferir a ele
                    um trabalho nosso, e o resultado foi um 404. */}
                <small>
                  Whapi: cole só <code>https://gate.whapi.cloud</code>. Evolution: cole o endereço
                  completo, com a instância (<code>…/message/sendStatus/sua-instancia</code>).
                </small>
              </label>
              <label>
                <span>Token</span>
                <input value={ponteToken} onChange={(e) => setPonteToken(e.target.value)} placeholder="Token do serviço" type="password" />
              </label>
              <div className="actions">
                <button type="submit" disabled={salvandoPonte} style={{ width: "auto", padding: "10px 20px" }}>
                  {salvandoPonte ? "Salvando…" : "Conectar ponte"}
                </button>
                <button type="button" className="button-secondary" style={{ width: "auto", padding: "10px 20px" }} onClick={() => setMostrarPonte(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
