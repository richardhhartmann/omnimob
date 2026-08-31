param()

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "Omnimob - Landing Zebra V4.1" -ForegroundColor Cyan
Write-Host "----------------------------" -ForegroundColor DarkGray

function Encontrar-ArquivoUnico {
    param(
        [string]$Raiz,
        [string]$Filtro,
        [string]$Preferido,
        [string]$Marcador
    )

    $preferidoPath = Join-Path $Raiz $Preferido
    if (Test-Path -LiteralPath $preferidoPath) {
        return (Resolve-Path -LiteralPath $preferidoPath).Path
    }

    $achados = @(
        Get-ChildItem -LiteralPath $Raiz -Filter $Filtro -File -Recurse -ErrorAction SilentlyContinue |
        Where-Object {
            $_.FullName -notmatch "[\\/](node_modules|\.git|dist|build|coverage)[\\/]"
        }
    )

    if ($Marcador) {
        $achados = @($achados | Where-Object {
            (Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8).Contains($Marcador)
        })
    }

    if ($achados.Count -eq 1) { return $achados[0].FullName }

    if ($achados.Count -eq 0) {
        throw "Nao encontrei $Filtro com a estrutura esperada. Extraia o patch na raiz do projeto."
    }

    Write-Host "Mais de um arquivo candidato encontrado:" -ForegroundColor Yellow
    $achados | ForEach-Object { Write-Host "  $($_.FullName)" }
    throw "Nao vou escolher um arquivo no chute."
}

$Landing = Encontrar-ArquivoUnico `
    -Raiz $Root `
    -Filtro "OmnimobLandingPage*.jsx" `
    -Preferido "apps\web\src\pages\OmnimobLandingPage.jsx" `
    -Marcador "OMNIMOB_LANDING_GROWTH_V4_PRODUCT_START"

$Growth = Encontrar-ArquivoUnico `
    -Raiz $Root `
    -Filtro "LandingGrowthV4.jsx" `
    -Preferido "apps\web\src\components\LandingGrowthV4.jsx" `
    -Marcador "OMNIMOB_LANDING_GROWTH_V4_COMPONENT"

Write-Host "Landing:" -ForegroundColor Green
Write-Host "  $Landing"
Write-Host "Growth V4:" -ForegroundColor Green
Write-Host "  $Growth"

$LandingAtual = Get-Content -LiteralPath $Landing -Raw -Encoding UTF8
$GrowthAtual = Get-Content -LiteralPath $Growth -Raw -Encoding UTF8

if ($LandingAtual.Contains("OMNIMOB_LANDING_ZEBRA_V41") -or
    $GrowthAtual.Contains("OMNIMOB_LANDING_ZEBRA_V41")) {
    Write-Host ""
    Write-Host "A correcao Zebra V4.1 ja esta aplicada. Nada foi alterado." -ForegroundColor Yellow
    exit 0
}

function Trocar-UmaVez {
    param(
        [string]$Texto,
        [string]$De,
        [string]$Para,
        [string]$Nome
    )

    $count = ([regex]::Matches($Texto, [regex]::Escape($De))).Count
    if ($count -ne 1) {
        throw "A ancora '$Nome' deveria aparecer 1 vez, mas apareceu $count."
    }
    return $Texto.Replace($De, $Para)
}

# ── Monta tudo em memória primeiro ──────────────────────────────────────────
$LandingNova = $LandingAtual

$LandingNova = Trocar-UmaVez $LandingNova `
    '<section id="recursos" className="dl-section">' `
    '<section id="recursos" className="dl-section dl-section--alt">' `
    "Recursos"

$LandingNova = Trocar-UmaVez $LandingNova `
    '<section className="dl-section dl-section--alt dl-section--compacto" id="integracoes">' `
    '<section className="dl-section dl-section--compacto" id="integracoes">' `
    "Integracoes"

$LandingNova = Trocar-UmaVez $LandingNova `
    '<section id="planos" className="dl-section dl-section--alt">' `
    '<section id="planos" className="dl-section">' `
    "Planos"

$LandingNova = Trocar-UmaVez $LandingNova `
    '<section id="faq" className="dl-section dl-section--compacto">' `
    '<section id="faq" className="dl-section dl-section--alt dl-section--compacto">' `
    "FAQ"

$LandingNova = Trocar-UmaVez $LandingNova `
    '<section className="dl-section dl-section--alt dl-app-soon" id="aplicativo">' `
    '<section className="dl-section dl-app-soon" id="aplicativo">' `
    "Aplicativo"

$AncoraProduto = '      {/* OMNIMOB_LANDING_GROWTH_V4_PRODUCT_START */}'
$LandingNova = Trocar-UmaVez $LandingNova `
    $AncoraProduto `
    ("      {/* OMNIMOB_LANDING_ZEBRA_V41 */}`n" + $AncoraProduto) `
    "Marcador Zebra"

