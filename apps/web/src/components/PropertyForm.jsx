import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { linkDoImovel } from "../utils/enderecoVitrine";
import { useLocation, useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { useConfirm } from "./ConfirmModal";
import { loadSession } from "../session.js";
import { COMODIDADES, EMPTY_COMODIDADES } from "../utils/comodidades.js";
import { planoLiberaIA, planoLiberaRedes, planoLiberaTour360 } from "../utils/planos.js";
import { tipoContratoInfo, tiposContratoAtivos } from "../utils/tiposContrato.js";
import { Panorama360 } from "./Panorama360.jsx";
import { SelectCustom } from "./SelectCustom.jsx";
import { overlay360 } from "../utils/cloudinaryOverlay.js";
import { spawnRipple } from "../utils/rippleDrop.js";
import { CartaoDeMenu } from "./CartaoDeMenu.jsx";
import { shareWhatsapp } from "../utils/shareWhatsapp.js";
import { gerarArteDeStatus } from "../utils/arteParaStatus.js";
import { uploadToCloudinary } from "../utils/uploadToCloudinary";
import { IconeCheck, IconeX } from "./Icones.jsx";

function formatCep(value) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function formatCurrencyBRL(rawValue) {
  const digits = rawValue.replace(/\D/g, "").slice(0, 12);
  if (!digits) return "";
  const amount = Number(digits) / 100;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
}

function parseCurrencyBRL(rawValue) {
  const digits = rawValue.replace(/\D/g, "");
  if (!digits) return NaN;
  return Number(digits) / 100;
}

function fileParaBase64Reduzido(file, maxDim = 1024, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > height && width > maxDim) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else if (height > maxDim) {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      resolve({ base64: canvas.toDataURL("image/jpeg", quality), mimeType: "image/jpeg" });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Falha ao ler imagem."));
    };
    img.src = url;
  });
}

const EMPTY = {
  tipoImovelId: "",
  tipoContrato: "",
  atributosIds: [],
  title: "",
  description: "",
  price: "",
  cep: "",
  address: "",
  neighborhood: "",
  city: "",
  state: "",
  bedrooms: "",
  parkingSpots: "",
  suites: "",
  salas: "",
  banheiros: "",
  squareFootage: "",
  finalidade: "RESIDENCIAL",
  areaTerreno: "",
  areaConstruida: "",
  areaPrivativa: "",
  areaTotal: "",
  andamento: "PRONTO_PARA_MORAR",
  aceitaPermuta: false,
  publicarPortais: true,
  /* Rua e número na página pública. Desmarcado por padrão de propósito: o
     endereço exato é o que transforma um anúncio em convite para bater na porta
     de quem ainda mora lá — e o que permite fechar negócio por fora da
     imobiliária que anunciou. Bairro e cidade continuam aparecendo sempre. */
  exibirEnderecoCompleto: false,
  status: "ACTIVE",
  comodidades: { ...EMPTY_COMODIDADES },
};

const STEPS = [
  { key: "basico", label: "Identificação" },
  { key: "localizacao", label: "Localização" },
  { key: "detalhes", label: "Detalhes" },
  { key: "divulgar", label: "Divulgar" },
];

// Máximo de fotos por imóvel. 20 cobre os limites dos canais de divulgação:
// Instagram (carrossel: até 20), Facebook (carrossel: 10) e WhatsApp (~30).
const MAX_FOTOS = 20;

const AREA_FIELDS = {
  areaTerreno: "Área do terreno",
  areaConstruida: "Área construída",
  areaPrivativa: "Área privativa",
  areaTotal: "Área total",
};
const TODAS_AREAS = ["areaTerreno", "areaConstruida", "areaPrivativa", "areaTotal"];

const TIPO_AREAS = {
  "casa": ["areaTerreno", "areaConstruida"],
  "apartamento": ["areaPrivativa", "areaTotal"],
  "cobertura": ["areaPrivativa", "areaTotal"],
  "studio": ["areaPrivativa"],
  "terreno": ["areaTerreno"],
  "comercial": ["areaConstruida", "areaTotal"],
  "sala comercial": ["areaPrivativa", "areaTotal"],
  "casa em condominio": ["areaTerreno", "areaConstruida"],
  "kitnet": ["areaPrivativa"],
  "loft": ["areaPrivativa"],
  "sobrado": ["areaTerreno", "areaConstruida"],
  "flat": ["areaPrivativa"],
  "casa de praia": ["areaTerreno", "areaConstruida"],
  "chacara": ["areaTerreno", "areaConstruida"],
  "sitio": ["areaTerreno", "areaConstruida"],
  "lote em condominio": ["areaTerreno"],
  "galpao": ["areaTerreno", "areaConstruida"],
  "loja": ["areaPrivativa", "areaTotal"],
  "predio comercial": ["areaTerreno", "areaConstruida", "areaTotal"],
};

function normalizarTipo(str) {
  return String(str || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

function metragemExibicao(form) {
  const v = TODAS_AREAS.map((f) => form[f]).find((x) => x !== "" && x != null);
  return (v != null ? v : form.squareFootage) || "";
}

function areasParaTipo(descricao) {
  if (!descricao) return TODAS_AREAS;
  return TIPO_AREAS[normalizarTipo(descricao)] || TODAS_AREAS;
}

const FIELD_STEP = {
  title: 0, description: 0, tipoImovelId: 0, tipoContrato: 0, price: 0,
  address: 1, neighborhood: 1, city: 1, state: 1,
  bedrooms: 2, parkingSpots: 2, suites: 2, salas: 2, banheiros: 2,
  areaTerreno: 2, areaConstruida: 2, areaPrivativa: 2, areaTotal: 2,
};

const FIELD_LABELS = {
  title: "Título", description: "Descrição", tipoImovelId: "Tipo de imóvel", tipoContrato: "Tipo de contrato", price: "Preço",
  address: "Endereço", neighborhood: "Bairro", city: "Cidade", state: "Estado (UF)",
  bedrooms: "Quartos", parkingSpots: "Vagas", suites: "Suítes", salas: "Salas", banheiros: "Banheiros",
  ...AREA_FIELDS,
};

function getValidationErrors(form, areaFields = TODAS_AREAS) {
  const fe = {};

  if (!form.title || form.title.trim().length < 3) fe.title = "Informe um título com ao menos 3 caracteres.";
  if (!form.description || form.description.trim().length < 10) fe.description = "A descrição deve ter ao menos 10 caracteres.";
  if (!form.tipoImovelId) fe.tipoImovelId = "Selecione o tipo de imóvel.";
  if (!form.tipoContrato) fe.tipoContrato = "Selecione o tipo de contrato.";
  const p = parseCurrencyBRL(String(form.price));
  if (!Number.isFinite(p) || p <= 0) fe.price = "Informe um preço válido maior que zero.";
  else if (p > 9999999999.99) fe.price = "Preço acima do máximo permitido (R$ 9.999.999.999,99).";

  if (!form.address || form.address.trim().length < 5) fe.address = "Informe o endereço completo.";
  if (!form.neighborhood || form.neighborhood.trim().length < 2) fe.neighborhood = "Informe o bairro.";
  if (!form.city || form.city.trim().length < 2) fe.city = "Informe a cidade.";
  if (!form.state || form.state.trim().length < 2) fe.state = "Informe o estado (UF).";

  for (const [field, label] of [["bedrooms", "Quartos"], ["parkingSpots", "Vagas"], ["suites", "Suítes"], ["salas", "Salas"], ["banheiros", "Banheiros"]]) {
    if (form[field] === "" || form[field] == null) continue;
    const n = Number(form[field]);
    if (!Number.isInteger(n) || n < 0) fe[field] = `${label} deve ser um número inteiro ≥ 0.`;
  }
  for (const field of TODAS_AREAS) {
    if (form[field] === "" || form[field] == null) continue;
    const n = parseFloat(form[field]);
    if (!Number.isFinite(n) || n < 0) fe[field] = `Informe um valor válido para ${AREA_FIELDS[field]} (m²).`;
  }
  const principal = areaFields[0];
  if (principal && !fe[principal]) {
    const v = parseFloat(form[principal]);
    if (!Number.isFinite(v) || v <= 0) fe[principal] = `Informe a ${AREA_FIELDS[principal].toLowerCase()} (m²).`;
  }

  return fe;
}

function IconHome() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconBed() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4v16M22 4v16M2 12h20M2 8h6a2 2 0 0 1 2 2v2H2V8zM14 8h6a2 2 0 0 1 2 2v2h-8v-4z" />
    </svg>
  );
}

function IconCar() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="11" width="22" height="9" rx="2" />
      <path d="M5 11V7a7 7 0 0 1 14 0v4" />
      <circle cx="8" cy="17" r="1" /><circle cx="16" cy="17" r="1" />
    </svg>
  );
}

function IconArea() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function StepIndicator({ current, onStepClick, lockedSteps = [], steps = STEPS }) {
  return (
    /* A linha em si é só layout — o que precisava de tema são os discos, o
       trilho entre eles e o cinza do passo travado, todos escritos em branco
       translúcido. Viraram variáveis com o valor escuro como reserva. */
    <div className="pf-passos" style={{ display: "flex", alignItems: "center", marginBottom: "32px" }}>
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const locked = lockedSteps.includes(i);
        const clickable = i !== current && !locked;
        return (
          <div key={step.key} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <div
                onClick={() => clickable && onStepClick(i)}
                style={{
                  width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "12px", fontWeight: "700", flexShrink: 0, transition: "all 0.3s ease",
                  background: locked ? "var(--passo-travado-fundo, rgba(255,255,255,0.03))" : done ? "var(--primary, #6366f1)" : active ? "rgba(99,102,241,0.2)" : "var(--passo-fundo, rgba(255,255,255,0.06))",
                  border: locked ? "2px dashed var(--passo-borda, rgba(255,255,255,0.12))" : done ? "2px solid var(--primary, #6366f1)" : active ? "2px solid rgba(99,102,241,0.8)" : "2px solid var(--passo-borda, rgba(255,255,255,0.12))",
                  color: locked ? "var(--passo-travado-cor, rgba(255,255,255,0.2))" : done ? "#fff" : active ? "rgba(99,102,241,1)" : "var(--text-muted)",
                  boxShadow: active ? "0 0 0 4px rgba(99,102,241,0.15)" : "none",
                  cursor: locked ? "not-allowed" : clickable ? "pointer" : "default",
                  opacity: locked ? 0.5 : 1,
                }}
              >
                {done ? <IconCheck /> : i + 1}
              </div>
              <span
                onClick={() => clickable && onStepClick(i)}
                style={{
                  fontSize: "11px", fontWeight: active ? "600" : "400",
                  color: locked ? "var(--passo-travado-cor, rgba(255,255,255,0.2))" : active ? "var(--text)" : "var(--text-muted)",
                  whiteSpace: "nowrap", transition: "all 0.3s",
                  cursor: locked ? "not-allowed" : clickable ? "pointer" : "default",
                  opacity: locked ? 0.5 : 1,
                }}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: "2px", marginBottom: "18px", marginLeft: "8px", marginRight: "8px", background: done ? "var(--primary, #6366f1)" : "var(--passo-trilho, rgba(255,255,255,0.08))", borderRadius: "2px", transition: "background 0.4s ease" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function AtributosSection({ atributos, selecionados, onChange, disabled }) {
  if (!atributos || atributos.length === 0) return null;

  const grupos = atributos.reduce((acc, atr) => {
    const g = atr.grupo || "Outros";
    if (!acc[g]) acc[g] = [];
    acc[g].push(atr);
    return acc;
  }, {});

  function toggle(id) {
    onChange(selecionados.includes(id) ? selecionados.filter((x) => x !== id) : [...selecionados, id]);
  }

  return (
    <div style={{ marginTop: "4px" }}>
      <span style={{ display: "block", marginBottom: "12px", fontSize: "13px", fontWeight: "600", color: "var(--text-muted)" }}>
        Atributos do imóvel
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {Object.entries(grupos).map(([grupo, itens]) => (
          <div key={grupo}>
            <span style={{ display: "block", fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.45, marginBottom: "8px" }}>
              {grupo}
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "8px" }}>
              {itens.map((atr) => {
                const checked = selecionados.includes(atr.id);
                return (
                  <label key={atr.id} style={{
                    display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px",
                    borderRadius: "8px", cursor: disabled ? "not-allowed" : "pointer",
                    border: checked ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.08)",
                    background: checked ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.02)",
                    transition: "all 0.15s ease", fontSize: "13px", userSelect: "none",
                    opacity: disabled ? 0.55 : 1,
                  }}>
                    <input
                      type="checkbox" checked={checked} onChange={() => toggle(atr.id)} disabled={disabled}
                      style={{ accentColor: "var(--primary, #6366f1)", width: "14px", height: "14px", flexShrink: 0 }}
                    />
                    {atr.descricao}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PropertyPreviewCard({ form, previewItems, cardRef }) {
  const [idx, setIdx] = useState(0);
  const previewUrls = previewItems.map((it) => it.url);
  const current360 = Boolean(previewItems[idx]?.is360); // foto atual é panorâmica 360°?

  useEffect(() => { setIdx(0); }, [previewUrls.length]);

  useEffect(() => {
    // Não auto-avança quando o usuário está explorando uma foto 360°.
    if (previewUrls.length <= 1 || current360) return;
    const timer = setInterval(() => setIdx((i) => (i + 1) % previewUrls.length), 3500);
    return () => clearInterval(timer);
  }, [previewUrls.length, current360]);

  const price = parseCurrencyBRL(String(form.price));
  const hasPrice = Number.isFinite(price) && price > 0;
  const hasLocation = form.neighborhood || form.city || form.state;
  const areaExibicao = metragemExibicao(form);
  const hasStats = areaExibicao || form.bedrooms || form.suites || form.salas || form.banheiros || form.parkingSpots;
  const statusLabel = { ACTIVE: "Ativo", INACTIVE: "Inativo", DRAFT: "Rascunho" }[form.status] || "Rascunho";
  const statusColor = { ACTIVE: "#10b981", INACTIVE: "#ef4444", DRAFT: "#f59e0b" }[form.status] || "#f59e0b";
  const contratoPreview = tipoContratoInfo(form.tipoContrato);
  const currentUrl = previewUrls[idx] || null;

  function prev(e) { e.stopPropagation(); setIdx((i) => (i - 1 + previewUrls.length) % previewUrls.length); }
  function next(e) { e.stopPropagation(); setIdx((i) => (i + 1) % previewUrls.length); }

  return (
    <div style={{ position: "sticky", top: "80px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
          Pré-visualização
        </span>
        <span style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", color: statusColor, background: `${statusColor}20`, padding: "2px 8px", borderRadius: "999px" }}>
          {statusLabel}
        </span>
      </div>

      {/* O cartão de vidro da prévia. O fundo e a borda saíram do inline para a
          folha (`.pf-previa`): eram branco translúcido, que sobre o painel
          claro deixava o cartão sem caixa nenhuma. */}
      <article ref={cardRef} className="pf-previa" style={{ backdropFilter: "blur(15px)", borderRadius: "20px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div className="pf-previa__foto" style={{ position: "relative", width: "100%", height: "200px", overflow: "hidden" }}>
          {currentUrl && current360 ? (
            <Panorama360 key={`pano-${currentUrl}`} src={currentUrl} height={200} />
          ) : currentUrl ? (
            <img
              key={currentUrl}
              src={currentUrl}
              alt="preview"
              style={{ width: "100%", height: "100%", objectFit: "cover", animation: "fadeIn 0.3s ease-in-out" }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "var(--previa-apagado, rgba(255,255,255,0.15))" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span style={{ fontSize: "12px" }}>Foto aparecerá aqui</span>
            </div>
          )}

          {previewUrls.length > 1 && (
            <>
              <button type="button" onClick={prev} style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", width: "28px", height: "28px", borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "16px", lineHeight: 1 }}>‹</button>
              <button type="button" onClick={next} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", width: "28px", height: "28px", borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "16px", lineHeight: 1 }}>›</button>
              <span style={{ position: "absolute", bottom: "8px", left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.45)", color: "#fff", fontSize: "10px", padding: "2px 8px", borderRadius: "999px" }}>
                {idx + 1}/{previewUrls.length}
              </span>
            </>
          )}

          {form.andamento && (
            <span style={{ position: "absolute", top: "10px", left: "10px", fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", color: "#fff", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", padding: "3px 8px", borderRadius: "999px" }}>
              {{ PRONTO_PARA_MORAR: "Pronto para morar", EM_CONSTRUCAO: "Em construção" }[form.andamento]}
            </span>
          )}
          {contratoPreview && (
            <span style={{ position: "absolute", top: "10px", right: "10px", fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", color: "#fff", background: contratoPreview.cor, backdropFilter: "blur(4px)", padding: "3px 8px", borderRadius: "999px" }}>
              {contratoPreview.label}
            </span>
          )}
          {form.aceitaPermuta && (
            <span style={{ position: "absolute", bottom: previewUrls.length > 1 ? "28px" : "10px", left: "10px", fontSize: "10px", fontWeight: "600", color: "#fff", background: "rgba(99,102,241,0.75)", backdropFilter: "blur(4px)", padding: "3px 8px", borderRadius: "999px" }}>
              Aceita permuta
            </span>
          )}
        </div>

        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "600", color: form.title ? "var(--previa-forte, #fff)" : "var(--previa-fantasma, rgba(255,255,255,0.2))", lineHeight: "1.3", margin: 0 }}>
            {form.title || "Título do imóvel"}
          </h3>

          {hasLocation && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
              <IconPin />
              <span>{[form.neighborhood, form.city, form.state].filter(Boolean).join(", ")}</span>
            </div>
          )}

          {form.description && (
            <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.5", margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {form.description}
            </p>
          )}

          {hasStats && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "2px" }}>
              {areaExibicao && (
                <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "4px 10px", borderRadius: "6px" }}>
                  <IconArea /> {areaExibicao} m²
                </span>
              )}
              {form.finalidade === "COMERCIAL" ? (
                (form.salas || form.banheiros) && (
                  <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "4px 10px", borderRadius: "6px" }}>
                    <IconBed />
                    {form.salas ? `${form.salas} sala${form.salas !== "1" ? "s" : ""}` : ""}
                    {form.salas && form.banheiros ? " · " : ""}
                    {form.banheiros ? `${form.banheiros} banheiro${form.banheiros !== "1" ? "s" : ""}` : ""}
                  </span>
                )
              ) : (
                form.bedrooms && (
                  <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "4px 10px", borderRadius: "6px" }}>
                    <IconBed /> {form.bedrooms} qto{form.bedrooms !== "1" ? "s" : ""}
                    {form.suites ? ` · ${form.suites} suíte${form.suites !== "1" ? "s" : ""}` : ""}
                  </span>
                )
              )}
              {form.parkingSpots && (
                <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "4px 10px", borderRadius: "6px" }}>
                  <IconCar /> {form.parkingSpots} vaga{form.parkingSpots !== "1" ? "s" : ""}
                </span>
              )}
            </div>
          )}

          <div style={{ marginTop: "4px", paddingTop: "12px", borderTop: "1px solid var(--previa-risco, rgba(255,255,255,0.06))" }}>
            <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>Valor</span>
            <p style={{ fontSize: "22px", fontWeight: "700", color: hasPrice ? "var(--previa-forte, #fff)" : "var(--previa-apagado, rgba(255,255,255,0.15))", margin: "2px 0 0 0", letterSpacing: "-0.5px" }}>
              {hasPrice ? `R$ ${price.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "R$ —"}
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}

/* `tourId` vira `data-tour` no invólucro do campo — é o gancho do tour guiado.
   Fica aqui, e não em cada <input>, porque o holofote precisa cobrir rótulo +
   campo + mensagem de erro; só o input deixaria o nome do campo no escuro. */
function Field({ label, children, hint, required, error, tourId }) {
  return (
    <div data-tour={tourId} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
        {required && <span style={{ color: "#ef4444", marginLeft: "4px" }} title="Campo obrigatório">*</span>}
      </label>
      {children}
      {error
        ? <span style={{ fontSize: "11px", color: "#f87171", fontWeight: "500" }}>{error}</span>
        : hint && <span style={{ fontSize: "11px", color: "var(--text-muted)", opacity: 0.7 }}>{hint}</span>}
    </div>
  );
}

function SugestaoCard({ rotulo, texto, onAplicar }) {
  const [aplicado, setAplicado] = useState(false);
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", background: "rgba(255,255,255,0.03)", padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "8px" }}>
        <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
          {rotulo}
        </span>
        <button
          type="button"
          onClick={() => { onAplicar(); setAplicado(true); }}
          style={{
            padding: "5px 14px", borderRadius: "7px", cursor: "pointer", flexShrink: 0, width: "auto",
            background: aplicado ? "rgba(16,185,129,0.2)" : "rgba(99,102,241,0.15)",
            border: `1px solid ${aplicado ? "rgba(16,185,129,0.5)" : "rgba(99,102,241,0.4)"}`,
            color: aplicado ? "#34d399" : "rgba(129,140,248,1)", fontSize: "12px", fontWeight: "600",
          }}
        >
          {aplicado ? <><IconeCheck size={12} /> Aplicado</> : "Aplicar"}
        </button>
      </div>
      <p style={{ margin: 0, fontSize: "13px", color: "var(--text)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
        {texto}
      </p>
    </div>
  );
}

function PostAvatar({ url, nome, size = 40, ring }) {
  const inner = url
    ? <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#6366f1,#a855f7)", color: "#fff", fontWeight: 700, fontSize: size * 0.42 }}>{(nome || "?").charAt(0).toUpperCase()}</div>;
  const circle = <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>{inner}</div>;
  if (!ring) return circle;
  return (
    <div style={{ padding: "2px", borderRadius: "50%", background: "linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)", flexShrink: 0 }}>
      <div style={{ padding: "2px", borderRadius: "50%", background: "#fff" }}>{circle}</div>
    </div>
  );
}

function PreviewCaption({ value, onChange, color, collapsedHeight = 60, linkColor = "#65676b", maxExpanded = 150 }) {
  const ref = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (expanded) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, maxExpanded)}px`;
      el.style.overflowY = el.scrollHeight > maxExpanded ? "auto" : "hidden";
    } else {
      el.style.height = `${collapsedHeight}px`;
      el.style.overflowY = "hidden";
      setOverflow(el.scrollHeight > collapsedHeight + 4);
    }
  }, [value, expanded, collapsedHeight, maxExpanded]);
  return (
    <div>
      <textarea
        ref={ref}
        className="divulgar-caption"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setExpanded(true)}
        placeholder="Escreva o texto do post…"
        style={{
          width: "100%", boxSizing: "border-box", border: "none", outline: "none", resize: "none",
          overflow: "hidden", background: "transparent", color, fontSize: "13px", lineHeight: 1.5,
          fontFamily: "inherit", height: collapsedHeight, padding: 0, margin: 0,
          // Suaviza o corte do texto no topo/base quando há mais conteúdo que cabe.
          ...((overflow || expanded) ? {
            WebkitMaskImage: "linear-gradient(to bottom, transparent 0, #000 12px, #000 calc(100% - 12px), transparent 100%)",
            maskImage: "linear-gradient(to bottom, transparent 0, #000 12px, #000 calc(100% - 12px), transparent 100%)",
          } : {}),
        }}
      />
      {(overflow || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{ width: "auto", padding: 0, marginTop: "2px", background: "none", border: "none", cursor: "pointer", color: linkColor, fontSize: "12px", fontWeight: 600 }}
        >
          {expanded ? "Ler menos" : "Ler mais"}
        </button>
      )}
    </div>
  );
}

function WandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ display: "block", flexShrink: 0 }}>
      <line x1="5" y1="19" x2="13" y2="11" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="17" y1="3.5" x2="17" y2="10" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <line x1="13.5" y1="6.75" x2="20.5" y2="6.75" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <line x1="6" y1="3" x2="6" y2="7" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="4" y1="5" x2="8" y2="5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function DescriptionBox({ value, onChange, color, collapsedHeight, linkColor, active, onEnter, onLeave, onGerarIA, iaLoading }) {
  return (
    <div className={`divulgar-desc${active ? " is-ai" : ""}`} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <PreviewCaption value={value} onChange={onChange} color={color} collapsedHeight={collapsedHeight} linkColor={linkColor} />
      {onGerarIA && (
        <button
          type="button"
          onClick={onGerarIA}
          disabled={iaLoading}
          title="Gerar com IA"
          aria-label="Gerar com IA"
          className="divulgar-desc-ia"
        >
          <WandIcon />
        </button>
      )}
    </div>
  );
}

