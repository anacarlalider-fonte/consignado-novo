@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Subir codigo para GitHub (Render precisa disso)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\subir-github-render.ps1"
echo.
pause
