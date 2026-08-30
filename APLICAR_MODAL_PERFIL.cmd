@echo off
setlocal
cd /d "%~dp0"

echo.
echo Omnimob - Modernizacao dos modais de perfil
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0aplicar_modal_perfil_moderno.ps1" -Root "%CD%"

echo.
pause
