import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import { uploadLogoWithBackgroundRemoval } from "../utils/uploadToCloudinary";
import { planoInfo, PLANOS } from "../utils/planos";
import { useConfirm } from "../components/ConfirmModal";
import { IconeCelular, IconeCheck, IconeEnvelope, IconeTelefone, IconeX } from "../components/Icones.jsx";
import { DominioVitrine } from "../components/DominioVitrine.jsx";
import { ModalCiencia } from "../components/ModalCiencia.jsx";
import { ImportadorDados, podeImportar } from "../components/ImportadorDados.jsx";

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

/* Esqueleto da tela de Configurações.

   Substitui um "Carregando configurações..." centralizado. A frase informava,
   mas empurrava a página inteira para baixo e depois a puxava de volta quando
   os dados chegavam — e nesta API, com os segundos de latência que ela tem, o
   salto era longo o suficiente para a pessoa clicar no lugar errado.

   O esqueleto ocupa desde já a forma que o conteúdo vai ter: três blocos com
   cabeçalho e campos, nas mesmas medidas das seções reais. Quando os dados
   entram, nada se move.

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

function Secao({ icone, titulo, cor, children }) {
  const accent = cor || "rgba(99,102,241,0.7)";
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "18px", overflow: "hidden" }}>
      {/* Header da seção */}
      <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: "12px" }}>
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
  autoGerarIA: true,
};

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

// ─── Abas ─────────────────────────────────────────────────────────────────────

const TABS = [
  {
    key: "perfil", label: "Perfil", cor: "#6366f1",
    icone: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>,
  },
  {
    key: "aparencia", label: "Aparência", cor: "#8b5cf6",
    icone: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="10.5" r="2.5" /><circle cx="8.5" cy="7.5" r="2.5" /><circle cx="6.5" cy="12.5" r="2.5" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" /></svg>,
  },
  {
    key: "redes", label: "Redes Sociais", cor: "#1877f2",
    icone: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>,
  },
  {
    /* Importação mora aqui, e não numa entrada própria do menu lateral: é coisa
       que se faz uma vez, na mudança de sistema, e um item permanente na
       navegação diária custaria atenção todo dia por uma tarefa de uma semana.
       Configurações já é onde se resolve o que é da imobiliária inteira. */
    key: "dados", label: "Dados", cor: "#0ea5e9",
    icone: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" /><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" /></svg>,
  },
  {
    key: "plano", label: "Plano e recursos", cor: "#d4af37",
    icone: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
  },
];

