# Configuração do backend RL Transportes (Nest + Prisma 7)
# Execute na raiz do monorepo: .\setup-backend.ps1

$ErrorActionPreference = "Stop"
$backend = Join-Path $PSScriptRoot "apps\backend"
$rootEnv = Join-Path $PSScriptRoot ".env"
$exampleEnv = Join-Path $PSScriptRoot ".env.example"

function Write-Step($msg) { Write-Host $msg -ForegroundColor Cyan }

if (-not (Test-Path $backend)) {
    Write-Host "Pasta apps\backend não encontrada. Rode este script na raiz do monorepo." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $rootEnv)) {
    Write-Step "Criando .env na raiz a partir de .env.example..."
    if (Test-Path $exampleEnv) {
        Copy-Item $exampleEnv $rootEnv
    } else {
        throw ".env.example não encontrado na raiz."
    }
}

Write-Step "Subindo PostgreSQL e Redis (docker compose)..."
Set-Location $PSScriptRoot
docker compose up -d

Write-Step "Instalando dependências do backend..."
Set-Location $backend
if (-not (Test-Path "node_modules")) {
    npm install
}

Write-Step "Prisma generate..."
npx prisma generate

Write-Step "Aplicando migrações..."
npx prisma migrate deploy

Write-Step "Seed do usuário admin..."
npx prisma db seed

Write-Host "`nPronto. Inicie a API com: npm run dev:backend (na raiz) ou npm run start:dev (em apps/backend)" -ForegroundColor Green
Write-Host "Swagger: http://localhost:3000/docs (ajuste API_PORT no .env se necessário)" -ForegroundColor Green
