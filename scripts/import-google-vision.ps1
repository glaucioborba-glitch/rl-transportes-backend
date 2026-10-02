$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $root "apps"))) { $root = $PSScriptRoot }
$secretsDir = Join-Path $root "secrets"
$dest = Join-Path $secretsDir "google-vision.json"
New-Item -ItemType Directory -Force -Path $secretsDir | Out-Null

function Test-ServiceAccount([string]$path) {
  try {
    $raw = Get-Content -LiteralPath $path -Raw -ErrorAction Stop
    return ($raw -match '"type"\s*:\s*"service_account"' -and $raw -match 'client_email' -and $raw -match 'private_key')
  } catch {
    return $false
  }
}

$candidates = @()
if ($args.Count -gt 0 -and (Test-Path -LiteralPath $args[0])) {
  $candidates += (Get-Item -LiteralPath $args[0])
}

$searchRoots = @(
  (Join-Path $env:USERPROFILE "Downloads"),
  (Join-Path $env:USERPROFILE "Desktop"),
  (Join-Path $env:USERPROFILE "Documents"),
  $secretsDir
)
foreach ($dir in $searchRoots) {
  if (-not (Test-Path $dir)) { continue }
  $candidates += Get-ChildItem -LiteralPath $dir -File -Filter *.json -ErrorAction SilentlyContinue |
    Where-Object { $_.Length -lt 50kb -and $_.LastWriteTime -gt (Get-Date).AddDays(-30) }
}

$hit = $candidates | Where-Object { Test-ServiceAccount $_.FullName } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $hit) {
  Write-Host "Nenhum JSON de service account encontrado."
  exit 2
}

Copy-Item -LiteralPath $hit.FullName -Destination $dest -Force
Write-Host "Copiado:" $hit.FullName
Write-Host "Destino:" $dest

$parsed = Get-Content -LiteralPath $dest -Raw | ConvertFrom-Json
Write-Host "Conta:" $parsed.client_email
Write-Host "Projeto:" $parsed.project_id

$envFile = Join-Path $root ".env"
$line = "GOOGLE_APPLICATION_CREDENTIALS=$dest"
if (Test-Path $envFile) {
  $text = Get-Content -LiteralPath $envFile -Raw
  if ($text -match '(?m)^GOOGLE_APPLICATION_CREDENTIALS=') {
    $text = [regex]::Replace($text, '(?m)^GOOGLE_APPLICATION_CREDENTIALS=.*$', $line)
  } elseif ($text -match '(?m)^# GOOGLE_APPLICATION_CREDENTIALS=') {
    $text = [regex]::Replace($text, '(?m)^# GOOGLE_APPLICATION_CREDENTIALS=.*$', $line)
  } else {
    $text = $text.TrimEnd() + "`r`n`r`n$line`r`n"
  }
  Set-Content -LiteralPath $envFile -Value $text -NoNewline
  Write-Host "Atualizado .env (GOOGLE_APPLICATION_CREDENTIALS)."
}
