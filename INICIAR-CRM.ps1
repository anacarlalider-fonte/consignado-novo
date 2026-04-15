# Duplo-clique em INICIAR-CRM.bat para usar. Nao precisa saber programacao.
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Set-Location $root

# PATH completo (atalhos as vezes nao carregam o Docker)
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
foreach ($dockerBin in @(
    "${env:ProgramFiles}\Docker\Docker\resources\bin",
    "${env:ProgramFiles}\Docker\Docker\resources"
  )) {
  if (Test-Path $dockerBin) { $env:Path = "$dockerBin;$env:Path" }
}

function Test-DockerReady {
  docker info 2>$null | Out-Null
  return $LASTEXITCODE -eq 0
}

function Start-DockerDesktop {
  $paths = @(
    "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe",
    "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe"
  )
  foreach ($p in $paths) {
    if (Test-Path $p) {
      Start-Process $p
      return $true
    }
  }
  return $false
}

Write-Host ""
Write-Host "  RealSynk Consignado - Iniciando" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Host "Docker nao foi encontrado." -ForegroundColor Red
  Write-Host "Instale o Docker Desktop: https://www.docker.com/products/docker-desktop/"
  Read-Host "Pressione Enter para fechar"
  exit 1
}

if (-not (Test-DockerReady)) {
  Write-Host "Abrindo o Docker Desktop (espere o icone da baleia ficar verde)..."
  if (-not (Start-DockerDesktop)) {
    Write-Host "Nao achei o Docker Desktop automaticamente."
    Write-Host "Abra o Docker pelo Menu Iniciar e execute este arquivo de novo."
    Read-Host "Pressione Enter para fechar"
    exit 1
  }
  Write-Host "Aguardando o Docker ficar pronto (ate 3 minutos)..."
  $deadline = (Get-Date).AddMinutes(3)
  while (-not (Test-DockerReady)) {
    if ((Get-Date) -gt $deadline) {
      Write-Host "Demorou demais. Abra o Docker Desktop e tente de novo."
      Read-Host "Pressione Enter para fechar"
      exit 1
    }
    Start-Sleep -Seconds 3
  }
}

Write-Host "Ligando o banco de dados (PostgreSQL)..."
Set-Location $root
function Invoke-DockerComposeUp {
  # Via cmd: o PowerShell nao trata mensagens do Docker no stderr como erro fatal
  cmd /c "cd /d `"$root`" && docker compose up -d"
  if ($LASTEXITCODE -eq 0) { return $true }
  cmd /c "cd /d `"$root`" && docker-compose up -d"
  if ($LASTEXITCODE -eq 0) { return $true }
  foreach ($p in @(
      "${env:ProgramFiles}\Docker\Docker\resources\bin\docker-compose.exe",
      "${env:ProgramFiles}\Docker\Docker\resources\bin\docker-compose"
    )) {
    if (Test-Path $p) {
      cmd /c "cd /d `"$root`" && `"$p`" up -d"
      if ($LASTEXITCODE -eq 0) { return $true }
    }
  }
  return $false
}
if (-not (Invoke-DockerComposeUp)) {
  Write-Host "Nao consegui subir o banco. Atualize o Docker Desktop ou use o terminal integrado do Docker." -ForegroundColor Red
  Read-Host "Pressione Enter para fechar"
  exit 1
}

Write-Host "Aguardando o banco aceitar conexao..."
$ok = $false
for ($i = 0; $i -lt 60; $i++) {
  try {
    $c = Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue
    if ($c.TcpTestSucceeded) { $ok = $true; break }
  } catch { }
  Start-Sleep -Seconds 2
}
if (-not $ok) {
  Write-Host "O banco nao respondeu. Veja se o Docker esta rodando."
  Read-Host "Pressione Enter para fechar"
  exit 1
}

if (-not (Test-Path "$root\backend\.env")) {
  Copy-Item "$root\backend\.env.example" "$root\backend\.env" -Force
}

Set-Location "$root\backend"
npx prisma generate 2>$null | Out-Null

if (Test-Path "prisma\migrations") {
  npx prisma migrate deploy
} else {
  npx prisma migrate dev --name init --skip-seed
}
if ($LASTEXITCODE -ne 0) {
  Read-Host "Erro na configuracao do banco. Pressione Enter para fechar"
  exit $LASTEXITCODE
}

Write-Host "Colocando usuario de teste no banco..."
npm run prisma:seed
if ($LASTEXITCODE -ne 0) {
  Read-Host "Erro no seed. Pressione Enter para fechar"
  exit $LASTEXITCODE
}

Write-Host "Abrindo o servidor do programa (duas janelas pretas - deixe abertas)..."
Start-Process cmd -ArgumentList "/k", "cd /d `"$root\backend`" && title RealSynk API && npm run dev"
Start-Sleep -Seconds 2
Start-Process cmd -ArgumentList "/k", "cd /d `"$root\frontend`" && title RealSynk Site && npm run dev"

Write-Host ""
Write-Host "  Pronto." -ForegroundColor Green
Write-Host ""
Write-Host "  Neste PC:  http://localhost:5173"
Write-Host "  Na rede (celular/outro PC): use o IP deste computador, ex.: http://192.168.x.x:5173"
Write-Host "             (o Vite mostra 'Network' na janela RealSynk Site — copie esse endereco)."
Write-Host "  API: porta 3001 — se o Windows pedir, libere no Firewall para rede privada."
Write-Host ""
Write-Host "  Login API (AUTH_ENABLED=true):  admin@kato.com  /  Admin@123"
Write-Host "  Modo local (padrao): CRM abre direto; dados no navegador (localStorage)."
Write-Host ""
Write-Host "  Nao feche as duas janelas pretas enquanto usar o CRM."
Write-Host ""
Read-Host "Pressione Enter para fechar esta mensagem"