function MediaCarousel({ urls, aspectRatio, maxHeight }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => { setIdx(0); }, [urls]);
  if (!urls || urls.length === 0) return null;
  const total = urls.length;
  const imgStyle = aspectRatio
    ? { width: "100%", aspectRatio, objectFit: "cover", display: "block" }
    : { width: "100%", maxHeight, objectFit: "cover", display: "block" };
  const go = (d) => (e) => { e.stopPropagation(); e.preventDefault(); setIdx((i) => (i + d + total) % total); };
  const arrow = (side) => ({
    position: "absolute", top: "50%", [side]: "8px", transform: "translateY(-50%)",
    width: "28px", height: "28px", borderRadius: "50%", border: "none", cursor: "pointer", padding: 0,
    background: "rgba(0,0,0,0.45)", color: "#fff", fontSize: "18px", lineHeight: 1,
    display: "flex", alignItems: "center", justifyContent: "center",
  });
  return (
    <div style={{ position: "relative", overflow: "hidden", background: "#000" }}>
      <img src={urls[idx]} alt="" style={imgStyle} />
      {total > 1 && (
        <>
          <button type="button" onClick={go(-1)} aria-label="Foto anterior" style={arrow("left")}>‹</button>
          <button type="button" onClick={go(1)} aria-label="Próxima foto" style={arrow("right")}>›</button>
          <div style={{ position: "absolute", top: "8px", right: "10px", background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "999px" }}>{idx + 1}/{total}</div>
          <div style={{ position: "absolute", bottom: "8px", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "5px" }}>
            {urls.map((_, i) => (
              <span key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: i === idx ? "#fff" : "rgba(255,255,255,0.5)" }} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function WhatsAppMedia({ urls }) {
  const n = urls?.length || 0;
  if (n === 0) return null;
  const img = (u, key, extra) => (
    <img key={key} src={u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", ...extra }} />
  );
  const gridBase = { display: "grid", gap: "2px", borderRadius: "6px", overflow: "hidden", marginBottom: "5px" };

  if (n === 1) {
    return <img src={urls[0]} alt="" style={{ width: "100%", borderRadius: "6px", display: "block", marginBottom: "5px", maxHeight: "200px", objectFit: "cover" }} />;
  }
  if (n === 2) {
    return <div style={{ ...gridBase, gridTemplateColumns: "1fr 1fr", aspectRatio: "2" }}>{img(urls[0], 0)}{img(urls[1], 1)}</div>;
  }
  if (n === 3) {
    return (
      <div style={{ ...gridBase, gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", aspectRatio: "1.25" }}>
        {img(urls[0], 0, { gridRow: "1 / 3" })}{img(urls[1], 1)}{img(urls[2], 2)}
      </div>
    );
  }
  const restantes = n - 3;
  return (
    <div style={{ ...gridBase, gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", aspectRatio: "1" }}>
      {img(urls[0], 0)}{img(urls[1], 1)}{img(urls[2], 2)}
      {n === 4
        ? img(urls[3], 3)
        : (
          <div key={3} style={{ position: "relative" }}>
            {img(urls[3], "bg", { filter: "brightness(0.42)" })}
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "22px", fontWeight: 700 }}>+{restantes}</div>
          </div>
        )}
    </div>
  );
}

function PreviewCard({ brandLabel, brandColor, brandRadius = "12px", brandIcon, ringGradient, ringGlow, statusText, published, publishedCount = 0, publishing, onRemove, removeLoading, locked, lockLabel, children }) {
  return (
    <div className={`divulgar-card${published ? " is-published" : ""}`} style={{ "--ring-gradient": ringGradient, "--ring-glow": ringGlow }}>
      <div className="divulgar-ring">
        <div className="divulgar-inner">
          {children}
          {publishing && (
            <div className="divulgar-publishing">
              <div className="divulgar-publishing-spin" />
              <div>Publicando…</div>
            </div>
          )}
          {published && !publishing && (
            <div className="divulgar-published">
              <div className="divulgar-published-check">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M20 6 9 17l-5-5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <div className="divulgar-published-label">Publicado!</div>
              {publishedCount > 1 && (
                <div style={{ fontSize: "12px", fontWeight: 600, opacity: 0.9, marginTop: "-4px" }}>
                  {publishedCount} posts ativos
                </div>
              )}
              {onRemove && (
                <button type="button" className="divulgar-published-remove" onClick={onRemove} disabled={removeLoading}>
                  {removeLoading ? "Removendo…" : "Remover publicação"}
                </button>
              )}
            </div>
          )}
          {!published && !publishing && locked && (
            <div className="divulgar-locked">
              <div className="divulgar-locked-icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              </div>
              <div className="divulgar-locked-label">{lockLabel || "Integração não configurada"}</div>
            </div>
          )}
        </div>
      </div>
      <span className="divulgar-logo" style={{ borderRadius: brandRadius, background: brandColor }}>{brandIcon}</span>
      {statusText && <span className="divulgar-status">{brandLabel} · {statusText}</span>}
    </div>
  );
}

function Expand({ children }) {
  return <div className="divulgar-expand"><div>{children}</div></div>;
}

function PostFooter({ children }) {
  return (
    <div style={{ padding: "10px 12px", background: "#f0f2f5", borderTop: "1px solid #dfe1e5" }}>
      {children}
    </div>
  );
}

export const FB_ICON = <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>;
export const IG_ICON = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>;
export const WA_ICON = <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/></svg>;

function Ic({ d, size = 16, fill = "none" }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flexShrink: 0 }}>{d}</svg>;
}
const ICON = {
  curtir: <path d="M7 10v11M18 21H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h2.5l3.2-6.4A2 2 0 0 1 15 4.5V9h4.2a2 2 0 0 1 2 2.3l-1.1 7A2 2 0 0 1 18 21z" />,
  comentar: <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />,
  compartilhar: <><line x1="4" y1="12" x2="20" y2="12" /><polyline points="14 6 20 12 14 18" /></>,
  coracao: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />,
  enviar: <><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>,
  salvar: <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />,
  globo: <><circle cx="12" cy="12" r="9" /><line x1="3" y1="12" x2="21" y2="12" /><path d="M12 3a14 14 0 0 1 3.5 9 14 14 0 0 1-3.5 9 14 14 0 0 1-3.5-9A14 14 0 0 1 12 3z" /></>,
};

export function FacebookPreview({ nome, avatarUrl, coverUrls, caption, onChange, statusText, descActive, onDescEnter, onDescLeave, onGerarIA, iaLoading, iaErro, published, publishedCount, publishing, onRemove, removeLoading, locked, lockLabel, acao }) {
  return (
    <PreviewCard brandLabel="Facebook" brandColor="#1877f2" brandRadius="11px" brandIcon={FB_ICON}
      ringGradient="linear-gradient(115deg,#1877f2,#4293ff,#0a58ca,#3b82f6,#1877f2)" ringGlow="rgba(24,119,242,0.45)" statusText={statusText}
      published={published} publishedCount={publishedCount} publishing={publishing} onRemove={onRemove} removeLoading={removeLoading} locked={locked} lockLabel={lockLabel}>
      <div style={{ background: "#fff", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px" }}>
          <PostAvatar url={avatarUrl} nome={nome} size={40} />
          <div style={{ lineHeight: 1.25 }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#050505" }}>{nome || "Sua imobiliária"}</div>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#65676b" }}>
              Agora · <span style={{ color: "#65676b", display: "inline-flex" }}><Ic d={ICON.globo} size={12} /></span>
            </div>
          </div>
          <span style={{ marginLeft: "auto", color: "#65676b", fontSize: "18px", lineHeight: 1 }}>⋯</span>
        </div>
        <Expand>
          <div style={{ padding: "0 12px 10px" }}>
            <DescriptionBox value={caption} onChange={onChange} color="#050505"
              active={descActive} onEnter={onDescEnter} onLeave={onDescLeave} onGerarIA={onGerarIA} iaLoading={iaLoading} />
            {iaErro && <span style={{ display: "block", marginTop: "6px", fontSize: "11px", color: "#c0392b" }}>{iaErro}</span>}
          </div>
        </Expand>
        <MediaCarousel urls={coverUrls} maxHeight="260px" />
        <Expand>
          <div style={{ display: "flex", justifyContent: "space-around", padding: "9px 4px", borderTop: "1px solid #ced0d4", color: "#65676b", fontSize: "13px", fontWeight: 600 }}>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><Ic d={ICON.curtir} size={17} /> Curtir</span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><Ic d={ICON.comentar} size={17} /> Comentar</span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><Ic d={ICON.compartilhar} size={17} /> Compartilhar</span>
          </div>
          <PostFooter>{acao}</PostFooter>
        </Expand>
      </div>
    </PreviewCard>
  );
}

export function InstagramPreview({ nome, avatarUrl, coverUrls, caption, onChange, statusText, descActive, onDescEnter, onDescLeave, onGerarIA, iaLoading, iaErro, published, publishedCount, publishing, onRemove, removeLoading, locked, lockLabel, acao }) {
  const handle = (nome || "imobiliaria").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9._]/g, "");
  return (
    <PreviewCard brandLabel="Instagram" brandColor="linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)" brandRadius="11px" brandIcon={IG_ICON}
      ringGradient="linear-gradient(115deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888,#f09433)" ringGlow="rgba(220,39,67,0.42)" statusText={statusText}
      published={published} publishedCount={publishedCount} publishing={publishing} onRemove={onRemove} removeLoading={removeLoading} locked={locked} lockLabel={lockLabel}>
      <div style={{ background: "#fff", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px" }}>
          <PostAvatar url={avatarUrl} nome={nome} size={30} ring />
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#262626" }}>{handle}</span>
          <span style={{ marginLeft: "auto", color: "#262626", fontSize: "18px", lineHeight: 1 }}>⋯</span>
        </div>
        {coverUrls.length > 0
          ? <MediaCarousel urls={coverUrls} aspectRatio="1" />
          : <div style={{ width: "100%", aspectRatio: "1", background: "#efefef", display: "flex", alignItems: "center", justifyContent: "center", color: "#b0b0b0", fontSize: "13px" }}>Adicione uma foto</div>}
        <Expand>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "10px 12px 6px", color: "#262626" }}>
            <Ic d={ICON.coracao} size={23} /><Ic d={ICON.comentar} size={23} /><Ic d={ICON.enviar} size={23} />
            <span style={{ marginLeft: "auto", display: "inline-flex" }}><Ic d={ICON.salvar} size={23} /></span>
          </div>
          <div style={{ padding: "2px 12px 12px" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#262626", marginRight: "6px" }}>{handle}</span>
            <DescriptionBox value={caption} onChange={onChange} color="#262626"
              active={descActive} onEnter={onDescEnter} onLeave={onDescLeave} onGerarIA={onGerarIA} iaLoading={iaLoading} />
            {iaErro && <span style={{ display: "block", marginTop: "6px", fontSize: "11px", color: "#c0392b" }}>{iaErro}</span>}
          </div>
          <PostFooter>{acao}</PostFooter>
        </Expand>
      </div>
    </PreviewCard>
  );
}

export function WhatsAppPreview({ nome, avatarUrl, coverUrls, caption, onChange, statusText, descActive, onDescEnter, onDescLeave, onGerarIA, iaLoading, iaErro, acao }) {
  return (
    <PreviewCard brandLabel="WhatsApp" brandColor="#25d366" brandRadius="50%" brandIcon={WA_ICON}
      ringGradient="linear-gradient(115deg,#25d366,#128c7e,#34e07a,#25d366)" ringGlow="rgba(37,211,102,0.42)" statusText={statusText}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#075e54", color: "#fff", padding: "8px 12px" }}>
          <PostAvatar url={avatarUrl} nome={nome} size={30} />
          <div style={{ fontSize: "13px", fontWeight: 600 }}>{nome || "Sua imobiliária"}</div>
        </div>
        <div style={{ background: "#e5ddd5 url('https://media2.dev.to/dynamic/image/width=800%2Cheight=%2Cfit=scale-down%2Cgravity=auto%2Cformat=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Farticles%2Fb9qk3w41sqf1l0ccujfh.png') center / cover", padding: "16px 10px", display: "flex", justifyContent: "flex-end", alignItems: "flex-start", flex: 1, minHeight: "120px" }}>
          <div style={{ maxWidth: "90%", background: "#dcf8c6", borderRadius: "10px", padding: "7px", boxShadow: "0 1px 1px rgba(0,0,0,0.12)" }}>
            <WhatsAppMedia urls={coverUrls} />
            <Expand>
              <DescriptionBox value={caption} onChange={onChange} color="#111b21" collapsedHeight={52} linkColor="#4a8a34"
                active={descActive} onEnter={onDescEnter} onLeave={onDescLeave} onGerarIA={onGerarIA} iaLoading={iaLoading} />
              {iaErro && <span style={{ display: "block", marginTop: "4px", fontSize: "10px", color: "#c0392b" }}>{iaErro}</span>}
              <div style={{ textAlign: "right", fontSize: "10px", color: "#667781", marginTop: "2px" }}>12:00 <span style={{ color: "#53bdeb" }}>✓✓</span></div>
            </Expand>
          </div>
        </div>
        <Expand>
          <PostFooter>{acao}</PostFooter>
        </Expand>
      </div>
    </PreviewCard>
  );
}

// Proporção considerada "equiretangular" (panorâmica 360°): ~2:1.
const ehEquirect = (r) => typeof r === "number" && r >= 1.9 && r <= 2.1;

function PhotoGrid({ images, onRemove, onReorder, addInputId, showAddCard, disabled, allow360, onToggle360 }) {
  const dragFrom = useRef(null);
  const [dragOver, setDragOver] = useState(null);
  const [ratios, setRatios] = useState({}); // proporção (w/h) medida por foto → só mostra 360° em ~2:1

  if (!images.length) return null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "10px" }}>
      {images.map((img, i) => (
        <div
          key={img.id}
          draggable
          onDragStart={() => { dragFrom.current = i; }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(i); }}
          onDragLeave={() => setDragOver(null)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(null);
            if (dragFrom.current !== null && dragFrom.current !== i) {
              onReorder(dragFrom.current, i);
            }
            dragFrom.current = null;
          }}
          onDragEnd={() => { dragFrom.current = null; setDragOver(null); }}
          style={{
            position: "relative", borderRadius: "10px", overflow: "hidden",
            border: dragOver === i ? "2px solid rgba(99,102,241,0.8)" : "2px solid rgba(255,255,255,0.08)",
            cursor: "grab", transition: "border-color 0.15s, opacity 0.15s",
            opacity: dragOver === i ? 0.7 : 1,
            aspectRatio: "1",
          }}
        >
          <img
            src={img.previewUrl}
            alt={`foto ${i + 1}`}
            onLoad={(e) => {
              const el = e.currentTarget;
              if (el.naturalHeight) setRatios((p) => (p[img.id] ? p : { ...p, [img.id]: el.naturalWidth / el.naturalHeight }));
            }}
            style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
          />

          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0)", transition: "background 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.35)"; e.currentTarget.querySelector("button").style.opacity = "1"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0)"; e.currentTarget.querySelector("button").style.opacity = "0"; }}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(i); }}
              /* `padding: 0` não é enfeite: o seletor global de button no
                 styles.css declara `padding: 14px 20px`. Com box-sizing
                 border-box, a largura usada nunca fica abaixo do padding —
                 os 22px viravam 40x28, que é o oval —, e a caixa de conteúdo
                 sobrava com zero de largura, onde o ícone encolhia até sumir. */
              style={{
                position: "absolute", top: "6px", right: "6px", width: "22px", height: "22px",
                padding: 0,
                borderRadius: "50%", background: "rgba(239,68,68,0.9)", border: "none",
                color: "#fff", fontSize: "14px", lineHeight: 1, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                opacity: 0, transition: "opacity 0.2s",
              }}
            ><IconeX size={11} /></button>
          </div>

          {i === 0 && (
            <span style={{ position: "absolute", bottom: "6px", left: "6px", fontSize: "9px", fontWeight: "700", background: "rgba(0,0,0,0.65)", color: "#fff", padding: "2px 6px", borderRadius: "999px", pointerEvents: "none" }}>
              CAPA
            </span>
          )}

          <span style={{ position: "absolute", top: "6px", left: "6px", fontSize: "9px", fontWeight: "700", background: "rgba(0,0,0,0.5)", color: "rgba(255,255,255,0.8)", padding: "1px 5px", borderRadius: "999px", pointerEvents: "none" }}>
            {i + 1}
          </span>

          {allow360 && (img.is360 || ehEquirect(ratios[img.id])) && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggle360(i); }}
              title={img.is360 ? "Remover marcação 360°" : "Marcar como foto panorâmica 360°"}
              style={{
                position: "absolute", bottom: "6px", right: "6px", zIndex: 3, width: "auto",
                display: "flex", alignItems: "center", gap: "3px", padding: "3px 8px",
                borderRadius: "999px", cursor: "pointer", border: "none",
                fontSize: "9px", fontWeight: 700, letterSpacing: "0.03em",
                background: img.is360 ? "rgba(99,102,241,0.95)" : "rgba(0,0,0,0.6)",
                color: img.is360 ? "#fff" : "rgba(255,255,255,0.85)",
                boxShadow: img.is360 ? "0 2px 8px rgba(99,102,241,0.5)" : "none",
              }}
            >
              360°
            </button>
          )}
        </div>
      ))}

      {showAddCard && (
        <label
          htmlFor={disabled ? undefined : addInputId}
          title="Adicionar mais fotos"
          className={`pf-add-foto${disabled ? " is-disabled" : ""}`}
          style={{ cursor: disabled ? "not-allowed" : "pointer" }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span style={{ fontSize: "11px", fontWeight: 600 }}>Adicionar</span>
        </label>
      )}
    </div>
  );
}

