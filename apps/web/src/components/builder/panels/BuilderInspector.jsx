import { useState } from "react";
import { FONTES_REAIS } from "../data/fontesReais.js";
import { IconeLua, IconeSol } from "../../Icones.jsx";
import { SelectCustom } from "../../SelectCustom";
import { FONT_OPTIONS, PRESET_THEMES, THEME_LABELS } from "../data/temas";
import { BLOCK_LABELS, parsePieceId } from "../../showcase/engine/pieces.js";
import {
  conteudoEhJson,
  DADOS_BUSCA_PADRAO,
  DADOS_EQUIPE_PADRAO,
  DADOS_FAQ_PADRAO,
  DADOS_FINANCIAMENTO_PADRAO,
  DADOS_PASSOS_PADRAO,
  DADOS_REGIOES_PADRAO,
  itensParaLinhas,
  lerDadosWidget,
  linhasParaItens,
  listaParaTexto,
  serializarDadosWidget,
  somenteTexto,
  textoParaLista,
} from "../../showcase/widgets/widgetData.js";
import {
  IconeCadeado,
  IconeCadeadoAberto,
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

function CampoArea({ label, value, onChange, placeholder, rows = 4 }) {
  return (
    <label className="editor-field">
      <span className="editor-field-label">{label}</span>
      <textarea
        className="editor-input editor-textarea"
        value={value || ""}
        rows={rows}
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

/* ── SEM COR ESCOLHIDA NÃO É UMA COR ─────────────────────────────────────────

   O campo pintava o `fallback` (branco no tema escuro) e ficava indistinguível
   de alguém ter ESCOLHIDO branco. Só que ninguém escolheu: sem valor, quem
   pinta é a folha de estilo — e ela usa tons diferentes para cada elemento (o
   título de um destaque sai em `--text-main`, a descrição em `--text-muted`).
   O resultado era o campo anunciando branco ao lado de um texto cinza.

   Agora o estado "não escolhido" tem aparência própria: um xadrez discreto com
   a palavra `auto`. O `<input>` continua carregando o fallback porque ele
   PRECISA de uma cor concreta para abrir o seletor do sistema — mas a caixa
   não afirma mais que aquela é a cor em uso.

   Quem escolhe uma cor vê a cor. Quem não escolheu vê que não escolheu. */
function CampoCor({ label, value, fallback, onChange }) {
  const escolhida = Boolean(value);
  return (
    <label className="editor-field">
      <span className="editor-field-label">{label}</span>
      <span
        className={`editor-color${escolhida ? "" : " is-auto"}`}
        style={escolhida ? { background: value } : undefined}
        title={escolhida ? value : "Sem cor definida — quem pinta é o tema da vitrine"}
      >
        {escolhida ? null : <em>auto</em>}
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

        {/* ── As cores da VITRINE, separadas das do painel ────────────────────
            Eram a mesma coisa: `tenant.primaryColor` pintava a ferramenta de
            trabalho da equipe E a página que o cliente da imobiliária vê. As
            duas respondem a perguntas diferentes — conforto de quem opera oito
            horas por dia, e marca de quem vende.

            Herdar continua sendo o padrão, para a vitrine de quem já existia
            não mudar de cor num deploy. Desmarcar revela as cores próprias, que
            ficam guardadas mesmo enquanto a herança está ligada: religar e
            desligar não perde a escolha. */}
        <label className="editor-fonte">
          <input
            type="checkbox"
            checked={config.herdarCoresDoPainel !== false}
            onChange={(e) => acoes.atualizarConfigDireto("herdarCoresDoPainel", e.target.checked)}
          />
          <span className="editor-fonte__texto">
            <strong>Usar as cores do painel</strong>
            <span>As mesmas de Configurações › Aparência. Desmarque para dar cores próprias à vitrine.</span>
          </span>
        </label>

        {config.herdarCoresDoPainel === false ? (
          <div className="editor-field-row">
            <CampoCor
              label="Primária"
              value={config.corPrimaria || form.primaryColor}
              fallback="#6366f1"
              onChange={(v) => acoes.atualizarConfigDireto("corPrimaria", v)}
            />
            <CampoCor
              label="Secundária"
              value={config.corSecundaria || form.secondaryColor}
              fallback="#d4af37"
              onChange={(v) => acoes.atualizarConfigDireto("corSecundaria", v)}
            />
          </div>
        ) : null}

        {/* Mesma ideia para claro/escuro, mas DESLIGADO por omissão: a vitrine
            sempre teve o próprio modo, e herdar por padrão mudaria a página
            publicada de quem nunca pediu. */}
        <label className="editor-fonte">
          <input
            type="checkbox"
            checked={config.herdarTemaDoPainel === true}
            onChange={(e) => acoes.atualizarConfigDireto("herdarTemaDoPainel", e.target.checked)}
          />
          <span className="editor-fonte__texto">
            <strong>Seguir o tema do painel</strong>
            <span>Claro ou escuro conforme o painel. Desmarcado, a vitrine tem o modo escolhido acima.</span>
          </span>
        </label>
      </Secao>

      {/* ── Os dados da imobiliária NÃO se editam aqui ────────────────────────
          Havia uma seção "Empresa" com WhatsApp, e-mail, slogan e logo, e ela
          era um segundo lugar para a mesma verdade. Os mesmos campos existem em
          Configurações › Perfil, e nada garantia que as duas telas
          concordassem: o WhatsApp trocado no editor divergia do que a página do
          imóvel, o feed dos portais e o widget de equipe continuavam usando.

          Identidade da imobiliária é cadastro, não desenho de página. Este
          painel edita a VITRINE; o que a vitrine mostra sobre a empresa vem de
          um lugar só.

          O atalho abaixo existe para a pessoa não ter de descobrir sozinha para
          onde foram os campos. */}
      <Secao titulo="Dados da imobiliária" aberta={false}>
        <p className="editor-hint" style={{ margin: 0 }}>
          Nome, WhatsApp, e-mail, slogan, logo, CRECI e endereço vêm do cadastro da imobiliária —
          a vitrine, a página do imóvel e os portais leem todos do mesmo lugar.
        </p>
        <a
          className="editor-button"
          href="/configuracoes?ver=perfil"
          target="_blank"
          rel="noreferrer"
          style={{ textDecoration: "none", justifyContent: "center" }}
        >
          Abrir Configurações › Perfil
        </a>
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

function salvarDadosWidget(widget, acoes, fallback, proximo, tituloAoMigrar = "") {
  if (tituloAoMigrar && !conteudoEhJson(widget.content)) acoes.atualizarWidget("title", tituloAoMigrar);
  const atual = lerDadosWidget(widget.content, fallback);
  const dados = typeof proximo === "function" ? proximo(atual) : proximo;
  acoes.atualizarWidget("content", serializarDadosWidget(dados));
}


function PainelFonteDeDados({ widget, acoes }) {
  const fonte = FONTES_REAIS[widget.type];
  if (!fonte) return null;

  // Ausente conta como ligado — ver `normalizeShowcaseConfig`.
  const ligado = widget.usarDadosReais !== false;

  return (
    <Secao titulo="Fonte do conteúdo">
      <label className="editor-fonte">
        <input
          type="checkbox"
          checked={ligado}
          /* Ligar GRAVA `undefined`, não `true`: a ausência é o padrão, e
             marcar `true` em toda peça diria que a escolha foi feita quando
             ninguém escolheu nada. */
          onChange={(e) => acoes.atualizarWidget("usarDadosReais", e.target.checked ? undefined : false)}
        />
        <span className="editor-fonte__texto">
          <strong>{fonte.rotulo}</strong>
          <span>{fonte.explica}</span>
        </span>
      </label>
      <p className="editor-hint" style={{ margin: 0 }}>
        {ligado
          ? `Vem de ${fonte.onde} e se atualiza sozinho. Desligue para escrever à mão.`
          : "Você está escrevendo à mão. Ligue para usar os dados do sistema."}
      </p>
    </Secao>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   NÃO EXISTE MAIS UM PAINEL DE CONTEÚDO AQUI.

   Havia um, e ele desenhava caixas de texto para o que a peça já mostrava na
   folha: os corretores da Equipe (numa lista `Nome :: cargo :: CRECI`), as
   perguntas do FAQ, as etapas do "Como funciona", as opções da Busca, as
   regiões, o aviso legal do Financiamento.

   Todos foram para DENTRO do widget, onde a coisa aparece. O que a caixa do
   inspetor fazia era pedir que a pessoa escrevesse num formato inventado e
   depois procurasse na folha o que tinha mudado — duas telas, e um formato a
   decorar, para editar uma frase.

   O inspetor ficou com o que ele sempre deveria ter tido: LAYOUT, APARÊNCIA e
   AÇÕES. Ação é endereço de destino (o WhatsApp do botão, os links das redes):
   não aparece como texto na página publicada, então desenhá-lo no canvas
   mostraria algo que a vitrine não tem.

   Se você veio aqui para acrescentar um campo de conteúdo: ele não vai neste
   arquivo. Vai no widget, com `ShowcaseTexto` e o caminho
   `widget|<id>|dados|<campo>` — ver `FaqWidget` ou `StepsWidget`.
   ──────────────────────────────────────────────────────────────────────────── */


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
            {/* O aviso de "alguns destaques têm cor própria" saiu junto com a
                seção que os editava: sem campo por destaque, ele apontaria para
                um lugar que não existe mais. Quem tem cor gravada de antes
                continua com ela, e "Limpar estilos" resolve. */}
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

      {/* ── A SEÇÃO "DESTAQUES" SAIU DAQUI ──────────────────────────────────
          Era uma lista de cartõezinhos com "Fundo" e "Texto" por destaque, mais
          o botão de acrescentar. Ela repetia na mesma tela os cartões que já
          estavam na folha — e a cor de cada um, aplicada por estilo inline,
          vencia em silêncio a cor do bloco em Aparência: escolher uma cor lá
          não fazia nada, e nada dizia por quê.

          Acrescentar, remover e escrever acontecem agora no próprio bloco, na
          folha, com a mesma gramática das etapas de "Como funciona". A cor por
          destaque deixou de ter campo; quem tiver uma gravada de antes continua
          com ela, e "Limpar estilos" é a saída. */}

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

      {/* Os endereços das redes saíram daqui: eram UMA caixa com os três
          separados por `|`, formato que ninguém adivinha e que quebra com um
          separador esquecido. Agora cada um é um campo dentro do próprio
          widget, ao lado do botão que ele vira. Ver `SocialWidget`. */}

      {ehWidget ? <PainelFonteDeDados widget={widget} acoes={acoes} /> : null}


      <Secao titulo="Ações">
        <div className="editor-actions-grid">
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
