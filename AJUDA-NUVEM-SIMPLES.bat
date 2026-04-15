@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  Abrindo o guia simples e os sites que voce vai usar...
echo.
start "" notepad.exe "%~dp0COMO-COLOCAR-NA-INTERNET.txt"
timeout /t 2 /nobreak >nul
start "" "https://dashboard.render.com"
start "" "https://vercel.com/dashboard"
echo.
echo  Leia o arquivo COMO-COLOCAR-NA-INTERNET.txt no Bloco de Notas.
echo  Comece pela PARTE 1 (Render). O site da Vercel ja abriu para depois.
echo.
pause
