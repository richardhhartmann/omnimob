import { useEffect, useRef, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { CartaoDeMenu } from "../components/CartaoDeMenu.jsx";
import { Trilha } from "../components/Trilha.jsx";
import { ABAS_CONFIG, ICONES_CONFIG, ehAbaDeConfig, rotuloDaAba } from "../utils/abasConfiguracoes";
import { GearSix } from "@phosphor-icons/react";
import { api } from "../api";
import { uploadLogoWithBackgroundRemoval } from "../utils/uploadToCloudinary";
import { planoInfo, PLANOS } from "../utils/planos";
import { useConfirm } from "../components/ConfirmModal";
import { IconeCelular, IconeCheck, IconeEnvelope, IconeTelefone, IconeX } from "../components/Icones.jsx";
import { DominioVitrine } from "../components/DominioVitrine.jsx";
import { ModalCiencia } from "../components/ModalCiencia.jsx";
import { ImportadorDados, podeImportar } from "../components/ImportadorDados.jsx";
import { ApiDoTenant } from "../components/ApiDoTenant.jsx";
import { CentralDeCanais } from "../components/CentralDeCanais.jsx";
import { MarcaDaguaConfig } from "../components/MarcaDaguaConfig.jsx";
import { OPACIDADE_PADRAO } from "../utils/marcaDagua";
import { TEMAS } from "../utils/temaDoPainel";

// ─── Formatadores ─────────────────────────────────────────────────────────────

function formatCnpj(v) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatTelefone(v) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function formatCep(v) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/* Data por extenso, curta. Devolve string vazia para valor ausente ou inválido:
   quem chama monta a frase em volta, e um "Invalid Date" no meio do aviso de
   cancelamento seria pior que a frase sem a data. */
function formatarData(valor) {
  if (!valor) return "";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

/* Esqueleto de UMA SEÇÃO de Configurações — nunca do índice.

   Substitui um "Carregando configurações..." centralizado. A frase informava,
   mas empurrava a página inteira para baixo e depois a puxava de volta quando
   os dados chegavam — e nesta API, com os segundos de latência que ela tem, o
   salto era longo o suficiente para a pessoa clicar no lugar errado.

   O ÍNDICE não passa por aqui. Ele é uma grade de cartões montada a partir do
   cargo que já está na sessão: não espera resposta nenhuma do servidor, e
   segurá-lo atrás do `loading` era mostrar a silhueta de um formulário para
   quem ia receber botões — uma tela piscando na forma de outra. Abre direto,
   como Relatórios, que faz a mesma pergunta e nunca teve espera.

   O que sobra é a espera legítima: entrar direto num endereço de seção
   (`/configuracoes?ver=perfil`) enquanto o perfil da imobiliária ainda vem. Aí
   o esqueleto ocupa desde já a forma do conteúdo — três blocos com cabeçalho e
   campos, nas medidas das seções reais —, e quando os dados entram nada se
   move.

   Não é uma cópia fiel de cada seção de propósito: manter duas árvores em
   sincronia daria trabalho a cada campo novo, e ninguém lê um esqueleto — o
   que importa é a silhueta e a altura. */
function Linha({ largura = "100%", altura = 12, raio = 6 }) {
  return <div className="cfg-esq__linha" style={{ width: largura, height: altura, borderRadius: raio }} />;
}

function EsqueletoConfiguracoes() {
  return (
    <div className="cfg-esq" aria-busy="true" aria-label="Carregando configurações">
      <style>{ESQUELETO_CSS}</style>
      {[0, 1, 2].map((i) => (
        <div className="cfg-esq__secao" key={i}>
          <div className="cfg-esq__cab">
            <div className="cfg-esq__icone" />
            <Linha largura="140px" altura={13} />
          </div>
          <div className="cfg-esq__corpo">
            {/* Dois campos por linha, como o formulário real. */}
            <div className="cfg-esq__par">
              <div><Linha largura="72px" altura={9} /><Linha altura={38} raio={10} /></div>
              <div><Linha largura="90px" altura={9} /><Linha altura={38} raio={10} /></div>
            </div>
            <div><Linha largura="64px" altura={9} /><Linha altura={38} raio={10} /></div>
          </div>
        </div>
      ))}
    </div>
  );
}

const ESQUELETO_CSS = `
.cfg-esq { display: flex; flex-direction: column; gap: 16px; }
.cfg-esq__secao {
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 18px; overflow: hidden;
}
.cfg-esq__cab {
  display: flex; align-items: center; gap: 12px;
  padding: 18px 24px; border-bottom: 1px solid rgba(255,255,255,0.06);
}
.cfg-esq__icone {
  width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0;
  background: rgba(255,255,255,0.06);
}
.cfg-esq__corpo { padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; }
.cfg-esq__corpo > div { display: flex; flex-direction: column; gap: 6px; }
.cfg-esq__par { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
@media (max-width: 640px) { .cfg-esq__par { grid-template-columns: 1fr; } }

/* O brilho corre da esquerda para a direita sobre um fundo fixo. Animar
   \`background-position\` numa faixa larga custa menos que animar opacidade em
   dezenas de elementos, e o movimento único mantém a leitura de "isto ainda
   está chegando" em vez de "isto está piscando". */
.cfg-esq__linha {
  background: linear-gradient(
    90deg,
    rgba(255,255,255,0.05) 0%,
    rgba(255,255,255,0.09) 40%,
    rgba(255,255,255,0.05) 80%
  );
  background-size: 300% 100%;
  animation: cfg-esq-brilho 1.4s ease-in-out infinite;
}
@keyframes cfg-esq-brilho {
  0%   { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}
/* Sem movimento: fica o bloco parado, que já comunica a espera pela forma. */
@media (prefers-reduced-motion: reduce) {
  .cfg-esq__linha { animation: none; }
}
`;

// ─── Primitivos ───────────────────────────────────────────────────────────────

function Campo({ label, hint, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
        {label}
      </label>
      {children}
      {hint && <span style={{ fontSize: "11px", color: "var(--text-muted)", opacity: 0.65 }}>{hint}</span>}
    </div>
  );
}

/* Classes em vez de só estilo inline: o tema claro precisa de um gancho para
   trocar fundo e borda, e `rgba(255,255,255,α)` inline é invisível sobre fundo
   claro. O layout continua inline; virou classe só o que muda com o tema. */
function Secao({ icone, titulo, cor, children }) {
  const accent = cor || "rgba(99,102,241,0.7)";
  return (
    <div className="cfg-secao" style={{ borderRadius: "18px", overflow: "hidden" }}>
      {/* Header da seção */}
      <div className="cfg-secao__cab" style={{ padding: "18px 24px", display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: `${accent}20`, color: accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {icone}
        </div>
        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", letterSpacing: "-0.2px" }}>{titulo}</h3>
      </div>
      {/* Conteúdo */}
      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
        {children}
      </div>
    </div>
  );
}

function ColorPicker({ label, value, onChange, hint }) {
  const [hexInput, setHexInput] = useState(value || "");

  useEffect(() => { setHexInput(value || ""); }, [value]);

  function handleHexChange(raw) {
    setHexInput(raw);
    if (/^#[0-9a-fA-F]{6}$/.test(raw)) onChange(raw);
  }

  return (
    <Campo label={label} hint={hint}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#6366f1"}
            onChange={(e) => { onChange(e.target.value); setHexInput(e.target.value); }}
            style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
          />
          <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: value || "#6366f1", border: "2px solid rgba(255,255,255,0.15)", boxShadow: `0 0 0 4px ${value || "#6366f1"}22` }} />
        </div>
        <input
          type="text"
          value={hexInput}
          onChange={(e) => handleHexChange(e.target.value)}
          placeholder="#6366f1"
          style={{ flex: 1, fontFamily: "monospace", fontSize: "13px", letterSpacing: "0.05em" }}
          maxLength={7}
        />
      </div>
    </Campo>
  );
}

// ─── Preview de marca ─────────────────────────────────────────────────────────

function BrandPreview({ form }) {
  const initial = (form.name || "D").charAt(0).toUpperCase();
  const hasLogo = Boolean(form.logoUrl);

  return (
    <div style={{ position: "sticky", top: "80px", display: "flex", flexDirection: "column", gap: "16px" }}>
      <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
        Pré-visualização da marca
      </span>

      {/* Card de vitrine */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "18px", overflow: "hidden" }}>
        {/* Cabeçalho simulado da vitrine */}
        <div style={{ padding: "20px", background: `linear-gradient(135deg, ${form.primaryColor || "#6366f1"}18 0%, transparent 100%)`, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
            {hasLogo ? (
              <img src={form.logoUrl} alt="logo" style={{ width: "40px", height: "40px", borderRadius: "10px", objectFit: "contain", background: "rgba(255,255,255,0.05)" }} onError={(e) => { e.target.style.display = "none"; }} />
            ) : (
              <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: form.primaryColor || "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: "700", color: "#fff", flexShrink: 0 }}>
                {initial}
              </div>
            )}
            <div>
              <div style={{ fontWeight: "700", fontSize: "14px", lineHeight: 1.2 }}>{form.name || "Nome da empresa"}</div>
              {form.slogan && <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px", fontStyle: "italic" }}>{form.slogan}</div>}
            </div>
          </div>

          {/* Barra de cores */}
          <div style={{ display: "flex", gap: "6px" }}>
            <div style={{ flex: 1, height: "4px", borderRadius: "999px", background: form.primaryColor || "#6366f1" }} />
            <div style={{ width: "30%", height: "4px", borderRadius: "999px", background: form.secondaryColor || "#d4af37" }} />
          </div>
        </div>

        {/* Swatches de cor */}
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {[
            { label: "Cor primária", value: form.primaryColor || "#6366f1" },
            { label: "Cor secundária", value: form.secondaryColor || "#d4af37" },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "24px", height: "24px", borderRadius: "6px", background: value, border: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: "12px", fontWeight: "500" }}>{label}</span>
                <span style={{ display: "block", fontSize: "10px", color: "var(--text-muted)", fontFamily: "monospace" }}>{value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contatos resumidos */}
      {(form.email || form.whatsapp || form.telefone) && (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <span style={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: "2px" }}>Contato</span>
          {form.email && <span style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "5px" }}><IconeEnvelope size={12} /> {form.email}</span>}
          {form.whatsapp && <span style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "5px" }}><IconeCelular size={12} /> {form.whatsapp}</span>}
          {form.telefone && <span style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "5px" }}><IconeTelefone size={12} /> {form.telefone}</span>}
        </div>
      )}

      {(form.endereco || form.cidade) && (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: "2px" }}>Endereço</span>
          {form.endereco && <span style={{ fontSize: "12px" }}>{form.endereco}</span>}
          {(form.cidade || form.estado) && <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{[form.cidade, form.estado].filter(Boolean).join(" / ")}</span>}
        </div>
      )}

      <p style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", opacity: 0.6 }}>
        Atualiza conforme você edita
      </p>
    </div>
  );
}

