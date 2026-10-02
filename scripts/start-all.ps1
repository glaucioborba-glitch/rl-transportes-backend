# RL Transportes — sobe stack dev no Windows (Docker + backend + frontend)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "RL — Inicializando ambiente de desenvolvimento (Windows)" -ForegroundColor Cyan

Write-Host "Subindo Docker (Postgres + Redis)..."
docker compose up -d postgres redis

Write-Host "Backend (Nest :3001)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\apps\backend'; npm run start:dev"

Write-Host "Frontend (Next :3000)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\apps\web'; npm run dev"

Write-Host "Agente digital RIC (leitor HFDU06R :39201)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root'; node apps/bio-agent/index.mjs"

Write-Host "Agente de impressão RIC (Epson TM-T20X :39202)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root'; node apps/print-agent/index.mjs"

Write-Host ""
Write-Host "Ambiente iniciado em janelas separadas." -ForegroundColor Green
Write-Host "Backend  -> http://localhost:3001"
Write-Host "Frontend -> http://localhost:3000"
Write-Host "Digital  -> http://127.0.0.1:39201/health"
Write-Host "Impressão-> http://127.0.0.1:39202/health"
Write-Host "Doctor   -> .\scripts\doctor.ps1"
