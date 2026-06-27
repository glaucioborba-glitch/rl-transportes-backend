$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root "PROJETO-CODIGO-COMPLETO.txt"
$ts = (Get-Date).ToUniversalTime().ToString("o")

$header = @"
RL Transportes - consolidacao de codigo-fonte
Gerado em: $ts
Exclui: node_modules, dist, coverage, .git, .next, build, .turbo, mcps, imagens/binarios, package-lock, pnpm-lock, yarn.lock, arquivos CODIGO-COMPLETO/EXPORT antigos (evita duplicar dump), arquivos > 3MB.
Somente arquivos rastreados pelo git (git ls-files).

"@
[System.IO.File]::WriteAllText($out, $header, [System.Text.UTF8Encoding]::new($true))

Push-Location $root
$files = @(git ls-files)
Pop-Location

$maxBytes = 3 * 1024 * 1024
$n = 0
$skipped = 0

foreach ($f in $files) {
  if ($f -match "^(node_modules/|dist/|coverage/|\.next/|build/|\.turbo/|mcps/)") { $skipped++; continue }
  if ($f -match "\.(png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot|pdf|zip|7z|exe|dll|parquet|sqlite|bin)$") { $skipped++; continue }
  if ($f -match "CODIGO-COMPLETO|EXPORT-CODIGO-COMPLETO") { $skipped++; continue }
  $bn = Split-Path -Leaf $f
  if ($bn -match "^(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$") { $skipped++; continue }
  $full = Join-Path $root $f
  if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { $skipped++; continue }
  try {
    $len = (Get-Item -LiteralPath $full).Length
  } catch {
    $skipped++
    continue
  }
  if ($len -gt $maxBytes) { $skipped++; continue }

  $sep = "`n================================================================================`nFILE: $f`n================================================================================`n"
  try {
    $content = [System.IO.File]::ReadAllText($full, [System.Text.UTF8Encoding]::new($false))
  } catch {
    try {
      $content = Get-Content -LiteralPath $full -Raw -Encoding utf8
    } catch {
      $skipped++
      continue
    }
  }

  $encNoBom = [System.Text.UTF8Encoding]::new($false)
  [System.IO.File]::AppendAllText($out, $sep, $encNoBom)
  [System.IO.File]::AppendAllText($out, $content, $encNoBom)
  $n++
}

$bytes = (Get-Item -LiteralPath $out).Length
Write-Host "Arquivos incluidos: $n"
Write-Host "Pulados: $skipped"
Write-Host "Saida: $out"
Write-Host "Tamanho bytes: $bytes"
