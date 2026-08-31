@echo off
chcp 65001 >nul
title Omnimob - Aplicar Zebra V4.1
echo.
echo Omnimob - Landing Zebra V4.1
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0aplicar_zebra_v41.ps1"
if errorlevel 1 (
  echo.
  echo O patch encontrou um erro. Nenhuma alteracao parcial sera mantida.
  pause
  exit /b 1
)
echo.
pause
