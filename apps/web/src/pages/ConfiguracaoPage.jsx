import { useEffect, useRef, useState } from "react";
import { useOutletContext, useSearchParams, useNavigate } from "react-router-dom";
import { GradeDeMenu } from "../components/GradeDeMenu.jsx";
import { Trilha } from "../components/Trilha.jsx";
import { degrausAte } from "../utils/trilhaDoPainel";
import { abasVisiveis, ICONES_CONFIG, ehAbaDeConfig, rotuloDaAba } from "../utils/abasConfiguracoes";
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
import { WhatsappMarca } from "../utils/marcasDeRede.jsx";
import { EditorDeAtalhos } from "../components/EditorDeAtalhos.jsx";
import { apenasMudancas } from "../utils/atalhos";
import { Keyboard } from "@phosphor-icons/react";
import { FLOW, modulosDoTenant } from "../utils/modulos";
import { SecaoFlow } from "../components/flow/SecaoFlow.jsx";
import { SecaoCobranca } from "../components/SecaoCobranca";
import { ToggleDoFlow } from "../components/ToggleDoFlow.jsx";

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
  background: var(--sup-03, rgba(255,255,255,0.03)); border: 1px solid var(--linha-08, rgba(255,255,255,0.08));
  border-radius: 18px; overflow: hidden;
}
.cfg-esq__cab {
  display: flex; align-items: center; gap: 12px;
  padding: 18px 24px; border-bottom: 1px solid var(--linha-06, rgba(255,255,255,0.06));
}
.cfg-esq__icone {
  width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0;
  background: var(--sup-06, rgba(255,255,255,0.06));
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
    var(--sup-05, rgba(255,255,255,0.05)) 0%,
    var(--sup-09, rgba(255,255,255,0.09)) 40%,
    var(--sup-05, rgba(255,255,255,0.05)) 80%
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
/* O cartão avulso do Omnimob Flow morava aqui e foi REMOVIDO: o interruptor
   passou para dentro de cada cartão de plano, onde o preço do módulo já está do
   lado. Ver o comentário na aba de Plano. */

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
          <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: value || "#6366f1", border: "2px solid var(--linha-15, rgba(255,255,255,0.15))", boxShadow: `0 0 0 4px ${value || "#6366f1"}22` }} />
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
      <div style={{ background: "var(--sup-03, rgba(255,255,255,0.03))", border: "1px solid var(--linha-08, rgba(255,255,255,0.08))", borderRadius: "18px", overflow: "hidden" }}>
        {/* Cabeçalho simulado da vitrine */}
        <div style={{ padding: "20px", background: `linear-gradient(135deg, ${form.primaryColor || "#6366f1"}18 0%, transparent 100%)`, borderBottom: "1px solid var(--linha-06, rgba(255,255,255,0.06))" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
            {hasLogo ? (
              <img src={form.logoUrl} alt="logo" style={{ width: "40px", height: "40px", borderRadius: "10px", objectFit: "contain", background: "var(--sup-05, rgba(255,255,255,0.05))" }} onError={(e) => { e.target.style.display = "none"; }} />
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
              <div style={{ width: "24px", height: "24px", borderRadius: "6px", background: value, border: "1px solid var(--linha-10, rgba(255,255,255,0.1))", flexShrink: 0 }} />
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
        <div style={{ background: "var(--sup-02, rgba(255,255,255,0.02))", border: "1px solid var(--linha-07, rgba(255,255,255,0.07))", borderRadius: "14px", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <span style={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: "2px" }}>Contato</span>
          {form.email && <span style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "5px" }}><IconeEnvelope size={12} /> {form.email}</span>}
          {form.whatsapp && <span style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "5px" }}><IconeCelular size={12} /> {form.whatsapp}</span>}
          {form.telefone && <span style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "5px" }}><IconeTelefone size={12} /> {form.telefone}</span>}
        </div>
      )}

      {(form.endereco || form.cidade) && (
        <div style={{ background: "var(--sup-02, rgba(255,255,255,0.02))", border: "1px solid var(--linha-07, rgba(255,255,255,0.07))", borderRadius: "14px", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "4px" }}>
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


// ─── Topologia das integrações sociais ────────────────────────────────────────

/*
  A topologia é navegação além de ser status: TODOS os canais aparecem, mesmo
  quando ainda não estão configurados. Clicar num card leva a pessoa ao ponto
  da própria aba onde aquela integração é feita.

  WhatsApp fica sempre ativo porque não exige conexão OAuth neste fluxo.
  Facebook e Instagram usam o status real já carregado por `getSocialStatus`.
  ZAP, VivaReal e OLX aparecem sempre porque a configuração deles vive em
  `CentralDeCanais`; esta página não duplica a regra do componente nem inventa
  estado de portal. Neles o card funciona como atalho para a configuração XML.
*/
function TopologiaDeRedes({ socialStatus, carregando, erro, aoIrParaConfiguracao, nome, logoUrl }) {
  const facebookAtivo = Boolean(socialStatus?.facebook?.connected);
  const instagramAtivo = Boolean(socialStatus?.instagram?.connected);

  /* ── O CENTRO É A IMOBILIÁRIA, NÃO NÓS ───────────────────────────────

     O nó dizia "Omnimob" com o nosso "O" no disco, e a leitura ficava errada:
     o desenho responde "de onde saem os meus anúncios?", e a resposta é a
     imobiliária — nós somos o encanamento. Com a marca do cliente no meio, o
     mapa passa a ser o dele.

     `logoQuebrou` existe porque a URL do logotipo é digitada à mão num campo
     das Configurações: ela pode apontar para um endereço que morreu. Sem isto
     o disco ficaria vazio, sem nada — e um buraco no centro do mapa parece
     defeito do mapa. Falhando, volta a inicial. */
  const [logoQuebrou, setLogoQuebrou] = useState(false);
  const temLogo = Boolean(logoUrl) && !logoQuebrou;
  const rotulo = (nome || "").trim() || "Sua imobiliária";
  /* A inicial do nome, e não o "O" fixo: ele era a marca da Omnimob, e sobrar
     ali numa conta chamada "Alfa Imóveis" seria a mesma troca de dono. */
  const inicial = rotulo.charAt(0).toUpperCase();

  /*
    No desktop, os canais formam uma topologia radial ao redor da imobiliária:
    WhatsApp fica fixo à esquerda do hub, redes sociais Meta na parte superior
    e portais distribuídos nas laterais/parte inferior. Em telas estreitas o CSS troca para uma composição em grade para
    preservar legibilidade sem sobrepor os cards.
  */
  const canais = [
    {
      key: "whatsapp",
      posicao: "esq",
      nome: "WhatsApp",
      detalhe: "Disponível por padrão",
      sempreAtivo: true,
      monitorado: false,
      alvo: null,
      /* A MARCA, e não um celular genérico. Ao lado do "f" do Facebook e da
         câmera do Instagram — que são as marcas de verdade —, um telefone
         desenhado à mão era o único nó que não se reconhecia de relance. Sai do
         mesmo arquivo que a landing e o cadastro de imóvel usam
         (`utils/marcasDeRede.jsx`), então o glífo é um só no produto inteiro. */
      icone: <WhatsappMarca size={18} />,
    },
    {
      key: "facebook",
      posicao: "sup-esq",
      nome: "Facebook",
      detalhe: facebookAtivo
        ? (socialStatus?.facebook?.pageName ? `Página: ${socialStatus.facebook.pageName}` : "Página conectada")
        : "Clique para conectar",
      ativo: facebookAtivo,
      monitorado: true,
      alvo: "facebook",
      icone: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
        </svg>
      ),
    },
    {
      key: "instagram",
      posicao: "sup-dir",
      nome: "Instagram",
      detalhe: instagramAtivo ? "Conta Business conectada" : "Clique para conectar",
      ativo: instagramAtivo,
      monitorado: true,
      alvo: "instagram",
      icone: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
      ),
    },
    {
      key: "zap",
      posicao: "dir",
      nome: "ZAP Imóveis",
      detalhe: "Integração via XML / VRSync",
      monitorado: false,
      alvo: "portais",
      icone: <span aria-hidden="true" style={{ fontSize: "15px", fontWeight: 900 }}>Z</span>,
    },
    {
      key: "vivareal",
      posicao: "inf-dir",
      nome: "VivaReal",
      detalhe: "Integração via XML / VRSync",
      monitorado: false,
      alvo: "portais",
      icone: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v10h13V10" /><path d="M9 20v-6h6v6" />
        </svg>
      ),
    },
    {
      key: "olx",
      posicao: "inf-esq",
      nome: "OLX Imóveis",
      detalhe: "Integração via XML / VRSync",
      monitorado: false,
      alvo: "portais",
      icone: <span aria-hidden="true" style={{ fontSize: "11px", fontWeight: 900, letterSpacing: "-0.7px" }}>olx</span>,
    },
  ];

  function estadoDo(canal) {
    // WhatsApp não exige OAuth nem feed: a publicação/compartilhamento está
    // disponível no produto por padrão, então este nó é sempre verde.
    if (canal.sempreAtivo) return "ativo";

    // O status dos portais continua pertencendo à CentralDeCanais.
    if (!canal.monitorado) return "configurar";

    /* Falha da rota de status Meta não significa que Facebook E Instagram
       quebraram. É uma falha de consulta. Por isso os nós ficam neutros e o
       aviso global explica o problema, em vez de contar dois erros falsos. */
    if (erro && !socialStatus) return "indisponivel";
    if (carregando && !socialStatus) return "recente";
    return canal.ativo ? "ativo" : "configurar";
  }

  function corDoEstado(estado) {
    if (estado === "ativo") return "#22c55e";
    if (estado === "recente") return "#f59e0b";
    if (estado === "erro") return "#ef4444";
    return "rgba(148,163,184,0.58)";
  }

  const ativos = canais.filter((c) => estadoDo(c) === "ativo").length;
  const configuraveis = canais.filter((c) => estadoDo(c) === "configurar").length;
  const erros = canais.filter((c) => estadoDo(c) === "erro").length;
  /*
    Pontos do diagrama radial. Mantemos as coordenadas em porcentagem do SVG
    para as linhas acompanharem a composição mesmo quando o card muda de
    tamanho. Os cards em si ficam em slots absolutos e responsivos.
  */
  const caminhos = {
    whatsapp:  "M 50 50 C 41 50, 29 50, 15 50",
    facebook:  "M 50 50 C 44 45, 34 26, 20 17",
    instagram: "M 50 50 C 56 45, 66 26, 80 17",
    zap:       "M 50 50 C 62 50, 74 50, 86 50",
    vivareal:  "M 50 50 C 58 58, 67 75, 76 82",
    olx:       "M 50 50 C 42 58, 33 75, 24 82",
  };

  return (
    <div className="cfg-topologia">
      <style>{TOPOLOGIA_REDES_CSS}</style>

      <div className="cfg-topologia__cab">
        <div>
          <h2>Topologia das integrações</h2>
          <p>
            {carregando && !socialStatus
              ? "Verificando conexões…"
              : erro && !socialStatus
                ? `${ativos} ativo${ativos === 1 ? "" : "s"} · ${configuraveis} para configurar · status Meta indisponível`
                : `${ativos} ativo${ativos === 1 ? "" : "s"} · ${configuraveis} para configurar${erros ? ` · ${erros} erro${erros === 1 ? "" : "s"}` : ""}`}
          </p>
        </div>

        <div className="cfg-topologia__legenda" aria-label="Legenda dos estados">
          <span><i style={{ background: "#22c55e" }} />Ativo</span>
          <span><i style={{ background: "#f59e0b" }} />Verificando</span>
          <span><i style={{ background: "#ef4444" }} />Erro</span>
          <span><i className="cfg-topologia__dot-inativo" />Configurar</span>
        </div>
      </div>

      <div className="cfg-topologia__canvas" aria-label="Mapa das integrações da Omnimob">
        <div className="cfg-topologia__grupo cfg-topologia__grupo--social">Redes sociais</div>
        <div className="cfg-topologia__grupo cfg-topologia__grupo--portais">Portais imobiliários</div>

        <svg className="cfg-topologia__linhas" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {canais.map((canal) => {
            const estado = estadoDo(canal);
            return (
              <path
                key={canal.key}
                className={`cfg-topologia__linha cfg-topologia__linha--${estado}`}
                d={caminhos[canal.key]}
                style={{ stroke: corDoEstado(estado) }}
              />
            );
          })}
        </svg>

        <div className="cfg-topologia__node cfg-topologia__node--omnimob">
          <div
            className={`cfg-topologia__omni-icone${temLogo ? " cfg-topologia__omni-icone--logo" : ""}`}
            aria-hidden="true"
          >
            {temLogo
              ? <img src={logoUrl} alt="" onError={() => setLogoQuebrou(true)} />
              : inicial}
          </div>
          <div className="cfg-topologia__node-texto">
            <strong title={rotulo}>{rotulo}</strong>
            <span>Central de publicação</span>
          </div>
        </div>

        {canais.map((canal) => {
          const estado = estadoDo(canal);
          const cor = corDoEstado(estado);
          const detalhe = estado === "recente"
            ? "Verificando…"
            : estado === "erro"
              ? "Erro na integração"
              : estado === "indisponivel"
                ? "Status indisponível · clique para configurar"
                : canal.detalhe;

          const conteudo = (
            <>
              <div className={`cfg-topologia__marca cfg-topologia__marca--${canal.key}`}>
                {canal.icone}
              </div>
              <div className="cfg-topologia__node-texto">
                <strong style={{ color: estado === "erro" ? "#fca5a5" : "inherit" }}>{canal.nome}</strong>
                <span title={detalhe}>{detalhe}</span>
              </div>
              <span className={`cfg-topologia__status cfg-topologia__status--${estado}`} style={{ background: cor }} />
            </>
          );

          return (
            <div
              className={`cfg-topologia__slot cfg-topologia__slot--${canal.posicao}`}
              key={canal.key}
            >
              {canal.alvo ? (
                <button
                  type="button"
                  className="cfg-topologia__node cfg-topologia__node--canal"
                  style={{
                    borderColor: cor,
                    boxShadow: estado === "ativo" ? `0 0 18px ${cor}22` : "none",
                  }}
                  onClick={() => aoIrParaConfiguracao?.(canal.alvo)}
                  title={`Ir para a configuração de ${canal.nome}`}
                  aria-label={`Ir para a configuração de ${canal.nome}`}
                >
                  {conteudo}
                  <span className="cfg-topologia__ir" aria-hidden="true">↓</span>
                </button>
              ) : (
                <div
                  className="cfg-topologia__node cfg-topologia__node--canal cfg-topologia__node--fixo"
                  style={{
                    borderColor: cor,
                    boxShadow: `0 0 18px ${cor}22`,
                  }}
                  title={`${canal.nome}: disponível por padrão`}
                  aria-label={`${canal.nome}: integração sempre ativa`}
                >
                  {conteudo}
                </div>
              )}
            </div>
          );
        })}

        <div className="cfg-topologia__vivo">
          <span className={erro ? "cfg-topologia__vivo-ponto cfg-topologia__vivo-ponto--erro" : "cfg-topologia__vivo-ponto"} />
          {erro ? "Status Meta indisponível" : carregando ? "Atualizando…" : "Clique em uma plataforma para configurar"}
        </div>
      </div>
    </div>
  );
}