function TabLink({ active, label, icone, cor, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: "relative", width: "100%", display: "flex", alignItems: "center", gap: "12px",
        padding: "11px 14px", borderRadius: "12px", border: "none", cursor: "pointer",
        background: active ? "rgba(255,255,255,0.06)" : "transparent",
        color: active ? "var(--text)" : "var(--text-muted)",
        fontSize: "13px", fontWeight: 600, textAlign: "left", transition: "background 0.2s, color 0.2s",
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      {active && <span style={{ position: "absolute", left: 0, top: "22%", height: "56%", width: "3px", background: cor, borderRadius: "0 4px 4px 0" }} />}
      <span style={{ width: "30px", height: "30px", borderRadius: "9px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: active ? cor : `${cor}22`, color: active ? "#fff" : cor, transition: "background 0.2s, color 0.2s" }}>
        {icone}
      </span>
      <span style={{ flex: 1, minWidth: 0, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </span>
    </button>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function ConfiguracaoPage({ session, onSessionUpdate }) {
  const tenantSlug = session?.tenant?.slug;
  const [tab, setTab] = useState("perfil");
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [socialStatus, setSocialStatus] = useState(null);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialMsg, setSocialMsg] = useState(null); // { type: "success"|"error", text }
  const [oauthLoading, setOauthLoading] = useState(false);
  const [disconnectLoading, setDisconnectLoading] = useState(false);

  // Processa retorno do OAuth Meta na URL
  useEffect(() => {
    const social = searchParams.get("social");
    if (!social) return;
    setTab("redes"); // volta do OAuth já mostrando a aba de Redes Sociais
    const page = searchParams.get("page");
    const msg = searchParams.get("msg");
    const hasIg = searchParams.get("instagram") === "ok";
    if (social === "connected") {
      const igText = hasIg ? " e Instagram" : ". Instagram não conectado (vincule sua conta Business ao Facebook).";
      setSocialMsg({ type: "success", text: `Facebook${igText} conectados com sucesso! Página: "${page}".` });
    } else if (social === "error") {
      setSocialMsg({ type: "error", text: msg || "Erro ao conectar conta." });
    }
    // Limpa params da URL
    setSearchParams({}, { replace: true });
  }, []);

  // Abre direto numa aba específica quando vier ?tab=... (ex.: CTA de upgrade de
  // plano vindo do cadastro de imóvel ao subir uma foto panorâmica no Básico).
  useEffect(() => {
    const alvo = searchParams.get("tab");
    if (alvo && TABS.some((t) => t.key === alvo)) {
      setTab(alvo);
      const next = new URLSearchParams(searchParams);
      next.delete("tab");
      setSearchParams(next, { replace: true });
    }
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
          secondaryColor: t.secondaryColor || "#d4af37",
          autoGerarIA: t.autoGerarIA ?? true,
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
              secondaryColor: form.secondaryColor,
              autoGerarIA: form.autoGerarIA,
            },
          });
        }
        debounceRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
      } catch {
        setSaveStatus("error");
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

  if (loading) return <EsqueletoConfiguracoes />;

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

      {/* ── Cabeçalho ─── */}
      <div data-tour="config-cabecalho" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: "0 0 4px 0", fontSize: "24px", fontWeight: "700" }}>Configurações</h2>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)" }}>
            Dados cadastrais, contato e identidade visual da imobiliária
          </p>
        </div>
        <div style={{ minHeight: "24px" }}>{saveIndicator}</div>
      </div>

      {/* ── Layout com abas ─── */}
      <div style={{ display: "flex", gap: "24px", alignItems: "flex-start", flexWrap: "wrap" }}>

        {/* ── Menu lateral de abas ─── */}
        <aside style={{ width: "240px", flexShrink: 0, position: "sticky", top: "80px" }}>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
            {/* A aba de Dados some para quem não pode importar nada — sem ela,
                a pessoa abriria uma tela cujo único conteúdo é dizer que ela
                não tem permissão. */}
            {TABS.filter((t) => t.key !== "dados" || podeImportar(session?.usuario?.cargo)).map((t) => (
              <TabLink key={t.key} active={tab === t.key} label={t.label} icone={t.icone} cor={t.cor} onClick={() => setTab(t.key)} />
            ))}
          </div>
        </aside>

        {/* ── Conteúdo da aba ativa ─── */}
        <div key={tab} style={{ flex: 1, minWidth: "300px", display: "flex", flexDirection: "column", gap: "16px", animation: "fadeIn 0.3s ease-out" }}>

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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <ColorPicker
                label="Cor Primária"
                hint="Botões, destaques e elementos principais."
                value={form.primaryColor}
                onChange={(v) => set("primaryColor", v)}
              />
              <ColorPicker
                label="Cor Secundária"
                hint="Badges, acentos e elementos complementares."
                value={form.secondaryColor}
                onChange={(v) => set("secondaryColor", v)}
              />
            </div>

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
            </div>
            <div style={{ width: "280px", flexShrink: 0 }}>
              <BrandPreview form={form} />
            </div>
          </div>
          )}

          {tab === "redes" && (<>
          {/* Redes Sociais */}
          <Secao cor="#1877f2" titulo="Redes Sociais" icone={
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
                <span>{socialMsg.text}</span>
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
          <Secao cor="#0ea5e9" titulo="Importar de outra plataforma" icone={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
              <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
            </svg>
          }>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.6 }}>
              Traga imóveis, clientes e usuários do sistema que você usava antes, a partir de uma
              planilha. Nada é publicado sozinho: os imóveis entram como rascunho para você revisar.
            </p>
            <ImportadorDados session={session} />
          </Secao>
          </>)}

          {tab === "plano" && (<>
          {/* Plano e recursos */}
          <Secao cor="#d4af37" titulo="Plano e recursos" icone={
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
                          const preco = cobranca?.precos?.[p.key]?.rotulo;
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

        </div>

      </div>
    </div>
  );
}