/* Os dois endereços do fluxo de cadastro, escritos uma vez.

   Eles aparecem em quatro lugares (rota, barra lateral, atalho do Início e
   aqui), e o par índice/formulário só faz sentido junto — cravar a string em
   cada ponto é como as duas telas acabaram com nomes trocados da primeira vez. */
const EnderecoDoIndice = "/imoveis";
const EnderecoDoFormulario = "/imoveis/novo";

export function PropertyManagement({ onSubmitProperty, disabled, initialData, logoUrl }) {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  /* ── Qual das duas telas está aberta vive NO CAMINHO, não num `useState` ────
     Era estado interno, e isso tinha dois custos: não dava para mandar link do
     formulário para ninguém, e o menu lateral não tinha como abrir "Novo
     Imóvel" — ele só sabia levar até o menu de escolha, de onde a pessoa
     precisava clicar de novo.

     A primeira correção pôs a escolha na URL como parâmetro (`?ver=novo`), e
     isso resolveu o link mas deixou os dois endereços torcidos: o índice ficava
     em `/imoveis/novo` — a palavra "novo" numa tela que não cadastra nada — e o
     formulário em `/imoveis/novo?ver=novo`, dizendo duas vezes a mesma coisa.
     Agora o caminho é a resposta: `/imoveis` é o índice, `/imoveis/novo` é o
     formulário. Botão Voltar do navegador segue funcionando entre os dois, e a
     edição (que chega com `initialData`) abre o formulário por outro caminho
     ainda, `/imoveis/editar`, sem depender de nada disso. */
  const view = initialData?.id || pathname === EnderecoDoFormulario ? "PROPERTY" : "MENU";
  const abrirFormulario = () => navigate(EnderecoDoFormulario);
  /* O botão de sair do formulário tem dois nomes ("Voltar ao menu" ao cadastrar,
     "Cancelar edição" ao editar) e agora dois destinos, porque são duas
     perguntas diferentes: quem desistiu de cadastrar volta ao índice de onde
     partiu; quem desistiu de editar quer o imóvel de volta na lista.

     Enquanto a tela era escolhida por parâmetro, o botão apagava o `?ver=novo` —
     e em `/imoveis/editar` isso não levava a lugar nenhum, porque o formulário
     abria pelo `initialData` e continuava aberto. "Cancelar edição" não
     cancelava nada. */
  const voltarAoMenu = () => navigate(initialData?.id ? "/imoveis/portfolio" : EnderecoDoIndice);

  /* Link antigo com `?ver=novo` ainda circula — em favorito, em tour gravado, no
     histórico de quem já usava. Traduzir para o endereço de hoje em vez de
     aceitar as duas grafias para sempre: o link velho continua levando ao
     formulário, e a barra do navegador passa a mostrar o caminho de verdade. */
  useEffect(() => {
    if (new URLSearchParams(search).get("ver") !== "novo") return;
    navigate(EnderecoDoFormulario, { replace: true });
  }, [pathname, search, navigate]);

  return (
    <div className="management-container">
      {view === "MENU" && (
        <div className="glass-panel" style={{ textAlign: "center", padding: "56px 40px", animation: "fadeIn 0.4s ease-out" }}>
          <h2 style={{ marginBottom: "8px", fontSize: "28px", fontWeight: "700" }}>Gerenciar Imóveis</h2>
          <p style={{ marginBottom: "48px", color: "var(--text-muted)", fontSize: "16px" }}>
            Selecione o tipo de operação que deseja realizar no sistema.
          </p>
          <div className="grid grid-2" style={{ gap: "32px", maxWidth: "800px", margin: "0 auto" }}>
            {[
              {
                onClick: abrirFormulario,
                tourId: "imovel-menu-novo",
                icon: <IconHome />,
                title: "Novo Imóvel",
                desc: "Cadastre propriedades, defina valores, envie fotos e gerencie as informações.",
              },
              {
                onClick: () => navigate("/tipos-imovel"),
                icon: (
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                  </svg>
                ),
                title: "Categoria de Imóvel",
                desc: "Adicione novas tipologias ao sistema para categorizar seu portfólio.",
              },
            ].map((card) => (
              <CartaoDeMenu key={card.title} {...card} />
            ))}
          </div>
        </div>
      )}

      {view === "PROPERTY" && (
        <PropertyForm
          onSubmit={onSubmitProperty}
          disabled={disabled}
          initialData={initialData}
          onCancelEdit={voltarAoMenu}
          logoUrl={logoUrl}
        />
      )}
    </div>
  );
}

// Selo "Informação gerada por IA" — texto pequeno posicionado acima do campo,
// à direita. Usa o mesmo gradiente e animação do IA-flare (agora aplicado ao
// texto via background-clip). Some junto com o flare quando o campo é editado.
function AiFlareBadge({ active }) {
  return (
    <span
      aria-hidden={!active}
      style={{
        position: "absolute", bottom: "calc(100% + 3px)", right: "2px", zIndex: 5,
        display: "inline-flex", alignItems: "center", gap: "4px",
        pointerEvents: "none", whiteSpace: "nowrap",
        opacity: active ? 1 : 0, transition: "opacity 0.4s ease",
      }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ display: "block", flexShrink: 0 }}>
        <line x1="5" y1="19" x2="13" y2="11" stroke="#dc2743" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="17" y1="3.5" x2="17" y2="10" stroke="#dc2743" strokeWidth="2" strokeLinecap="round" />
        <line x1="13.5" y1="6.75" x2="20.5" y2="6.75" stroke="#dc2743" strokeWidth="2" strokeLinecap="round" />
        <line x1="6" y1="3" x2="6" y2="7" stroke="#dc2743" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="4" y1="5" x2="8" y2="5" stroke="#dc2743" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span
        style={{
          fontSize: "10px", fontWeight: 700, letterSpacing: "0.03em",
          background: "linear-gradient(115deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
          backgroundSize: "200% 200%", animation: "gradient-flare 3s ease infinite",
          WebkitBackgroundClip: "text", backgroundClip: "text",
          WebkitTextFillColor: "transparent", color: "transparent",
        }}
      >
        Informação gerada por IA
      </span>
    </span>
  );
}

// Modal de decisão ao republicar quando já existe post na rede: manter o
// original + publicar novo (dois posts) OU apagar o original e substituir.
export function RepublishModal({ platform, onKeep, onReplace, onCancel }) {
  if (!platform) return null;
  const nome = platform === "facebook" ? "Facebook" : "Instagram";
  const optBase = {
    display: "flex", flexDirection: "column", gap: "3px", alignItems: "flex-start",
    padding: "12px 16px", borderRadius: "10px", cursor: "pointer", width: "100%",
    textAlign: "left", fontSize: "14px", fontWeight: 600,
  };
  return (
    <>
      <div onClick={onCancel} style={{
        position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
      }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 9001, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{
          width: "100%", maxWidth: "460px", background: "rgba(18,22,36,0.98)",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "26px 26px 22px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}>
          <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "8px" }}>Republicar no {nome}</div>
          <p style={{ margin: "0 0 20px", fontSize: "13px", lineHeight: 1.6, color: "#cbd5e1" }}>
            Já existe um anúncio deste imóvel no {nome}. O que fazer com o post atual?
            {platform === "instagram" && (
              <><br /><span style={{ color: "#fbbf24" }}>
                No Instagram, "substituir" apenas para de rastrear o post antigo — a Meta não permite apagá-lo por API. A exclusão precisa ser feita manualmente no app.
              </span></>
            )}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button type="button" onClick={onKeep} style={{ ...optBase, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.4)", color: "#c7d2fe" }}>
              Manter o original + publicar novo
              <small style={{ fontSize: "12px", fontWeight: 400, opacity: 0.8 }}>Fica com dois posts no {nome}.</small>
            </button>
            <button type="button" className="btn-danger" onClick={onReplace} style={{ ...optBase, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", color: "#fca5a5" }}>
              Apagar o original e substituir
              <small style={{ fontSize: "12px", fontWeight: 400, opacity: 0.8 }}>Remove o post atual e publica o novo no lugar.</small>
            </button>
            <button type="button" onClick={onCancel} style={{
              padding: "9px 16px", borderRadius: "9px", border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.05)", color: "#94a3b8", fontSize: "13px", fontWeight: 500,
              cursor: "pointer", width: "auto", alignSelf: "flex-end", marginTop: "2px",
            }}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Simulação do post publicado no estilo da rede (Facebook/Instagram), renderizada
// inline (dropdown) abaixo da linha. Usa a legenda REAL salva no publish e as
// métricas REAIS (curtidas/comentários/compartilhamentos) vindas da Graph API.
export function PostSimCard({ pub, coverUrls, caption, insights, nome, avatarUrl }) {
  const isIg = pub.channel === "INSTAGRAM";
  const likes = insights?.likes ?? 0;
  const comments = insights?.comments ?? 0;
  const shares = insights?.shares; // número (FB) ou null (IG)
  const nfmt = (n) => Number(n || 0).toLocaleString("pt-BR");
  const dataCurta = pub.createdAt
    ? new Date(pub.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })
    : "Agora";
  const handle = (nome || "imobiliaria").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9._]/g, "");

  return (
    <div style={{ background: "#fff", borderRadius: "10px", overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.18)" }}>
      {isIg ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px" }}>
            <PostAvatar url={avatarUrl} nome={nome} size={32} ring />
            <div style={{ flex: 1, fontSize: "13px", fontWeight: 600, color: "#050505" }}>{handle}</div>
            <span style={{ color: "#050505", fontSize: "18px", lineHeight: 1 }}>⋯</span>
          </div>
          <MediaCarousel urls={coverUrls} aspectRatio="1" />
          <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "10px 12px 6px", color: "#050505", fontSize: "14px", fontWeight: 600 }}>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><Ic d={ICON.coracao} size={24} />{likes > 0 && nfmt(likes)}</span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><Ic d={ICON.comentar} size={24} />{comments > 0 && nfmt(comments)}</span>
            <span style={{ display: "flex" }}><Ic d={ICON.enviar} size={24} /></span>
            <span style={{ marginLeft: "auto", display: "flex" }}><Ic d={ICON.salvar} size={24} /></span>
          </div>
          {caption && (
            <div style={{ padding: "4px 12px 0", fontSize: "14px", color: "#050505", lineHeight: 1.5 }}>
              <span style={{ fontWeight: 700, marginRight: "6px" }}>{handle}</span>
              <span style={{ whiteSpace: "pre-wrap" }}>{caption}</span>
            </div>
          )}
          <div style={{ padding: "6px 12px 14px", fontSize: "11px", color: "#8e8e8e", textTransform: "uppercase", letterSpacing: "0.02em" }}>{dataCurta}</div>
        </>
      ) : (
        <>
          <div style={{ padding: "12px 14px 8px", display: "flex", alignItems: "center", gap: "10px" }}>
            <PostAvatar url={avatarUrl} nome={nome} size={40} />
            <div style={{ flex: 1, lineHeight: 1.3 }}>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#050505" }}>{nome || "Sua imobiliária"}</div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "#65676b" }}>
                {dataCurta} · <span style={{ display: "inline-flex" }}><Ic d={ICON.globo} size={12} /></span>
              </div>
            </div>
            <span style={{ color: "#65676b", fontSize: "20px", lineHeight: 1 }}>⋯</span>
          </div>
          {caption && <div style={{ padding: "0 14px 10px", fontSize: "14px", lineHeight: 1.5, color: "#050505", whiteSpace: "pre-wrap" }}>{caption}</div>}
          <MediaCarousel urls={coverUrls} maxHeight="400px" />
          <div style={{ borderTop: "1px solid #ced0d4", margin: "10px 12px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-around", padding: "8px 4px 12px", color: "#65676b", fontSize: "14px", fontWeight: 600 }}>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><Ic d={ICON.curtir} size={18} /> {likes > 0 ? nfmt(likes) : "Curtir"}</span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><Ic d={ICON.comentar} size={18} /> {comments > 0 ? nfmt(comments) : "Comentar"}</span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><Ic d={ICON.compartilhar} size={18} /> {(shares != null && shares > 0) ? nfmt(shares) : "Compartilhar"}</span>
          </div>
        </>
      )}
    </div>
  );
}

// Contorno "flare" (gradiente animado) exibido ao redor de um campo preenchido
// pela IA. Some suavemente (opacity) quando o usuário edita o campo manualmente.
function AiFlare({ active, radius = "11px", children }) {
  return (
    <div style={{ position: "relative", zIndex: 1 }}>
      <AiFlareBadge active={active} />
      <div style={{
        position: "absolute", inset: "-1px", borderRadius: radius, zIndex: -1, pointerEvents: "none",
        background: "linear-gradient(115deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
        backgroundSize: "200% 200%", animation: "gradient-flare 3s ease infinite",
        opacity: active ? 1 : 0, transition: "opacity 0.4s ease",
        padding: "2px", WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
        WebkitMaskComposite: "xor", maskComposite: "exclude",
      }} />
      {children}
    </div>
  );
}

// Overlay de "skeleton" com shimmer nas cores do IA-flare. Cobre um campo
// enquanto a IA gera o conteúdo (auto-preenchimento a partir das fotos),
// deixando a espera mais imersiva. O pai precisa ter position: relative.
function IaSkeleton({ active, radius = "10px" }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute", inset: 0, borderRadius: radius, zIndex: 4,
        pointerEvents: active ? "auto" : "none",
        // Fade-out mais longo e suave: ao terminar, o skeleton se dissolve e revela
        // gradualmente o texto por baixo (dissolve/crossfade), em vez de sumir seco.
        opacity: active ? 1 : 0, transition: "opacity 0.7s cubic-bezier(.4, 0, .2, 1)",
        /* As cores saem de variáveis para o tema claro poder trocá-las: o
           azul-noite cravado aqui era invisível sobre fundo claro — o campo
           ficava com um retângulo escuro no meio do formulário branco.
           Os valores abaixo são os do tema escuro, que continua sendo o
           padrão; quem redefine é o CSS, em `main[data-tema="claro"]`. */
        border: "1px solid var(--ia-esq-borda, rgba(255,255,255,0.05))",
        backgroundColor: "var(--ia-esq-base, #20293c)",
        backgroundImage:
          "linear-gradient(90deg, var(--ia-esq-base, #20293c) 25%, var(--ia-esq-brilho, #2c3851) 50%, var(--ia-esq-base, #20293c) 75%)",
        backgroundSize: "200% 100%",
        // Shimmer segue rodando mesmo durante o fade-out (invisível ao chegar em
        // opacity 0), para o dissolve não "congelar" no meio.
        animation: "ia-skeleton 1.5s linear infinite",
      }}
    />
  );
}