$GrowthNovo = $GrowthAtual

$GrowthNovo = Trocar-UmaVez $GrowthNovo `
    '  --gv4-bg: #0a0a0b;' `
    '  --gv4-bg: var(--bg, #0a0a0b);' `
    "Token bg V4"

$GrowthNovo = Trocar-UmaVez $GrowthNovo `
    '  --gv4-alt: #0d0d10;' `
    '  --gv4-alt: var(--bg-alt, #0d0d10);' `
    "Token bg-alt V4"

$AncoraCss = '/* OMNIMOB_LANDING_GROWTH_V4_CSS_START */'
$GrowthNovo = Trocar-UmaVez $GrowthNovo `
    $AncoraCss `
    ($AncoraCss + "`n/* OMNIMOB_LANDING_ZEBRA_V41: usa os tokens --bg / --bg-alt da landing. */") `
    "Marcador CSS Zebra"

# ── Validação em memória ───────────────────────────────────────────────────
$EsperadosLanding = @(
    'OMNIMOB_LANDING_ZEBRA_V41',
    '<section id="recursos" className="dl-section dl-section--alt">',
    '<section className="dl-section dl-section--compacto" id="integracoes">',
    '<section id="planos" className="dl-section">',
    '<section id="faq" className="dl-section dl-section--alt dl-section--compacto">',
    '<section className="dl-section dl-app-soon" id="aplicativo">'
)

foreach ($Trecho in $EsperadosLanding) {
    if (-not $LandingNova.Contains($Trecho)) {
        throw "Validacao da landing em memoria falhou. Faltou: $Trecho"
    }
}

$EsperadosGrowth = @(
    'OMNIMOB_LANDING_ZEBRA_V41',
    '--gv4-bg: var(--bg, #0a0a0b);',
    '--gv4-alt: var(--bg-alt, #0d0d10);'
)

foreach ($Trecho in $EsperadosGrowth) {
    if (-not $GrowthNovo.Contains($Trecho)) {
        throw "Validacao do Growth V4 em memoria falhou. Faltou: $Trecho"
    }
}

# ── Só agora cria backup e grava ────────────────────────────────────────────
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupLanding = "$Landing.before-zebra-v41.$Timestamp.bak"
$BackupGrowth = "$Growth.before-zebra-v41.$Timestamp.bak"

Copy-Item -LiteralPath $Landing -Destination $BackupLanding -Force
Copy-Item -LiteralPath $Growth -Destination $BackupGrowth -Force

try {
    [System.IO.File]::WriteAllText(
        $Landing,
        $LandingNova,
        [System.Text.UTF8Encoding]::new($false)
    )

    [System.IO.File]::WriteAllText(
        $Growth,
        $GrowthNovo,
        [System.Text.UTF8Encoding]::new($false)
    )

    $CheckLanding = Get-Content -LiteralPath $Landing -Raw -Encoding UTF8
    $CheckGrowth = Get-Content -LiteralPath $Growth -Raw -Encoding UTF8

    if (([regex]::Matches($CheckLanding, "OMNIMOB_LANDING_ZEBRA_V41")).Count -ne 1) {
        throw "Marcador Zebra V4.1 invalido na landing depois da gravacao."
    }

    if (([regex]::Matches($CheckGrowth, "OMNIMOB_LANDING_ZEBRA_V41")).Count -ne 1) {
        throw "Marcador Zebra V4.1 invalido no componente depois da gravacao."
    }

    Write-Host ""
    Write-Host "Zebrado V4.1 aplicado com sucesso." -ForegroundColor Green
    Write-Host ""
    Write-Host "Cadencia final:" -ForegroundColor Cyan
    Write-Host "  Numeros        ALT"
    Write-Host "  Desafio        BASE"
    Write-Host "  Editor         ALT"
    Write-Host "  Veja acontecer BASE"
    Write-Host "  Recursos       ALT"
    Write-Host "  Integracoes    BASE"
    Write-Host "  Modulos        CLARO"
    Write-Host "  Por que        BASE"
    Write-Host "  Confianca      ALT"
    Write-Host "  Planos         BASE"
    Write-Host "  FAQ            ALT"
    Write-Host "  Aplicativo     BASE"
    Write-Host "  CTA final      CLARO"
    Write-Host ""
    Write-Host "Os mesmos tokens valem para desktop e mobile." -ForegroundColor DarkGray
}
catch {
    Write-Host ""
    Write-Host "Falhou depois do backup. Restaurando os dois arquivos..." -ForegroundColor Yellow
    Copy-Item -LiteralPath $BackupLanding -Destination $Landing -Force
    Copy-Item -LiteralPath $BackupGrowth -Destination $Growth -Force
    throw
}
