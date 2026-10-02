$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$sdk = Join-Path $root 'sdk'
New-Item -ItemType Directory -Force -Path $sdk | Out-Null

$managedCandidates = @(
  'C:\Program Files (x86)\NITGEN\eNBSP SDK Professional\SDK\dotNET\NITGEN.SDK.NBioBSP.dll',
  'C:\rl-transportes-monorepo\Impressao\CSharp\C#\FingerCapturaAPI\Captura.Api\bin\NITGEN.SDK.NBioBSP.dll',
  'C:\Program Files (x86)\NITGEN eNBSP\SDK\dotNET\NITGEN.SDK.NBioBSP.dll',
  'C:\Program Files\NITGEN eNBSP\SDK\dotNET\NITGEN.SDK.NBioBSP.dll',
  (Join-Path $sdk 'NITGEN.SDK.NBioBSP.dll')
)
$managed = $managedCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $managed) {
  throw 'NITGEN.SDK.NBioBSP.dll nao encontrada. Confira a pasta Impressao\CSharp.'
}
$managedDest = Join-Path $sdk 'NITGEN.SDK.NBioBSP.dll'
if ((Resolve-Path $managed).Path -ne (Resolve-Path $managedDest -ErrorAction SilentlyContinue).Path) {
  Copy-Item $managed $managedDest -Force
}

$nativeCandidates = @(
  'C:\Windows\SysWOW64\NBioBSP.dll',
  'C:\Program Files (x86)\NITGEN\eNBSP SDK Professional\SDK\Bin\NBioBSP.dll',
  'C:\Program Files (x86)\NITGEN eNBSP\SDK\Bin\Win32\NBioBSP.dll',
  'C:\Program Files\NITGEN eNBSP\SDK\Bin\Win32\NBioBSP.dll',
  (Join-Path $sdk 'NBioBSP.dll')
)
$native = $nativeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
$nativeDest = Join-Path $sdk 'NBioBSP.dll'
if ($native -and ((Resolve-Path $native).Path -ne (Resolve-Path $nativeDest -ErrorAction SilentlyContinue).Path)) {
  Copy-Item $native $nativeDest -Force
}

$csc = 'C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) {
  throw 'csc.exe x86 nao encontrado (.NET Framework 4).'
}

$out = Join-Path $sdk 'NitgenBridge.exe'
& $csc /nologo /platform:x86 /target:exe /out:$out /reference:"$sdk\NITGEN.SDK.NBioBSP.dll" /reference:System.Windows.Forms.dll "$root\NitgenBridge.cs"
if ($LASTEXITCODE -ne 0) {
  throw "Falha ao compilar NitgenBridge (exit $LASTEXITCODE)"
}

Write-Host "OK $out"