/*
  Scroll centralizado + um brilho curto no destino. `scroll-margin-top` evita
  que a barra superior esconda a linha quando o navegador termina o movimento.
*/
function irParaConfiguracaoDaRede(alvo) {
  const elemento = document.querySelector(`[data-config-rede="${alvo}"]`);
  if (!elemento) return;

  elemento.scrollIntoView({ behavior: "smooth", block: "center" });
  elemento.classList.remove("cfg-config-alvo--pulso");
  // Reinicia a animação mesmo quando a pessoa clica duas vezes no mesmo card.
  void elemento.offsetWidth;
  elemento.classList.add("cfg-config-alvo--pulso");
  window.setTimeout(() => elemento.classList.remove("cfg-config-alvo--pulso"), 1450);
}

const TOPOLOGIA_REDES_CSS = `
.cfg-topologia {
  background: var(--sup-03, rgba(255,255,255,0.03));
  border: 1px solid var(--linha-08, rgba(255,255,255,0.08));
  border-radius: 18px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.08);
  padding: 20px;
}
.cfg-topologia__cab {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 18px; margin-bottom: 14px;
}
.cfg-topologia__cab h2 { margin: 0; font-size: 14px; font-weight: 650; }
.cfg-topologia__cab p { margin: 4px 0 0; font-size: 11px; color: var(--text-muted); }
.cfg-topologia__legenda { display: flex; align-items: center; justify-content: flex-end; gap: 12px; flex-wrap: wrap; }
.cfg-topologia__legenda span { display: inline-flex; align-items: center; gap: 5px; font-size: 10px; color: var(--text-muted); white-space: nowrap; }
.cfg-topologia__legenda i { width: 7px; height: 7px; border-radius: 999px; display: block; }
.cfg-topologia__dot-inativo { background: rgba(148,163,184,0.58) !important; }

.cfg-topologia__canvas {
  height: 520px; min-width: 0; position: relative; overflow: hidden;
  border: 1px solid var(--linha-07, rgba(255,255,255,0.07));
  border-radius: 14px;
  background:
    radial-gradient(circle at 25% 50%, rgba(99,102,241,0.09), transparent 28%),
    linear-gradient(var(--sup-01, rgba(255,255,255,0.01)), var(--sup-01, rgba(255,255,255,0.01)));
}
.cfg-topologia__canvas::before {
  content: ""; position: absolute; inset: 0; pointer-events: none; opacity: 0.26;
  background-image: radial-gradient(circle, var(--linha-15, rgba(148,163,184,0.35)) 1px, transparent 1px);
  background-size: 22px 22px;
}
.cfg-topologia__grupo {
  position: absolute; left: 50%; z-index: 4; transform: translateX(-50%);
  padding: 3px 7px; border-radius: 999px; font-size: 8.5px; font-weight: 700;
  letter-spacing: .055em; text-transform: uppercase; color: var(--text-muted);
  background: var(--sup-04, rgba(255,255,255,.04)); border: 1px solid var(--linha-07, rgba(255,255,255,.07));
}
.cfg-topologia__grupo--social { top: 2.2%; }
.cfg-topologia__grupo--portais { bottom: 2.2%; }
.cfg-topologia__linhas { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.cfg-topologia__linha {
  fill: none; stroke-width: 0.45; vector-effect: non-scaling-stroke;
  stroke-linecap: round; opacity: 0.7;
}
.cfg-topologia__linha--ativo,
.cfg-topologia__linha--recente {
  stroke-dasharray: 5 6;
  animation: cfg-topologia-fluxo 1.7s linear infinite;
}
.cfg-topologia__linha--erro { stroke-dasharray: 3 4; }
.cfg-topologia__linha--configurar,
.cfg-topologia__linha--indisponivel { stroke-dasharray: 2 6; opacity: 0.45; }
@keyframes cfg-topologia-fluxo { to { stroke-dashoffset: -22; } }

.cfg-topologia__node {
  display: flex; align-items: center; gap: 10px;
  border: 1.5px solid var(--linha-10, rgba(255,255,255,0.1));
  background: var(--bg, #111827); color: var(--text);
  border-radius: 12px; padding: 10px 12px; z-index: 3;
  min-width: 150px; max-width: 240px; box-sizing: border-box;
  transition: border-color .25s ease, box-shadow .25s ease, transform .25s ease, background-color .25s ease;
}
.cfg-topologia__node--omnimob {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  border: 2px solid rgba(99,102,241,0.8);
  box-shadow: 0 0 24px rgba(99,102,241,0.13);
  min-width: 170px;
}
.cfg-topologia__slot {
  position: absolute; z-index: 3; width: min(250px, 28%);
  display: flex; align-items: center; justify-content: center; pointer-events: none;
}
.cfg-topologia__slot--sup-esq { left: 5%; top: 8%; }
.cfg-topologia__slot--sup-dir { right: 5%; top: 8%; }
.cfg-topologia__slot--esq { left: 2.5%; top: 50%; transform: translateY(-50%); }
.cfg-topologia__slot--dir { right: 2.5%; top: 50%; transform: translateY(-50%); }
.cfg-topologia__slot--inf-dir { right: 9%; bottom: 8%; }
.cfg-topologia__slot--inf-esq { left: 9%; bottom: 8%; }
.cfg-topologia__node--canal {
  position: relative; width: 100%; max-width: 250px; min-width: 0;
  padding-right: 42px; appearance: none; text-align: left; font: inherit;
  cursor: pointer; pointer-events: auto;
}
.cfg-topologia__node--canal:hover,
.cfg-topologia__node--canal:focus-visible {
  transform: translateY(-2px);
  background: var(--sup-05, rgba(255,255,255,0.05));
  outline: none;
}
.cfg-topologia__node--canal:focus-visible { box-shadow: 0 0 0 3px rgba(99,102,241,.22); }
.cfg-topologia__node--fixo { cursor: default; padding-right: 34px; }
.cfg-topologia__node--fixo:hover { transform: none; background: var(--bg, #111827); }
.cfg-topologia__omni-icone {
  width: 34px; height: 34px; border-radius: 10px; flex: 0 0 auto;
  display: grid; place-items: center; font-size: 17px; font-weight: 800;
  color: #fff; background: linear-gradient(135deg, #6366f1, #8b5cf6);
  box-shadow: 0 6px 16px rgba(99,102,241,0.28);
  overflow: hidden;
}
/* Com logotipo, o disco sai da frente: superficie neutra e sem halo colorido.
   O gradiente indigo por tras de uma marca alheia disputaria com ela, e o halo
   pintaria de roxo a sombra de uma logo que pode ser de qualquer cor. */
.cfg-topologia__omni-icone--logo {
  background: var(--sup-06, rgba(255,255,255,0.06));
  box-shadow: none; padding: 4px;
}
.cfg-topologia__omni-icone img {
  width: 100%; height: 100%; object-fit: contain; display: block;
}
.cfg-topologia__marca {
  width: 31px; height: 31px; border-radius: 8px; flex: 0 0 auto;
  display: grid; place-items: center; color: #fff;
}
.cfg-topologia__marca--whatsapp { background: #25D366; }
.cfg-topologia__marca--facebook { background: #1877f2; }
.cfg-topologia__marca--instagram { background: linear-gradient(135deg,#f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%); }
.cfg-topologia__marca--zap { background: linear-gradient(135deg, #ff7a00, #6d28d9); }
.cfg-topologia__marca--vivareal { background: linear-gradient(135deg, #22c7e8, #2563eb); }
.cfg-topologia__marca--olx { background: linear-gradient(135deg, #6d28d9, #ec4899); }
.cfg-topologia__node-texto { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
/* Reticencias porque o nome do cliente entrou aqui: os nomes dos canais sao
   curtos e fixos, o da imobiliaria nao — e um no de 240px com "Imobiliaria
   Santa Rita Negocios Imobiliarios" derrubaria a composicao radial inteira. */
.cfg-topologia__node-texto strong {
  font-size: 12px; font-weight: 650; line-height: 1.2;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cfg-topologia__node-texto span {
  display: block; max-width: 100%; font-size: 9.5px; color: var(--text-muted); line-height: 1.35;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.cfg-topologia__status {
  position: absolute; right: 25px; top: 50%; transform: translateY(-50%);
  width: 6px; height: 6px; border-radius: 999px;
}
.cfg-topologia__ir {
  position: absolute; right: 9px; top: 50%; transform: translateY(-52%);
  color: var(--text-muted); opacity: .48; font-size: 11px;
  transition: transform .2s ease, opacity .2s ease;
}
.cfg-topologia__node--canal:hover .cfg-topologia__ir { transform: translateY(-30%); opacity: .9; }
.cfg-topologia__status--ativo::after,
.cfg-topologia__status--recente::after {
  content: ""; position: absolute; inset: -4px; border-radius: inherit;
  border: 1px solid currentColor; opacity: .35; animation: cfg-topologia-pulso 1.8s ease-out infinite;
}
@keyframes cfg-topologia-pulso { 0% { transform: scale(.7); opacity: .45; } 100% { transform: scale(1.45); opacity: 0; } }
.cfg-topologia__vivo {
  position: absolute; left: 12px; bottom: 10px; z-index: 4;
  display: flex; align-items: center; gap: 6px;
  padding: 5px 8px; border-radius: 999px;
  font-size: 9px; color: var(--text-muted);
  background: var(--sup-04, rgba(255,255,255,0.04));
  border: 1px solid var(--linha-07, rgba(255,255,255,0.07));
}
.cfg-topologia__vivo-ponto { width: 5px; height: 5px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,.10); }
.cfg-topologia__vivo-ponto--erro { background: #ef4444; box-shadow: 0 0 0 3px rgba(239,68,68,.10); }

.cfg-config-alvo { scroll-margin-top: 96px; border-radius: 18px; }
.cfg-config-alvo--pulso { animation: cfg-config-destino 1.4s ease-out; }
@keyframes cfg-config-destino {
  0% { box-shadow: 0 0 0 0 rgba(99,102,241,.0); }
  22% { box-shadow: 0 0 0 4px rgba(99,102,241,.28), 0 0 30px rgba(99,102,241,.16); }
  100% { box-shadow: 0 0 0 0 rgba(99,102,241,.0); }
}

@media (max-width: 680px) {
  .cfg-topologia { padding: 16px; }
  .cfg-topologia__cab { flex-direction: column; }
  .cfg-topologia__legenda { justify-content: flex-start; gap: 9px; }
  .cfg-topologia__canvas { height: 790px; }
  /* No celular a topologia vira um "hub + grade" para nenhum card se sobrepor.
     No desktop ela continua verdadeiramente radial, em volta da Omnimob. */
  .cfg-topologia__node--omnimob { left: 50%; top: 9%; min-width: 148px; padding: 9px; }
  .cfg-topologia__linhas { display: none; }
  .cfg-topologia__grupo--social { top: 31%; }
  .cfg-topologia__grupo--portais { top: 52%; bottom: auto; }
  .cfg-topologia__slot { width: 45%; transform: none; }
  .cfg-topologia__slot--esq { left: 50%; top: 19%; transform: translateX(-50%); width: 72%; }
  .cfg-topologia__slot--sup-esq { left: 3%; top: 36%; }
  .cfg-topologia__slot--sup-dir { right: 3%; top: 36%; }
  .cfg-topologia__slot--dir { left: 50%; right: auto; top: 58%; transform: translateX(-50%); }
  .cfg-topologia__slot--inf-dir { right: 3%; bottom: 12%; }
  .cfg-topologia__slot--inf-esq { left: 3%; bottom: 12%; }
  .cfg-topologia__node--canal { width: 100%; max-width: none; padding: 9px 34px 9px 9px; }
  .cfg-topologia__node-texto span { font-size: 8.5px; }
  .cfg-topologia__status { right: 20px; }
  .cfg-topologia__ir { right: 7px; }
  .cfg-topologia__marca { width: 28px; height: 28px; }
}
@media (prefers-reduced-motion: reduce) {
  .cfg-topologia__linha--ativo, .cfg-topologia__linha--recente,
  .cfg-topologia__status--ativo::after, .cfg-topologia__status--recente::after,
  .cfg-config-alvo--pulso { animation: none; }
  .cfg-topologia__node { transition: none; }
}
`;

