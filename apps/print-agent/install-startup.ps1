# Instala o agente de impressão RIC para subir no logon do Windows (2 PCs da portaria).
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$agent = Join-Path $root 'apps\print-agent\index.mjs'
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) {
  Write-Host 'Instale o Node.js LTS (https://nodejs.org) antes de registrar o agente.' -ForegroundColor Red
  exit 1
}
if (-not (Test-Path -LiteralPath $agent)) {
  Write-Host "Agente não encontrado: $agent" -ForegroundColor Red
  exit 1
}

$task = 'RL-Print-Agent'
$tr = "`"$node`" `"$agent`""
schtasks /Create /TN $task /TR $tr /SC ONLOGON /RL LIMITED /F | Out-Null
Write-Host "Tarefa '$task' registrada. O agente sobe no logon em http://127.0.0.1:39202"
Write-Host 'Ainda é preciso: driver Epson TM-T20X + SumatraPDF (https://www.sumatrapdfreader.org).'
Start-Process -FilePath $node -ArgumentList $agent -WindowStyle Hidden
Write-Host 'Agente iniciado agora nesta sessão.'
