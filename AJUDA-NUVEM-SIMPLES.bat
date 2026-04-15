@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Ajuda nuvem - leia o Bloco de Notas primeiro
cls
echo.
echo  ============================================================
echo    PRIMEIRO: LEIA O GUIA NO BLOCO DE NOTAS
echo  ============================================================
echo.
echo  Nao vamos abrir o navegador agora — assim nada cobre o texto.
echo  A janela do Bloco de Notas vai abrir GRANDE em seguida.
echo.
echo  Quando quiser abrir o RENDER (Parte 1 a 3 do guia), volte
echo  para ESTA janela preta e pressione ENTER.
echo.
echo  So depois, outro ENTER abre a VERCEL (Parte 4).
echo.
pause
start "Guia CRM" /max notepad.exe "%~dp0COMO-COLOCAR-NA-INTERNET.txt"
cls
echo.
echo  O guia esta no Bloco de Notas (em cima ou na barra de tarefas).
echo.
echo  --- Quando quiser abrir o site do RENDER, pressione ENTER ---
echo  (Se ainda estiver lendo, nao pressione — pode demorar o quanto quiser.)
echo.
pause >nul
start "" "https://dashboard.render.com"
cls
echo.
echo  Render aberto no navegador. Volte ao guia no Bloco de Notas.
echo.
echo  --- Quando for a hora da VERCEL (Parte 4), pressione ENTER ---
echo  (Se ainda nao chegou na Parte 4, nao pressione.)
echo.
pause >nul
start "" "https://vercel.com/dashboard"
cls
echo.
echo  Vercel aberta no navegador.
echo  Feche esta janela quando quiser.
echo.
pause
