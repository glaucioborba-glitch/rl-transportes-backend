# Gera projeto-codigos-por-caminho.txt na raiz: todos os arquivos com caminho relativo + conteudo.
# Exclui apenas arvores enormes/geradas; .env nao tem conteudo copiado (credenciais).
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$outName = 'projeto-codigos-por-caminho.txt'
$outPath = Join-Path $root $outName

$excludeDirNames = [string[]]@(
    '.git', 'node_modules', 'dist', 'build', '.next', 'coverage', '.turbo',
    '__pycache__', '.pytest_cache'
)

function Test-ExcludedDir([string]$fullPath) {
    $rel = $fullPath.Substring($root.Length).TrimStart('\', '/')
    if (-not $rel) { return $false }
    $parts = $rel -split '[\\/]'
    foreach ($p in $parts) { if ($excludeDirNames -contains $p) { return $true } }
    return $false
}

function Test-EnvFile([string]$name) {
    if ($name -eq '.env') { return $true }
    if ($name -match '^\.env\.') { return $name -ne '.env.example' }
    return $false
}

$binaryExt = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
@(
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.pdf', '.zip', '.7z', '.rar',
    '.exe', '.dll', '.so', '.dylib', '.pyc',
    '.sqlite', '.db', '.bin'
) | ForEach-Object { [void]$binaryExt.Add($_) }

function Test-LikelyBinary([byte[]]$bytes) {
    if ($bytes.Length -eq 0) { return $false }
    $n = [Math]::Min($bytes.Length, 65536)
    for ($i = 0; $i -lt $n; $i++) {
        if ($bytes[$i] -eq 0) { return $true }
    }
    return $false
}

$allFiles = [System.Collections.Generic.List[System.IO.FileInfo]]::new()
$stack = New-Object System.Collections.Stack
$stack.Push((Get-Item -LiteralPath $root))
while ($stack.Count -gt 0) {
    $item = $stack.Pop()
    if ($item.PSIsContainer) {
        if (Test-ExcludedDir $item.FullName) { continue }
        foreach ($c in Get-ChildItem -LiteralPath $item.FullName -Force -ErrorAction SilentlyContinue) {
            $stack.Push($c)
        }
    } else {
        if (-not (Test-ExcludedDir $item.FullName)) {
            $allFiles.Add($item)
        }
    }
}

$sorted = $allFiles | Sort-Object { $_.FullName }
$utf8 = New-Object System.Text.UTF8Encoding $false
$writer = New-Object System.IO.StreamWriter($outPath, $false, $utf8)

try {
    $writer.WriteLine('# RL Transportes - dump de arquivos (caminho + conteudo)')
    $writer.WriteLine("# Raiz: $root")
    $writer.WriteLine("# Gerado em: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
    $writer.WriteLine('# Pastas excluidas: ' + ($excludeDirNames -join ', '))
    $writer.WriteLine('# Credenciais: conteudo de .env e de .env.* (exceto .env.example) nao e copiado')
    $writer.WriteLine('#')
    foreach ($f in $sorted) {
        $rel = $f.FullName.Substring($root.Length).TrimStart('\').Replace('\', '/')
        if ($rel -eq $outName) { continue }
        $writer.WriteLine('')
        $writer.WriteLine(('################################################################################'))
        $writer.WriteLine("# arquivo: $rel")
        $writer.WriteLine(('################################################################################'))
        $writer.WriteLine('')

        if (Test-EnvFile $f.Name) {
            $writer.WriteLine('[OMITIDO: arquivo de ambiente / possiveis credenciais]')
            continue
        }

        $ext = [System.IO.Path]::GetExtension($f.Name)
        if ($ext -and $binaryExt.Contains($ext)) {
            $writer.WriteLine("[OMITIDO: extensao binaria ($ext)]")
            continue
        }

        try {
            $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
        } catch {
            $writer.WriteLine("[ERRO ao ler: $($_.Exception.Message)]")
            continue
        }

        if ($bytes.Length -eq 0) {
            $writer.WriteLine('[arquivo vazio]')
            continue
        }

        if (Test-LikelyBinary $bytes) {
            $writer.WriteLine('[OMITIDO: conteudo binario detectado (byte nulo em amostra)]')
            continue
        }

        $text = $utf8.GetString($bytes)
        $writer.Write($text)
        if (-not $text.EndsWith("`n")) {
            $writer.WriteLine('')
        }
    }
} finally {
    $writer.Close()
}

Write-Output "Escrito: $outPath"
