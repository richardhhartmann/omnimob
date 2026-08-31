@echo off
chcp 65001 >nul
title Omnimob - Reverter Zebra V4.1
echo.
echo Omnimob - Reverter Zebra V4.1
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0reverter_zebra_v41.ps1"
if errorlevel 1 (
  echo.
  echo O reversor encontrou um erro.
  pause
  exit /b 1
)
echo.
pause
