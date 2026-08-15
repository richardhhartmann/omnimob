import { CATEGORIAS, widgetsDaCategoria } from "../data/biblioteca";
import { TemplateThumb } from "../data/templates";
import {
  IconeCadeado,
  IconeCadeadoAberto,
  IconeCamadas,
  IconeGrade,
  IconeMais,
  IconeOlho,
  IconeOlhoCortado,
  IconeSeta,
} from "../iconesEditor";

/* ────────────────────────────────────────────────────────────────────────────
   Painel esquerdo — "o que eu posso pôr na página".

   Três abas, na ordem em que alguém realmente monta uma vitrine: primeiro
   escolhe um ponto de partida (Templates), depois acrescenta peças (Adicionar)
   e por fim organiza o que já existe (Camadas).

   O FAB redondo de widgets que flutuava sobre o canvas saiu. Ele escondia a
   biblioteca atrás de um clique e de uma animação, tapava o canto inferior
   direito da página justamente onde o rodapé é editado, e não tinha onde
   crescer: dez tipos já enchiam o menu. Aqui a biblioteca é uma coluna com
   cabeçalhos, e cabe o dobro sem virar rolagem infinita.

   Recolhido, vira uma tira de ícones — em notebook de 1366px o canvas precisa
   dos 240px de volta.
   ──────────────────────────────────────────────────────────────────────────── */

const ABAS = [
  { id: "adicionar", rotulo: "Adicionar", Icone: IconeMais },
  { id: "camadas", rotulo: "Camadas", Icone: IconeCamadas },
  { id: "templates", rotulo: "Templates", Icone: IconeGrade },
];

export function BuilderLeftRail({
  aba,
  onAba,
  colapsado,
  onAlternarColapso,
  onAdicionarWidget,
  onArrastarWidget,
  camadas,
  selecionada,
  onSelecionarCamada,
  onAlternarVisibilidade,
  onAlternarTrava,
  templates,
  onAplicarTemplate,
}) {
  return (
    <aside className={`editor-rail ${colapsado ? "is-collapsed" : ""}`} data-tour="vitrine-biblioteca">
      <nav className="editor-rail-tabs" aria-label="Ferramentas do construtor">
        {ABAS.map(({ id, rotulo, Icone }) => (
          <button
            key={id}
            type="button"
            className={`editor-rail-tab ${aba === id && !colapsado ? "is-active" : ""}`}
            title={rotulo}
            aria-pressed={aba === id && !colapsado}
            onClick={() => {
              if (colapsado) onAlternarColapso();
              onAba(id);
            }}
          >
            <Icone size={16} />
            {!colapsado ? <span>{rotulo}</span> : null}
          </button>
        ))}
        <button
          type="button"
          className="editor-rail-toggle"
          title={colapsado ? "Expandir painel" : "Recolher painel"}
          onClick={onAlternarColapso}
        >
          <IconeSeta size={14} style={{ transform: colapsado ? "none" : "rotate(180deg)" }} />
        </button>
      </nav>

      {colapsado ? null : (
        <div className="editor-rail-body">
          {aba === "adicionar" ? (
            <div className="editor-lib">
              <p className="editor-hint">Clique para adicionar ao fim da página, ou arraste para soltar num ponto exato.</p>
              {CATEGORIAS.map((cat) => (
                <section key={cat.id} className="editor-section">
                  <h3 className="editor-section-title">{cat.titulo}</h3>
                  <div className="editor-lib-grid">
                    {widgetsDaCategoria(cat.id).map((template) => (
                      <button
                        key={template.type}
                        type="button"
                        className="editor-lib-card"
                        onClick={() => onAdicionarWidget(template)}
                        onPointerDown={(e) => onArrastarWidget(template, e)}
                        title={`Adicionar ${template.nome}`}
                      >
                        <span className="editor-lib-preview">{template.preview}</span>
                        <span className="editor-lib-nome">{template.nome}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : null}

          {aba === "camadas" ? (
            <div className="editor-layers">
              <p className="editor-hint">A ordem segue a página, de cima para baixo.</p>
              {camadas.map((camada) => (
                <div
                  key={camada.pieceId}
                  className={`editor-layer ${selecionada === camada.pieceId ? "is-active" : ""} ${camada.oculta ? "is-hidden" : ""}`}
                >
                  <button
                    type="button"
                    className="editor-layer-nome"
                    onClick={() => onSelecionarCamada(camada.pieceId)}
                    disabled={camada.oculta}
                  >
                    <span className={`editor-layer-tipo ${camada.kind === "widget" ? "is-widget" : ""}`} aria-hidden />
                    <span>{camada.rotulo}</span>
                  </button>
                  <button
                    type="button"
                    className="editor-icon-button is-ghost"
                    title={camada.travada ? "Destravar" : "Travar posição"}
                    onClick={() => onAlternarTrava(camada.pieceId)}
                  >
                    {camada.travada ? <IconeCadeado size={13} /> : <IconeCadeadoAberto size={13} />}
                  </button>
                  <button
                    type="button"
                    className="editor-icon-button is-ghost"
                    title={camada.oculta ? "Mostrar" : "Ocultar"}
                    onClick={() => onAlternarVisibilidade(camada.pieceId)}
                  >
                    {camada.oculta ? <IconeOlhoCortado size={13} /> : <IconeOlho size={13} />}
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {aba === "templates" ? (
            <div className="editor-templates">
              <p className="editor-hint">
                Troca estrutura, cores e fonte de uma vez. Seus textos (títulos, destaques e rodapé) são preservados.
              </p>
              <div className="editor-template-grid">
                {templates.map((tpl) => (
                  <button key={tpl.id} type="button" className="editor-template-card" onClick={() => onAplicarTemplate(tpl)}>
                    <TemplateThumb tpl={tpl} />
                    <span className="editor-template-nome">{tpl.name}</span>
                    <span className="editor-template-desc">{tpl.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </aside>
  );
}