// Cobre o conteúdo com o skeleton enquanto `active` — usado nos campos que o
// CEP preenche sozinho. O IaSkeleton fica sempre montado para aproveitar o
// dissolve de saída, e bloqueia o clique só enquanto está visível.
function ComSkeleton({ active, radius = "10px", style, children }) {
  return (
    <div style={{ position: "relative", ...style }}>
      {children}
      <IaSkeleton active={active} radius={radius} />
    </div>
  );
}

export function PropertyForm({ onSubmit, disabled, initialData, onCancelEdit, logoUrl }) {
  /* O toast vem do AdminLayout, pelo contexto do <Outlet>. `?.` porque este
     componente também é montado em teste, fora de qualquer Outlet — e uma
     publicação não pode falhar por falta de um aviso na tela. */
  const showToast = useOutletContext()?.showToast;
  const { confirm, modal: confirmModal } = useConfirm();
  const [form, setForm] = useState(EMPTY);
  const [step, setStep] = useState(0);
  const [displayStep, setDisplayStep] = useState(0);   // passo realmente renderizado (defasa durante a saída animada)
  const [stepAnim, setStepAnim] = useState("fade");    // forward | back | fade — animação de entrada do conteúdo
  const [divulgarMorph, setDivulgarMorph] = useState(null); // { type: "split"|"merge", key } — anima os 3 cards do Divulgar
  const divulgarGridRef = useRef(null);
  const previewCardRef = useRef(null);  // card de pré-visualização (origem da animação)
  const seedRectRef = useRef(null);     // rect do preview capturado ao entrar no Divulgar
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [flashFields, setFlashFields] = useState({}); // campos obrigatórios piscando em vermelho ao tentar avançar
  const flashTimerRef = useRef(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [comodidadesLoading, setComodidadesLoading] = useState(false);
  const [comodidadesMsg, setComodidadesMsg] = useState("");
  const [images, setImages] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const dragDepth = useRef(0);
  const lastCepRef = useRef("");
  const autoIaLockRef = useRef(false);
  const auto360Ref = useRef(new Set()); // ids de fotos já avaliadas para auto-marcar 360°
  const descricaoRef = useRef(null); // textarea de descrição — auto-expande com o conteúdo
  const [tipos, setTipos] = useState([]);
  const isEditing = Boolean(initialData?.id);

  const [existingImages, setExistingImages] = useState([]);

  const [savedPropertyId, setSavedPropertyId] = useState(null);
  // Montar a arte do status carrega e compõe imagens; sem isto o botão fica
  // mudo por um segundo e a pessoa clica de novo.
  const [gerandoArte, setGerandoArte] = useState(false);
  /* Há ponte de WhatsApp conectada? É o que decide se o botão publica de
     verdade ou entrega a arte para a pessoa publicar. `null` = ainda não
     sabemos, e nesse caso o botão faz o caminho manual — que é o seguro. */
  const [pontePronta, setPontePronta] = useState(null);
  const [captions, setCaptions] = useState({ facebook: "", instagram: "", whatsapp: "" });
  const [descHover, setDescHover] = useState(null);
  const [redeIaLoading, setRedeIaLoading] = useState({});
  const [redeIaErro, setRedeIaErro] = useState({});
  const [coverUrls, setCoverUrls] = useState([]);
  const [socialStatus, setSocialStatus] = useState(null);
  const [publishLoading, setPublishLoading] = useState({ facebook: false, instagram: false });
  const [publishResults, setPublishResults] = useState({});
  const [publications, setPublications] = useState([]); // posts ativos por rede (0..N por canal)
  const [removingId, setRemovingId] = useState(null);   // id do post sendo removido
  const [republishAsk, setRepublishAsk] = useState(null); // "facebook" | "instagram" — modal manter/substituir
  const [expandedPostId, setExpandedPostId] = useState(null); // publicação expandida (dropdown)
  const [postInsights, setPostInsights] = useState({});       // { [pubId]: { loading, likes, comments, shares, available } }
  const [removeNote, setRemoveNote] = useState({});
  const [gerandoCampo, setGerandoCampo] = useState(null);
  const [campoIaErro, setCampoIaErro] = useState("");
  const [semIA, setSemIA] = useState(false); // usuário optou por seguir sem o preenchimento automático
  const [aviso360, setAviso360] = useState(""); // aviso quando uma foto marcada como 360° não é 2:1
  const [temPanoramica, setTemPanoramica] = useState(false); // há alguma foto ~2:1 (equiretangular)?
  const [focusedField, setFocusedField] = useState(null);
  const [aiFields, setAiFields] = useState({ title: false, description: false, tipoImovelId: false, atributos: false, finalidade: false, comodidades: false });

  const session = loadSession();
  const tenantSlug = session?.tenant?.slug;
  const cargo = session?.usuario?.cargo;
  const plano = session?.tenant?.plano;
  // Divulgar exige permissão do cargo E plano (Profissional+). IA exige plano Premium.
  const canPublish = Boolean(cargo?.publicarRedes) && planoLiberaRedes(plano);
  const canUseIA = planoLiberaIA(plano);
  const canUse360 = planoLiberaTour360(plano); // marcar fotos panorâmicas (Profissional+)
  const autoIA = canUseIA && (session?.tenant?.autoGerarIA ?? true); // auto-preencher ao lançar foto
  const visibleSteps = canPublish ? STEPS : STEPS.slice(0, 3);
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();

  // Auto-expande a textarea de descrição conforme o conteúdo cresce — ao colar
  // um texto grande ou quando a IA gera a descrição — sem barra de rolagem interna.
  useLayoutEffect(() => {
    const el = descricaoRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [form.description]);

  useEffect(() => {
    if (!tenantSlug) return;
    api.getTiposImovel(tenantSlug).then(setTipos).catch(() => {});
  }, [tenantSlug]);

  // Tipos de contrato liberados pela imobiliária. Vem do perfil do tenant (e
  // não da sessão) porque a parametrização pode mudar depois do login.
  const [tiposContratoTenant, setTiposContratoTenant] = useState(null);
  useEffect(() => {
    if (!tenantSlug) return;
    api.getTenantProfile(tenantSlug)
      .then((t) => setTiposContratoTenant(t?.tiposContrato ?? null))
      .catch(() => {});
  }, [tenantSlug]);

  const contratosDisponiveis = useMemo(
    () => tiposContratoAtivos({ tiposContrato: tiposContratoTenant }),
    [tiposContratoTenant],
  );

  useEffect(() => {
    return () => { images.forEach((img) => URL.revokeObjectURL(img.previewUrl)); };
  }, []);

  useEffect(() => {
    if (step !== 3 || !tenantSlug || !savedPropertyId) return;
    api.getSocialStatus(tenantSlug).then(setSocialStatus).catch(() => {});
    /* Falha silenciosa de propósito: a central de canais é Profissional+, e
       quem está no Básico não tem ponte nenhuma — o botão simplesmente segue
       manual, sem erro na tela. */
    api.listarCanais(tenantSlug)
      .then((r) => setPontePronta(Boolean(r.canais?.find((c) => c.id === "whatsapp-status")?.ponte)))
      .catch(() => setPontePronta(false));
    api.listPublications(tenantSlug, savedPropertyId)
      .then((list) => setPublications((Array.isArray(list) ? list : []).filter((p) => p.status === "PUBLISHED")))
      .catch(() => {});
    api.listPropertyImages(tenantSlug, savedPropertyId)
      .then((imgs) => setCoverUrls((imgs || []).map((i) => (i.is360 ? overlay360(i.url) : i.url)).filter(Boolean)))
      .catch(() => setCoverUrls([]));

    const price = parseCurrencyBRL(String(form.price));
    const priceStr = Number.isFinite(price) && price > 0
      ? `R$ ${price.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
      : "";
    const location = [form.neighborhood, form.city, form.state].filter(Boolean).join(", ");
    const areaLegenda = metragemExibicao(form);
    const isComercial = form.finalidade === "COMERCIAL";
    const stats = [
      isComercial
        ? (form.salas ? `${form.salas} sala${form.salas !== "1" ? "s" : ""}` : "")
        : (form.bedrooms ? `${form.bedrooms} quarto${form.bedrooms !== "1" ? "s" : ""}` : ""),
      isComercial && form.banheiros ? `${form.banheiros} banheiro${form.banheiros !== "1" ? "s" : ""}` : "",
      areaLegenda ? `${areaLegenda} m²` : "",
      form.parkingSpots ? `${form.parkingSpots} vaga${form.parkingSpots !== "1" ? "s" : ""}` : "",
    ].filter(Boolean).join(" · ");
    const tipoSel = tipos.find((t) => String(t.id) === String(form.tipoImovelId));
    const atribs = tipoSel?.atributos
      ?.filter((a) => form.atributosIds.includes(a.id))
      .map((a) => a.descricao) || [];
    const vitrineUrl = linkDoImovel(savedPropertyId);
    const whatsapp = session?.tenant?.whatsapp || "";

    const contratoLabel = tipoContratoInfo(form.tipoContrato)?.label || "";

    const lines = [
      `🏠 ${form.title}`,
      contratoLabel ? `📄 ${contratoLabel}` : "",
      location ? `📍 ${location}` : "",
      priceStr ? `💰 ${priceStr}` : "",
      stats ? `📐 ${stats}` : "",
      atribs.length > 0 ? `✅ ${atribs.join(" · ")}` : "",
      form.aceitaPermuta ? "🔄 Aceita permuta" : "",
      "",
      form.description || "",
      "",
      `🔗 Ver detalhes: ${vitrineUrl}`,
      whatsapp ? `📲 Contato: ${whatsapp}` : "",
    ].filter((l, i, arr) => !(l === "" && arr[i - 1] === ""));
    const base = lines.join("\n").trim();
    setCaptions({ facebook: base, instagram: base, whatsapp: base });
    setRedeIaErro({});
  }, [step, savedPropertyId]);

  // Orquestra a animação entre passos. `displayStep` é o passo de fato renderizado;
  // ao SAIR do Divulgar ele só troca depois do "merge" dos 3 cards.
  useEffect(() => {
    if (step === displayStep) return;
    const forward = step > displayStep;

    // Saindo do Divulgar (passo 3): os 3 cards se fundem no centro e deslizam para
    // fora antes de trocar de passo.
    if (displayStep === 3 && step !== 3) {
      setDivulgarMorph({ type: "merge", key: Date.now() });
      const t = setTimeout(() => {
        setStepAnim(forward ? "forward" : "back");
        setDisplayStep(step);
      }, 820);
      return () => clearTimeout(t);
    }

    // Entrando no Divulgar: captura o rect do card de preview AGORA (ainda montado)
    // para a animação partir do tamanho/posição dele.
    if (step === 3) {
      seedRectRef.current = previewCardRef.current
        ? previewCardRef.current.getBoundingClientRect()
        : null;
    }

    // Troca o conteúdo agora, com a animação de entrada adequada.
    setDisplayStep(step);
    if (step === 3) {
      // Sem fade no painel para o card-semente já aparecer 100% visível (a
      // animação fica por conta do FLIP dos cards).
      setStepAnim("none");
      setDivulgarMorph({ type: "split", key: Date.now() });
    } else {
      setStepAnim(forward ? "forward" : "back");
    }
  }, [step, displayStep]);

  // Anima os 3 cards do Divulgar via FLIP medido: eles partem empilhados (como um
  // card só), deslizam até o centro exato da grade e se abrem para as posições
  // reais (split); no merge, o caminho inverso. Os estilos inline são limpos ao
  // final para não travar o hover dos cards.
  useLayoutEffect(() => {
    if (!divulgarMorph || displayStep !== 3) return;
    const grid = divulgarGridRef.current;
    if (!grid) return;
    const cards = Array.from(grid.children).filter((el) => el.nodeType === 1);
    if (cards.length === 0) return;

    const gr = grid.getBoundingClientRect();
    const cx = gr.left + gr.width / 2;
    const cy = gr.top + gr.height / 2;
    const lead = Math.floor(cards.length / 2); // card que aparece na "pilha"

    // Estado inicial/final da "pilha": parte do tamanho e posição do card de preview
    // (a `<article>` de vidro). Sem o rect, cai num fallback à direita do centro.
    // Os deltas são medidos das posições NATURAIS (transform é relativo a elas).
    const seed = seedRectRef.current;
    const seedCX = seed ? seed.left + seed.width / 2 : cx + gr.width * 0.28;
    const seedCY = seed ? seed.top + seed.height / 2 : cy;

    const info = cards.map((card) => {
      const r = card.getBoundingClientRect();
      const ncx = r.left + r.width / 2;
      const ncy = r.top + r.height / 2;
      return { card, cw: r.width, nLeft: r.left, nTop: r.top, nW: r.width, nH: r.height, toCenterX: cx - ncx, toCenterY: cy - ncy, seedX: seedCX - ncx, seedY: seedCY - ncy };
    });

    const cardW = info[lead]?.cw || gr.width / Math.max(1, cards.length);
    const seedScale = seed ? Math.max(0.45, Math.min(1.5, seed.width / cardW)) : 0.55;

    let cleaned = false;
    const restore = () => {
      if (cleaned) return;
      cleaned = true;
      for (const { card } of info) {
        card.style.transition = "";
        card.style.transform = "";
        card.style.opacity = "";
        card.style.zIndex = "";
        card.style.willChange = "";
        card.style.filter = "";
      }
    };
    const timers = [];
    const shrink = 0.55; // encolhimento no centro

    if (divulgarMorph.type === "split") {
      // t0: cards no lugar/tamanho da semente (preview), borrados; só o lead visível.
      info.forEach((it, i) => {
        it.card.style.willChange = "transform, opacity, filter";
        it.card.style.transition = "none";
        it.card.style.transform = `translate(${it.seedX}px, ${it.seedY}px) scale(${seedScale})`;
        it.card.style.opacity = i === lead ? "1" : "0";
        it.card.style.filter = "blur(7px)";
        it.card.style.zIndex = i === lead ? "3" : "1";
      });
      void grid.offsetHeight; // reflow para fixar o t0
      // Fase A: desliza ao centro encolhendo, ainda borrado.
      requestAnimationFrame(() => {
        info.forEach(({ card, toCenterX, toCenterY }) => {
          card.style.transition = "transform 0.5s cubic-bezier(.4,0,.2,1)";
          card.style.transform = `translate(${toCenterX}px, ${toCenterY}px) scale(${seedScale * shrink})`;
        });
      });
      // Fase B: abre em três, desborrando ao chegar no lugar.
      timers.push(setTimeout(() => {
        info.forEach(({ card }, i) => {
          card.style.transition = `transform 0.6s cubic-bezier(.22,1,.36,1) ${i * 0.09}s, opacity 0.45s ease ${i * 0.09}s, filter 0.5s ease ${i * 0.09}s`;
          card.style.transform = "translate(0, 0) scale(1)";
          card.style.opacity = "1";
          card.style.filter = "blur(0px)";
        });
      }, 500));
      timers.push(setTimeout(restore, 500 + 820));
    } else {
      // MERGE — junta os três no centro e sai borrando de volta ao lugar do preview.
      info.forEach(({ card, toCenterX, toCenterY }, i) => {
        card.style.willChange = "transform, opacity, filter";
        card.style.transition = `transform 0.44s cubic-bezier(.4,0,.6,1), opacity 0.34s ease ${i === lead ? "0.14s" : "0s"}, filter 0.4s ease`;
        card.style.transform = `translate(${toCenterX}px, ${toCenterY}px) scale(${seedScale})`;
        card.style.opacity = i === lead ? "1" : "0";
        card.style.filter = "blur(3px)";
        card.style.zIndex = i === lead ? "3" : "1";
      });
      // Fase A invertida: a pilha volta borrando para o lugar do preview e some.
      timers.push(setTimeout(() => {
        info.forEach(({ card, seedX, seedY }) => {
          card.style.transition = "transform 0.42s cubic-bezier(.4,0,1,1), opacity 0.3s ease, filter 0.4s ease";
          card.style.transform = `translate(${seedX}px, ${seedY}px) scale(${seedScale})`;
          card.style.opacity = "0";
          card.style.filter = "blur(8px)";
        });
      }, 430));
    }

    return () => { timers.forEach(clearTimeout); restore(); };
  }, [divulgarMorph, displayStep]);

  useEffect(() => {
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setImages([]);

    setFieldErrors({});
    setSemIA(false);
    setAviso360("");

    if (!initialData) {
      setForm(EMPTY);
      setExistingImages([]);
      setSavedPropertyId(null);
      setPublishResults({});
      setPublications([]);
      setStep(0);
      return;
    }
    // Em edição o imóvel já existe: destrava a aba Divulgar de imediato
    // (savedPropertyId) e hidrata a lista de publicações a partir do que já veio
    // no imóvel, para os posts ativos aparecerem na aba Divulgar de cara.
    setSavedPropertyId(initialData.id);
    setPublishResults({});
    setPublications(
      (initialData.publications || []).filter((p) => p.status === "PUBLISHED")
    );
    setExistingImages(
      [...(initialData.images || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    );
    const atributosIds = initialData.atributos?.map((a) => a.atributoId ?? a.atributo?.id) ?? [];
    setForm({
      tipoImovelId: initialData.tipoImovelId ? String(initialData.tipoImovelId) : "",
      atributosIds,
      title: initialData.title || "",
      description: initialData.description || "",
      // initialData.price vem em REAIS; formatCurrencyBRL espera CENTAVOS (×100).
      price: initialData.price != null ? formatCurrencyBRL(String(Math.round(Number(initialData.price) * 100))) : "",
      cep: formatCep(initialData.cep || ""),
      address: initialData.address || "",
      neighborhood: initialData.neighborhood || "",
      city: initialData.city || "",
      state: initialData.state || "",
      bedrooms: initialData.bedrooms != null ? String(initialData.bedrooms) : "",
      parkingSpots: initialData.parkingSpots != null ? String(initialData.parkingSpots) : "",
      suites: initialData.suites != null ? String(initialData.suites) : "",
      salas: initialData.salas != null ? String(initialData.salas) : "",
      banheiros: initialData.banheiros != null ? String(initialData.banheiros) : "",
      squareFootage: initialData.squareFootage != null ? String(initialData.squareFootage) : "",
      finalidade: initialData.finalidade || "",
      areaTerreno: initialData.areaTerreno != null ? String(initialData.areaTerreno) : "",
      areaConstruida: initialData.areaConstruida != null ? String(initialData.areaConstruida) : "",
      areaPrivativa: initialData.areaPrivativa != null ? String(initialData.areaPrivativa) : "",
      areaTotal: initialData.areaTotal != null ? String(initialData.areaTotal) : "",
      andamento: initialData.andamento || "",
      tipoContrato: initialData.tipoContrato || "",
      aceitaPermuta: Boolean(initialData.aceitaPermuta),
      // Ausente nos imóveis anteriores ao campo: o padrão é publicar.
      publicarPortais: initialData.publicarPortais !== false,
      // `=== true` e não `!== false`: o padrão aqui é NÃO exibir, então a
      // ausência do campo (imóvel salvo antes desta opção existir) conta como
      // desmarcado, e não como marcado.
      exibirEnderecoCompleto: initialData.exibirEnderecoCompleto === true,
      status: initialData.status || "DRAFT",
      comodidades: { ...EMPTY_COMODIDADES, ...(initialData.comodidades || {}) },
    });
    setComodidadesMsg("");
    setStep(0);
  }, [initialData]);

  const tipoSelecionado = tipos.find((t) => String(t.id) === String(form.tipoImovelId));
  // A IA gera a partir das fotos, então os botões só aparecem com ao menos uma foto.
  const temFotos = images.length > 0 || existingImages.length > 0;
  const areaFields = (() => {
    const fromDB = tipoSelecionado?.areaFields;
    if (Array.isArray(fromDB) && fromDB.length > 0) return fromDB;
    return areasParaTipo(tipoSelecionado?.descricao);
  })();

  // No CADASTRO (não-edição) o avanço entre passos é travado: só se pode ir para
  // frente com os campos obrigatórios do passo atual preenchidos. Em edição a
  // navegação segue livre (pode pular entre os passos).
  const validationErrors = getValidationErrors(form, areaFields);
  const stepComplete = (stepIndex) =>
    !Object.keys(validationErrors).some((f) => FIELD_STEP[f] === stepIndex);

  // Passos travados no mapa de etapas: Divulgar (3) até salvar; e, no cadastro,
  // qualquer passo à frente de um passo ainda incompleto.
  const lockedSteps = (() => {
    const locked = savedPropertyId ? [] : [3];
    if (!isEditing) {
      for (let i = 0; i < visibleSteps.length; i++) {
        const bloqueado = Array.from({ length: i }).some((_, s) => !stepComplete(s));
        if (bloqueado && !locked.includes(i)) locked.push(i);
      }
    }
    return locked;
  })();

  // Com a auto-IA ligada, o passo Identificação exige a foto primeiro: os campos
  // de texto/seleção ficam travados até haver ao menos uma foto, para a IA
  // preencher tudo a partir dela sem conflitar com o que o usuário digitou.
  // "Continuar sem IA" (semIA) desliga esse gate e o auto-preenchimento.
  const bloquearSemFoto = !isEditing && autoIA && !semIA && !temFotos;

  // Um campo é reescrito pela auto-IA (e portanto mostra o skeleton) só se ainda for
  // da IA (intacto) ou estiver vazio — espelha o `podeEscrever` de handleGerarCampoIA.
  const regeraCampo = (field, vazio) => aiFields[field] || vazio;

  const existingUrls = existingImages.map((img) => img.url);
  const previewUrls = images.length > 0 ? images.map((img) => img.previewUrl) : existingUrls;
  // Itens do preview com o flag 360 (novas fotos ou salvas) para o viewer panorâmico.
  const previewItems = images.length > 0
    ? images.map((img) => ({ url: img.previewUrl, is360: Boolean(img.is360) }))
    : existingImages.map((img) => ({ url: img.url, is360: Boolean(img.is360) }));

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    clearFieldError(field);
  }

  function clearFieldError(field) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function addImages(files) {
    setImages((prev) => {
      const jaUsadas = existingImages.length + prev.length;
      const espaco = Math.max(0, MAX_FOTOS - jaUsadas);
      if (espaco <= 0) return prev;
      const newItems = files.slice(0, espaco).map((file) => ({
        id: `${Date.now()}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      return [...prev, ...newItems];
    });
  }

  // ── Arrastar fotos para dentro da página ───────────────────────────────────
  // Aceita arquivos soltos em qualquer lugar do formulário; ignora no passo
  // Divulgar (imóvel já salvo) e as reordenações internas de foto (que não
  // carregam arquivos, e sim "text/plain").
  const dropDisabled = disabled || step === 3;

  function dragHasFiles(e) {
    const types = e.dataTransfer?.types;
    return Boolean(types) && Array.from(types).includes("Files");
  }

  function handleFormDragEnter(e) {
    if (dropDisabled || !dragHasFiles(e)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragActive(true);
  }
  function handleFormDragOver(e) {
    if (dropDisabled || !dragHasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }
  function handleFormDragLeave(e) {
    if (dropDisabled || !dragHasFiles(e)) return;
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragActive(false);
    }
  }
  function handleFormDrop(e) {
    if (dropDisabled || !dragHasFiles(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    addImages(files);
    if (step !== 0) setStep(0); // fotos ficam no passo Identificação
  }

  // Enquanto o formulário está montado, impede o navegador de "abrir" a imagem
  // caso ela seja solta fora da zona de drop (isso destruiria o formulário).
  useEffect(() => {
    const prevent = (e) => {
      const types = e.dataTransfer?.types;
      if (types && Array.from(types).includes("Files")) e.preventDefault();
    };
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  function dadosImovelParaIA() {
    const tipoSel = tipos.find((t) => String(t.id) === String(form.tipoImovelId));
    const atributos = (tipoSel?.atributos || [])
      .filter((a) => form.atributosIds.includes(a.id))
      .map((a) => a.descricao);
    return {
      propertyType: tipoSel?.descricao || "",
      finalidade: form.finalidade || "",
      title: form.title,
      description: form.description,
      price: parseCurrencyBRL(String(form.price)) || undefined,
      city: form.city,
      neighborhood: form.neighborhood,
      state: form.state,
      address: form.address,
      bedrooms: form.bedrooms,
      suites: form.suites,
      salas: form.salas,
      banheiros: form.banheiros,
      parkingSpots: form.parkingSpots,
      areaPrivativa: form.areaPrivativa,
      areaConstruida: form.areaConstruida,
      areaTerreno: form.areaTerreno,
      squareFootage: form.squareFootage,
      andamento: form.andamento,
      tipoContrato: form.tipoContrato,
      aceitaPermuta: form.aceitaPermuta,
      publicarPortais: form.publicarPortais,
      exibirEnderecoCompleto: form.exibirEnderecoCompleto,
      atributos,
    };
  }

  async function handleGerarRedeIA(rede) {
    const propId = savedPropertyId || initialData?.id;
    if (!propId) return;
    setRedeIaErro((prev) => ({ ...prev, [rede]: "" }));
    setRedeIaLoading((prev) => ({ ...prev, [rede]: true }));
    try {
      const { resultados, erros } = await api.gerarConteudoPropertyIA(tenantSlug, propId, [rede]);
      if (resultados?.[rede]) {
        setCaptions((prev) => ({ ...prev, [rede]: resultados[rede] }));
      } else {
        setRedeIaErro((prev) => ({ ...prev, [rede]: erros?.[rede] || "A IA não retornou um texto." }));
      }
    } catch (err) {
      setRedeIaErro((prev) => ({ ...prev, [rede]: err.message || "Não foi possível gerar o texto." }));
    } finally {
      setRedeIaLoading((prev) => ({ ...prev, [rede]: false }));
    }
  }

  function removeImage(i) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[i].previewUrl);
      return prev.filter((_, idx) => idx !== i);
    });
  }

  function handleChangeField(field, value) {
    set(field, value);
    if (aiFields[field]) {
      setAiFields((prev) => ({ ...prev, [field]: false }));
    }
  }

  async function handleGerarCampoIA(campo) {
    setCampoIaErro("");
    setGerandoCampo(campo);
    try {
      const imovel = dadosImovelParaIA();
      let imagens = [];
      if (images.length > 0) {
        imagens = await Promise.all(images.slice(0, 4).map((im) => fileParaBase64Reduzido(im.file)));
      } else if (existingImages.length > 0) {
        imagens = existingImages.slice(0, 4).map((im) => ({ url: im.url }));
      }
      const tiposDisponiveis = tipos.map((t) => ({ tipo: t.descricao, atributos: (t.atributos || []).map((a) => a.descricao) }));

      const sugestao = await api.sugerirImovelIA(tenantSlug, { imovel, imagens, tiposDisponiveis });

      // No modo "auto" (lançar fotos), só sobrescreve o que AINDA é da IA (ou está
      // vazio) — o que o usuário editou à mão é preservado. Clique manual na varinha
      // (campo específico) sempre escreve.
      const auto = campo === "auto";
      const podeEscrever = (field, vazio) => !auto || aiFields[field] || vazio;

      if ((campo === "title" || campo === "auto") && sugestao.titulo && podeEscrever("title", !form.title.trim())) {
        set("title", sugestao.titulo);
        setAiFields((prev) => ({ ...prev, title: true }));
      }
      if ((campo === "description" || campo === "auto") && sugestao.descricao && podeEscrever("description", !form.description.trim())) {
        set("description", sugestao.descricao);
        setAiFields((prev) => ({ ...prev, description: true }));
      }

      if (sugestao.finalidade && podeEscrever("finalidade", !form.finalidade)) {
        const fin = sugestao.finalidade.toUpperCase();
        if (fin === "RESIDENCIAL" || fin === "COMERCIAL") {
          set("finalidade", fin);
          setAiFields((prev) => ({ ...prev, finalidade: true }));
        }
      }

      // Tipo/atributos só são reescritos quando o tipo ainda é da IA (ou vazio),
      // para não bagunçar uma seleção manual do usuário.
      if (sugestao.tipoImovel && podeEscrever("tipoImovelId", !form.tipoImovelId)) {
        const tipoInferido = normalizarTipo(sugestao.tipoImovel);
        const tipoEncontrado = tipos.find((t) => normalizarTipo(t.descricao) === tipoInferido);
        if (tipoEncontrado) {
          set("tipoImovelId", String(tipoEncontrado.id));
          setAiFields((prev) => ({ ...prev, tipoImovelId: true }));

          if (sugestao.atributos && Array.isArray(sugestao.atributos) && podeEscrever("atributos", form.atributosIds.length === 0)) {
            const atributosDoTipo = tipoEncontrado.atributos || [];
            const attrsInferidos = sugestao.atributos.map(normalizarTipo);
            const idsMarcados = atributosDoTipo
              .filter((a) => attrsInferidos.includes(normalizarTipo(a.descricao)))
              .map((a) => a.id);

            if (idsMarcados.length > 0) {
              setForm((prev) => {
                const novosIds = new Set([...prev.atributosIds, ...idsMarcados]);
                return { ...prev, atributosIds: Array.from(novosIds) };
              });
              setAiFields((prev) => ({ ...prev, atributos: true }));
            }
          }
        }
      }
    } catch (err) {
      setCampoIaErro(err.message || "Não foi possível gerar com IA.");
    } finally {
      setGerandoCampo(null);
    }
  }

  // Ao lançar fotos (arrastar ou selecionar), preenche tudo com IA automaticamente.
  // Roda na 1ª geração (form vazio) e TAMBÉM ao adicionar mais fotos — desde que o
  // conteúdo ainda seja da IA (usuário não mexeu); nesse caso reescreve usando as
  // novas fotos como contexto. Se o usuário editou, aqueles campos são preservados
  // (a preservação por campo é feita dentro de handleGerarCampoIA).
  // Depende de images.length para não disparar quando só o flag 360° de uma foto muda.
  useEffect(() => {
    if (!autoIA || semIA) return; // toggle/plano sem IA, ou usuário optou por seguir sem IA
    if (images.length === 0 || autoIaLockRef.current || gerandoCampo) return;
    const vazio = !form.title.trim() && !form.description.trim();
    const conteudoDaIA = aiFields.title || aiFields.description || aiFields.tipoImovelId || aiFields.finalidade || aiFields.atributos;
    if (!vazio && !conteudoDaIA) return; // usuário editou tudo → não reescreve
    autoIaLockRef.current = true;
    handleGerarCampoIA("auto").finally(() => { autoIaLockRef.current = false; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length]);

  // Detecta se alguma foto atual é panorâmica (~2:1). Roda independente do plano:
  // no Profissional+ vira o hint "já marcamos como 360°"; no Básico vira o convite
  // para fazer upgrade e liberar o tour virtual.
  useEffect(() => {
    const srcs = [...images.map((im) => im.previewUrl), ...existingImages.map((im) => im.url)];
    if (srcs.length === 0) { setTemPanoramica(false); return; }
    let cancelled = false;
    let pending = srcs.length;
    let achou = false;
    srcs.forEach((src) => {
      const el = new Image();
      el.onload = el.onerror = () => {
        if (cancelled) return;
        if (el.naturalHeight && ehEquirect(el.naturalWidth / el.naturalHeight)) achou = true;
        if (--pending === 0) setTemPanoramica(achou);
      };
      el.src = src;
    });
    return () => { cancelled = true; };
  }, [images, existingImages]);

  // Auto-marca como 360° toda foto NOVA reconhecida como equiretangular (~2:1): quem
  // sobe uma panorâmica quase sempre quer exibi-la em 360°. Avalia cada foto só uma
  // vez — se o usuário desmarcar depois, não volta a marcar.
  useEffect(() => {
    if (!canUse360) return;
    images.forEach((img) => {
      if (auto360Ref.current.has(img.id)) return;
      auto360Ref.current.add(img.id);
      const el = new Image();
      el.onload = () => {
        if (el.naturalHeight && ehEquirect(el.naturalWidth / el.naturalHeight)) {
          setImages((prev) => prev.map((x) => (x.id === img.id && !x.is360 ? { ...x, is360: true } : x)));
        }
      };
      el.src = img.previewUrl;
    });
  }, [images, canUse360]);

  // Panorâmicas equiretangulares são 2:1. Se a foto marcada como 360° fugir muito
  // disso, avisa (não bloqueia — o usuário pode ter uma pano levemente fora).
  function checarProporcao360(src) {
    const el = new Image();
    el.onload = () => {
      const r = el.naturalHeight ? el.naturalWidth / el.naturalHeight : 0;
      setAviso360(
        r < 1.9 || r > 2.1
          ? `A foto marcada como 360° tem proporção ${r.toFixed(2)}:1. Panorâmicas equiretangulares precisam ser 2:1 — fora disso o tour aparece esticado/distorcido.`
          : ""
      );
    };
    el.onerror = () => setAviso360("");
    el.src = src;
  }

  function toggleImage360(i) {
    const virando360 = !images[i]?.is360;
    setImages((prev) => prev.map((img, idx) => (idx === i ? { ...img, is360: !img.is360 } : img)));
    if (virando360) checarProporcao360(images[i].previewUrl);
    else setAviso360("");
  }

  async function toggleExisting360(i) {
    const img = existingImages[i];
    if (!img) return;
    const novo = !img.is360;
    setExistingImages((prev) => prev.map((x, idx) => (idx === i ? { ...x, is360: novo } : x)));
    if (novo) checarProporcao360(img.url);
    else setAviso360("");
    try {
      await api.setPropertyImage360(tenantSlug, initialData.id, img.id, novo);
    } catch {
      setExistingImages((prev) => prev.map((x, idx) => (idx === i ? { ...x, is360: !novo } : x)));
    }
  }

  function reorderImages(from, to) {
    setImages((prev) => {
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
  }

  function handleReorderExisting(from, to) {
    setExistingImages((prev) => {
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      const order = arr.map((img) => img.id);
      api.reorderPropertyImages(tenantSlug, initialData.id, order).catch(() => {});
      return arr;
    });
  }

  async function handleRemoveExisting(i) {
    const img = existingImages[i];
    if (!img) return;
    setExistingImages((prev) => prev.filter((_, idx) => idx !== i));
    try {
      await api.deletePropertyImage(tenantSlug, initialData.id, img.id);
    } catch {
      setExistingImages((prev) => { const arr = [...prev]; arr.splice(i, 0, img); return arr; });
    }
  }

  function handleStepClick(target) {
    if (target === step) return;
    if (target === 3 && (!savedPropertyId || !canPublish)) return;
    // Cadastro: não deixa pular para frente sem completar os passos anteriores.
    if (!isEditing && target > step) {
      for (let s = 0; s < target; s++) if (!stepComplete(s)) return;
    }
    setError("");
    setStep(target);
  }

  // Faz os campos obrigatórios faltantes piscarem em vermelho por ~2s (sem avançar).
  function flashMissing(fields) {
    if (!fields.length) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlashFields({}); // zera antes para reiniciar a animação mesmo em cliques repetidos
    requestAnimationFrame(() => {
      setFlashFields(Object.fromEntries(fields.map((f) => [f, true])));
    });
    flashTimerRef.current = setTimeout(() => setFlashFields({}), 2000);
  }

  function handleNext() {
    // Cadastro: se faltam obrigatórios, não avança — pisca os campos faltantes.
    if (!isEditing && !stepComplete(step)) {
      const missing = Object.keys(validationErrors).filter((f) => FIELD_STEP[f] === step);
      setFieldErrors((prev) => ({ ...prev, ...Object.fromEntries(missing.map((f) => [f, validationErrors[f]])) }));
      flashMissing(missing);
      return;
    }
    setError("");
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleBack() {
    setError("");
    setStep((s) => s - 1);
  }

  async function handleSubmit() {
    const fe = getValidationErrors(form, areaFields);
    const fields = Object.keys(fe);
    if (fields.length > 0) {
      setFieldErrors(fe);

      const byStep = {};
      for (const f of fields) {
        const st = FIELD_STEP[f];
        (byStep[st] ||= []).push(FIELD_LABELS[f]);
      }
      const orderedSteps = Object.keys(byStep).map(Number).sort((a, b) => a - b);
      const parts = orderedSteps.map((st) => `${STEPS[st].label} (${byStep[st].join(", ")})`);
      setError(`Faltam campos obrigatórios para publicar: ${parts.join(" · ")}. Revise as etapas destacadas.`);

      setStep(orderedSteps[0]);
      flashMissing(fields.filter((f) => FIELD_STEP[f] === orderedSteps[0]));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (images.length === 0 && existingImages.length === 0) {
      setError("Adicione ao menos uma foto do imóvel para publicar.");
      setStep(0);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setFieldErrors({});
    setError("");
    const normalizedPrice = parseCurrencyBRL(String(form.price));
    const areaPrincipal = areaFields
      .map((f) => parseFloat(form[f]))
      .find((v) => Number.isFinite(v) && v > 0);
    const squareFootage = areaPrincipal ?? (parseFloat(form.squareFootage) || 0);
    const areaPayload = Object.fromEntries(
      TODAS_AREAS.map((f) => [f, areaFields.includes(f) && form[f] !== "" ? parseFloat(form[f]) : null])
    );
    const saved = await onSubmit({
      tipoImovelId: form.tipoImovelId ? Number(form.tipoImovelId) : undefined,
      atributosIds: form.atributosIds,
      title: form.title,
      description: form.description,
      price: normalizedPrice,
      cep: form.cep.replace(/\D/g, ""),
      address: form.address,
      neighborhood: form.neighborhood,
      city: form.city,
      state: form.state,
      bedrooms: form.finalidade === "COMERCIAL" ? 0 : Number(form.bedrooms),
      suites: form.finalidade === "COMERCIAL" ? 0 : Number(form.suites),
      salas: form.finalidade === "COMERCIAL" ? Number(form.salas) : 0,
      banheiros: form.finalidade === "COMERCIAL" ? Number(form.banheiros) : 0,
      parkingSpots: Number(form.parkingSpots),
      squareFootage,
      finalidade: form.finalidade || null,
      ...areaPayload,
      andamento: form.andamento || null,
      tipoContrato: form.tipoContrato || null,
      aceitaPermuta: Boolean(form.aceitaPermuta),
      publicarPortais: Boolean(form.publicarPortais),
      exibirEnderecoCompleto: Boolean(form.exibirEnderecoCompleto),
      status: form.status,
      comodidades: form.comodidades,
      imageFiles: images.map((img) => img.file),
      imageIs360: images.map((img) => Boolean(img.is360)),
    });

    if (!isEditing && saved?.id) {
      images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      setImages([]);
      if (canPublish) {
        // Segue para a etapa Divulgar.
        setSavedPropertyId(saved.id);
        setPublishResults({});
        setStep(3);
      } else {
        // Sem permissão de publicar: cadastro finaliza aqui, volta ao portfólio.
        navigate("/imoveis/portfolio");
      }
    }
  }

  async function handleCepBlur() {
    const cleanCep = String(form.cep || "").replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    if (cleanCep === lastCepRef.current) return; // mesmo CEP já analisado — evita reprocessar
    setCepLoading(true);
    setError("");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      if (!response.ok) throw new Error("Falha ao consultar CEP.");
      const data = await response.json();
      if (data.erro) throw new Error("CEP não encontrado.");
      lastCepRef.current = cleanCep;
      const street = [data.logradouro, data.complemento].filter(Boolean).join(" - ");
      setForm((prev) => ({
        ...prev,
        cep: formatCep(cleanCep),
        address: street || prev.address,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
      }));
      enriquecerComodidades({
        cep: formatCep(cleanCep),
        logradouro: data.logradouro,
        bairro: data.bairro,
        cidade: data.localidade,
        uf: data.uf,
      });
    } catch (err) {
      setError(err.message || "Não foi possível buscar o CEP.");
    } finally {
      setCepLoading(false);
    }
  }

  // Usa a IA (Gemini) para inferir, a partir do CEP/endereço, quais comodidades
  // provavelmente existem na região — preenchendo as checkboxes automaticamente.
  async function enriquecerComodidades({ cep, logradouro, bairro, cidade, uf }) {
    if (!canUseIA) return; // recurso de IA (Premium)
    if (!cidade || !uf || !tenantSlug) return;
    setComodidadesLoading(true);
    setComodidadesMsg("");
    setAiFields((prev) => ({ ...prev, comodidades: false }));
    try {
      const { presentes } = await api.inferirComodidadesIA(tenantSlug, {
        endereco: { cep, logradouro, bairro, cidade, uf },
        comodidades: COMODIDADES.map((c) => ({ key: c.key, label: c.label })),
      });
      const marcadas = Array.isArray(presentes) ? presentes : [];
      const detectadas = marcadas.reduce((acc, key) => ({ ...acc, [key]: true }), {});
      setForm((prev) => ({
        ...prev,
        comodidades: { ...EMPTY_COMODIDADES, ...detectadas },
      }));
      const qtd = marcadas.length;
      if (qtd > 0) setAiFields((prev) => ({ ...prev, comodidades: true }));
      setComodidadesMsg(
        qtd > 0
          ? `${qtd} comodidade(s) sugerida(s) pela IA para esta região.`
          : "A IA não identificou comodidades típicas nesta região."
      );
    } catch {
      setComodidadesMsg("Não foi possível analisar as comodidades da região.");
    } finally {
      setComodidadesLoading(false);
    }
  }

  function toggleComodidade(key) {
    setForm((prev) => ({
      ...prev,
      comodidades: { ...prev.comodidades, [key]: !prev.comodidades?.[key] },
    }));
    setAiFields((prev) => ({ ...prev, comodidades: false })); // ajuste manual desliga o flare
  }

  async function refreshPublications() {
    if (!tenantSlug || !savedPropertyId) return;
    try {
      const list = await api.listPublications(tenantSlug, savedPropertyId);
      setPublications((Array.isArray(list) ? list : []).filter((p) => p.status === "PUBLISHED"));
    } catch { /* mantém o estado atual em caso de falha de rede */ }
  }

  // Publica no canal. `replace` = apaga os posts anteriores desta rede depois de
  // publicar o novo (escolha "substituir"); sem ele, o post novo soma aos que já existem.
  async function handlePublish(platform, replace = false) {
    if (!tenantSlug || !savedPropertyId) return;
    setRepublishAsk(null);
    setPublishLoading((prev) => ({ ...prev, [platform]: true }));
    setPublishResults((prev) => { const next = { ...prev }; delete next[platform]; return next; });
    setRemoveNote((prev) => ({ ...prev, [platform]: "" }));
    try {
      const result = await api.publishProperty(tenantSlug, savedPropertyId, {
        platforms: [platform],
        caption: captions[platform] ?? "",
        replace,
      });
      const r = result?.[platform];
      if (r) setPublishResults((prev) => ({ ...prev, [platform]: r }));
      if (r?.note) setRemoveNote((prev) => ({ ...prev, [platform]: r.note }));
      await refreshPublications();
    } catch (err) {
      setPublishResults((prev) => ({ ...prev, [platform]: { success: false, error: err.message } }));
    } finally {
      setPublishLoading((prev) => ({ ...prev, [platform]: false }));
    }
  }

  // Clique no botão "Publicar/Publicar novamente": se já existe post nesta rede,
  // pergunta manter+novo ou substituir; senão publica direto.
  function onPublishClick(platform) {
    const channel = platform === "facebook" ? "FACEBOOK" : "INSTAGRAM";
    const jaTem = publications.some((p) => p.channel === channel);
    if (jaTem) setRepublishAsk(platform);
    else handlePublish(platform, false);
  }

  // Abre/fecha o dropdown de um post e busca as métricas reais (uma vez).
  function togglePost(pub) {
    const willOpen = expandedPostId !== pub.id;
    setExpandedPostId(willOpen ? pub.id : null);
    if (willOpen && !postInsights[pub.id]) {
      setPostInsights((prev) => ({ ...prev, [pub.id]: { loading: true } }));
      api.getPublicationInsights(tenantSlug, pub.id)
        .then((data) => setPostInsights((prev) => ({ ...prev, [pub.id]: { loading: false, ...data } })))
        .catch(() => setPostInsights((prev) => ({ ...prev, [pub.id]: { loading: false, likes: 0, comments: 0, shares: null, available: false } })));
    }
  }

  // Remove UM post específico (por id).
  async function handleRemovePost(pub) {
    if (!tenantSlug) return;
    const nome = pub.channel === "FACEBOOK" ? "Facebook" : pub.channel === "INSTAGRAM" ? "Instagram" : "WhatsApp";
    if (!await confirm(`Remover este post do ${nome}?`, "Remover")) return;
    const platformKey = pub.channel.toLowerCase();
    setRemovingId(pub.id);
    setRemoveNote((prev) => ({ ...prev, [platformKey]: "" }));
    try {
      // Deixa a animação de saída (0.4s) concluir antes do refresh desmontar a linha.
      const [result] = await Promise.all([
        api.removePublicationById(tenantSlug, pub.id),
        new Promise((r) => setTimeout(r, 400)),
      ]);
      if (result?.note) setRemoveNote((prev) => ({ ...prev, [platformKey]: result.note }));
      await refreshPublications();
    } catch (err) {
      setRemoveNote((prev) => ({ ...prev, [platformKey]: err.message }));
    } finally {
      setRemovingId(null);
    }
  }

  /* ── Publicar no status ────────────────────────────────────────────────────
     NÃO existe API oficial para status do WhatsApp: o Cloud API entrega
     MENSAGENS, e status é recurso de consumidor que a Meta nunca expôs. As
     pontes que existem dirigem uma sessão do WhatsApp Web por fora, violam os
     termos e arriscam banir o número — que costuma ser o principal canal de
     vendas da imobiliária.

     Então o caminho é este: montamos a peça vertical pronta e entregamos ao
     compartilhamento do celular, onde a pessoa escolhe WhatsApp › Status. Um
     toque humano por post, e nenhum risco.

     A arte é gerada no NAVEGADOR (canvas), como a marca d'água das fotos. */
  async function handleStatus() {
    setGerandoArte(true);
    try {
      const vitrineUrl = linkDoImovel(savedPropertyId);
      const arte = await gerarArteDeStatus(form, {
        fotoUrl: coverUrls[0] || "",
        logoUrl: session?.tenant?.logoUrl || "",
        corPrimaria: session?.tenant?.primaryColor || "#6366f1",
        nomeDaImobiliaria: session?.tenant?.name || "",
        enderecoDaVitrine: String(vitrineUrl || "").replace(/^https?:\/\//, ""),
      });

      const texto = captions.whatsapp || `${form.title} — ${vitrineUrl}`;

      /* ── Com ponte conectada, publica de verdade ─────────────────────────
         Este ramo faltava, e era o defeito: o backend da ponte existia, a
         rota existia, e o botão nunca a chamava — sempre caía no caminho
         manual, mesmo com a ponte ligada.

         O passo do meio é o que torna isto não-óbvio: a arte nasce como
         arquivo NO NAVEGADOR, e a ponte roda no servidor, que precisa de uma
         URL pública. Então ela sobe para o Cloudinary primeiro, pelo mesmo
         caminho das fotos do imóvel. */
      if (pontePronta) {
        try {
          const { url } = await uploadToCloudinary(arte);
          /* ── UM STATUS POR FOTO ────────────────────────────────────────────
             Status do WhatsApp não tem carrossel: cada imagem é uma publicação.
             Mandar só a arte deixaria de fora as fotos do imóvel, que são o que
             faz alguém parar de rolar — quem vende imóvel vende ambiente, e um
             cartão com preço não mostra a sala.

             A arte vai primeiro, com a ficha e o endereço da vitrine; as demais
             vão CRUAS, já com a marca d'água que o cadastro aplicou no envio.
             Repetir a faixa de preço em cinco fotos transformaria o anúncio em
             panfleto. Quem publica em sequência é o servidor, que respeita um
             intervalo entre elas. */
          const r = await api.publicarStatusPelaPonte(tenantSlug, savedPropertyId, {
            imagemUrl: url,
            imagensExtras: coverUrls.slice(1),
            legenda: texto,
          });
          const quantos = r?.publicados ?? 1;
          showToast?.(
            quantos === 1
              ? "Publicado no seu status do WhatsApp."
              : `${quantos} status publicados no seu WhatsApp.` +
                (r?.falhas?.length ? ` ${r.falhas.length} foto(s) não foram aceitas.` : ""),
          );
        } catch (falha) {
          /* A mensagem traz a resposta CRUA da ponte (ver `pontewhatsapp.js`).
             É feia e é útil: cada serviço tem o próprio contrato, e ler o que
             ele reclamou transforma um ajuste de campo em trinta segundos. */
          showToast?.(falha.message || "A ponte recusou a publicação.", "error");
        }
        return;
      }

      /* `navigator.share` com arquivo é o único caminho manual que chega ao
         status. O `wa.me` abre a CONVERSA, não o status — mandar para lá seria
         oferecer um botão que não faz o que promete. */
      if (navigator.canShare?.({ files: [arte] })) {
        await navigator.share({ title: form.title, text: texto, files: [arte] });
        return;
      }

      /* Sem compartilhamento de arquivo (quase todo desktop), baixamos a arte.
         A pessoa manda para o próprio celular e publica de lá — que é o que ela
         faria de qualquer jeito, já que status se posta do telefone. */
      const url = URL.createObjectURL(arte);
      const a = document.createElement("a");
      a.href = url;
      a.download = arte.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (erro) {
      if (erro?.name !== "AbortError") console.warn("[status] não consegui montar a arte:", erro);
    } finally {
      setGerandoArte(false);
    }
  }

  function handleWhatsApp() {
    const vitrineUrl = linkDoImovel(savedPropertyId);
    const text = captions.whatsapp || `🏠 ${form.title}\n🔗 ${vitrineUrl}`;
    shareWhatsapp({ text, imageUrls: coverUrls, title: form.title });
  }

  /* Campos de texto e listas de seleção do formulário.

     O fundo e a borda saem de variáveis porque este objeto vira estilo INLINE,
     e inline vence qualquer regra de folha: com os valores cravados aqui, o
     tema claro do painel não tinha como alcançá-los — a lista e as entradas
     continuavam quase pretas no meio de uma tela branca. O valor de reserva é o
     do tema escuro, então quem lê `inputStyle` sem tema definido vê o de antes. */
  const inputStyle = {
    width: "100%", boxSizing: "border-box",
    background: "var(--campo-fundo, rgba(255,255,255,0.04))",
    border: "1px solid var(--campo-borda, rgba(255,255,255,0.1))",
    borderRadius: "10px", color: "inherit", padding: "12px 14px", fontSize: "14px",
    outline: "none", transition: "border-color 0.2s",
  };
  const selectStyle = { ...inputStyle, cursor: "pointer" };
  const pubBtnBase = { padding: "11px 16px", borderRadius: "9px", fontSize: "13px", fontWeight: 600, color: "#fff", border: "none", width: "100%", textAlign: "center", cursor: "pointer" };
  const removeBtnStyle = { padding: "7px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)", cursor: "pointer", flexShrink: 0, width: "auto" };
  const withError = (field, base = inputStyle) => {
    let s = fieldErrors[field] ? { ...base, border: "1px solid rgba(239,68,68,0.6)" } : base;
    if (flashFields[field]) s = { ...s, animation: "field-flash-red 0.5s ease-in-out 0s 4" };
    return s;
  };

  // Posts ativos por rede (podem ser vários).
  const fbPosts = publications.filter((p) => p.channel === "FACEBOOK");
  const igPosts = publications.filter((p) => p.channel === "INSTAGRAM");

  return (
    <section
      className="glass-panel"
      style={{ animation: "fadeIn 0.3s ease-in-out", position: "relative" }}
      onDragEnter={handleFormDragEnter}
      onDragOver={handleFormDragOver}
      onDragLeave={handleFormDragLeave}
      onDrop={handleFormDrop}
    >
      {confirmModal}

      <RepublishModal
        platform={republishAsk}
        onKeep={() => handlePublish(republishAsk, false)}
        onReplace={() => handlePublish(republishAsk, true)}
        onCancel={() => setRepublishAsk(null)}
      />

      {dragActive && (
        <div
          style={{
            position: "absolute", inset: 0, zIndex: 60, pointerEvents: "none",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: "18px", borderRadius: "inherit", textAlign: "center",
            background: "rgba(10,12,24,0.84)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
            border: "2px dashed rgba(99,102,241,0.75)",
            animation: "fadeIn 0.15s ease",
          }}
        >
          <style>{`
            @keyframes omnimob-drop-pulse {
              0%, 100% { transform: translateY(0) scale(1); }
              50% { transform: translateY(-7px) scale(1.06); }
            }
          `}</style>
          <div style={{
            width: "76px", height: "76px", borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(99,102,241,0.18)", border: "1px solid rgba(99,102,241,0.45)", color: "#a5b4fc",
            animation: "omnimob-drop-pulse 1.2s ease-in-out infinite",
          }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: "19px", fontWeight: 700, color: "#fff" }}>Solte as fotos aqui</div>
            <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.65)", marginTop: "5px" }}>
              Elas serão adicionadas ao cadastro do imóvel
            </div>
          </div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "8px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ margin: 0, marginBottom: "4px" }}>{isEditing ? "Editar Imóvel" : "Novo Imóvel"}</h2>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)" }}>
            {isEditing ? "Atualize as informações do imóvel abaixo." : "Preencha as etapas para cadastrar um novo imóvel."}
          </p>
        </div>
        <button type="button" className="button-secondary" onClick={onCancelEdit} disabled={disabled} style={{ fontSize: "13px", padding: "8px 16px", width: "auto" }}>
          {isEditing ? "Cancelar edição" : "Voltar ao menu"}
        </button>
      </div>

      <StepIndicator current={step} onStepClick={handleStepClick} steps={visibleSteps} lockedSteps={lockedSteps} />

      {error ? <div className="error" style={{ marginBottom: "16px" }}>{error}</div> : null}

      <div style={{ display: "flex", gap: "40px", alignItems: "flex-start" }}>

        <div
          key={displayStep}
          className={`step-pane step-pane--${stepAnim}`}
          style={displayStep === 3
            ? { width: "100%", display: "flex", flexDirection: "column", gap: "20px" }
            : { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "20px" }
          }
        >

          {displayStep === 0 && (
            <>
              {isEditing && existingImages.length > 0 && (
                <div>
                  <span style={{ display: "block", marginBottom: "10px", fontSize: "13px", fontWeight: "600", color: "var(--text-muted)" }}>
                    Fotos salvas ({existingImages.length}) — arraste para reordenar, ✕ para remover
                  </span>
                  <PhotoGrid
                    images={existingImages.map((img) => ({ ...img, previewUrl: img.url }))}
                    onRemove={handleRemoveExisting}
                    onReorder={handleReorderExisting}
                    addInputId="foto-upload"
                    showAddCard={images.length === 0 && (existingImages.length + images.length) < MAX_FOTOS}
                    disabled={disabled}
                    allow360={canUse360}
                    onToggle360={toggleExisting360}
                  />
                </div>
              )}

              {isEditing && existingImages.length > 0 && images.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.07)" }} />
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>
                    Adicionar novas fotos
                  </span>
                  <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.07)" }} />
                </div>
              )}

              {/* Input sempre montado: usado tanto pela zona pontilhada quanto
                  pelo card "+" que aparece no fim da grade de fotos. */}
              <input
                type="file" accept="image/*" multiple id="foto-upload"
                onChange={(e) => { addImages(Array.from(e.target.files || [])); e.target.value = ""; }}
                disabled={disabled} style={{ display: "none" }}
              />

              {/* Zona pontilhada de upload só quando não há NENHUMA foto (nem
                  salva, nem nova). Havendo qualquer foto, o card "+" no fim da
                  grade passa a ser o ponto de adição. */}
              {images.length === 0 && existingImages.length === 0 && (
                <div data-tour="imovel-fotos" style={{ background: "rgba(255,255,255,0.02)", border: "2px dashed rgba(255,255,255,0.1)", borderRadius: "16px", padding: "32px 24px", textAlign: "center" }}>
                  <div style={{ color: "rgba(255,255,255,0.2)", marginBottom: "14px" }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                  <p style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: "600" }}>
                    {bloquearSemFoto ? "Fotos do imóvel" : "Adicionar fotos"}
                  </p>
                  <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: "var(--text-muted)" }}>
                    {bloquearSemFoto
                      ? "Envie ao menos uma foto do imóvel — a IA vai preencher título, descrição e os detalhes automaticamente a partir delas."
                      : "Selecione ou arraste uma ou mais fotos para esta página."}
                  </p>
                  {/* A marca é aplicada no envio, não aqui — então a miniatura
                      da lista mostra a foto limpa. Sem este aviso, a pessoa só
                      descobriria a logo depois de publicar. */}
                  <label htmlFor="foto-upload" style={{
                    display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 24px",
                    borderRadius: "10px", cursor: disabled ? "not-allowed" : "pointer",
                    background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)",
                    color: "rgba(99,102,241,1)", fontSize: "14px", fontWeight: "600",
                    opacity: disabled ? 0.55 : 1,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Selecionar fotos
                  </label>
                </div>
              )}

              <PhotoGrid
                images={images}
                onRemove={removeImage}
                onReorder={reorderImages}
                addInputId="foto-upload"
                showAddCard={images.length > 0 && (existingImages.length + images.length) < MAX_FOTOS}
                disabled={disabled}
                allow360={canUse360}
                onToggle360={toggleImage360}
              />

              {(existingImages.length + images.length) >= MAX_FOTOS && (
                <p className="hint" style={{ marginTop: "-8px", color: "var(--text-muted)" }}>
                  Limite de {MAX_FOTOS} fotos atingido.
                </p>
              )}

              {images.length > 1 && (
                <p className="hint" style={{ marginTop: "-8px" }}>
                  Arraste as fotos para reordenar. A primeira será a capa do anúncio.
                </p>
              )}

              {canUse360 && temPanoramica && (
                <p className="hint" style={{ marginTop: "-8px" }}>
                  Foto panorâmica detectada — já marcamos como <strong style={{ color: "#a5b4fc" }}>360°</strong> para o tour virtual. Clique no selo no canto da foto se quiser desativar.
                </p>
              )}

              {!canUse360 && temPanoramica && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "14px 16px", borderRadius: "12px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.28)", fontSize: "13px", color: "var(--text)", marginTop: "-8px" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: "1px" }}>
                    <circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" />
                  </svg>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", lineHeight: 1.5 }}>
                    <span>
                      Detectamos uma <strong>foto panorâmica</strong>. O <strong style={{ color: "#a5b4fc" }}>Tour Virtual 360°</strong> está disponível a partir do plano <strong style={{ color: "#6366f1" }}>Profissional</strong> — no seu plano atual ela será exibida como uma imagem comum.
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate("/configuracoes?ver=plano")}
                      style={{ alignSelf: "flex-start", width: "auto", padding: "7px 16px", fontSize: "12px", fontWeight: 600, borderRadius: "8px", background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.45)", color: "#c7d2fe", cursor: "pointer" }}
                    >
                      Conhecer o plano Profissional
                    </button>
                  </div>
                </div>
              )}

              {aviso360 && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "12px 16px", borderRadius: "12px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", fontSize: "13px", color: "#fbbf24" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: "1px" }}>
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  {aviso360}
                </div>
              )}

              {bloquearSemFoto && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => setSemIA(true)}
                    style={{ width: "auto", fontSize: "13px", padding: "9px 20px" }}
                  >
                    Continuar sem IA
                  </button>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", opacity: 0.75, textAlign: "center" }}>
                    Preencha os campos manualmente. A ferramenta de IA continua disponível em cada campo.
                  </span>
                </div>
              )}

              <style>{`
                @keyframes gradient-flare {
                  0% { background-position: 0% 50%; }
                  50% { background-position: 100% 50%; }
                  100% { background-position: 0% 50%; }
                }
                @keyframes wand-pulse {
                  0%, 100% { opacity: 1; }
                  50% { opacity: 0.35; }
                }
                @keyframes ia-skeleton {
                  0% { background-position: 200% 0; }
                  100% { background-position: -200% 0; }
                }
                @keyframes omnimob-reveal {
                  from { opacity: 0; transform: translateY(18px); }
                  to { opacity: 1; transform: translateY(0); }
                }
              `}</style>

              {campoIaErro && (
                <div style={{ fontSize: "12px", color: "#f87171", marginBottom: "12px" }}>
                  {campoIaErro}
                </div>
              )}

              {/* Fluxo com IA: os campos só aparecem depois da 1ª foto e entram
                  com uma animação de reveal. Sem IA, aparecem normalmente. */}
              {!bloquearSemFoto && (
              <div
                style={{
                  display: "flex", flexDirection: "column", gap: "20px",
                  animation: (autoIA && !isEditing) ? "omnimob-reveal 0.55s cubic-bezier(.22,1,.36,1) both" : undefined,
                }}
              >
              <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", margin: "32px 0 16px 0" }} />

              <Field tourId="imovel-titulo" label="Título do imóvel" required error={fieldErrors.title}>
                <div style={{ position: "relative", zIndex: 1 }}>
                  <AiFlareBadge active={aiFields.title} />
                  <div style={{
                    position: "absolute", inset: "-1px", borderRadius: "11px", zIndex: -1,
                    background: "linear-gradient(115deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
                    backgroundSize: "200% 200%", animation: "gradient-flare 3s ease infinite",
                    opacity: aiFields.title ? 1 : 0, transition: "opacity 0.4s ease",
                    padding: "2px", WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                    WebkitMaskComposite: "xor", maskComposite: "exclude"
                  }} />
                  <input
                    style={{ ...withError("title"), paddingRight: "44px", position: "relative", zIndex: 2 }}
                    placeholder="Ex: Apartamento 3 quartos no Setor Bueno"
                    value={form.title}
                    onChange={(e) => handleChangeField("title", e.target.value)}
                    disabled={disabled}
                    onFocus={() => setFocusedField("title")}
                    onBlur={() => setFocusedField(null)}
                  />
                  {canUseIA && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleGerarCampoIA("title")}
                    disabled={(gerandoCampo === "title" || gerandoCampo === "auto") || disabled}
                    title="Gerar título com IA"
                    style={{
                      position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)",
                      background: "linear-gradient(135deg, #f09433, #dc2743, #bc1888)",
                      border: "none", borderRadius: "8px", width: "28px", height: "28px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: (gerandoCampo === "title" || gerandoCampo === "auto") || disabled ? "wait" : "pointer",
                      padding: 0, opacity: focusedField === "title" && temFotos ? 1 : 0,
                      pointerEvents: focusedField === "title" && temFotos ? "auto" : "none",
                      transition: "opacity 0.3s ease", zIndex: 3,
                      boxShadow: "0 2px 6px rgba(220, 39, 67, 0.4)"
                    }}
                  >
                    <span style={{ display: "flex", animation: (gerandoCampo === "title" || gerandoCampo === "auto") ? "wand-pulse 0.9s ease-in-out infinite" : "none" }}><WandIcon /></span>
                  </button>
                  )}
                  <IaSkeleton active={(gerandoCampo === "auto" && regeraCampo("title", !form.title.trim())) || gerandoCampo === "title"} radius="10px" />
                </div>
              </Field>

              <Field tourId="imovel-descricao" label="Descrição" required error={fieldErrors.description}>
                <div style={{ position: "relative", zIndex: 1 }}>
                  <AiFlareBadge active={aiFields.description} />
                  <div style={{
                    position: "absolute", inset: "-1px", borderRadius: "11px", zIndex: -1,
                    background: "linear-gradient(115deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
                    backgroundSize: "200% 200%", animation: "gradient-flare 3s ease infinite",
                    opacity: aiFields.description ? 1 : 0, transition: "opacity 0.4s ease",
                    padding: "2px", WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                    WebkitMaskComposite: "xor", maskComposite: "exclude"
                  }} />
                  <textarea
                    ref={descricaoRef}
                    className="input-scroll"
                    style={{ ...withError("description"), resize: "none", overflowY: "hidden", minHeight: "100px", lineHeight: "1.6", paddingRight: "44px", position: "relative", zIndex: 2 }}
                    placeholder="Descreva os principais atrativos do imóvel, diferenciais, acabamento..."
                    value={form.description}
                    onChange={(e) => handleChangeField("description", e.target.value)}
                    rows={4}
                    disabled={disabled}
                    onFocus={() => setFocusedField("description")}
                    onBlur={() => setFocusedField(null)}
                  />
                  {canUseIA && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleGerarCampoIA("description")}
                    disabled={(gerandoCampo === "description" || gerandoCampo === "auto") || disabled}
                    title="Gerar descrição com IA"
                    style={{
                      position: "absolute", right: "8px", top: "12px",
                      background: "linear-gradient(135deg, #f09433, #dc2743, #bc1888)",
                      border: "none", borderRadius: "8px", width: "28px", height: "28px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: (gerandoCampo === "description" || gerandoCampo === "auto") || disabled ? "wait" : "pointer",
                      padding: 0, opacity: focusedField === "description" && temFotos ? 1 : 0,
                      pointerEvents: focusedField === "description" && temFotos ? "auto" : "none",
                      transition: "opacity 0.3s ease", zIndex: 3,
                      boxShadow: "0 2px 6px rgba(220, 39, 67, 0.4)"
                    }}
                  >
                    <span style={{ display: "flex", animation: (gerandoCampo === "description" || gerandoCampo === "auto") ? "wand-pulse 0.9s ease-in-out infinite" : "none" }}><WandIcon /></span>
                  </button>
                  )}
                  <IaSkeleton active={(gerandoCampo === "auto" && regeraCampo("description", !form.description.trim())) || gerandoCampo === "description"} radius="10px" />
                </div>
              </Field>

              <Field tourId="imovel-preco" label="Preço" required error={fieldErrors.price}>
                <input style={withError("price")} placeholder="R$ 0,00" type="text" inputMode="numeric" value={form.price} onChange={(e) => set("price", formatCurrencyBRL(e.target.value))} disabled={disabled} />
              </Field>

              <Field tourId="imovel-tipo" label="Tipo de imóvel" required error={fieldErrors.tipoImovelId}>
                <AiFlare active={aiFields.tipoImovelId}>
                  <SelectCustom
                    style={{ position: "relative", zIndex: 2 }}
                    value={form.tipoImovelId}
                    placeholder="Selecione uma categoria..."
                    disabled={disabled}
                    invalid={Boolean(fieldErrors.tipoImovelId)}
                    flash={Boolean(flashFields.tipoImovelId)}
                    options={tipos.map((t) => ({ value: String(t.id), label: t.descricao }))}
                    onChange={(v) => {
                      setForm((prev) => ({ ...prev, tipoImovelId: v, atributosIds: [] }));
                      clearFieldError("tipoImovelId");
                      setAiFields((p) => ({ ...p, tipoImovelId: false, atributos: false }));
                    }}
                  />
                  <IaSkeleton active={gerandoCampo === "auto" && regeraCampo("tipoImovelId", !form.tipoImovelId)} radius="10px" />
                </AiFlare>
              </Field>

              <Field tourId="imovel-contrato" label="Tipo de contrato" required error={fieldErrors.tipoContrato}>
                <SelectCustom
                  id="tipo-contrato"
                  value={form.tipoContrato}
                  placeholder="Selecione o tipo de negócio..."
                  disabled={disabled}
                  invalid={Boolean(fieldErrors.tipoContrato)}
                  flash={Boolean(flashFields.tipoContrato)}
                  options={contratosDisponiveis.map((t) => ({
                    value: t.key, label: t.label, description: t.descricao, color: t.cor,
                  }))}
                  onChange={(v) => { set("tipoContrato", v); clearFieldError("tipoContrato"); }}
                />
              </Field>

              {tipoSelecionado && tipoSelecionado.atributos?.length > 0 ? (
                <AiFlare active={aiFields.atributos} radius="13px">
                  <div data-tour="imovel-atributos" style={{ position: "relative", zIndex: 2, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: "16px" }}>
                    <AtributosSection atributos={tipoSelecionado.atributos} selecionados={form.atributosIds} onChange={(ids) => { set("atributosIds", ids); setAiFields((p) => ({ ...p, atributos: false })); }} disabled={disabled} />
                    <IaSkeleton active={gerandoCampo === "auto" && regeraCampo("atributos", form.atributosIds.length === 0)} radius="12px" />
                  </div>
                </AiFlare>
              ) : (gerandoCampo === "auto" && regeraCampo("tipoImovelId", !form.tipoImovelId)) ? (
                <div style={{ position: "relative", minHeight: "92px" }}>
                  <IaSkeleton active radius="12px" />
                </div>
              ) : null}
              </div>
              )}
            </>
          )}

          {displayStep === 1 && (
            <>
              <Field tourId="imovel-cep" label="CEP" hint="Preencha o CEP para auto-completar o endereço.">
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <input style={{ ...inputStyle, maxWidth: "160px" }} placeholder="00000-000" value={form.cep} onChange={(e) => set("cep", formatCep(e.target.value))} onBlur={handleCepBlur} maxLength={9} disabled={disabled || cepLoading} />
                  {cepLoading && <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Consultando...</span>}
                </div>
              </Field>
              <Field tourId="imovel-endereco" label="Endereço" required error={fieldErrors.address}>
                <ComSkeleton active={cepLoading}>
                  <input style={withError("address")} placeholder="Rua, número, complemento" value={form.address} onChange={(e) => set("address", e.target.value)} disabled={disabled} />
                </ComSkeleton>
              </Field>
              <div data-tour="imovel-bairro-cidade" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <Field label="Bairro" required error={fieldErrors.neighborhood}>
                  <ComSkeleton active={cepLoading}>
                    <input style={withError("neighborhood")} placeholder="Bairro" value={form.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} disabled={disabled} />
                  </ComSkeleton>
                </Field>
                <Field label="Cidade" required error={fieldErrors.city}>
                  <ComSkeleton active={cepLoading}>
                    <input style={withError("city")} placeholder="Cidade" value={form.city} onChange={(e) => set("city", e.target.value)} disabled={disabled} />
                  </ComSkeleton>
                </Field>
              </div>
              <Field tourId="imovel-uf" label="Estado (UF)" required error={fieldErrors.state}>
                <ComSkeleton active={cepLoading} style={{ maxWidth: "100px" }}>
                  <input style={{ ...withError("state"), maxWidth: "100px", textTransform: "uppercase" }} placeholder="GO" maxLength={2} value={form.state} onChange={(e) => set("state", e.target.value.toUpperCase())} disabled={disabled} />
                </ComSkeleton>
              </Field>

              <AiFlare active={aiFields.comodidades} radius="12px">
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: "16px", position: "relative", zIndex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "4px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-muted)" }}>
                    Comodidades da região
                  </span>
                  {comodidadesLoading ? (
                    <span style={{ fontSize: "12px", color: "rgba(99,102,241,1)" }}>Analisando a região com IA…</span>
                  ) : comodidadesMsg ? (
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{comodidadesMsg}</span>
                  ) : null}
                </div>
                <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", opacity: 0.7, marginBottom: "12px" }}>
                  Sugerido por IA a partir do CEP. Você pode ajustar manualmente.
                </span>
                {/* Cobre da consulta do CEP até o fim da inferência por IA, sem piscar entre as duas etapas. */}
                <ComSkeleton active={cepLoading || comodidadesLoading} radius="10px">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "8px" }}>
                  {COMODIDADES.map((c) => {
                    const checked = Boolean(form.comodidades?.[c.key]);
                    return (
                      <label key={c.key} style={{
                        display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px",
                        borderRadius: "8px", cursor: disabled ? "not-allowed" : "pointer",
                        border: checked ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.08)",
                        background: checked ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.02)",
                        transition: "all 0.15s ease", fontSize: "13px", userSelect: "none",
                        opacity: disabled ? 0.55 : 1,
                      }}>
                        <input
                          type="checkbox" checked={checked} onChange={() => toggleComodidade(c.key)} disabled={disabled}
                          style={{ accentColor: "var(--primary, #6366f1)", width: "14px", height: "14px", flexShrink: 0 }}
                        />
                        {/* O ícone acompanha o estado: aceso quando marcado,
                            apagado quando não — o mesmo sinal que a borda dá. */}
                        <c.Icone size={15} style={{ flexShrink: 0, color: checked ? "#a5b4fc" : "var(--text-muted)" }} />
                        {c.label}
                      </label>
                    );
                  })}
                </div>
                </ComSkeleton>
              </div>
              </AiFlare>
            </>
          )}

          {displayStep === 2 && (
            <>
              <Field tourId="imovel-finalidade" label="Finalidade">
                <AiFlare active={aiFields.finalidade}>
                  <SelectCustom
                    style={{ position: "relative", zIndex: 2 }}
                    value={form.finalidade}
                    placeholder="Não informado"
                    disabled={disabled}
                    options={[
                      { value: "", label: "Não informado" },
                      { value: "RESIDENCIAL", label: "Residencial" },
                      { value: "COMERCIAL", label: "Comercial" },
                    ]}
                    onChange={(v) => { set("finalidade", v); setAiFields((p) => ({ ...p, finalidade: false })); }}
                  />
                </AiFlare>
              </Field>
              <div data-tour="imovel-quantidades" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
                {form.finalidade === "COMERCIAL" ? (
                  <>
                    <Field label="Salas" error={fieldErrors.salas}><input style={withError("salas")} type="number" min="0" placeholder="0" value={form.salas} onChange={(e) => set("salas", e.target.value)} disabled={disabled} /></Field>
                    <Field label="Banheiros" error={fieldErrors.banheiros}><input style={withError("banheiros")} type="number" min="0" placeholder="0" value={form.banheiros} onChange={(e) => set("banheiros", e.target.value)} disabled={disabled} /></Field>
                  </>
                ) : (
                  <>
                    <Field label="Quartos" error={fieldErrors.bedrooms}><input style={withError("bedrooms")} type="number" min="0" placeholder="0" value={form.bedrooms} onChange={(e) => set("bedrooms", e.target.value)} disabled={disabled} /></Field>
                    <Field label="Suítes" error={fieldErrors.suites}><input style={withError("suites")} type="number" min="0" placeholder="0" value={form.suites} onChange={(e) => set("suites", e.target.value)} disabled={disabled} /></Field>
                  </>
                )}
                <Field label="Vagas de garagem" error={fieldErrors.parkingSpots}><input style={withError("parkingSpots")} type="number" min="0" placeholder="0" value={form.parkingSpots} onChange={(e) => set("parkingSpots", e.target.value)} disabled={disabled} /></Field>
              </div>

              {!tipoSelecionado && (
                <div style={{ padding: "10px 14px", borderRadius: "10px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", fontSize: "12px", color: "#fbbf24" }}>
                  Selecione o tipo de imóvel na etapa "Identificação" para ver os campos de área corretos.
                </div>
              )}
              <div data-tour="imovel-areas" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(areaFields.length, 3)}, 1fr)`, gap: "16px" }}>
                {areaFields.map((field, idx) => (
                  <Field key={field} label={`${AREA_FIELDS[field]} (m²)`} required={idx === 0} error={fieldErrors[field]}>
                    <input style={withError(field)} type="number" min="0" step="0.01" placeholder="0,00" value={form[field]} onChange={(e) => set(field, e.target.value)} disabled={disabled} />
                  </Field>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <Field label="Status">
                  <SelectCustom
                    value={form.status}
                    disabled={disabled}
                    options={[
                      { value: "DRAFT", label: "Rascunho", color: "#f59e0b" },
                      { value: "ACTIVE", label: "Ativo", color: "#10b981" },
                      { value: "INACTIVE", label: "Inativo", color: "#ef4444" },
                    ]}
                    onChange={(v) => set("status", v)}
                  />
                </Field>
                <Field label="Andamento">
                  <SelectCustom
                    value={form.andamento}
                    placeholder="Não informado"
                    disabled={disabled}
                    options={[
                      { value: "", label: "Não informado" },
                      { value: "PRONTO_PARA_MORAR", label: "Pronto para morar" },
                      { value: "EM_CONSTRUCAO", label: "Em construção" },
                    ]}
                    onChange={(v) => set("andamento", v)}
                  />
                </Field>
              </div>
              <label style={{
                display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", borderRadius: "12px",
                cursor: disabled ? "not-allowed" : "pointer",
                border: form.aceitaPermuta ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.08)",
                background: form.aceitaPermuta ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.02)",
                transition: "all 0.2s ease", userSelect: "none", opacity: disabled ? 0.55 : 1,
              }}>
                <input type="checkbox" checked={form.aceitaPermuta} onChange={(e) => set("aceitaPermuta", e.target.checked)} disabled={disabled} style={{ accentColor: "var(--primary, #6366f1)", width: "16px", height: "16px", flexShrink: 0 }} />
                <div>
                  <span style={{ fontSize: "14px", fontWeight: "500" }}>Aceita permuta</span>
                  <span style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>Proprietário aceita troca parcial ou total</span>
                </div>
              </label>

              {/* Portais imobiliários.
                  Separado de "ativo na vitrine" de propósito: imóvel de
                  exclusividade em negociação, ou de carteira, fica na vitrine
                  da imobiliária e fora do ZAP. Sem este campo, "publicar tudo"
                  seria a única política possível. */}
              <label style={{
                display: "flex", alignItems: "flex-start", gap: "14px", padding: "16px 18px", borderRadius: "14px",
                cursor: disabled ? "not-allowed" : "pointer",
                border: form.publicarPortais ? "1px solid rgba(14,165,233,0.45)" : "1px solid rgba(255,255,255,0.08)",
                background: form.publicarPortais ? "rgba(14,165,233,0.09)" : "rgba(255,255,255,0.02)",
                transition: "all 0.2s ease", userSelect: "none", opacity: disabled ? 0.55 : 1,
              }}>
                <input type="checkbox" checked={form.publicarPortais} onChange={(e) => set("publicarPortais", e.target.checked)} disabled={disabled} style={{ accentColor: "#0ea5e9", width: "16px", height: "16px", flexShrink: 0, marginTop: "2px" }} />
                <div>
                  <span style={{ fontSize: "14px", fontWeight: "500" }}>Enviar aos portais</span>
                  <span style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginTop: "2px", lineHeight: 1.5 }}>
                    Inclui o imóvel no arquivo que o ZAP, o VivaReal e o OLX Imóveis buscam.
                    Desmarque para mantê-lo só na sua vitrine.
                  </span>
                </div>
              </label>

              {/* Endereço completo na página pública.
                  Desmarcado por padrão, e isso é a decisão — não um detalhe de
                  interface. Bairro e cidade continuam aparecendo sempre; o que
                  este campo libera é a RUA E O NÚMERO.

                  Quando desmarcado, o endereço não é escondido: ele não sai da
                  API (ver `semEnderecoOculto` em publicRoutes), e o feed pede
                  aos portais que exibam só o bairro. Esconder na tela e mandar
                  no JSON seria esconder de quem olha e entregar a quem procura. */}
              <label style={{
                display: "flex", alignItems: "flex-start", gap: "14px", padding: "16px 18px", borderRadius: "14px",
                cursor: disabled ? "not-allowed" : "pointer",
                border: form.exibirEnderecoCompleto ? "1px solid rgba(139,92,246,0.45)" : "1px solid rgba(255,255,255,0.08)",
                background: form.exibirEnderecoCompleto ? "rgba(139,92,246,0.09)" : "rgba(255,255,255,0.02)",
                transition: "all 0.2s ease", userSelect: "none", opacity: disabled ? 0.55 : 1,
              }}>
                <input
                  type="checkbox"
                  checked={form.exibirEnderecoCompleto}
                  onChange={(e) => set("exibirEnderecoCompleto", e.target.checked)}
                  disabled={disabled}
                  style={{ accentColor: "#8b5cf6", width: "16px", height: "16px", flexShrink: 0, marginTop: "2px" }}
                />
                <div>
                  <span style={{ fontSize: "14px", fontWeight: "500" }}>Mostrar o endereço completo na vitrine</span>
                  <span style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginTop: "2px", lineHeight: 1.5 }}>
                    {form.exibirEnderecoCompleto
                      ? "A rua, o número e o CEP aparecem na página do imóvel para qualquer visitante."
                      : "Só o bairro, a cidade e o estado aparecem. A rua fica com você e com quem entrar em contato."}
                  </span>
                </div>
              </label>
            </>
          )}

          {displayStep === 3 && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "18px 20px", borderRadius: "14px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "rgba(16,185,129,0.2)", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <div>
                  <div style={{ fontWeight: "600", fontSize: "14px" }}>
                    {isEditing ? "Divulgação do imóvel" : "Imóvel salvo com sucesso!"}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                    {isEditing
                      ? "Gerencie as publicações deste imóvel nas redes sociais."
                      : "Agora você pode divulgá-lo nas redes sociais."}
                  </div>
                </div>
              </div>

              <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5 }}>
                Veja como o post fica em cada rede e <strong>edite o texto direto no preview</strong>. Cada rede
                começa com o texto do imóvel; use <strong>Gerar com IA</strong> para
                uma versão sob medida.
              </p>

              {!cargo?.publicarRedes && (
                <div style={{ padding: "12px 16px", borderRadius: "10px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", fontSize: "13px", color: "#fbbf24" }}>
                  Você não tem permissão para publicar no Facebook/Instagram — mas pode compartilhar via WhatsApp.
                </div>
              )}

              <div className="divulgar-grid" ref={divulgarGridRef}>
                {cargo?.publicarRedes && (
                  <FacebookPreview
                    nome={session?.tenant?.name}
                    avatarUrl={session?.tenant?.logoUrl || null}
                    coverUrls={coverUrls}
                    caption={captions.facebook}
                    onChange={(v) => setCaptions((p) => ({ ...p, facebook: v }))}
                    descActive={descHover === "facebook"}
                    onDescEnter={() => setDescHover("facebook")}
                    onDescLeave={() => setDescHover(null)}
                    onGerarIA={canUseIA ? () => handleGerarRedeIA("facebook") : undefined}
                    iaLoading={redeIaLoading.facebook}
                    iaErro={redeIaErro.facebook}
                    statusText={socialStatus === null ? "Verificando…" : socialStatus.facebook.connected ? socialStatus.facebook.pageName : "Não conectado"}
                    published={fbPosts.length > 0}
                    publishedCount={fbPosts.length}
                    publishing={publishLoading.facebook}
                    locked={socialStatus !== null && !socialStatus.facebook.connected}
                    lockLabel="Conecte sua Página do Facebook em Configurações para publicar aqui."
                    acao={
                      <button type="button" className="divulgar-pub" onClick={() => onPublishClick("facebook")} disabled={!socialStatus?.facebook?.connected || publishLoading.facebook}
                        style={{ ...pubBtnBase, background: "#1877f2", cursor: socialStatus?.facebook?.connected ? "pointer" : "not-allowed", opacity: socialStatus?.facebook?.connected ? 1 : 0.4 }}>
                        {publishLoading.facebook ? "Publicando…" : fbPosts.length > 0 ? "Publicar novamente" : "Publicar"}
                      </button>
                    }
                  />
                )}

                {cargo?.publicarRedes && (
                  <InstagramPreview
                    nome={session?.tenant?.name}
                    avatarUrl={session?.tenant?.logoUrl || null}
                    coverUrls={coverUrls}
                    caption={captions.instagram}
                    onChange={(v) => setCaptions((p) => ({ ...p, instagram: v }))}
                    descActive={descHover === "instagram"}
                    onDescEnter={() => setDescHover("instagram")}
                    onDescLeave={() => setDescHover(null)}
                    onGerarIA={canUseIA ? () => handleGerarRedeIA("instagram") : undefined}
                    iaLoading={redeIaLoading.instagram}
                    iaErro={redeIaErro.instagram}
                    statusText={socialStatus === null ? "Verificando…" : socialStatus.instagram.connected ? "Conta conectado" : "Não conectado"}
                    published={igPosts.length > 0}
                    publishedCount={igPosts.length}
                    publishing={publishLoading.instagram}
                    locked={socialStatus !== null && !socialStatus.instagram.connected}
                    lockLabel="Conecte sua conta do Instagram em Configurações para publicar aqui."
                    acao={
                      <button type="button" className="divulgar-pub" onClick={() => onPublishClick("instagram")} disabled={!socialStatus?.instagram?.connected || publishLoading.instagram}
                        style={{ ...pubBtnBase, background: "linear-gradient(135deg, #f09433, #dc2743, #bc1888)", cursor: socialStatus?.instagram?.connected ? "pointer" : "not-allowed", opacity: socialStatus?.instagram?.connected ? 1 : 0.4 }}>
                        {publishLoading.instagram ? "Publicando…" : igPosts.length > 0 ? "Publicar novamente" : "Publicar"}
                      </button>
                    }
                  />
                )}

                <WhatsAppPreview
                  nome={session?.tenant?.name}
                  avatarUrl={session?.tenant?.logoUrl || null}
                  coverUrls={coverUrls}
                  caption={captions.whatsapp}
                  onChange={(v) => setCaptions((p) => ({ ...p, whatsapp: v }))}
                  descActive={descHover === "whatsapp"}
                  onDescEnter={() => setDescHover("whatsapp")}
                  onDescLeave={() => setDescHover(null)}
                  onGerarIA={canUseIA ? () => handleGerarRedeIA("whatsapp") : undefined}
                  iaLoading={redeIaLoading.whatsapp}
                  iaErro={redeIaErro.whatsapp}
                  statusText="Sempre disponível"
                  acao={
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <button type="button" className="divulgar-pub btn-whatsapp" onClick={handleWhatsApp} style={{ ...pubBtnBase, background: "#25d366", cursor: "pointer" }}>
                        Compartilhar
                      </button>
                      {/* Peça vertical 1080×1920, o formato do status. Mandar a
                          foto quadrada faz o WhatsApp preencher o resto com um
                          borrão da própria imagem, e o post sai com tarjas. */}
                      <button
                        type="button"
                        className="divulgar-pub"
                        onClick={handleStatus}
                        disabled={gerandoArte}
                        style={{
                          ...pubBtnBase,
                          background: "rgba(37,211,102,0.14)",
                          border: "1px solid rgba(37,211,102,0.45)",
                          color: "#25d366",
                          cursor: gerandoArte ? "default" : "pointer",
                        }}
                      >
                        {gerandoArte
                          ? (pontePronta ? "Publicando…" : "Montando a arte…")
                          : (pontePronta ? "Publicar no status" : "Gerar arte para o status")}
                      </button>
                    </div>
                  }
                />
              </div>

              {(publishResults.facebook?.error || publishResults.instagram?.error) && (
                <div style={{ padding: "12px 16px", borderRadius: "10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", fontSize: "13px", color: "#f87171", display: "flex", flexDirection: "column", gap: "4px" }}>
                  {publishResults.facebook?.error && <span>Facebook: {publishResults.facebook.error}</span>}
                  {publishResults.instagram?.error && <span>Instagram: {publishResults.instagram.error}</span>}
                </div>
              )}

              {(removeNote.facebook || removeNote.instagram) && (
                <div style={{ padding: "12px 16px", borderRadius: "10px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", fontSize: "13px", color: "#fbbf24", display: "flex", flexDirection: "column", gap: "4px" }}>
                  {removeNote.facebook && <span>{removeNote.facebook}</span>}
                  {removeNote.instagram && <span>{removeNote.instagram}</span>}
                </div>
              )}

              {publications.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                    Publicações ativas ({publications.length})
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {publications.map((pub) => {
                      const isFb = pub.channel === "FACEBOOK";
                      const isIg = pub.channel === "INSTAGRAM";
                      const label = isFb ? "Facebook" : isIg ? "Instagram" : "WhatsApp";
                      const brandBg = isFb ? "#1877f2" : isIg ? "linear-gradient(135deg,#f09433,#dc2743,#bc1888)" : "#25d366";
                      const brandIcon = isFb ? FB_ICON : isIg ? IG_ICON : WA_ICON;
                      const removing = removingId === pub.id;
                      const isOpen = expandedPostId === pub.id;
                      const data = pub.createdAt
                        ? new Date(pub.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
                        : "";
                      const captionReal = pub.caption ?? captions[pub.channel.toLowerCase()] ?? "";
                      return (
                        <div key={pub.id} style={{
                          borderRadius: "10px", border: `1px solid ${isOpen ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.08)"}`,
                          background: "rgba(255,255,255,0.03)", overflow: "hidden",
                          transition: "border-color 0.15s",
                          animation: removing ? "divulgar-post-out 0.4s ease forwards" : undefined,
                        }}>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => togglePost(pub)}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); togglePost(pub); } }}
                            title="Ver como ficou o post"
                            style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", cursor: "pointer" }}
                          >
                            <span style={{ width: "34px", height: "34px", borderRadius: "9px", background: brandBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}>
                              <span style={{ display: "flex", transform: "scale(0.72)" }}>{brandIcon}</span>
                            </span>
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0, flex: 1 }}>
                              <span style={{ fontSize: "13px", fontWeight: 600 }}>{label}</span>
                              {data && <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Publicado em {data}</span>}
                            </div>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-muted)", flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.25s ease" }}>
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleRemovePost(pub); }}
                              disabled={removing}
                              title="Remover publicação"
                              aria-label="Remover publicação"
                              style={{
                                width: "34px", height: "34px", borderRadius: "9px", flexShrink: 0, padding: 0,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)",
                                cursor: removing ? "default" : "pointer", opacity: removing ? 0.6 : 1, transition: "background 0.15s, color 0.15s",
                              }}
                              onMouseEnter={(e) => { if (removing) return; e.currentTarget.style.background = "rgba(239,68,68,0.22)"; e.currentTarget.style.color = "#fca5a5"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; e.currentTarget.style.color = "#f87171"; }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                              </svg>
                            </button>
                          </div>
                          {/* Dropdown: abre/fecha animando a altura (grid-template-rows 0fr→1fr) */}
                          <div style={{ display: "grid", gridTemplateRows: isOpen ? "1fr" : "0fr", transition: "grid-template-rows 0.32s ease" }}>
                            <div style={{ minHeight: 0, overflow: "hidden" }}>
                              <div style={{ padding: "0 10px 10px" }}>
                                <PostSimCard
                                  pub={pub}
                                  coverUrls={coverUrls}
                                  caption={captionReal}
                                  insights={postInsights[pub.id]}
                                  nome={session?.tenant?.name}
                                  avatarUrl={session?.tenant?.logoUrl || null}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: "12px", marginTop: "4px", flexWrap: "wrap", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <button
                  type="button"
                  onClick={() => { setSavedPropertyId(null); setForm(EMPTY); setStep(0); setPublishResults({}); setPublications([]); setSemIA(false); }}
                  style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 20px", borderRadius: "10px", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "rgba(99,102,241,1)", fontSize: "13px", fontWeight: "600", cursor: "pointer", width: "auto" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  Cadastrar novo imóvel
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => navigate("/imoveis/portfolio")}
                  style={{ fontSize: "13px", padding: "9px 20px", width: "auto" }}
                >
                  Ver portfólio
                </button>
              </div>
            </>
          )}

          {displayStep < 3 && (
            <div style={{ display: "flex", gap: "12px", marginTop: "8px", flexWrap: "wrap" }}>
              {displayStep > 0 && (
                <button type="button" className="button-secondary" onClick={handleBack} disabled={disabled} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                  Voltar
                </button>
              )}
              {displayStep < 2 ? (
                <button data-tour="imovel-continuar" type="button" onClick={handleNext} disabled={disabled} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  Continuar
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              ) : (
                <button data-tour="imovel-salvar" type="button" onClick={handleSubmit} disabled={disabled}>
                  {isEditing ? "Salvar alterações" : canPublish ? "Publicar imóvel" : "Cadastrar imóvel"}
                </button>
              )}
            </div>
          )}
        </div>

        {displayStep < 3 && !bloquearSemFoto && (
          <div
            style={{
              width: "300px", flexShrink: 0,
              animation: (autoIA && !isEditing) ? "omnimob-reveal 0.55s cubic-bezier(.22,1,.36,1) both" : undefined,
            }}
          >
            <PropertyPreviewCard form={form} previewItems={previewItems} cardRef={previewCardRef} />
          </div>
        )}
      </div>
    </section>
  );
}