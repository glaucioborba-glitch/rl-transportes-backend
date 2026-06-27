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

Write-Host ""
Write-Host "Ambiente iniciado em janelas separadas." -ForegroundColor Green
Write-Host "Backend  -> http://localhost:3001"
Write-Host "Frontend -> http://localhost:3000"
Write-Host "Doctor   -> .\scripts\doctor.ps1"
