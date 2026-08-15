import { useState } from "react";
import { IconeLua, IconeSol } from "../../Icones.jsx";
import { SelectCustom } from "../../SelectCustom";
import { FONT_OPTIONS, PRESET_THEMES, THEME_LABELS } from "../data/temas";
import { BLOCK_LABELS, parsePieceId } from "../../showcase/engine/pieces.js";
import {
  IconeCadeado,
  IconeCadeadoAberto,
  IconeDuplicar,
  IconeOlhoCortado,
  IconeReset,
  IconeSeta,
} from "../iconesEditor";

/* ────────────────────────────────────────────────────────────────────────────
   Inspetor — a coluna da direita.

   A regra que organiza tudo aqui: sem seleção, você está editando a PÁGINA; com
   seleção, você está editando aquela PEÇA. Nada de misturar os dois níveis na
   mesma coluna, que era o que fazia o painel antigo alternar entre "Aparência
   global" e "cor de fundo do rodapé" sem aviso.

   As seções recolhem. Um bloco com banner tem nove controles; empilhados de uma
   vez viram parede, e a pessoa rola para achar o que já estava na tela.
   ──────────────────────────────────────────────────────────────────────────── */

function Secao({ titulo, children, aberta = true, acao }) {
  const [expandida, setExpandida] = useState(aberta);
  return (
    <section className="editor-panel-section">
      <header className="editor-panel-section-head">
        <button type="button" className="editor-panel-section-toggle" aria-expanded={expandida} onClick={() => setExpandida((v) => !v)}>
          <IconeSeta size={12} style={{ transform: expandida ? "rotate(90deg)" : "none" }} />
          <span>{titulo}</span>
        </button>
        {acao}
      </header>
      {expandida ? <div className="editor-panel-section-body">{children}</div> : null}
    </section>
  );
}

function CampoTexto({ label, value, onChange, placeholder, readOnly }) {
  return (
    <label className="editor-field">
      <span className="editor-field-label">{label}</span>
      <input
        type="text"
        className="editor-input"
        value={value || ""}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </label>
  );
}

/* Campo numérico de layout (X, Y, largura, altura).

   O histórico é registrado no FOCO e não a cada tecla: digitar "250" produz
   2 → 25 → 250, e três entradas de undo para um número só transformam Ctrl+Z
   numa viagem de volta letra por letra. Uma entrada por visita ao campo é o
   equivalente ao "um gesto, uma operação" do arrasto. */
function CampoNumero({ label, value, onChange, aoFocar, sufixo, passo = 1, min, max }) {
  return (
    <label className="editor-field is-inline">
      <span className="editor-field-label">{label}</span>
      <span className="editor-number">
        <input
          type="number"
          className="editor-input"
          value={Math.round((value ?? 0) * 10) / 10}
          step={passo}
          min={min}
          max={max}
          onFocus={aoFocar}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(n);
          }}
        />
        {sufixo ? <em>{sufixo}</em> : null}
      </span>
    </label>
  );
}

function CampoCor({ label, value, fallback, onChange }) {
  return (
    <label className="editor-field">
      <span className="editor-field-label">{label}</span>
      <span className="editor-color" style={{ background: value || fallback }}>
        <input type="color" value={value || fallback} onChange={(e) => onChange(e.target.value)} />
      </span>
    </label>
  );
}

