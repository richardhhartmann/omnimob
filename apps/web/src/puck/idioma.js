/* ────────────────────────────────────────────────────────────────────────────
   O EDITOR EM PORTUGUÊS.

   O Puck aceita um dicionário, e é por ele que a interface fala a língua do
   resto do produto. Sem isto o editor de vitrine era a única tela da Omnimob
   com "Blocks", "Outline", "Publish" e "Toggle left sidebar" — e a régua deste
   repositório é que TUDO que o cliente lê é em português.

   As chaves são as do `defaultDictionary` do Puck; o que não estiver aqui cai no
   inglês original. `{title}`, `{index}`, `{zoom}` e `{label}` são substituições
   que a biblioteca faz — precisam sobreviver à tradução.

   ── DUAS ESCOLHAS DE VOCABULÁRIO ──

   "Blocks" virou **Peças**, e não "Blocos". Peça é a palavra que este projeto
   já usa em toda parte — no editor antigo, na engine, nos comentários — e
   introduzir um segundo nome para a mesma coisa é como a equipe passa a não
   saber se bloco e peça são diferentes.

   "Outline" virou **Estrutura**, e não "Contorno" nem "Esboço": ali é a árvore
   da página, e é assim que quem monta a página a chama.
   ──────────────────────────────────────────────────────────────────────────── */

export const DICIONARIO_PT = {
  "header-publish": "Publicar",
  "header-undo": "desfazer",
  "header-redo": "refazer",
  "header-toggle-leftsidebar": "Mostrar ou esconder o painel da esquerda",
  "header-toggle-rightsidebar": "Mostrar ou esconder o painel da direita",
  "header-toggle-menubar": "Mostrar ou esconder a barra de menu",

  "action-selectparent": "Selecionar a peça de fora",
  "action-duplicate": "Duplicar",
  "action-delete": "Excluir",

  "label-page": "Página",
  "label-component": "Peça",

  "outline-empty": "Nada aqui ainda",
  "outline-item-collapse": "Recolher",
  "outline-item-expand": "Expandir",
  "outline-header-title": "Estrutura",
  "outline-header-collapseall": "Recolher tudo",
  "outline-item-duplicate": "Duplicar",
  "outline-item-delete": "Excluir",

  "drawer-category-collapse": "Recolher {title}",
  "drawer-category-expand": "Expandir {title}",
  "drawer-category-other": "Outros",

  "canvas-noconfig": "Sem configuração para {type}",

  "field-readonly": "Somente leitura",
  "field-arrayitem-summary": "Item #{index}",
  "field-arrayitem-duplicate": "Duplicar",
  "field-arrayitem-delete": "Excluir",
  "field-external-selectdata": "Escolher dados",
  "field-external-search": "Buscar",
  "field-external-togglefilters": "Mostrar ou esconder os filtros",
  "field-external-item": "Item externo",
  "field-external-result-singular": "{count} resultado",
  "field-external-result-plural": "{count} resultados",

  "field-richtext-bold": "Negrito",
  "field-richtext-italic": "Itálico",
  "field-richtext-underline": "Sublinhado",
  "field-richtext-strikethrough": "Riscado",
  "field-richtext-blockquote": "Citação",
  "field-richtext-code-inline": "Código na linha",
  "field-richtext-code-block": "Bloco de código",
  "field-richtext-list-bullet": "Lista com marcadores",
  "field-richtext-list-ordered": "Lista numerada",
  "field-richtext-horizontalrule": "Linha divisória",
  "field-richtext-align-left": "Alinhar à esquerda",
  "field-richtext-align-center": "Centralizar",
  "field-richtext-align-right": "Alinhar à direita",
  "field-richtext-align-justify": "Justificar",
  "field-richtext-select": "Selecionar",
  "field-richtext-headingselect-1": "Título 1",
  "field-richtext-headingselect-2": "Título 2",
  "field-richtext-headingselect-3": "Título 3",
  "field-richtext-headingselect-4": "Título 4",
  "field-richtext-headingselect-5": "Título 5",
  "field-richtext-headingselect-6": "Título 6",
  "field-richtext-alignselect-left": "Esquerda",
  "field-richtext-alignselect-center": "Centro",
  "field-richtext-alignselect-right": "Direita",
  "field-richtext-alignselect-justify": "Justificado",
  "field-richtext-listselect-bullet": "Com marcadores",
  "field-richtext-listselect-ordered": "Numerada",

  "viewport-zoom-in": "Aproximar",
  "viewport-zoom-out": "Afastar",
  "viewport-zoom-auto": "{zoom}% (automático)",
  "viewport-toggle-menu": "Mostrar ou esconder os tamanhos de tela",
  "viewport-switch": "Ver em {label}",
  "viewport-switch-default": "Trocar o tamanho da tela",

  "plugin-blocks": "Peças",
  "plugin-outline": "Estrutura",
  "plugin-fields": "Ajustes",
  "plugin-components": "Peças",

  "layout-maximize": "ampliar",
  "layout-minimize": "reduzir",
  "loader-loading": "carregando",
};
