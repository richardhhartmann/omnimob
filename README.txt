OMNIMOB — LANDING ZEBRA V4.1
============================

Objetivo
--------
Corrigir a cadência de fundos depois da Growth V4.

A V4 inseriu duas seções novas:
- "Veja acontecer", depois do Editor;
- "Confiança operacional", antes dos Planos.

As seções antigas mantiveram suas classes de fundo, então duas faixas de mesmo
tom ficaram encostadas. Esta V4.1 desloca o padrão a partir de cada inserção.

Cadência final
--------------
Hero            especial
Números         ALT
Desafio         BASE
Editor          ALT
Veja acontecer  BASE
Recursos        ALT
Integrações     BASE
Módulos         CLARO
Por que         BASE
Confiança       ALT
Planos          BASE
FAQ             ALT
Aplicativo      BASE
CTA final       CLARO

Importante
----------
LandingGrowthV4.jsx deixa de usar seus dois hexes como fonte principal e passa a
ler os próprios tokens da landing:

  var(--bg, #0a0a0b)
  var(--bg-alt, #0d0d10)

Assim o zebrado continua sincronizado se a paleta global mudar no futuro.

Não existe regra diferente para celular. Os mesmos tokens e a mesma alternância
valem em desktop e mobile.

Arquivos alterados
------------------
- apps/web/src/pages/OmnimobLandingPage.jsx
- apps/web/src/components/LandingGrowthV4.jsx

Como aplicar
------------
Extraia tudo na raiz do projeto e execute:

  APLICAR_ZEBRA_V41.cmd

Como desfazer
-------------
Execute:

  REVERTER_ZEBRA_V41.cmd
