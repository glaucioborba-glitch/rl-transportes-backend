param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('list', 'print')]
  [string]$Action,
  [string]$File = '',
  [string]$Printer = ''
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

function Write-Json($obj) {
  $obj | ConvertTo-Json -Compress -Depth 6
}

function Test-ImpressoraVirtual([string]$name) {
  return $name -match 'Print to PDF|XPS Document Writer|OneNote|Fax|Microsoft IPP'
}

function Find-Sumatra {
  $here = Split-Path -Parent $PSCommandPath
  $candidates = @(
    (Join-Path $here 'bin\SumatraPDF.exe'),
    (Join-Path $env:LOCALAPPDATA 'SumatraPDF\SumatraPDF.exe'),
    (Join-Path $env:ProgramFiles 'SumatraPDF\SumatraPDF.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'SumatraPDF\SumatraPDF.exe')
  )
  foreach ($c in $candidates) {
    if ($c -and (Test-Path -LiteralPath $c)) { return $c }
  }
  return $null
}

$sumatra = Find-Sumatra
$sumatraOk = [bool]$sumatra

if ($Action -eq 'list') {
  $printers = @(Get-CimInstance Win32_Printer | ForEach-Object {
      [ordered]@{
        name     = $_.Name
        default  = [bool]$_.Default
        virtual  = [bool](Test-ImpressoraVirtual $_.Name)
      }
    })
  Write-Json @{
    ok       = $true
    sumatra  = $sumatraOk
    printers = $printers
  }
  exit 0
}

if (-not $File -or -not (Test-Path -LiteralPath $File)) {
  Write-Json @{ ok = $false; error = 'Arquivo para impressão não encontrado.' }
  exit 1
}

if (-not $sumatraOk) {
  Write-Json @{
    ok      = $false
    sumatra = $false
    error   = 'Instale o SumatraPDF neste PC (gratuito). Sem ele o Windows não envia o cupom para a Epson. Baixe em https://www.sumatrapdfreader.org e tente de novo.'
  }
  exit 1
}

if ($Printer -and (Test-ImpressoraVirtual $Printer)) {
  Write-Json @{
    ok    = $false
    error = 'Microsoft Print to PDF não é impressora de cupom. Nas 2 máquinas da portaria, instale o driver da Epson TM-T20X e escolha essa impressora.'
  }
  exit 1
}

function Quote-WinArg([string]$value) {
  '"' + ($value -replace '"', '""') + '"'
}

# Start-Process parte argumento com espaço se não for uma string só, com aspas.
$argLine = '-silent -exit-when-done '
if ($Printer) {
  $argLine += '-print-to ' + (Quote-WinArg $Printer) + ' '
} else {
  $argLine += '-print-to-default '
}
$argLine += Quote-WinArg $File
$p = Start-Process -FilePath $sumatra -ArgumentList $argLine -PassThru -WindowStyle Hidden
# Epson TM muitas vezes não sinaliza fim de job; -Wait deixa a tela do Gate presa.
$saiu = $false
if ($null -ne $p) {
  $saiu = $p.WaitForExit(8000)
}
if ($saiu) {
  $code = if ($null -eq $p.ExitCode) { 0 } else { $p.ExitCode }
  if ($code -ne 0) {
    Write-Json @{ ok = $false; error = "SumatraPDF não conseguiu imprimir (código $code). Confira se a Epson TM-T20X está ligada e selecionada." }
    exit 1
  }
}
Write-Json @{ ok = $true; via = 'sumatra'; printer = $Printer }
exit 0