function Deslizante({ label, valor, onChange, min, max, formatar }) {
  return (
    <label className="editor-field">
      <span className="editor-field-label editor-field-label--split">
        {label} <b>{formatar(valor)}</b>
      </span>
      <input type="range" className="editor-range" min={min} max={max} value={valor} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

/* ── Página ────────────────────────────────────────────────────────────────── */
function PainelDaPagina({ form, config, tenantName, isLightMode, currentTheme, acoes }) {
  const ocultos = (config.hiddenBlocks || []).filter((k) => BLOCK_LABELS[k]);
  const widgetsOcultos = (config.widgets || []).filter((w) => w.hidden);

  return (
    <>
      <Secao titulo="Aparência">
        <div className="editor-segmented">
          {[["dark", "Escuro", IconeLua], ["light", "Claro", IconeSol]].map(([modo, rotulo, Icone]) => {
            const ativo = (modo === "dark" && !isLightMode) || (modo === "light" && isLightMode);
            return (
              <button key={modo} type="button" className={ativo ? "is-active" : ""} aria-pressed={ativo} onClick={() => acoes.definirModoAparencia(modo)}>
                <Icone size={13} />{rotulo}
              </button>
            );
          })}
        </div>

        {/* `div` e não `label`: o SelectCustom é um <button>, e o rótulo
            reencaminharia o clique para ele — abrindo e fechando a lista no
            mesmo gesto quando o clique cai sobre o próprio seletor. */}
        <div className="editor-field">
          <span className="editor-field-label">Fonte da vitrine</span>
          <SelectCustom
            size="sm"
            value={config.globalFont || "Inter"}
            ariaLabel="Fonte da vitrine"
            options={FONT_OPTIONS.map((f) => ({ value: f.value, label: f.label }))}
            onChange={acoes.definirFonte}
          />
        </div>
      </Secao>

      <Secao
        titulo="Cores"
        acao={
          <button type="button" className="editor-icon-button is-ghost" title="Combinação aleatória" onClick={acoes.sortearCores}>
            <IconeReset size={13} />
          </button>
        }
      >
        <div className="editor-theme-grid">
          {Object.entries(PRESET_THEMES).map(([key, preset]) => (
            <button
              key={key}
              type="button"
              className={`editor-theme-chip ${currentTheme === key ? "is-active" : ""}`}
              aria-pressed={currentTheme === key}
              onClick={() => acoes.aplicarPreset(key)}
            >
              <span className="editor-theme-dots">
                <i style={{ background: preset.primaryColor }} />
                <i style={{ background: preset.secondaryColor }} />
              </span>
              {THEME_LABELS[key] || key}
            </button>
          ))}
        </div>
        {currentTheme === "PERSONALIZADO" ? (
          <div className="editor-theme-chip is-active is-full">
            <span className="editor-theme-dots">
              <i style={{ background: form.primaryColor }} />
              <i style={{ background: form.secondaryColor }} />
            </span>
            Personalizado
          </div>
        ) : null}

        <div className="editor-field-row">
          <CampoCor label="Primária" value={form.primaryColor} fallback="#6366f1" onChange={(v) => acoes.atualizarCampo("primaryColor", v)} />
          <CampoCor label="Secundária" value={form.secondaryColor} fallback="#d4af37" onChange={(v) => acoes.atualizarCampo("secondaryColor", v)} />
        </div>
      </Secao>

      <Secao titulo="Empresa" aberta={false}>
        <CampoTexto label="Nome" value={tenantName} readOnly />
        <CampoTexto label="WhatsApp" value={form.whatsapp} onChange={(v) => acoes.atualizarCampo("whatsapp", v)} placeholder="5511999999999" />
        <CampoTexto label="E-mail" value={form.email} onChange={(v) => acoes.atualizarCampo("email", v)} placeholder="contato@imobiliaria.com" />
        <CampoTexto label="Slogan" value={form.slogan} onChange={(v) => acoes.atualizarCampo("slogan", v)} placeholder="Alto padrão" />
        <CampoTexto label="Logo (URL)" value={form.logoUrl} onChange={(v) => acoes.atualizarCampo("logoUrl", v)} placeholder="https://…/logo.png" />
      </Secao>

      {ocultos.length || widgetsOcultos.length ? (
        <Secao titulo="Peças ocultas">
          <div className="editor-hidden-list">
            {ocultos.map((key) => (
              <button key={key} type="button" className="editor-hidden-item" onClick={() => acoes.restaurar(`b:${key}`)}>
                <span>{BLOCK_LABELS[key]}</span>
                <IconeReset size={13} />
              </button>
            ))}
            {widgetsOcultos.map((w) => (
              <button key={w.id} type="button" className="editor-hidden-item" onClick={() => acoes.restaurar(`w:${w.id}`)}>
                <span>{(w.title || "Widget").replace(/<[^>]*>/g, "").slice(0, 26)}</span>
                <IconeReset size={13} />
              </button>
            ))}
          </div>
        </Secao>
      ) : null}
    </>
  );
}

/* ── Peça selecionada ──────────────────────────────────────────────────────── */
function PainelDaPeca({ pieceId, config, rect, mode, isLightMode, acoes }) {
  const alvo = parsePieceId(pieceId);
  const ehWidget = alvo?.kind === "widget";
  const widget = ehWidget ? (config.widgets || []).find((w) => w.id === alvo.key) : null;
  const estilo = ehWidget ? null : config.blockStyles[alvo.key] || {};
  const travada = ehWidget ? widget?.locked === true : (config.lockedBlocks || []).includes(alvo.key);
  const temBanner = !ehWidget && typeof estilo.backgroundImage === "string" && estilo.backgroundImage.trim() !== "";

  const corFundoPadrao = isLightMode ? "#f8fafc" : "#1e293b";
  const corTextoPadrao = isLightMode ? "#0f172a" : "#f8fafc";

  if (ehWidget && !widget) return null;

  return (
    <>
      <Secao titulo="Layout">
        <p className="editor-hint">
          Editando o layout <b>{mode === "mobile" ? "mobile" : "desktop"}</b>. O outro modo não é afetado.
        </p>
        <div className="editor-field-row">
          <CampoNumero label="X" sufixo="%" value={rect.x} passo={0.5} min={0} max={100} aoFocar={acoes.registrarHistorico} onChange={(v) => acoes.moverPara({ x: v })} />
          <CampoNumero label="Y" sufixo="px" value={rect.y} passo={4} min={0} aoFocar={acoes.registrarHistorico} onChange={(v) => acoes.moverPara({ y: v })} />
        </div>
        <div className="editor-field-row">
          <CampoNumero label="L" sufixo="%" value={rect.w} passo={0.5} min={10} max={100} aoFocar={acoes.registrarHistorico} onChange={(v) => acoes.redimensionarPara({ w: v })} />
          <CampoNumero label="A" sufixo="px" value={rect.h} passo={8} min={60} aoFocar={acoes.registrarHistorico} onChange={(v) => acoes.redimensionarPara({ h: v })} />
        </div>
      </Secao>

      <Secao titulo="Aparência">
        {ehWidget ? (
          <>
            <CampoCor label="Fundo" value={widget.backgroundColor} fallback={corFundoPadrao} onChange={(v) => acoes.atualizarWidget("backgroundColor", v)} />
            <CampoCor label="Texto" value={widget.color} fallback={corTextoPadrao} onChange={(v) => acoes.atualizarWidget("color", v)} />
            <button type="button" className="editor-button is-quiet" onClick={acoes.limparEstiloWidget}>
              Limpar cores
            </button>
          </>
        ) : (
          <>
            <CampoTexto
              label="Banner (URL da imagem)"
              value={estilo.backgroundImage}
              onChange={(v) => acoes.atualizarEstiloBloco("backgroundImage", v)}
              placeholder="https://imagem.com/foto.jpg"
            />
            <div style={{ opacity: temBanner ? 0.4 : 1, pointerEvents: temBanner ? "none" : "auto" }}>
              <CampoCor
                label={temBanner ? "Fundo (bloqueado pelo banner)" : "Fundo"}
                value={estilo.backgroundColor}
                fallback={corFundoPadrao}
                onChange={(v) => acoes.atualizarEstiloBloco("backgroundColor", v)}
              />
            </div>
            {temBanner ? (
              <>
                <Deslizante
                  label="Escurecer" min={0} max={100}
                  valor={Math.round((estilo.backgroundOverlay || 0) * 100)}
                  onChange={(v) => acoes.atualizarEstiloBloco("backgroundOverlay", v / 100)}
                  formatar={(v) => `${v}%`}
                />
                <Deslizante
                  label="Brilho" min={30} max={200}
                  valor={Math.round((estilo.backgroundBrightness ?? 1) * 100)}
                  onChange={(v) => acoes.atualizarEstiloBloco("backgroundBrightness", v / 100)}
                  formatar={(v) => `${(v / 100).toFixed(1)}×`}
                />
              </>
            ) : null}
            <CampoCor label="Texto" value={estilo.color} fallback={corTextoPadrao} onChange={(v) => acoes.atualizarEstiloBloco("color", v)} />
            <div className="editor-field-row">
              <button type="button" className="editor-button is-quiet" onClick={acoes.copiarEstilo}>Copiar estilo</button>
              {acoes.podeColar ? (
                <button type="button" className="editor-button is-accent" onClick={acoes.colarEstilo}>Colar estilo</button>
              ) : null}
            </div>
            <button type="button" className="editor-button is-quiet" onClick={acoes.limparEstiloBloco}>Limpar estilos</button>
          </>
        )}
      </Secao>

      {!ehWidget && alvo.key === "highlights" ? (
        <Secao titulo="Destaques">
          <button type="button" className="editor-button is-dashed" onClick={acoes.adicionarDestaque}>
            + Adicionar destaque
          </button>
          <div className="editor-sublist">
            {config.highlights.map((item, index) => {
              const hs = config.highlightStyles[index] || {};
              return (
                <div key={`hl-${index}`} className="editor-subitem">
                  <div className="editor-subitem-head">
                    <span dangerouslySetInnerHTML={{ __html: (item.title || "").replace(/<[^>]+>/g, "") }} />
                    <button
                      type="button"
                      className="editor-icon-button is-ghost"
                      disabled={config.highlights.length <= 1}
                      title="Remover destaque"
                      onClick={() => acoes.removerDestaque(index)}
                    >
                      <IconeOlhoCortado size={12} />
                    </button>
                  </div>
                  <div className="editor-field-row">
                    <CampoCor label="Fundo" value={hs.backgroundColor} fallback={corFundoPadrao} onChange={(v) => acoes.atualizarEstiloDestaque(index, "backgroundColor", v)} />
                    <CampoCor label="Texto" value={hs.color} fallback={corTextoPadrao} onChange={(v) => acoes.atualizarEstiloDestaque(index, "color", v)} />
                  </div>
                </div>
              );
            })}
          </div>
        </Secao>
      ) : null}

      {!ehWidget && alvo.key === "properties" ? (
        <Secao titulo="Conteúdo">
          <p className="editor-hint">
            Os imóveis vêm do <b>Portfólio</b>. Só os que estão com status <b>Ativo</b> aparecem na vitrine.
          </p>
        </Secao>
      ) : null}

      {/* Campos que NÃO aparecem como texto na página publicada moram aqui.
          Editá-los na prancheta obrigaria a desenhar, dentro da peça, uma caixa
          de configuração que o visitante nunca vê — foi assim que o CTA acabou
          com um "Configuração do Botão" no editor e um botão redondo no ar. */}
      {ehWidget && widget.type === "cta" ? (
        <Secao titulo="Conteúdo">
          <CampoTexto label="Link do botão" value={widget.ctaUrl} onChange={(v) => acoes.atualizarWidget("ctaUrl", v)} placeholder="https://wa.me/55…" />
          <p className="editor-hint" style={{ margin: 0 }}>O texto do botão é editado direto na página.</p>
        </Secao>
      ) : null}

      {ehWidget && widget.type === "social" ? (
        <Secao titulo="Conteúdo">
          <CampoTexto
            label="Endereços (separados por |)"
            value={widget.content}
            onChange={(v) => acoes.atualizarWidget("content", v)}
            placeholder="https://wa.me/…|https://instagram.com/…"
          />
          <p className="editor-hint" style={{ margin: 0 }}>
            Cada endereço vira um botão. WhatsApp, Instagram e Facebook são reconhecidos pela cor e pelo nome.
          </p>
        </Secao>
      ) : null}

      <Secao titulo="Ações">
        <div className="editor-actions-grid">
          {ehWidget ? (
            <button type="button" className="editor-button" onClick={acoes.duplicar}>
              <IconeDuplicar size={13} /> Duplicar
            </button>
          ) : null}
          <button type="button" className="editor-button" onClick={acoes.alternarTrava}>
            {travada ? <IconeCadeado size={13} /> : <IconeCadeadoAberto size={13} />}
            {travada ? "Destravar" : "Travar"}
          </button>
          <button type="button" className="editor-button is-danger" onClick={acoes.ocultar}>
            <IconeOlhoCortado size={13} /> Ocultar
          </button>
          {ehWidget ? (
            <button type="button" className="editor-button is-danger" onClick={acoes.remover}>
              Excluir
            </button>
          ) : null}
        </div>
      </Secao>
    </>
  );
}

export function BuilderInspector({
  colapsado,
  onAlternarColapso,
  selecionada,
  config,
  form,
  tenantName,
  rect,
  mode,
  isLightMode,
  currentTheme,
  acoes,
}) {
  const titulo = selecionada
    ? (parsePieceId(selecionada)?.kind === "widget"
        ? (config.widgets.find((w) => w.id === parsePieceId(selecionada).key)?.title || "Widget").replace(/<[^>]*>/g, "").slice(0, 28)
        : BLOCK_LABELS[parsePieceId(selecionada)?.key] || "Bloco")
    : "Página";

  if (colapsado) {
    return (
      <aside className="editor-inspector is-collapsed">
        <button type="button" className="editor-inspector-toggle" title="Expandir propriedades" onClick={onAlternarColapso}>
          <IconeSeta size={14} style={{ transform: "rotate(180deg)" }} />
        </button>
        <span className="editor-inspector-vertical">Propriedades</span>
      </aside>
    );
  }

  return (
    <aside className="editor-inspector" data-tour="vitrine-painel">
      <header className="editor-inspector-head">
        <span className="editor-inspector-kicker">{selecionada ? "Peça" : "Documento"}</span>
        <strong className="editor-inspector-title">{titulo}</strong>
        <button type="button" className="editor-inspector-toggle is-inline" title="Recolher propriedades" onClick={onAlternarColapso}>
          <IconeSeta size={14} />
        </button>
      </header>

      <div className="editor-inspector-body">
        {selecionada && rect ? (
          <PainelDaPeca
            pieceId={selecionada}
            config={config}
            rect={rect}
            mode={mode}
            isLightMode={isLightMode}
            acoes={acoes}
          />
        ) : (
          <PainelDaPagina
            form={form}
            config={config}
            tenantName={tenantName}
            isLightMode={isLightMode}
            currentTheme={currentTheme}
            acoes={acoes}
          />
        )}
      </div>
    </aside>
  );
}