// ─── Página principal ─────────────────────────────────────────────────────────

export function ConfiguracaoPage({ session, onSessionUpdate }) {
  const navigate = useNavigate();
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
  /* Os atalhos da casa. Começam do que já está gravado no tenant; o editor
     mostra o padrão de fábrica por baixo do que não foi mexido. */
  const [atalhosDoTenant, setAtalhosDoTenant] = useState(() => session?.tenant?.atalhos || {});
  const [salvandoAtalhos, setSalvandoAtalhos] = useState(false);
  const [avisoAtalhos, setAvisoAtalhos] = useState("");
  const [atalhosLigados, setAtalhosLigados] = useState(() => session?.tenant?.atalhosAtivos !== false);

  /* O interruptor mestre. Desligado, nenhuma tecla dispara e nenhum selo é
     desenhado ao lado dos botões — a imobiliária que não quer atalhos não quer
     nem o ruído visual deles. Grava na hora, como o resto desta seção. */
  async function alternarAtalhos(ligado) {
    setAtalhosLigados(ligado);
    setAvisoAtalhos("");
    try {
      await api.salvarAtalhosDoTenant(session?.tenant?.slug, { ativos: ligado });
      onSessionUpdate?.({ ...session, tenant: { ...session.tenant, atalhosAtivos: ligado } });
      setAvisoAtalhos(ligado ? "Atalhos ligados." : "Atalhos desligados.");
    } catch (e) {
      setAtalhosLigados(!ligado); // reverte: a caixa não pode mentir sobre o que está gravado
      setAvisoAtalhos(e.message || "Não consegui salvar.");
    }
  }

  /* Sem botão: o editor chama isto com um respiro depois de cada tecla. */
  async function salvarAtalhosDoTenant(config) {
    setSalvandoAtalhos(true);
    setAvisoAtalhos("");
    try {
      const enxuto = apenasMudancas(config);
      await api.salvarAtalhosDoTenant(session?.tenant?.slug, { atalhos: enxuto });
      /* A sessão acompanha na hora: o ouvinte do teclado lê dela, e sem isto a
         tecla nova só valeria depois de recarregar. */
      onSessionUpdate?.({ ...session, tenant: { ...session.tenant, atalhos: enxuto } });
      setAvisoAtalhos("Salvo para a imobiliária.");
    } catch (e) {
      setAvisoAtalhos(e.message || "Não consegui salvar.");
    } finally {
      setSalvandoAtalhos(false);
    }
  }

  const abas = abasVisiveis(session?.usuario?.cargo, session?.tenant?.plano, {
    podeImportar,
    temFlow: modulosDoTenant(session?.tenant).includes(FLOW),
  });
  const pedida = searchParams.get("ver");
  const tab = abas.some((a) => a.key === pedida) ? pedida : "MENU";
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
  /* O add-on do Flow, nesta tela. Separado de `trocandoPlano` porque são duas
     operações distintas com duas rotas distintas — juntá-las num estado só
     desabilitaria os cartões de plano enquanto o Flow grava, e vice-versa. */
  const [planoMsg, setPlanoMsg] = useState(null);  // { tipo, texto }
  /* Em que PERÍODO os cartões mostram o preço. Só afeta a exibição: esta tela
     troca o que a conta USA, e quem decide o ciclo de cobrança é a assinatura
     (cartão) ou o próximo Pix. Mostrar só o mensal escondia metade da tabela de
     preços de quem já paga anual — e a conta anual é justamente a que compensa
     comparar antes de subir de plano. */
  const [periodoPreco, setPeriodoPreco] = useState("mensal");
  /* ── O Flow, agora dentro de cada cartão ──────────────────────────────────

     Era um cartão só, acima da grade, e ele respondia "quero o Flow?" antes de
     "em qual plano?" — a ordem inversa da decisão. O preço do módulo depende do
     plano, então a pergunta separada mostrava um número que valia para a faixa
     atual e mudava assim que a pessoa trocasse de faixa.

     Um mapa `{ BASICO: true, ... }` e não um booleano só: cada cartão compõe o
     SEU alvo, e é isso que deixa comparar "Profissional sem Flow" com
     "Premium com Flow" lado a lado, que é a comparação que a pessoa faz.

     O interruptor NÃO age sozinho — ele só muda o preço e o que o botão vai
     fazer. Um switch que contrata no clique, ao lado de um botão que também
     contrata, dá duas portas para a mesma decisão. */
  const [pacotes, setPacotes] = useState({});
  /* Existe cobrança anual de verdade para ALGUM plano? Enquanto as variáveis do
     Stripe não existirem, não existe — e o alternador some sozinho, sem erro. */
  const temPrecoAnual = Object.values(cobranca?.precos || {}).some((p) => p?.anual);
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
  const [socialErro, setSocialErro] = useState(false);
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
  async function trocarPlano(destino, comFlow) {
    const de = planoInfo(plano);
    const para = planoInfo(destino);
    const subindo = para.nivel > de.nivel;
    const temFlowHoje = (cobranca?.modulos || []).includes("FLOW");
    const mesmoPlano = destino === plano;

    /* O que muda no dinheiro depende de COMO a conta é cobrada — quem paga por
       Pix não tem próxima fatura para receber o proporcional. */
    const sobreCobranca = cobranca?.renovaSozinho
      ? "A diferença proporcional aos dias que faltam entra na sua próxima fatura."
      : "O período que você já pagou continua até o fim, e o novo valor passa a valer no próximo pagamento.";

    /* Três frases possíveis, porque agora são três decisões diferentes: mudar
       de faixa, ligar o módulo na faixa atual, ou as duas coisas. */
    const oQueMuda = mesmoPlano
      ? comFlow
        ? `Contratar o Omnimob Flow no plano ${para.nome}? O módulo é liberado na hora. `
        : `Dispensar o Omnimob Flow? O acesso ao módulo fecha imediatamente — os negócios e contratos continuam guardados. `
      : `Trocar do plano ${de.nome} para o ${para.nome}${comFlow && !temFlowHoje ? ", com o Omnimob Flow" : ""}? ` +
        (subindo
          ? `Os recursos do ${para.nome} passam a valer imediatamente. `
          : `Os recursos exclusivos do ${de.nome} deixam de aparecer imediatamente. `);

    const ok = await confirm(
      oQueMuda + sobreCobranca,
      mesmoPlano ? (comFlow ? "Contratar o Flow" : "Dispensar o Flow") : subindo ? "Fazer upgrade" : "Fazer downgrade",
      // Tirar recurso de quem está usando pede vermelho; acrescentar, não.
      subindo || (mesmoPlano && comFlow) ? "primary" : "danger",
    );
    if (!ok) return;

    setTrocandoPlano(destino);
    setPlanoMsg(null);
    try {
      /* ── A DESCIDA QUE DESLIGA COISAS EM USO ──────────────────────────────
         A rota recusa a primeira chamada com 409 e a lista do que se perde —
         domínio próprio saindo do ar, publicação em redes fechando, fotos 360°
         virando imagem comum. Só a segunda, com `confirmar`, aplica.

         A tela não tratava esse código: mostrava a recusa como erro vermelho, e
         quem tinha domínio próprio simplesmente não conseguia descer de plano
         pela interface. O ensaio existia e não tinha para onde ir.

         Duas perguntas seguidas é de propósito, e não excesso de cerimônia: a
         primeira é sobre a TROCA, a segunda é sobre o ESTRAGO — e a segunda só
         aparece quando há estrago, listado item a item, com o que acontece com
         cada um. Um "tem certeza?" genérico ensina a clicar em sim sem ler. */
      const r = await api
        .trocarPlano(tenantSlug, destino, comFlow ? "HUB_FLOW" : "HUB")
        .catch(async (erro) => {
          if (erro?.body?.code !== "CONFIRMAR_PERDAS") throw erro;

          const perdas = erro.body.perdas || [];
          /* Uma linha por perda, com o detalhe embaixo. Texto e não JSX porque
             `confirm` é um diálogo de texto — e a lista precisa caber nele sem
             virar um segundo componente de modal. */
          const lista = perdas.map((p) => `• ${p.titulo}\n   ${p.detalhe}`).join("\n\n");
          const quantos =
            perdas.length === 1 ? "um recurso que você usa" : `${perdas.length} recursos que você usa`;

          const cienteDoEstrago = await confirm(
            `Descer para o ${para.nome} desliga ${quantos}:\n\n${lista}\n\n` +
              "Isso vale a partir do momento em que você confirmar.",
            "Entendi, descer mesmo assim",
            "danger",
          );
          if (!cienteDoEstrago) return null;

          return api.trocarPlano(tenantSlug, destino, comFlow ? "HUB_FLOW" : "HUB", true);
        });

      /* Desistiu na segunda pergunta: nada foi trocado, e não há o que dizer —
         a tela continua exatamente como estava. */
      if (!r) return;
      setPlano(destino);
      // A sessão carrega o plano e é ela que libera recursos nas outras telas;
      // sem sincronizar, o painel só mudaria no próximo login.
      if (onSessionUpdate && session?.tenant) {
        /* Os MÓDULOS vão junto do plano: a sessão é quem decide o seletor do
           Flow na barra lateral, e sem isto quem contratasse o módulo aqui
           continuaria sem vê-lo até sair e entrar. */
        onSessionUpdate({
          ...session,
          tenant: { ...session.tenant, plano: destino, modulos: r?.tenant?.modulos || session.tenant.modulos },
        });
      }
      setCobranca((c) => (c ? { ...c, modulos: r?.tenant?.modulos || c.modulos } : c));
      /* ── A MENSAGEM SEGUE O QUE O SERVIDOR FEZ ──────────────────────────
         Ela dizia "vamos ajustar a cobrança" em todos os casos, porque o ajuste
         nunca acontecia. Agora acontece na maioria — e continuar prometendo
         intervenção humana faria o cliente esperar um contato que não vem.

         Quando NÃO ajusta (conta sem assinatura no provedor, preço não
         cadastrado, provedor fora do ar), o servidor manda o motivo em
         `motivoCobranca` e é ele que aparece. Inventar a frase aqui exigiria
         repetir a árvore de decisão do servidor no navegador. */
      setPlanoMsg({
        tipo: "success",
        /* Três desfechos, e cada um é uma conversa diferente. O do meio é o
           que faltava: quem paga por Pix não tem fatura para ajustar, e a
           mensagem genérica ("o time acerta") deixava a pessoa esperando um
           contato que não vem. */
        texto: `${
          mesmoPlano
            ? comFlow
              ? "Omnimob Flow contratado."
              : "Omnimob Flow dispensado."
            : `Plano alterado para ${para.nome}.`
        } ${
          r?.cobrancaAjustada
            ? "A diferença proporcional entra na sua próxima fatura."
            : cobranca?.renovaSozinho === false
              ? "O novo valor passa a valer no seu próximo pagamento — o período já pago continua até o fim."
              : r?.motivoCobranca || "O valor será acertado pelo nosso time."
        }`,
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

  // Carrega status das redes sociais e mantém a topologia viva enquanto a aba
  // estiver aberta. O polling é leve (uma consulta a cada 15s) e evita que o
  // diagrama fique mentindo depois de uma conexão/desconexão feita em outra aba.
  useEffect(() => {
    if (!tenantSlug || tab !== "redes") return;

    let montado = true;

    async function atualizarStatusSocial({ silencioso = false } = {}) {
      if (!silencioso) setSocialLoading(true);
      try {
        const status = await api.getSocialStatus(tenantSlug);
        if (!montado) return;
        setSocialStatus(status);
        setSocialErro(false);
      } catch {
        if (!montado) return;
        setSocialErro(true);
      } finally {
        if (montado && !silencioso) setSocialLoading(false);
      }
    }

    atualizarStatusSocial();
    const timer = window.setInterval(() => atualizarStatusSocial({ silencioso: true }), 15000);

    return () => {
      montado = false;
      window.clearInterval(timer);
    };
  }, [tenantSlug, tab]);

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
    background: "var(--sup-04, rgba(255,255,255,0.04))", border: "1px solid var(--linha-10, rgba(255,255,255,0.1))",
    borderRadius: "10px", color: "inherit", padding: "11px 14px", fontSize: "14px",
    outline: "none",
  };

  return (
    /* `main-content` dá 40px de respiro e um teto de 1200px — certos para os
       FORMULÁRIOS das seções, que são colunas de campos e não devem esticar
       pela tela inteira. No ÍNDICE ele estava sobrando: os cartões nasciam mais
       estreitos que os de Relatórios e de Gerenciar Imóveis, que não passam por
       essa moldura, e a mesma grade aparecia apertada só aqui. */
    <div
      className={`main-content${tab === "MENU" ? " main-content--indice" : ""}`}
      style={{ animation: "fadeIn 0.3s ease-in-out", display: "flex", flexDirection: "column", gap: "24px" }}
    >
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
        <GradeDeMenu
          tourId="config-cabecalho"
          titulo="Configurações"
          subtitulo="Tudo que vale para a imobiliária inteira — dados, identidade visual, redes e plano."
          cards={abas.map((a) => ({
            title: a.label,
            desc: a.desc,
            accent: a.cor,
            /* A tecla de cada seção. O id segue a chave da aba, então uma seção
               nova ganha atalho acrescentando UMA linha em `ACOES` — e, se
               esquecerem, `TeclaDeAtalho` devolve null e o cartão fica igual. */
            acao: `configuracoes.${a.key}`,
            icon: <a.Icon size={32} weight="duotone" />,
            onClick: () => setTab(a.key),
          }))}
        />
      ) : (
        <>
        {/* ── Cabeçalho da seção ─── */}
        <div data-tour="config-secao" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          {/* `GearSix` é o mesmo ícone que Configurações tem na barra lateral, e
              o da seção sai de `ICONES_CONFIG` — a mesma lista que desenha os
              cartões do índice e o submenu. */}
          <Trilha
            itens={[
              /* A cadeia até Configurações vem do catálogo, e traz o Dashboard
                 na frente — o degrau que faltava aqui. */
              ...degrausAte("/configuracoes", navigate, () => setTab("MENU")),
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

          {/* ── O cadastro por IA ────────────────────────────────────────────
              Veio da seção do Plano, onde era o único controle no meio de
              cartões de compra. Aqui está entre as outras preferências de como
              a imobiliária trabalha, que é o que ele é.

              Só aparece para quem TEM IA no plano. Um interruptor desabilitado
              a 55% seria ruído: a pessoa não pode mexer, e o convite para subir
              de plano já é feito em `?ver=plano`, onde ela pode agir. */}
          {planoInfo(plano).ia ? (
            <Secao cor="#a78bfa" titulo="Cadastro por IA" icone={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
                <circle cx="12" cy="12" r="3.2" />
              </svg>
            }>
              <label style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "14px 16px", borderRadius: "12px", background: "var(--sup-02, rgba(255,255,255,0.02))", border: "1px solid var(--linha-08, rgba(255,255,255,0.08))", cursor: "pointer", opacity: 1 }}>
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
            </Secao>
          ) : null}

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
                  <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "var(--sup-06, rgba(255,255,255,0.06))", border: "1px solid var(--linha-10, rgba(255,255,255,0.1))", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
            <div style={{ marginTop: "4px", padding: "16px", background: "var(--sup-02, rgba(255,255,255,0.02))", borderRadius: "12px", border: "1px solid var(--linha-06, rgba(255,255,255,0.06))", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
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

          {tab === "atalhos" && (
            <Secao cor="#94a3b8" titulo="Atalhos de teclado" icone={<Keyboard size={16} />}>
              <label className="pt-opcao" style={{ marginBottom: "14px" }}>
                <input
                  type="checkbox"
                  className="sw"
                  checked={atalhosLigados}
                  onChange={(e) => alternarAtalhos(e.target.checked)}
                />
                <span className="pt-opcao__rotulo">
                  Usar atalhos de teclado
                  <small>
                    Desligado, nenhuma tecla funciona e as teclas somem de perto dos botões.
                    Vale para a imobiliária inteira.
                  </small>
                </span>
              </label>

              <p className="api-ajuda" style={{ margin: "0 0 14px" }}>
                Estas são as teclas da imobiliária inteira — o ponto de partida de todo mundo.
                Cada pessoa ainda pode trocar as dela em <strong>Sua conta › Preferências</strong>,
                e a escolha dela vence esta.
              </p>
              <EditorDeAtalhos
                cargo={session?.usuario?.cargo}
                valor={atalhosDoTenant}
                aoMudar={setAtalhosDoTenant}
                aoSalvar={salvarAtalhosDoTenant}
                estado={salvandoAtalhos ? "Salvando…" : avisoAtalhos}
                disabled={!atalhosLigados}
              />
            </Secao>
          )}

          {tab === "redes" && (<>
          {/* A topologia é uma leitura rápida do estado real das integrações.
              Não substitui nenhum controle abaixo: ela só resume visualmente o
              mesmo status que já alimenta "Contas conectadas". */}
          {/* Nome e logotipo saem do FORM, e nao da sessao: e o mesmo estado que
              os campos de Perfil e Aparencia editam nesta pagina, entao trocar
              a logo ali ja troca a marca no centro do mapa — sem esperar o
              salvamento e a sessao se atualizarem. */}
          <TopologiaDeRedes
            socialStatus={socialStatus}
            carregando={socialLoading}
            erro={socialErro}
            aoIrParaConfiguracao={irParaConfiguracaoDaRede}
            nome={form.name || session?.tenant?.name}
            logoUrl={form.logoUrl}
          />

          {/* ── Onde os imóveis aparecem ──────────────────────────────────────
              Substitui a seção "Portais imobiliários", que mostrava o endereço
              do feed e mais nada. O endereço continua aqui — junto de quantos
              imóveis estão no arquivo e de quando um portal veio buscar pela
              última vez, que é o que responde "cadastrei lá, funcionou?".

              E junto dos outros canais, porque a pergunta de quem divulga é uma
              só: onde meus imóveis aparecem? Que uns sejam buscados, outros
              empurrados e um seja manual é mecânica nossa, não dela. */}
          <div data-config-rede="portais" className="cfg-config-alvo">
            <Secao cor="#0ea5e9" titulo="Onde seus imóveis aparecem" icone={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1.5" />
              </svg>
            }>
              <CentralDeCanais session={session} />
            </Secao>
          </div>

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
              <div data-config-rede="facebook" className="cfg-config-alvo" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "10px", background: "var(--sup-02, rgba(255,255,255,0.02))", border: "1px solid var(--linha-07, rgba(255,255,255,0.07))" }}>
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
              <div data-config-rede="instagram" className="cfg-config-alvo" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "10px", background: "var(--sup-02, rgba(255,255,255,0.02))", border: "1px solid var(--linha-07, rgba(255,255,255,0.07))" }}>
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
              <strong>Pré-requisito:</strong> a conta do Instagram deve ser do tipo Business ou Creator, vinculada à Página do Facebook. Quem conectar precisa ser administrador dessa Página. O Instagram aceita até 100 publicações por API a cada 24 horas.
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

          {/* ── O add-on do Flow, na tela onde se decide o que se paga ─────
              Fica na aba de Plano e não na do Flow de propósito: aquela é sobre
              CONFIGURAR o módulo (provedor de assinatura, comissão) e só existe
              para quem já o tem. A decisão de contratar é uma decisão de plano,
              e mora ao lado das outras. */}
          {/* O CARTÃO AVULSO DO FLOW SAIU DAQUI.

              Ele perguntava "quer o Flow?" antes de "em qual plano?", que é a
              ordem inversa da decisão — e mostrava um preço que valia só para a
              faixa atual, mudando de valor no instante em que a pessoa trocasse
              de faixa. Agora o interruptor mora DENTRO de cada cartão de plano,
              onde o preço já está do lado.

              Contratar e dispensar o módulo passaram a ser feitos por
              `trocarPlano`, que resolve plano e pacote numa chamada só — duas
              produziriam dois proporcionais na mesma fatura. */}

          {/* Cobrança: componente próprio pelo mesmo motivo do Flow — tem
              estado seu (busca o extrato) e engordaria em duzentas linhas uma
              página que já tem mil e quinhentas. `Secao` vai por prop para o
              desenho seguir sendo o mesmo das outras abas. */}
          {tab === "cobranca" && <SecaoCobranca session={session} Secao={Secao} />}

          {tab === "flow" && (
            /* A seção do Flow mora num componente próprio, e não inline como as
               outras: ela tem estado próprio (o token, os percentuais, a prévia
               do split) e acrescentaria ~200 linhas a uma página que já tem
               mil e quinhentas. `Secao` vai por prop para o desenho continuar
               sendo o mesmo das outras abas — é a moldura desta tela. */
            <SecaoFlow session={session} Secao={Secao} showToast={showToast} />
          )}

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
              /* O que a conta TEM hoje — é o ponto de partida de cada cartão e
                 o que diz se o interruptor representa uma mudança. */
              const temFlowHoje = (cobranca?.modulos || []).includes("FLOW");
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

                  {/* O interruptor da IA automática mudou-se para o Perfil.
                      Aqui ele era um CONTROLE no meio de uma tela de compra: a
                      seção do plano existe para dizer o que a conta tem e como
                      trocar, e a única coisa clicável que não levava a lugar
                      nenhum era justamente ele. Ver "Cadastro por IA", em
                      `?ver=perfil`. */}

                  {/* Upgrade / downgrade: só para quem já é cliente. Em teste a
                      troca de plano não existe — o que existe é assinar. */}
                  {cobranca && !emTrial && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "4px", paddingTop: "18px", borderTop: "1px solid var(--linha-07, rgba(255,255,255,0.07))" }}>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 600 }}>Mudar de plano</div>
                        {/* ── O QUE ACONTECE COM O DINHEIRO depende de COMO a
                            conta é cobrada ────────────────────────────────────
                            Havia uma frase só, falando em "próxima fatura", e
                            ela virou mentira no dia em que o Pix entrou: quem
                            paga por Pix não tem fatura seguinte nenhuma — tem um
                            código que gera quando quiser. Prometer um ajuste que
                            nunca chega é pior do que não explicar nada. */}
                        <p style={{ margin: "5px 0 0", fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.6 }}>
                          {cobranca?.renovaSozinho
                            ? "A mudança vale na hora dentro do painel, e a diferença proporcional aos dias que faltam entra na sua próxima fatura."
                            : "A mudança vale na hora dentro do painel. Como seu pagamento é por Pix, o período que você já pagou continua valendo até o fim — o novo valor passa a valer no próximo pagamento."}
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

                      {/* Mensal | Anual. Só aparece quando existe preço anual
                          cadastrado de verdade — enquanto não existir, oferecer
                          a escolha seria vender o que a cobrança recusa. É a
                          mesma regra da landing. */}
                      {temPrecoAnual ? (
                        <div role="radiogroup" aria-label="Período do preço" style={{ display: "flex", gap: "6px" }}>
                          {[
                            { chave: "mensal", rotulo: "Mensal" },
                            { chave: "anual", rotulo: "Anual" },
                          ].map((op) => (
                            <label
                              key={op.chave}
                              style={{
                                display: "inline-flex", alignItems: "center", cursor: "pointer",
                                padding: "6px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: 600,
                                background: periodoPreco === op.chave ? "var(--sup-08, rgba(255,255,255,0.08))" : "transparent",
                                border: `1px solid ${periodoPreco === op.chave ? "var(--linha-14, rgba(255,255,255,0.14))" : "transparent"}`,
                                color: periodoPreco === op.chave ? "var(--text-main)" : "var(--text-muted)",
                              }}
                            >
                              <input
                                type="radio"
                                name="cfg-periodo-preco"
                                checked={periodoPreco === op.chave}
                                onChange={() => setPeriodoPreco(op.chave)}
                                style={{ position: "absolute", opacity: 0, width: 0, height: 0, padding: 0, margin: 0, border: 0 }}
                              />
                              {op.rotulo}
                            </label>
                          ))}
                        </div>
                      ) : null}

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(215px, 1fr))", gap: "10px" }}>
                        {PLANOS.map((p) => {
                          const ehAtual = p.key === atual.key;
                          const subindo = p.nivel > atual.nivel;
                          /* O pacote DESTE cartão. Começa no que a conta já
                             tem — abrir com o Flow ligado para quem não o
                             contratou anunciaria um preço que não é o dela. */
                          const comFlow = pacotes[p.key] ?? temFlowHoje;
                          /* O preço do período escolhido, no pacote do cartão,
                             com queda para o mensal quando aquele plano não tem
                             anual cadastrado: some a vantagem, não o plano.

                             O Hub mora na raiz do plano e o Hub+Flow em `.flow`
                             — a assimetria está explicada em `precosDosPlanos`,
                             no servidor. */
                          const bruto = cobranca?.precos?.[p.key];
                          const doPlano = comFlow ? bruto?.flow : bruto;
                          const preco = (doPlano?.[periodoPreco] || doPlano?.mensal)?.rotulo;
                          /* Existe preço do Flow para este plano? Sem ele o
                             interruptor não aparece: oferecer o módulo numa
                             faixa que a cobrança não sabe faturar é vender o
                             que o provedor recusa. */
                          const temPrecoFlow = Boolean(bruto?.flow?.mensal);
                          /* O que este cartão faria se clicado. Só há ação
                             quando o alvo difere do que a conta tem hoje. */
                          const mudaPlano = !ehAtual;
                          const mudaFlow = comFlow !== temFlowHoje;
                          const ocupado = Boolean(trocandoPlano);
                          return (
                            <div
                              key={p.key}
                              style={{
                                display: "flex", flexDirection: "column", gap: "7px",
                                padding: "14px 16px", borderRadius: "12px",
                                background: ehAtual ? `${p.cor}14` : "var(--sup-02, rgba(255,255,255,0.02))",
                                border: `1px solid ${ehAtual ? `${p.cor}66` : "var(--linha-08, rgba(255,255,255,0.08))"}`,
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                <span style={{ fontSize: "13.5px", fontWeight: 700, color: p.cor }}>{p.nome}</span>
                                {ehAtual && (
                                  <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", background: "var(--sup-06, rgba(255,255,255,0.06))", padding: "2px 8px", borderRadius: "999px" }}>
                                    Atual
                                  </span>
                                )}
                              </div>
                              {preco && <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-muted)" }}>{preco}</span>}
                              <span style={{ fontSize: "11.5px", color: "var(--text-muted)", lineHeight: 1.55, flex: 1 }}>
                                {p.descricao}
                              </span>
                              {/* ── O Flow, no cartão ────────────────────────
                                  Ele muda o PREÇO acima e o que o botão abaixo
                                  vai fazer — e fica entre os dois porque é esse
                                  o caminho do olho: vê quanto custa, decide se
                                  quer o módulo, confirma.

                                  Não age sozinho. Um switch que contrata no
                                  clique ao lado de um botão que também contrata
                                  daria duas portas para a mesma decisão. */}
                              {/* O MESMO interruptor das outras três telas de
                                  pagamento. Desenhar um aqui seria a quarta
                                  versão dele — e este projeto já teve três ao
                                  mesmo tempo, com preços diferentes na mesma
                                  compra. `test/toggleDoFlow.test.jsx` guarda
                                  isso. */}
                              {temPrecoFlow ? (
                                <ToggleDoFlow
                                  id={`cfg-flow-${p.key.toLowerCase()}`}
                                  ligado={comFlow}
                                  /* Compacto porque aqui ele aparece TRÊS vezes
                                     lado a lado, em colunas estreitas: a mesma
                                     descrição repetida em cada cartão deixa de
                                     informar e vira parede. */
                                  compacto
                                  desabilitado={!podeTrocarPlano}
                                  ocupado={ocupado}
                                  aoAlternar={(on) =>
                                    setPacotes((atuais) => ({ ...atuais, [p.key]: on }))
                                  }
                                  nota={
                                    ehAtual && temFlowHoje && !comFlow
                                      ? "Ao dispensar, os negócios e contratos continuam guardados — o que fecha é o acesso."
                                      : undefined
                                  }
                                />
                              ) : null}

                              {(mudaPlano || mudaFlow) && (
                                <button
                                  type="button"
                                  disabled={ocupado || !podeTrocarPlano}
                                  title={podeTrocarPlano ? undefined : "Só quem gerencia usuários pode trocar o plano."}
                                  onClick={() => trocarPlano(p.key, comFlow)}
                                  style={{
                                    width: "100%", marginTop: "4px", padding: "8px 12px", borderRadius: "9px",
                                    /* Acrescentar o Flow no plano atual é uma
                                       ação positiva: pintá-la como downgrade
                                       diria à pessoa que ela está perdendo algo
                                       ao contratar. */
                                    border: subindo || (!mudaPlano && comFlow) ? "none" : "1px solid var(--linha-14, rgba(255,255,255,0.14))",
                                    background: subindo ? p.cor : !mudaPlano && comFlow ? "#ec0b5b" : "transparent",
                                    color: subindo ? "#0c0f1a" : !mudaPlano && comFlow ? "#fff" : "var(--text-muted)",
                                    fontSize: "12.5px", fontWeight: 600,
                                    cursor: ocupado || !podeTrocarPlano ? "not-allowed" : "pointer",
                                    opacity: ocupado || !podeTrocarPlano ? 0.55 : 1,
                                    boxShadow: "none", transform: "none",
                                  }}
                                >
                                  {trocandoPlano === p.key
                                    ? "Trocando…"
                                    : !mudaPlano
                                      ? comFlow ? "Contratar o Flow" : "Dispensar o Flow"
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
                    <div style={{ marginTop: "6px", paddingTop: "18px", borderTop: "1px solid var(--linha-07, rgba(255,255,255,0.07))" }}>
                      {/* ── QUEM PAGA POR PIX NÃO TEM O QUE CANCELAR ────────
                          Não há assinatura recorrente: o plano simplesmente
                          vence na data e não se renova sozinho. Oferecer um
                          botão de cancelar ali é oferecer uma ação sem efeito —
                          e o pior tipo dela, porque a pessoa clica achando que
                          precisava clicar para não ser cobrada de novo. */}
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "#fca5a5" }}>
                        {cobranca?.renovaSozinho ? "Cancelar assinatura" : "Deixar de renovar"}
                      </div>
                      <p style={{ margin: "5px 0 12px", fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.6 }}>
                        {cobranca?.renovaSozinho
                          ? "Você continua com acesso normal até o fim do período já pago — nada é interrompido hoje, e nenhuma nova cobrança é feita depois disso."
                          : "Seu pagamento é por Pix e não se renova sozinho: para encerrar, basta não gerar o próximo código. O acesso continua normal até o fim do período já pago, e nada é cobrado depois disso."}
                      </p>
                      {/* O botão só existe quando há assinatura para cancelar.
                          Sem ela a rota recusaria, e a recusa chegaria como
                          erro vermelho para quem não fez nada de errado. */}
                      {cobranca?.renovaSozinho ? (
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
                      ) : null}
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