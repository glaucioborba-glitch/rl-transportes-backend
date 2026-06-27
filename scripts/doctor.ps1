# RL Transportes — diagnóstico rápido do ambiente dev (Windows)
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "=== RL Doctor ===" -ForegroundColor Cyan
Write-Host "Raiz: $root"

function Test-PortListening([int]$Port) {
  $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  return [bool]$conn
}

Write-Host "`n[Node]"
node -v
npm -v

Write-Host "`n[Docker]"
try {
  docker compose ps
} catch {
  Write-Host "Docker indisponível: $_" -ForegroundColor Yellow
}

Write-Host "`n[Portas esperadas]"
$ports = @{ 3000 = "Next.js"; 3001 = "Nest API"; 5433 = "Postgres"; 6379 = "Redis" }
foreach ($p in $ports.Keys) {
  $ok = Test-PortListening $p
  $label = $ports[$p]
  if ($ok) { Write-Host "  OK  :$p $label" -ForegroundColor Green }
  else { Write-Host "  OFF :$p $label" -ForegroundColor Red }
}

Write-Host "`n[.env]"
$envFile = Join-Path $root ".env"
if (Test-Path $envFile) {
  $db = Select-String -Path $envFile -Pattern "^DATABASE_URL=" | Select-Object -First 1
  $api = Select-String -Path $envFile -Pattern "^API_PORT=" | Select-Object -First 1
  Write-Host "  DATABASE_URL: $($db.Line)"
  Write-Host "  API_PORT: $($api.Line)"
  if ($db.Line -match ":5432/") {
    Write-Host "  AVISO: compose usa Postgres :5433 — ajuste DATABASE_URL se migrate falhar." -ForegroundColor Yellow
  }
} else {
  Write-Host "  .env ausente — copie de .env.example" -ForegroundColor Yellow
}

Write-Host "`n[Health API]"
try {
  $h = Invoke-RestMethod -Uri "http://localhost:3001/health" -TimeoutSec 5
  Write-Host "  API: $($h.api) | DB: $($h.database) | Redis: $($h.redis)" -ForegroundColor Green
} catch {
  Write-Host "  API não responde em :3001" -ForegroundColor Red
}

Write-Host "`n=== Fim ===" -ForegroundColor Cyan
