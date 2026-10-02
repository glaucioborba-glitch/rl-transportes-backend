# Exporta todo o código-fonte do monorepo para um único .txt
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$outFile = Join-Path $root 'CODIGO-COMPLETO-PROJETO.txt'
$manifestFile = Join-Path $root 'CODIGO-COMPLETO-PROJETO-MANIFESTO.txt'

$excludeDirPatterns = @(
  '\\node_modules\\',
  '\\.git\\',
  '\\.next\\',
  '\\dist\\',
  '\\build\\',
  '\\coverage\\',
  '\\.turbo\\',
  '\\.cache\\',
  '\\mcps\\',
  '\\terminals\\',
  '\\.cursor\\'
)

$excludeFileNames = @(
  'CODIGO-COMPLETO-PROJETO.txt',
  'CODIGO-COMPLETO-PROJETO-MANIFESTO.txt',
  '.env'
)

$excludeExtensions = @(
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.pdf', '.zip', '.gz', '.tar', '.7z',
  '.exe', '.dll', '.so', '.dylib',
  '.map', '.bin', '.wasm'
)

$utf8 = New-Object System.Text.UTF8Encoding $true

function ShouldInclude([System.IO.FileInfo]$file) {
  if ($excludeFileNames -contains $file.Name) { return $false }
  $path = $file.FullName
  foreach ($pat in $excludeDirPatterns) {
    if ($path -match $pat) { return $false }
  }
  if ($excludeExtensions -contains $file.Extension.ToLower()) { return $false }
  return $true
}

function IsTextFile([System.IO.FileInfo]$file) {
  if ($file.Length -eq 0) { return $true }
  if ($file.Length -gt 10MB) { return $false }
  try {
    $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
    $sample = [Math]::Min($bytes.Length, 8192)
    for ($i = 0; $i -lt $sample; $i++) {
      if ($bytes[$i] -eq 0) { return $false }
    }
    return $true
  } catch {
    return $false
  }
}

$allFiles = Get-ChildItem -Path $root -Recurse -File | Sort-Object FullName
$included = @()
$excluded = @()

foreach ($f in $allFiles) {
  if (-not (ShouldInclude $f)) {
    $excluded += $f
    continue
  }
  if (-not (IsTextFile $f)) {
    $excluded += $f
    continue
  }
  $included += $f
}

$header = @"
================================================================================
RL TRANSPORTES MONOREPO - EXPORTACAO COMPLETA DO CODIGO
Gerado em: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Raiz: $root
Total de arquivos incluidos: $($included.Count)
Total de arquivos excluidos (binarios/artefatos/segredos): $($excluded.Count)
Nota: .env omitido por seguranca; use .env.example como referencia.
================================================================================

"@

[System.IO.File]::WriteAllText($outFile, $header, $utf8)

$index = 0
foreach ($file in $included) {
  $index++
  $relative = $file.FullName.Substring($root.Path.Length).TrimStart('\', '/')
  $separator = @"

================================================================================
ARQUIVO [$index/$($included.Count)]: $relative
================================================================================

"@
  [System.IO.File]::AppendAllText($outFile, $separator, $utf8)
  try {
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.UTF8Encoding]::new($false))
    [System.IO.File]::AppendAllText($outFile, $content, $utf8)
    if (-not $content.EndsWith("`n")) {
      [System.IO.File]::AppendAllText($outFile, "`n", $utf8)
    }
  } catch {
    $msg = "[ERRO AO LER ARQUIVO: $($_.Exception.Message)]`n"
    [System.IO.File]::AppendAllText($outFile, $msg, $utf8)
  }
}

$footer = @"

================================================================================
FIM DA EXPORTACAO - $($included.Count) arquivos incluidos
================================================================================
"@
[System.IO.File]::AppendAllText($outFile, $footer, $utf8)

$manifest = @"
MANIFESTO DE ARQUIVOS EXCLUIDOS
Gerado em: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Total excluidos: $($excluded.Count)

Motivos:
- node_modules, .git, .next, dist, build, coverage (artefatos/dependencias)
- Binarios: imagens, fontes, PDF, zip, executaveis
- .env (segredos locais - nao exportado)
- Arquivos > 10MB ou com bytes nulos (nao-texto)

LISTA:
"@
foreach ($f in $excluded) {
  $rel = $f.FullName.Substring($root.Path.Length).TrimStart('\', '/')
  $manifest += "`n$rel ($($f.Length) bytes)"
}
[System.IO.File]::WriteAllText($manifestFile, $manifest, $utf8)

Write-Output "Exportado: $outFile"
Write-Output "Manifesto: $manifestFile"
Write-Output "Incluidos: $($included.Count)"
Write-Output "Excluidos: $($excluded.Count)"
Write-Output "Tamanho: $([Math]::Round((Get-Item $outFile).Length / 1MB, 2)) MB"