// ─── Estado inicial ───────────────────────────────────────────────────────────

const EMPTY = {
  name: "", cnpj: "", creci: "", slogan: "",
  whatsapp: "", telefone: "", email: "",
  cep: "", endereco: "", cidade: "", estado: "",
  logoUrl: "", primaryColor: "#6366f1", secondaryColor: "#d4af37",
  // Tema do painel para toda a imobiliária. Padrão do produto é escuro.
  temaImobiliaria: "escuro",
  autoGerarIA: true,
  marcaDaguaAtiva: true, marcaDaguaOpacidade: OPACIDADE_PADRAO,
  /* Os dois campos que a vitrine passou a mostrar de verdade: o widget de
     Números usa `fundadaEm` para dizer "X anos de mercado", e o de Horários
     desenha as faixas de `horarioAtendimento`. Antes os dois eram texto
     digitado dentro da peça — "15 anos de experiência" saía igual para toda
     imobiliária que arrastasse o bloco. */
  fundadaEm: "", horarioAtendimento: [],
};

/* Uma faixa de atendimento em branco. Texto livre no `dias` porque a realidade
   é "Segunda a sexta", "Sábado", "Plantão de domingo" — e sete pares de
   colunas, um por dia da semana, não descrevem nenhuma imobiliária de verdade. */
const FAIXA_VAZIA = { dias: "", abre: "09:00", fecha: "18:00", fechado: false };

/* ─── Rever o tour ────────────────────────────────────────────────────────────
   Apaga o progresso deste usuário e recarrega. O recarregar não é preguiça: o
   tour é decidido na montagem do AdminLayout, que fica ACIMA desta tela — sem
   remontar, o convite só apareceria no próximo login. */
