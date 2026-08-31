param()

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "Omnimob - Reverter Zebra V4.1" -ForegroundColor Cyan
Write-Host "-----------------------------" -ForegroundColor DarkGray

$Landing = Join-Path $Root "apps\web\src\pages\OmnimobLandingPage.jsx"
$Growth = Join-Path $Root "apps\web\src\components\LandingGrowthV4.jsx"

if (-not (Test-Path -LiteralPath $Landing)) {
    $candidatos = @(Get-ChildItem -LiteralPath $Root -Filter "OmnimobLandingPage*.jsx" -File -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch "[\\/](node_modules|\.git|dist|build|coverage)[\\/]" })
    $validos = @($candidatos | Where-Object {
        (Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8).Contains("OMNIMOB_LANDING_ZEBRA_V41")
    })
    if ($validos.Count -ne 1) { throw "Nao consegui identificar a landing V4.1 de forma segura." }
    $Landing = $validos[0].FullName
}

if (-not (Test-Path -LiteralPath $Growth)) {
    $candidatos = @(Get-ChildItem -LiteralPath $Root -Filter "LandingGrowthV4.jsx" -File -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch "[\\/](node_modules|\.git|dist|build|coverage)[\\/]" })
    $validos = @($candidatos | Where-Object {
        (Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8).Contains("OMNIMOB_LANDING_ZEBRA_V41")
    })
    if ($validos.Count -ne 1) { throw "Nao consegui identificar LandingGrowthV4.jsx V4.1 de forma segura." }
    $Growth = $validos[0].FullName
}

$PagesDir = Split-Path -Parent $Landing
$GrowthDir = Split-Path -Parent $Growth

$BackLanding = @(Get-ChildItem -LiteralPath $PagesDir -Filter "*.before-zebra-v41.*.bak" -File |
    Where-Object { $_.Name -like "OmnimobLandingPage*" } |
    Sort-Object LastWriteTime -Descending)

$BackGrowth = @(Get-ChildItem -LiteralPath $GrowthDir -Filter "LandingGrowthV4.jsx.before-zebra-v41.*.bak" -File |
    Sort-Object LastWriteTime -Descending)

if ($BackLanding.Count -eq 0 -or $BackGrowth.Count -eq 0) {
    throw "Nao encontrei os dois backups criados pela Zebra V4.1."
}

Copy-Item -LiteralPath $BackLanding[0].FullName -Destination $Landing -Force
Copy-Item -LiteralPath $BackGrowth[0].FullName -Destination $Growth -Force

Write-Host ""
Write-Host "Zebra V4.1 revertida com sucesso." -ForegroundColor Green
