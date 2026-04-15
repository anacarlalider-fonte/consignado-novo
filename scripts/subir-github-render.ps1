#Requires -Version 5.1
# Envia o código do PC para o GitHub (o Render só implanta se o repo tiver arquivos).
# Repositório usado no projeto: anacarlalider-fonte/consignado-novo

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$originUrl = "https://github.com/anacarlalider-fonte/consignado-novo.git"

Write-Host ""
Write-Host "  Enviando código para o GitHub..." -ForegroundColor Cyan
Write-Host "  Repo: $originUrl" -ForegroundColor DarkGray
Write-Host ""

$remotes = git remote 2>$null
if ($remotes -match "origin") {
  git remote set-url origin $originUrl
  Write-Host "  Remote 'origin' atualizado." -ForegroundColor Green
} else {
  git remote add origin $originUrl
  Write-Host "  Remote 'origin' criado." -ForegroundColor Green
}

# Garante commit local
$dirty = git status --porcelain
if ($dirty) {
  Write-Host "  Há alterações novas — criando commit..." -ForegroundColor Yellow
  git add -A
  git commit -m "Deploy: Dockerfile backend + ajustes para Render"
}

# Render na sua conta mostrava branch "principal" — enviamos master para lá e também para main
Write-Host ""
Write-Host "  Fazendo push (o Git pode pedir login no navegador ou usuário/senha)..." -ForegroundColor Yellow
Write-Host ""

# Render costuma usar 'main'; antes enviávamos só 'principal' — enviamos as duas.
$ok = $false
git push -u origin master:main 2>&1 | Out-Host
if ($LASTEXITCODE -eq 0) { $ok = $true; Write-Host "  OK: branch 'main' (padrão do Render)." -ForegroundColor Green }

git push origin master:principal 2>&1 | Out-Host
if ($LASTEXITCODE -eq 0) { Write-Host "  OK: branch 'principal' também atualizada." -ForegroundColor Green }

if (-not $ok) {
  Write-Host ""
  Write-Host "  Push falhou. Tente manualmente:" -ForegroundColor Red
  Write-Host "    git push -u origin master:main" -ForegroundColor White
  exit 1
}

Write-Host ""
Write-Host "  Próximo passo: no Render → consignado-novo → Implantação manual → Deploy." -ForegroundColor Cyan
Write-Host ""