function ReverTour({ tenantSlug }) {
  const [estado, setEstado] = useState("parado"); // parado | indo | erro

  async function reiniciar() {
    if (!tenantSlug || estado === "indo") return;
    setEstado("indo");
    try {
      await api.reiniciarTutorial(tenantSlug);
      window.location.assign("/");
    } catch {
      setEstado("erro");
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
      <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.6, flex: 1, minWidth: "220px" }}>
        {estado === "erro"
          ? "Não consegui reiniciar agora. Tente de novo em instantes."
          : "Refaz a apresentação das telas do painel, do começo."}
      </p>
      <button
        type="button"
        className="button-secondary"
        onClick={reiniciar}
        disabled={estado === "indo"}
        style={{ width: "auto", padding: "9px 18px", flexShrink: 0 }}
      >
        {estado === "indo" ? "Reiniciando…" : "Rever o tour"}
      </button>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function ConfiguracaoPage({ session, onSessionUpdate }) {
  /* Toast SÓ NO ERRO, e é decisão, não esquecimento.

     Esta tela salva sozinha 1,5s depois de a digitação parar, e já tem
     indicador próprio de "Salvando…/Salvo". Um toast por gravação bem-sucedida
     dispararia a cada pausa dentro de um campo de texto — dez avisos para
     escrever um slogan. O indicador cobre o caso bom.

     Falha é outra história: ela é rara, e o indicador de erro é discreto demais
     para algo que significa "o que você acabou de escrever não está salvo". */
  const showToast = useOutletContext()?.showToast;
  const tenantSlug = session?.tenant?.slug;
  /* ── A seção aberta mora no endereço ───────────────────────────────────────
     Era `useState("perfil")`, e o preço disso era não conseguir mandar "olha o
     seu plano" por link, nem deixar o menu lateral abrir uma seção específica —
     ele só sabia trazer a pessoa para a primeira aba. Sem `?ver=`, o que está
     aberto é o índice de cartões, como em Relatórios.

     A permissão entra na leitura, e não só na hora de desenhar: `?ver=dados`
     digitado à mão por quem não pode importar cai no índice em vez de abrir uma
     tela cujo único conteúdo seria dizer que ela não tem permissão. */
  const [searchParams, setSearchParams] = useSearchParams();
  const abasVisiveis = ABAS_CONFIG.filter(
    (a) => a.key !== "dados" || podeImportar(session?.usuario?.cargo)
  );
  const pedida = searchParams.get("ver");
  const tab = abasVisiveis.some((a) => a.key === pedida) ? pedida : "MENU";
  const setTab = (proxima) => setSearchParams(proxima === "MENU" ? {} : { ver: proxima });
  const [form, setForm] = useState(EMPTY);
  const [plano, setPlano] = useState(session?.tenant?.plano || "BASICO");
  const [loading, setLoading] = useState(true);

  /* ── Situação da cobrança ──────────────────────────────────────────────────
     `emTrial` sai de `statusPagamento === "TRIAL"` no servidor, e não do plano:
     um tenant em teste roda com `plano = "PREMIUM"` (o teste libera o produto
     inteiro), então olhar só o plano diria "cliente Premium" para quem ainda
     não pagou nada. Daí a aba precisar das duas informações.
     ──────────────────────────────────────────────────────────────────────── */
  const [cobranca, setCobranca] = useState(null); // { emTrial, precos, ... }
  const [trocandoPlano, setTrocandoPlano] = useState("");
  const [planoMsg, setPlanoMsg] = useState(null);  // { tipo, texto }
  /* Cancelamento em duas etapas, espelhando a rota: `confirmarCancelamento`
     guarda o que o servidor respondeu no ensaio (até quando o acesso vale) e é
     o que abre o modal. Nulo = modal fechado. */
  const [confirmarCancelamento, setConfirmarCancelamento] = useState(null);
  const [cancelando, setCancelando] = useState(false);
  const { confirm, modal: confirmModal } = useConfirm();
  /* Mexer no plano segue a mesma permissão que abre esta tela. Era
     `gerenciarUsuarios`, que dizia respeito a gerir gente e não a contratar —
     e deixava quem administra a equipe trocar o plano da imobiliária. */
  const podeTrocarPlano = Boolean(session?.usuario?.cargo?.verConfiguracoes);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [cepLoading, setCepLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoMsg, setLogoMsg] = useState("");
  const loadedRef = useRef(false);
  const debounceRef = useRef(null);

  // ── Redes Sociais ──
  const [socialStatus, setSocialStatus] = useState(null);
  /* O endereço do feed saiu daqui junto com a seção de portais: quem o monta
     agora é o servidor, e a `CentralDeCanais` o recebe pronto. Montá-lo dos
     dois lados daria duas verdades sobre o mesmo endereço no dia em que a API
     mudar de casa. */
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialMsg, setSocialMsg] = useState(null); // { type: "success"|"error", text }
  const [oauthLoading, setOauthLoading] = useState(false);
  const [disconnectLoading, setDisconnectLoading] = useState(false);

  // Processa retorno do OAuth Meta na URL
  useEffect(() => {
    const social = searchParams.get("social");
    if (!social) return;
    const page = searchParams.get("page");
    const msg = searchParams.get("msg");
    const hasIg = searchParams.get("instagram") === "ok";
    if (social === "connected") {
      const igText = hasIg ? " e Instagram" : ". Instagram não conectado (vincule sua conta Business ao Facebook).";
      setSocialMsg({ type: "success", text: `Facebook${igText} conectados com sucesso! Página: "${page}".` });
    } else if (social === "error") {
      setSocialMsg({ type: "error", text: msg || "Erro ao conectar conta." });
    }
    /* Limpa o rastro do OAuth e deixa só a seção — voltar do Facebook cai em
       Redes Sociais, que é de onde a pessoa saiu. Zerar tudo aqui a jogaria no
       índice, com a mensagem de sucesso numa tela que ela não pediu. */
    setSearchParams({ ver: "redes" }, { replace: true });
  }, []);

  /* `?tab=` é a grafia antiga do mesmo pedido (o CTA de upgrade de plano no
     cadastro de imóvel manda `?tab=plano` ao subir uma panorâmica no Básico).
     Traduzir aqui em vez de aceitar os dois nomes para sempre: um link velho
     que ainda circule continua funcionando, e a barra do navegador passa a
     mostrar o endereço de verdade. */
  useEffect(() => {
    const alvo = searchParams.get("tab");
    if (!alvo || !ehAbaDeConfig(alvo)) return;
    const next = new URLSearchParams(searchParams);
    next.delete("tab");
    next.set("ver", alvo);
    setSearchParams(next, { replace: true });
  }, []);

  useEffect(() => {
    if (!tenantSlug) return;
    api.getTrialStatus(tenantSlug).then(setCobranca).catch(() => setCobranca(null));
  }, [tenantSlug]);

  /* Troca de plano de cliente pagante. O aviso sobre a cobrança está no texto da
     confirmação porque é a única hora em que a pessoa ainda pode desistir — e é
     verdade que o produto muda agora e a fatura não. */
  async function trocarPlano(destino) {
    const de = planoInfo(plano);
    const para = planoInfo(destino);
    const subindo = para.nivel > de.nivel;
    const ok = await confirm(
      `Trocar do plano ${de.nome} para o ${para.nome}? ` +
      (subindo
        ? `Os recursos do ${para.nome} passam a valer imediatamente. `
        : `Os recursos exclusivos do ${de.nome} deixam de aparecer imediatamente. `) +
      "O valor da próxima fatura é ajustado pelo nosso time — a cobrança não muda sozinha aqui.",
      subindo ? "Fazer upgrade" : "Fazer downgrade",
      // Downgrade tira recurso de quem está usando; upgrade não é perigo nenhum.
      subindo ? "primary" : "danger",
    );
    if (!ok) return;

    setTrocandoPlano(destino);
    setPlanoMsg(null);
    try {
      await api.trocarPlano(tenantSlug, destino);
      setPlano(destino);
      // A sessão carrega o plano e é ela que libera recursos nas outras telas;
      // sem sincronizar, o painel só mudaria no próximo login.
      if (onSessionUpdate && session?.tenant) {
        onSessionUpdate({ ...session, tenant: { ...session.tenant, plano: destino } });
      }
      setPlanoMsg({
        tipo: "success",
        texto: `Plano alterado para ${para.nome}. Vamos ajustar a cobrança e confirmar por e-mail.`,
      });
    } catch (err) {
      setPlanoMsg({ tipo: "error", texto: err.message || "Não foi possível trocar o plano." });
    } finally {
      setTrocandoPlano("");
    }
  }

  /* ─── Cancelamento da assinatura ──────────────────────────────────────────
     Primeiro clique não cancela nada: pergunta ao servidor o que aconteceria.
     Ele responde 409 com a data até quando o acesso vale, e é ESSA data que o
     modal mostra. Inventá-la no front (somando 30 dias, por exemplo) daria um
     número que não vem da cobrança real — e a única coisa que a pessoa quer
     saber neste momento é até quando ela ainda tem o que pagou. */
  async function pedirCancelamento() {
    setPlanoMsg(null);
    try {
      // Sem `confirmar`. O caminho normal é o catch: 409 é a resposta esperada.
      await api.cancelarAssinatura(tenantSlug, false);
      /* 200 aqui significaria cancelamento sem confirmação — a rota não faz
         isso, mas se um dia fizer, é melhor a tela recarregar do que mentir. */
      setPlanoMsg({ tipo: "success", texto: "Assinatura cancelada." });
    } catch (err) {
      const corpo = err.body || {};
      if (corpo.code === "CONFIRMAR_CANCELAMENTO") {
        setConfirmarCancelamento({ validoAte: corpo.validoAte, planoAtual: corpo.planoAtual });
        return;
      }
      // EM_TRIAL, JA_CANCELADO e afins já vêm com mensagem pronta e em português.
      setPlanoMsg({ tipo: "error", texto: err.message || "Não foi possível cancelar." });
    }
  }

  async function confirmarCancelamentoAgora() {
    setCancelando(true);
    try {
      const r = await api.cancelarAssinatura(tenantSlug, true);
      setConfirmarCancelamento(null);
      const ate = r?.validoAte ? formatarData(r.validoAte) : null;
      setPlanoMsg({
        tipo: "success",
        texto: ate
          ? `Assinatura cancelada. Seu acesso continua normal até ${ate}, e não haverá nova cobrança.`
          : "Assinatura cancelada. Não haverá nova cobrança.",
      });
      /* Falha parcial: alguma assinatura foi agendada e outra não. Raro, mas
         calar sobre isso deixaria uma cobrança viva sem ninguém saber. */
      if (r?.falhasParciais) {
        setPlanoMsg({
          tipo: "error",
          texto: "Parte do cancelamento não foi concluída. Fale com o time para confirmar que nada continuará sendo cobrado.",
        });
      }
    } catch (err) {
      setConfirmarCancelamento(null);
      setPlanoMsg({ tipo: "error", texto: err.message || "Não foi possível cancelar." });
    } finally {
      setCancelando(false);
    }
  }

  // Carrega status das redes sociais
  useEffect(() => {
    if (!tenantSlug) return;
    setSocialLoading(true);
    api.getSocialStatus(tenantSlug)
      .then(setSocialStatus)
      .catch(() => {})
      .finally(() => setSocialLoading(false));
  }, [tenantSlug]);

  async function handleConectarRedes() {
    if (!tenantSlug) return;
    setOauthLoading(true);
    try {
      const { url } = await api.getSocialOAuthUrl(tenantSlug);
      window.location.href = url;
    } catch (err) {
      setSocialMsg({ type: "error", text: err.message || "Não foi possível iniciar a autenticação." });
      setOauthLoading(false);
    }
  }

  async function handleDesconectarRedes() {
    if (!tenantSlug) return;
    setDisconnectLoading(true);
    try {
      await api.disconnectSocial(tenantSlug);
      setSocialStatus({ facebook: { connected: false, pageName: null }, instagram: { connected: false } });
      setSocialMsg({ type: "success", text: "Contas desconectadas com sucesso." });
    } catch (err) {
      setSocialMsg({ type: "error", text: err.message || "Erro ao desconectar." });
    } finally {
      setDisconnectLoading(false);
    }
  }

  useEffect(() => {
    if (!tenantSlug) return;
    api.getTenantProfile(tenantSlug)
      .then((t) => {
        setForm({
          name: t.name || "",
          cnpj: t.cnpj || "",
          creci: t.creci || "",
          slogan: t.slogan || "",
          whatsapp: t.whatsapp || "",
          telefone: t.telefone || "",
          email: t.email || "",
          cep: t.cep ? formatCep(t.cep) : "",
          endereco: t.endereco || "",
          cidade: t.cidade || "",
          estado: t.estado || "",
          logoUrl: t.logoUrl || "",
          primaryColor: t.primaryColor || "#6366f1",
          temaImobiliaria: t.temaImobiliaria || "escuro",
          secondaryColor: t.secondaryColor || "#d4af37",
          autoGerarIA: t.autoGerarIA ?? true,
          marcaDaguaAtiva: t.marcaDaguaAtiva ?? true,
          marcaDaguaOpacidade: t.marcaDaguaOpacidade ?? OPACIDADE_PADRAO,
          // Número vira string: o input é controlado e `null` o tornaria
          // não-controlado na primeira digitação.
          fundadaEm: t.fundadaEm == null ? "" : String(t.fundadaEm),
          horarioAtendimento: Array.isArray(t.horarioAtendimento) ? t.horarioAtendimento : [],
        });
        setPlano(t.plano || "BASICO");
        loadedRef.current = true;
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tenantSlug]);

  useEffect(() => {
    if (!loadedRef.current || !tenantSlug) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveStatus("idle");
    debounceRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await api.updateTenantConfiguracao(tenantSlug, {
          ...form,
          cep: form.cep.replace(/\D/g, ""),
          /* Campo vazio vira `null`, não `0`: o validador aceita nulo como
             "não informado", e `Number("")` é zero — que passaria a valer como
             ano 0 e seria recusado pelo mínimo de 1900. */
          fundadaEm: form.fundadaEm === "" ? null : Number(form.fundadaEm),
          /* Faixa sem dia descrito não vai para o servidor. Ela existe no
             formulário porque a pessoa acabou de clicar em "adicionar" e ainda
             não digitou — mandar assim só encheria o banco de linhas mudas. */
          horarioAtendimento: form.horarioAtendimento.filter((f) => String(f.dias || "").trim()),
        });
        setSaveStatus("saved");
        /* Sincroniza a sessão local para o painel refletir a identidade na hora.

           AS CORES PRECISAM ESTAR AQUI. O painel lê `session.tenant.primaryColor`
           para pintar o ladrilho da marca, o avatar do perfil e as iniciais das
           listas (via `--tenant-primary`, no AdminLayout). Enquanto elas ficavam
           de fora desta lista, salvar uma cor nova gravava no banco e não mudava
           nada na tela — a sessão continuava com a cor velha até o próximo
           login, e parecia que o salvamento não tinha funcionado. */
        if (onSessionUpdate && session?.tenant) {
          onSessionUpdate({
            ...session,
            tenant: {
              ...session.tenant,
              name: form.name,
              slogan: form.slogan,
              logoUrl: form.logoUrl,
              primaryColor: form.primaryColor,
              temaImobiliaria: form.temaImobiliaria,
              secondaryColor: form.secondaryColor,
              autoGerarIA: form.autoGerarIA,
              /* Sem estas duas na sessao, mudar a marca aqui so valeria no
                 proximo login: quem compoe a foto e o cadastro de imovel, e ele
                 le as preferencias de session.tenant. */
              marcaDaguaAtiva: form.marcaDaguaAtiva,
              marcaDaguaOpacidade: form.marcaDaguaOpacidade,
            },
          });
        }
        debounceRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
      } catch (err) {
        setSaveStatus("error");
        showToast?.(err?.message || "Não foi possível salvar as configurações.", "error");
      }
    }, 1500);
  }, [form]);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleLogoUpload(file) {
    if (!file) return;
    setLogoUploading(true);
    setLogoMsg("");
    try {
      const result = await uploadLogoWithBackgroundRemoval(file);
      set("logoUrl", result.url);
      setLogoMsg(
        result.bgRemoved
          ? "Logo enviada e fundo removido automaticamente."
          : "Logo enviada. Não foi possível remover o fundo automaticamente — a imagem original foi usada."
      );
    } catch (err) {
      setLogoMsg(err.message || "Falha ao enviar a logo.");
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleCepBlur() {
    const clean = form.cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((prev) => ({
          ...prev,
          endereco: data.logradouro || prev.endereco,
          cidade: data.localidade || prev.cidade,
          estado: data.uf || prev.estado,
        }));
      }
    } catch {}
    finally { setCepLoading(false); }
  }

  const saveIndicator = {
    idle: null,
    saving: (
      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text-muted)" }}>
        <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--text-muted)", animation: "pulse 1s infinite" }} />
        Salvando…
      </div>
    ),
    saved: (
      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#86efac" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        Salvo com sucesso
      </div>
    ),
    error: (
      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#fca5a5" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
        Erro ao salvar
      </div>
    ),
  }[saveStatus];

  const inputStyle = {
    width: "100%", boxSizing: "border-box",
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "10px", color: "inherit", padding: "11px 14px", fontSize: "14px",
    outline: "none",
  };

  return (
    <div className="main-content" style={{ animation: "fadeIn 0.3s ease-in-out", display: "flex", flexDirection: "column", gap: "24px" }}>
      {confirmModal}

      {/* A data vem do servidor (do provedor de pagamento, na verdade), não de
          uma conta feita aqui — é o que a pessoa realmente comprou. */}
      <ModalCiencia
        aberto={Boolean(confirmarCancelamento)}
        titulo="Cancelar a assinatura?"
        descricao={
          confirmarCancelamento?.validoAte
            ? `Seu acesso continua igual até ${formatarData(confirmarCancelamento.validoAte)}. Depois dessa data a conta deixa de ser cobrada e o painel fica indisponível.`
            : "Seu acesso continua até o fim do período já pago. Depois disso a conta deixa de ser cobrada e o painel fica indisponível."
        }
        riscos={[
          "A vitrine pública sai do ar no fim do período — quem tiver o link deixa de encontrar seus imóveis.",
          "Os usuários da equipe perdem o acesso ao painel na mesma data.",
          "Nenhuma cobrança nova é feita. O período já pago não é devolvido proporcionalmente.",
        ]}
        textoCiencia="Estou ciente de que a vitrine e o painel ficam indisponíveis ao fim do período já pago, e quero cancelar."
        confirmarLabel={cancelando ? "Cancelando…" : "Cancelar assinatura"}
        aoConfirmar={confirmarCancelamentoAgora}
        aoCancelar={() => setConfirmarCancelamento(null)}
      />

      {tab === "MENU" ? (
        /* ── Índice ───────────────────────────────────────────────────────────
           Configurações tinha cinco abas numa coluna de 240px, e a barra
           lateral do painel logo ao lado — duas navegações verticais
           encostadas, competindo pelo mesmo canto do olho. Agora a tela abre
           como Relatórios e como Gerenciar Imóveis: cartões grandes, um por
           destino, e o submenu da barra leva direto a cada um. */
        <div data-tour="config-cabecalho" className="glass-panel" style={{ textAlign: "center", padding: "56px 40px" }}>
          <h2 style={{ marginBottom: "8px", fontSize: "28px", fontWeight: "700" }}>Configurações</h2>
          <p style={{ marginBottom: "48px", color: "var(--text-muted)", fontSize: "16px" }}>
            Tudo que vale para a imobiliária inteira — dados, identidade visual, redes e plano.
          </p>
          <div
            style={{
              display: "grid",
              /* Duas colunas na largura de trabalho e uma no celular, sem
                 media query: `min(300px, 100%)` impede a coluna de ficar mais
                 larga que a tela, que é o que estourava a grade fixa. */
              gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))",
              gap: "32px", maxWidth: "820px", margin: "0 auto",
            }}
          >
            {abasVisiveis.map((a, i) => {
              /* Número ímpar de cartões: o último ocupa a linha inteira em vez
                 de deixar um buraco do lado. Acontece de verdade — a seção de
                 Dados some para quem não pode importar. */
              const sozinho = abasVisiveis.length % 2 === 1 && i === abasVisiveis.length - 1;
              const cartao = (
                <CartaoDeMenu
                  icon={<a.Icon size={40} weight="duotone" />}
                  title={a.label}
                  desc={a.desc}
                  accent={a.cor}
                  onClick={() => setTab(a.key)}
                />
              );
              return sozinho
                ? <div key={a.key} style={{ gridColumn: "1 / -1" }}>{cartao}</div>
                : <div key={a.key} style={{ display: "contents" }}>{cartao}</div>;
            })}
          </div>
        </div>
      ) : (
        <>
        {/* ── Cabeçalho da seção ─── */}
        <div data-tour="config-secao" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          {/* `GearSix` é o mesmo ícone que Configurações tem na barra lateral, e
              o da seção sai de `ICONES_CONFIG` — a mesma lista que desenha os
              cartões do índice e o submenu. */}
          <Trilha
            itens={[
              { chave: "indice", rotulo: "Configurações", Icone: GearSix, aoIr: () => setTab("MENU") },
              { chave: tab, rotulo: rotuloDaAba(tab), Icone: ICONES_CONFIG[tab], aoIr: () => setTab(tab) },
            ]}
          />
          {/* A mesma margem da trilha, para os dois ficarem na mesma linha. */}
          <div style={{ minHeight: "24px", marginBottom: "20px" }}>{saveIndicator}</div>
        </div>

        {/* ── Conteúdo da seção ───
            O esqueleto entra AQUI e não no lugar da página inteira: o cabeçalho
            acima (voltar ao índice + nome da seção) não depende de dado nenhum,
            então desenhá-lo desde o primeiro quadro evita o pulo que o esqueleto
            existe para evitar. */}
        <div key={tab} style={{ display: "flex", flexDirection: "column", gap: "16px", animation: "fadeIn 0.3s ease-out" }}>
          {loading ? <EsqueletoConfiguracoes /> : <>

          {tab === "perfil" && (<>
          {/* Dados da Empresa */}
          <Secao cor="#6366f1" titulo="Dados da Empresa" icone={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          }>
            <Campo label="Nome da Imobiliária">
              <input style={inputStyle} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Imobiliária Centro" />
            </Campo>
            <Campo label="Slogan" hint="Frase exibida na vitrine pública abaixo do nome.">
              <input style={inputStyle} value={form.slogan} onChange={(e) => set("slogan", e.target.value)} placeholder="Ex: Seu lar ideal com segurança e confiança." />
            </Campo>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Campo label="CNPJ">
                <input style={inputStyle} value={form.cnpj} onChange={(e) => set("cnpj", formatCnpj(e.target.value))} placeholder="00.000.000/0000-00" inputMode="numeric" />
              </Campo>
              <Campo label="CRECI">
                <input style={inputStyle} value={form.creci} onChange={(e) => set("creci", e.target.value)} placeholder="CRECI-SP 12345-F" />
              </Campo>
            </div>
            {/* O widget "Números" da vitrine dizia "15 anos de experiência" para
                toda imobiliária que arrastasse o bloco. A alternativa óbvia era
                contar a partir da criação da conta aqui — e aí uma imobiliária
                de trinta anos que assinou no mês passado anunciaria "0 anos" na
                própria página. O ano de fundação é dela, e só ela sabe. */}
            <Campo label="Ano de fundação" hint="A vitrine usa isto para mostrar seus anos de mercado. Em branco, o número não aparece.">
              <input
                style={{ ...inputStyle, maxWidth: "150px" }}
                value={form.fundadaEm}
                onChange={(e) => set("fundadaEm", e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="Ex: 1998"
                inputMode="numeric"
                maxLength={4}
              />
            </Campo>
          </Secao>

          {/* Contato */}
          <Secao cor="#10b981" titulo="Contato" icone={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          }>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Campo label="WhatsApp">
                <input style={inputStyle} value={form.whatsapp} onChange={(e) => set("whatsapp", formatTelefone(e.target.value))} placeholder="(00) 00000-0000" inputMode="numeric" />
              </Campo>
              <Campo label="Telefone Fixo">
                <input style={inputStyle} value={form.telefone} onChange={(e) => set("telefone", formatTelefone(e.target.value))} placeholder="(00) 0000-0000" inputMode="numeric" />
              </Campo>
            </div>
            <Campo label="E-mail">
              <input style={inputStyle} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="contato@imobiliaria.com.br" type="email" />
            </Campo>
          </Secao>

          {/* Endereço */}
          <Secao cor="#f59e0b" titulo="Endereço" icone={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
          }>
            <Campo label="CEP">
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <input
                  style={{ ...inputStyle, maxWidth: "150px" }}
                  value={form.cep}
                  onChange={(e) => set("cep", formatCep(e.target.value))}
                  onBlur={handleCepBlur}
                  placeholder="00000-000"
                  inputMode="numeric"
                  maxLength={9}
                  disabled={cepLoading}
                />
                {cepLoading && <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Buscando…</span>}
              </div>
            </Campo>
            <Campo label="Endereço">
              <input style={inputStyle} value={form.endereco} onChange={(e) => set("endereco", e.target.value)} placeholder="Rua, número e complemento" />
            </Campo>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: "12px" }}>
              <Campo label="Cidade">
                <input style={inputStyle} value={form.cidade} onChange={(e) => set("cidade", e.target.value)} placeholder="Cidade" />
              </Campo>
              <Campo label="UF">
                <input style={inputStyle} value={form.estado} onChange={(e) => set("estado", e.target.value.toUpperCase())} placeholder="SP" maxLength={2} />
              </Campo>
            </div>
          </Secao>

          {/* ── Horário de atendimento ──────────────────────────────────────
              O widget de Horários guardava isto como HTML solto dentro da peça
              ("Segunda a Sexta: 09h às 18h<br>Sábados: 09h às 13h"). Dava um
              texto apresentável e um dado que nenhuma outra parte do sistema
              conseguia ler — nem o rodapé, nem uma futura resposta automática
              fora do expediente. Aqui ele vira estrutura. */}
          <Secao cor="#38bdf8" titulo="Horário de atendimento" icone={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          }>
            <p style={{ margin: "0 0 4px", fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5 }}>
              A vitrine mostra estas faixas e calcula sozinha se você está aberto agora.
            </p>

            {form.horarioAtendimento.length === 0 ? (
              <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>
                Nenhuma faixa cadastrada — o widget de horários usa o texto escrito no editor de vitrine.
              </p>
            ) : null}

            {form.horarioAtendimento.map((faixa, i) => {
              const trocar = (campo, valor) =>
                set("horarioAtendimento", form.horarioAtendimento.map((f, j) => (j === i ? { ...f, [campo]: valor } : f)));
              return (
                <div key={i} className="cfg-faixa">
                  <input
                    style={inputStyle}
                    value={faixa.dias}
                    onChange={(e) => trocar("dias", e.target.value)}
                    placeholder="Ex: Segunda a sexta"
                  />
                  {/* Faixa marcada como fechada não tem hora para mostrar, e os
                      dois campos saem de cena em vez de ficarem desabilitados:
                      um "09:00 às 18:00" apagado ao lado de "Fechado" é a
                      contradição que a pessoa lê primeiro. */}
                  {faixa.fechado ? (
                    <span className="cfg-faixa__fechado">Sem atendimento</span>
                  ) : (
                    <div className="cfg-faixa__horas">
                      <input style={inputStyle} type="time" value={faixa.abre} onChange={(e) => trocar("abre", e.target.value)} />
                      <span>às</span>
                      <input style={inputStyle} type="time" value={faixa.fecha} onChange={(e) => trocar("fecha", e.target.value)} />
                    </div>
                  )}
                  <label className="cfg-faixa__chave">
                    <input type="checkbox" checked={Boolean(faixa.fechado)} onChange={(e) => trocar("fechado", e.target.checked)} />
                    Fechado
                  </label>
                  <button
                    type="button"
                    className="cfg-faixa__remover"
                    title="Remover faixa"
                    onClick={() => set("horarioAtendimento", form.horarioAtendimento.filter((_, j) => j !== i))}
                  >
                    <IconeX size={13} />
                  </button>
                </div>
              );
            })}

            {form.horarioAtendimento.length < 8 ? (
              <button
                type="button"
                className="button-secondary"
                style={{ width: "auto", marginTop: "4px" }}
                onClick={() => set("horarioAtendimento", [...form.horarioAtendimento, { ...FAIXA_VAZIA }])}
              >
                + Adicionar faixa
              </button>
            ) : null}
          </Secao>

          {/* Endereço da vitrine. Fica no Perfil, junto de "Dados da Empresa",
              porque é identidade da imobiliária — o endereço em que os clientes
              dela vão encontrá-la — e não uma preferência de aparência.

              É a mesma tela do passo 3 do primeiro acesso: quem pulou lá volta
              aqui, e quem escolheu o endereço da Omnimob troca por um próprio
              quando comprar o domínio. */}
          <Secao cor="#d4af37" titulo="Endereço da vitrine" icone={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M2 12h20" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          }>
            <DominioVitrine
              tenantSlug={tenantSlug}
              aoAtualizarTenant={(campos) =>
                onSessionUpdate?.({ ...session, tenant: { ...session.tenant, ...campos } })}
            />
          </Secao>

          {/* Fica no Perfil porque é uma preferência de QUEM está logado, não
              da imobiliária: o reinício vale só para o próprio usuário. */}
          <Secao cor="#818cf8" titulo="Tour guiado" icone={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
          }>
            <ReverTour tenantSlug={tenantSlug} />
          </Secao>
          </>)}

          {tab === "aparencia" && (
          <div style={{ display: "flex", gap: "16px", alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "300px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Identidade Visual */}
          <Secao cor="#8b5cf6" titulo="Identidade Visual" icone={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="13.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="10.5" r="2.5" />
              <circle cx="8.5" cy="7.5" r="2.5" /><circle cx="6.5" cy="12.5" r="2.5" />
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
            </svg>
          }>
            <Campo label="Logotipo" hint="Envie uma imagem (o fundo é removido automaticamente) ou cole a URL de uma imagem hospedada online.">
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <input style={{ ...inputStyle, flex: 1, minWidth: "180px" }} value={form.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://..." />
                <label style={{
                  display: "inline-flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap",
                  padding: "10px 16px", borderRadius: "10px", fontSize: "13px", fontWeight: "600",
                  background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.35)", color: "#c4b5fd",
                  cursor: logoUploading ? "default" : "pointer", opacity: logoUploading ? 0.6 : 1, flexShrink: 0,
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                  {logoUploading ? "Enviando…" : "Enviar imagem"}
                  <input type="file" accept="image/*" disabled={logoUploading} onChange={(e) => { handleLogoUpload(e.target.files?.[0]); e.target.value = ""; }} style={{ display: "none" }} />
                </label>
                {form.logoUrl && (
                  <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <img src={form.logoUrl} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} onError={(e) => { e.target.style.display = "none"; }} />
                  </div>
                )}
              </div>
              {logoMsg && <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "8px 0 0" }}>{logoMsg}</p>}
            </Campo>

            {/* ── Tema do painel, para a imobiliária ────────────────────────
                O PADRÃO da casa, não uma imposição: vale para quem ainda não
                escolheu o próprio tema no perfil. Quem já escolheu continua com
                o seu — o administrador define o ponto de partida de todo mundo,
                não a tela de cada um.

                "Automático" é um valor gravado, não um atalho: quem escolhe
                continua espelhando o sistema operacional a cada acesso. */}
            <Campo
              label="Tema do painel"
              hint="Vale para quem ainda não escolheu um tema no próprio perfil. Não afeta a vitrine."
            >
              <div className="cfg-temas">
                {TEMAS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`cfg-tema${form.temaImobiliaria === t.id ? " is-ativo" : ""}`}
                    onClick={() => set("temaImobiliaria", t.id)}
                  >
                    <span className={`cfg-tema__amostra is-${t.id}`} aria-hidden />
                    <span>
                      <strong>{t.rotulo}</strong>
                      {t.nota ? <small>{t.nota}</small> : null}
                    </span>
                  </button>
                ))}
              </div>
            </Campo>

            {/* As cores são do PAINEL. As da vitrine moram no editor dela, com
                a opção de herdar estas — ver `ShowcaseEditorPage`. Antes eram
                uma coisa só, e mudar a marca da vitrine repintava a ferramenta
                de trabalho da equipe junto. */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <ColorPicker
                label="Cor primária do painel"
                hint="Botões, destaques e elementos principais do painel."
                value={form.primaryColor}
                onChange={(v) => set("primaryColor", v)}
              />
              <ColorPicker
                label="Cor secundária do painel"
                hint="Selos, acentos e elementos complementares."
                value={form.secondaryColor}
                onChange={(v) => set("secondaryColor", v)}
              />
            </div>
            <p style={{ margin: 0, fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.6 }}>
              Estas cores valem só para o painel. As da vitrine pública são definidas no editor de
              vitrine, onde dá para herdar estas ou escolher outras.
            </p>

            {/* Pré-visualização de botões */}
            <div style={{ marginTop: "4px", padding: "16px", background: "rgba(255,255,255,0.02)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", marginRight: "4px" }}>Preview:</span>
              <span style={{ padding: "6px 16px", borderRadius: "8px", background: form.primaryColor || "#6366f1", color: "#fff", fontSize: "12px", fontWeight: "600" }}>
                Ver detalhes
              </span>
              <span style={{ padding: "6px 16px", borderRadius: "8px", background: "transparent", border: `1px solid ${form.primaryColor || "#6366f1"}`, color: form.primaryColor || "#6366f1", fontSize: "12px", fontWeight: "600" }}>
                Saiba mais
              </span>
              <span style={{ padding: "4px 12px", borderRadius: "999px", background: `${form.secondaryColor || "#d4af37"}22`, color: form.secondaryColor || "#d4af37", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Disponível
              </span>
            </div>
          </Secao>

          {/* Marca d’água. Fica logo abaixo da Identidade Visual porque é um USO
              da logo — separá-la em outra aba obrigaria a pessoa a lembrar que a
              imagem que ela acabou de enviar tem um segundo destino. */}
          <Secao cor="#0ea5e9" titulo="Marca d’água nas fotos" icone={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          }>
            <MarcaDaguaConfig
              logoUrl={form.logoUrl}
              ativa={form.marcaDaguaAtiva}
              opacidade={form.marcaDaguaOpacidade}
              onAtiva={(v) => set("marcaDaguaAtiva", v)}
              onOpacidade={(v) => set("marcaDaguaOpacidade", v)}
              tenantSlug={tenantSlug}
              tenantNome={form.name}
            />
          </Secao>
            </div>
            <div style={{ width: "280px", flexShrink: 0 }}>
              <BrandPreview form={form} />
            </div>
          </div>
          )}

          {tab === "redes" && (<>
          {/* ── Onde os imóveis aparecem ──────────────────────────────────────
              Substitui a seção "Portais imobiliários", que mostrava o endereço
              do feed e mais nada. O endereço continua aqui — junto de quantos
              imóveis estão no arquivo e de quando um portal veio buscar pela
              última vez, que é o que responde "cadastrei lá, funcionou?".

              E junto dos outros canais, porque a pergunta de quem divulga é uma
              só: onde meus imóveis aparecem? Que uns sejam buscados, outros
              empurrados e um seja manual é mecânica nossa, não dela. */}
          <Secao cor="#0ea5e9" titulo="Onde seus imóveis aparecem" icone={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1.5" />
            </svg>
          }>
            <CentralDeCanais session={session} />
          </Secao>

          {/* Redes Sociais */}
          <Secao cor="#1877f2" titulo="Contas conectadas" icone={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          }>
            {/* Mensagem de retorno do OAuth */}
            {socialMsg && (
              <div style={{
                padding: "12px 14px", borderRadius: "10px", fontSize: "13px",
                background: socialMsg.type === "success" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                border: `1px solid ${socialMsg.type === "success" ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
                color: socialMsg.type === "success" ? "#6ee7b7" : "#fca5a5",
                display: "flex", alignItems: "flex-start", gap: "10px",
              }}>
                <span style={{ marginTop: "2px", display: "flex" }}>{socialMsg.type === "success" ? <IconeCheck size={13} /> : <IconeX size={13} />}</span>
                {/* `flex: 1` e `minWidth: 0`: sem eles o texto é um filho de
                    flex que encolhe até a largura da MENOR palavra, e a
                    mensagem sai quebrada uma palavra por linha. O botão de
                    fechar tem `margin-left: auto` e ficava com todo o espaço. */}
                <span style={{ flex: 1, minWidth: 0 }}>{socialMsg.text}</span>
                <button type="button" onClick={() => setSocialMsg(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: "inherit", cursor: "pointer", opacity: 0.6, fontSize: "14px", flexShrink: 0 }}>✕</button>
              </div>
            )}

            <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.6" }}>
              Conecte sua <strong style={{ color: "var(--text)" }}>Página do Facebook</strong> e conta <strong style={{ color: "var(--text)" }}>Business do Instagram</strong> para publicar imóveis diretamente pelo painel.
            </p>

            {/* Status das plataformas */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {/* Facebook */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#1877f2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "600", fontSize: "13px" }}>Facebook</div>
                  <div style={{ fontSize: "11px", marginTop: "2px", color: socialStatus?.facebook?.connected ? "#6ee7b7" : "var(--text-muted)" }}>
                    {socialLoading ? "Verificando…" : socialStatus?.facebook?.connected ? `✓ Página: "${socialStatus.facebook.pageName}"` : "Não conectado"}
                  </div>
                </div>
              </div>

              {/* Instagram */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "600", fontSize: "13px" }}>Instagram</div>
                  <div style={{ fontSize: "11px", marginTop: "2px", color: socialStatus?.instagram?.connected ? "#6ee7b7" : "var(--text-muted)" }}>
                    {socialLoading ? "Verificando…" : socialStatus?.instagram?.connected ? "✓ Conta Business conectada" : "Não conectado"}
                  </div>
                </div>
              </div>
            </div>

            {/* Ações */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleConectarRedes}
                disabled={oauthLoading}
                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 18px", borderRadius: "9px", fontSize: "13px", fontWeight: "600", background: "rgba(24,119,242,0.15)", border: "1px solid rgba(24,119,242,0.4)", color: "#60a5fa", cursor: oauthLoading ? "wait" : "pointer", opacity: oauthLoading ? 0.6 : 1 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
                {oauthLoading ? "Redirecionando…" : socialStatus?.facebook?.connected ? "Reconectar conta" : "Conectar Facebook & Instagram"}
              </button>

              {socialStatus?.facebook?.connected && (
                <button
                  type="button"
                  className="btn-danger"
                  onClick={handleDesconectarRedes}
                  disabled={disconnectLoading}
                  style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 18px", borderRadius: "9px", fontSize: "13px", fontWeight: "600", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", cursor: disconnectLoading ? "wait" : "pointer", opacity: disconnectLoading ? 0.6 : 1 }}
                >
                  {disconnectLoading ? "Desconectando…" : "Desconectar"}
                </button>
              )}
            </div>

            <p style={{ margin: 0, fontSize: "11px", color: "var(--text-muted)", opacity: 0.6, lineHeight: "1.6" }}>
              <strong>Pré-requisito:</strong> a conta do Instagram deve ser do tipo Business ou Creator, vinculada à Página do Facebook. A autenticação usa o Meta Graph API v19.0 com permissões <code>pages_manage_posts</code> e <code>instagram_content_publish</code>.
            </p>
          </Secao>
          </>)}

          {tab === "dados" && (<>
          {/* ── Sair vem antes de entrar ─────────────────────────────────────
              "Disponibilizar" fica acima de "Importar" de propósito. A pergunta
              que uma imobiliária faz antes de assinar é "os dados são meus, eu
              consigo tirá-los daqui?" — e a resposta não pode estar embaixo do
              formulário que os traz para dentro. Também é ordem prática: o
              caminho de importar pela API precisa de uma chave, e a chave é
              gerada na seção de cima. */}
          <Secao cor="#22c55e" titulo="Disponibilizar dados" icone={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
            </svg>
          }>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.6 }}>
              Seus imóveis, clientes, equipe e leads acessíveis por API e XML, para o seu site, um
              CRM ou qualquer plataforma que você use. Você controla o que cada chave enxerga e
              revoga qualquer uma a qualquer momento.
            </p>
            <ApiDoTenant session={session} />
          </Secao>

          <Secao cor="#0ea5e9" titulo="Importar de outra plataforma" icone={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
              <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
            </svg>
          }>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.6 }}>
              Traga imóveis, clientes e usuários do sistema que você usava antes — pelo feed XML
              dele ou pela nossa API. Nada é publicado sozinho: os imóveis entram como rascunho
              para você revisar.
            </p>
            <ImportadorDados session={session} />
          </Secao>
          </>)}

          {tab === "plano" && (<>
          {/* Plano e recursos */}
          <Secao cor="#d4af37" titulo="Sua assinatura" icone={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          }>
            {(() => {
              const atual = planoInfo(plano);
              const emTrial = Boolean(cobranca?.emTrial);
              return (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Seu plano atual:</span>
                    {/* Em teste o selo precisa dizer as duas coisas: o produto é
                        o Premium inteiro, mas ninguém pagou por ele ainda. Só
                        "Premium" faria a pessoa achar que já é cliente. */}
                    <span style={{ fontSize: "13px", fontWeight: 700, color: atual.cor, background: `${atual.cor}22`, border: `1px solid ${atual.cor}55`, padding: "4px 12px", borderRadius: "999px" }}>
                      {emTrial ? `${atual.nome} · Teste` : atual.nome}
                    </span>
                  </div>

                  {atual.descricao && (
                    <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.6 }}>
                      {atual.descricao}
                    </p>
                  )}

                  {emTrial && (
                    <p style={{ margin: 0, fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.6, padding: "12px 14px", borderRadius: "12px", background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.22)" }}>
                      Você está testando o <strong style={{ color: "#d4af37" }}>{atual.nome}</strong> sem
                      pagar nada — os recursos são os mesmos que a assinatura desse plano entrega.
                      Para assinar (ou trocar de plano), use o botão de teste no menu lateral{cobranca?.diasRestantes != null ? ` (faltam ${cobranca.diasRestantes} dia${cobranca.diasRestantes === 1 ? "" : "s"})` : ""}.
                    </p>
                  )}

                  {/* Toggle de IA: só existe para quem tem IA. Antes ele
                      aparecia desabilitado a 55% para todo mundo, e um controle
                      que a pessoa nunca vai poder mexer é ruído — a mensagem de
                      "disponível no Premium" já é dada pelos cartões de plano
                      logo abaixo, onde ela pode fazer algo a respeito. */}
                  {atual.ia && (
                    <label style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "14px 16px", borderRadius: "12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", opacity: 1 }}>
                      <input
                        type="checkbox"
                        className="sw"
                        checked={Boolean(form.autoGerarIA)}
                        onChange={(e) => set("autoGerarIA", e.target.checked)}
                        style={{ marginTop: "2px" }}
                      />
                      <span style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 600 }}>Preencher imóvel por IA automaticamente</span>
                        <span style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.5 }}>
                          Ao lançar a primeira foto no cadastro, a IA já preenche título, descrição, tipo e demais campos.
                          {!form.autoGerarIA && <> Desativado — nada é preenchido sozinho, mas o botão "Gerar com IA" continua disponível.</>}
                        </span>
                      </span>
                    </label>
                  )}

                  {/* Upgrade / downgrade: só para quem já é cliente. Em teste a
                      troca de plano não existe — o que existe é assinar. */}
                  {cobranca && !emTrial && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "4px", paddingTop: "18px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 600 }}>Mudar de plano</div>
                        <p style={{ margin: "5px 0 0", fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.6 }}>
                          A mudança vale na hora dentro do painel. O valor da próxima fatura é
                          ajustado pelo nosso time — nada é cobrado por esta tela.
                        </p>
                      </div>

                      {planoMsg && (
                        <p style={{
                          margin: 0, fontSize: "12.5px", lineHeight: 1.6, padding: "10px 13px", borderRadius: "10px",
                          color: planoMsg.tipo === "error" ? "#fca5a5" : "#6ee7b7",
                          background: planoMsg.tipo === "error" ? "rgba(239,68,68,0.10)" : "rgba(16,185,129,0.10)",
                          border: `1px solid ${planoMsg.tipo === "error" ? "rgba(239,68,68,0.28)" : "rgba(16,185,129,0.28)"}`,
                        }}>
                          {planoMsg.texto}
                        </p>
                      )}

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(215px, 1fr))", gap: "10px" }}>
                        {PLANOS.map((p) => {
                          const ehAtual = p.key === atual.key;
                          const subindo = p.nivel > atual.nivel;
                          /* Sempre o mensal, mesmo para quem assinou o anual:
                             esta tela troca o que o tenant USA, não o que ele
                             paga (ver a rota /me/plano), e o valor mensal é a
                             única forma de comparar três planos numa linha. */
                          const preco = cobranca?.precos?.[p.key]?.mensal?.rotulo;
                          const ocupado = Boolean(trocandoPlano);
                          return (
                            <div
                              key={p.key}
                              style={{
                                display: "flex", flexDirection: "column", gap: "7px",
                                padding: "14px 16px", borderRadius: "12px",
                                background: ehAtual ? `${p.cor}14` : "rgba(255,255,255,0.02)",
                                border: `1px solid ${ehAtual ? `${p.cor}66` : "rgba(255,255,255,0.08)"}`,
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                <span style={{ fontSize: "13.5px", fontWeight: 700, color: p.cor }}>{p.nome}</span>
                                {ehAtual && (
                                  <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: "999px" }}>
                                    Atual
                                  </span>
                                )}
                              </div>
                              {preco && <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-muted)" }}>{preco}</span>}
                              <span style={{ fontSize: "11.5px", color: "var(--text-muted)", lineHeight: 1.55, flex: 1 }}>
                                {p.descricao}
                              </span>
                              {!ehAtual && (
                                <button
                                  type="button"
                                  disabled={ocupado || !podeTrocarPlano}
                                  title={podeTrocarPlano ? undefined : "Só quem gerencia usuários pode trocar o plano."}
                                  onClick={() => trocarPlano(p.key)}
                                  style={{
                                    width: "100%", marginTop: "4px", padding: "8px 12px", borderRadius: "9px",
                                    border: subindo ? "none" : "1px solid rgba(255,255,255,0.14)",
                                    background: subindo ? p.cor : "transparent",
                                    color: subindo ? "#0c0f1a" : "var(--text-muted)",
                                    fontSize: "12.5px", fontWeight: 600,
                                    cursor: ocupado || !podeTrocarPlano ? "not-allowed" : "pointer",
                                    opacity: ocupado || !podeTrocarPlano ? 0.55 : 1,
                                    boxShadow: "none", transform: "none",
                                  }}
                                >
                                  {trocandoPlano === p.key
                                    ? "Trocando…"
                                    : subindo ? "Fazer upgrade" : "Fazer downgrade"}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Cancelar assinatura ──────────────────────────────────
                      Fica por último e visualmente apartado, sem competir com a
                      grade de planos: é a saída, e saída não se oferece no meio
                      do caminho de quem está decidindo entre um plano e outro.

                      Só para quem paga. Em teste não há cobrança para cancelar,
                      e a rota recusa com essa explicação — mas nem chegamos lá:
                      sem botão, ninguém tropeça na dúvida. */}
                  {cobranca && !emTrial && podeTrocarPlano && (
                    <div style={{ marginTop: "6px", paddingTop: "18px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "#fca5a5" }}>Cancelar assinatura</div>
                      <p style={{ margin: "5px 0 12px", fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.6 }}>
                        Você continua com acesso normal até o fim do período já pago — nada é
                        interrompido hoje, e nenhuma nova cobrança é feita depois disso.
                      </p>
                      <button
                        type="button"
                        onClick={pedirCancelamento}
                        disabled={cancelando}
                        style={{
                          width: "auto", padding: "9px 16px", borderRadius: "9px",
                          border: "1px solid rgba(239,68,68,0.35)",
                          background: "rgba(239,68,68,0.10)",
                          color: "#fca5a5", fontSize: "12.5px", fontWeight: 600,
                          cursor: cancelando ? "not-allowed" : "pointer",
                          opacity: cancelando ? 0.6 : 1,
                          boxShadow: "none", transform: "none",
                        }}
                      >
                        {cancelando ? "Cancelando…" : "Cancelar minha assinatura"}
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </Secao>
          </>)}

          </>}
        </div>
        </>
      )}
    </div>
  );
}
