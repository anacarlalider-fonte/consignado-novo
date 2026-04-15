#Requires -Version 5.1
# Assistente de deploy: prepara Git, gera segredos e mostra os passos para Vercel + Render.
# Não substitui login no site da Vercel/Render (ninguém pode fazer isso por você).

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

Write-Host ""
Write-Host "  CRM Consignado — publicar na nuvem" -ForegroundColor Cyan
Write-Host ""

# --- JWT para colar no Render ---
$bytes1 = New-Object byte[] 48
$bytes2 = New-Object byte[] 48
$rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
$rng.GetBytes($bytes1)
$rng.GetBytes($bytes2)
$rng.Dispose()
$jwtSecret = [Convert]::ToBase64String($bytes1).TrimEnd("=").Replace("+", "").Replace("/", "")
$jwtRefresh = [Convert]::ToBase64String($bytes2).TrimEnd("=").Replace("+", "").Replace("/", "")

Write-Host "Segredos gerados (guarde em lugar seguro; cole no Render nas variáveis JWT):" -ForegroundColor Yellow
Write-Host ""
Write-Host "JWT_SECRET=$jwtSecret"
Write-Host "JWT_REFRESH_SECRET=$jwtRefresh"
Write-Host ""

# --- Git: primeiro commit se necessário ---
if (-not (Test-Path (Join-Path $root ".git"))) {
  Write-Host "Inicializando repositório Git..." -ForegroundColor Green
  git init
  if (-not (git config user.email 2>$null)) {
    git config user.email "crm@local.deploy"
    git config user.name "CRM Deploy"
  }
}

$hasCommit = $false
try {
  git rev-parse HEAD 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { $hasCommit = $true }
} catch { }

if (-not $hasCommit) {
  Write-Host "Criando primeiro commit (tudo que não está no .gitignore)..." -ForegroundColor Green
  git add -A
  git status -s
  git commit -m "CRM Consignado: código pronto para Vercel + Render"
  Write-Host "Commit criado." -ForegroundColor Green
} else {
  Write-Host "Git já tem histórico. Para enviar: git push" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "========== O que você faz agora (uns 10–15 min) ==========" -ForegroundColor Cyan
Write-Host ""
Write-Host "1) GitHub — crie um repositório VAZIO (sem README)."
Write-Host "   Depois, nesta pasta, rode (troque a URL):"
Write-Host ""
Write-Host '   git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git' -ForegroundColor White
Write-Host '   git branch -M main' -ForegroundColor White
Write-Host '   git push -u origin main' -ForegroundColor White
Write-Host ""
Write-Host "2) Render — https://dashboard.render.com"
Write-Host "   New → Blueprint → conecte o GitHub → escolha este repo → use o render.yaml da raiz."
Write-Host "   No painel, defina manualmente: JWT_SECRET, JWT_REFRESH_SECRET, CORS_ORIGINS"
Write-Host "   (use os valores JWT gerados acima; CORS_ORIGINS = URL do site na Vercel, ex.: https://xxx.vercel.app)"
Write-Host "   Depois do primeiro deploy: Shell do serviço → npx prisma db seed"
Write-Host ""
Write-Host "3) Vercel — https://vercel.com/new"
Write-Host "   Importe o MESMO repositório, Root Directory = frontend"
Write-Host "   Variáveis (Production):"
Write-Host "   VITE_API_BASE_URL = https://SUA-API.onrender.com/api"
Write-Host "   VITE_AUTH_ENABLED = true"
Write-Host ""
Write-Host "4) Volte no Render e atualize CORS_ORIGINS com a URL final do Vercel; redeploy da API se precisar."
Write-Host ""
Write-Host "Guia detalhado: DEPLOY.md na raiz do projeto."
Write-Host ""

$open = Read-Host "Abrir DEPLOY.md no Bloco de notas? (S/N)"
if ($open -eq "S" -or $open -eq "s") {
  notepad.exe (Join-Path $root "DEPLOY.md")
}
