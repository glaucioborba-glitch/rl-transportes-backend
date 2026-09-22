param(
  [Parameter(Mandatory = $true)][ValidateSet('health', 'enroll', 'verify')][string]$Action,
  [string]$FirFile = ''
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Json([hashtable]$obj) {
  ($obj | ConvertTo-Json -Compress -Depth 4)
}

function Test-UsbHamster {
  try {
    $hit = Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue |
      Where-Object { $_.FriendlyName -match 'HFDU06|Hamster' }
    return [bool]$hit
  } catch {
    return $false
  }
}

function New-Bsp {
  $ids = @(
    'NBioBSPCOM.NBioBSP',
    'NBioBSP.NBioBSP',
    'NITGEN.NBioBSPCOM.NBioBSP'
  )
  foreach ($id in $ids) {
    try {
      return New-Object -ComObject $id
    } catch {
      # tenta o próximo ProgID
    }
  }
  throw 'COM Nitgen/Fingertech nao registrado (NBioBSPCOM). Instale o SDK eNBSP do leitor HFDU06R.'
}

function Open-Device($device) {
  foreach ($devId in @(255, 0, 1)) {
    try {
      $device.Open($devId) | Out-Null
      return $devId
    } catch {
      # tenta outro DeviceID
    }
  }
  try {
    $device.Open() | Out-Null
    return 255
  } catch {
    throw 'Leitor nao encontrado. Confira o USB e o driver do HFDU06R.'
  }
}

$usb = Test-UsbHamster

if ($Action -eq 'health') {
  try {
    $null = New-Bsp
    Write-Json @{ ok = $true; usb = $usb; com = $true; device = 'HFDU06R' }
    exit 0
  } catch {
    $hint = if ($usb) {
      'Leitor HFDU06 conectado. Falta o SDK eNBSP (NBioBSPCOM). O instalador do driver USB nao registra a API de digital. Instale o SDK Windows da Fingertech/Nitgen.'
    } else {
      [string]$_.Exception.Message
    }
    Write-Json @{ ok = $false; usb = $usb; com = $false; error = $hint }
    exit 1
  }
}

$bsp = $null
$openId = $null
try {
  $bsp = New-Bsp
  $device = $bsp.Device
  $extraction = $bsp.Extraction
  $matching = $bsp.Matching
  $openId = Open-Device $device

  if ($Action -eq 'enroll') {
    $extraction.Enroll('', $null) | Out-Null
    $fir = [string]$extraction.TextEncodeFIR
    if ([string]::IsNullOrWhiteSpace($fir)) {
      throw 'Cadastro da digital cancelado ou falhou. Coloque o dedo no leitor quando a janela abrir.'
    }
    Write-Json @{ ok = $true; fir = $fir }
    exit 0
  }

  if ($Action -eq 'verify') {
    if (-not $FirFile -or -not (Test-Path -LiteralPath $FirFile)) {
      throw 'Template cadastrado ausente para conferencia 1:1.'
    }
    $stored = [System.IO.File]::ReadAllText($FirFile).Trim()
    if ([string]::IsNullOrWhiteSpace($stored)) {
      throw 'Template cadastrado vazio.'
    }
    $extraction.Capture(1) | Out-Null
    $live = [string]$extraction.TextEncodeFIR
    if ([string]::IsNullOrWhiteSpace($live)) {
      throw 'Captura cancelada. O motorista precisa encostar o dedo no leitor.'
    }
    $matching.VerifyMatch($live, $stored) | Out-Null
    $result = 0
    try { $result = [int]$matching.MatchingResult } catch { $result = 0 }
    $matched = $result -eq 1
    Write-Json @{ ok = $true; matched = $matched }
    exit 0
  }
} catch {
  Write-Json @{ ok = $false; usb = $usb; error = [string]$_.Exception.Message }
  exit 1
} finally {
  if ($null -ne $bsp -and $null -ne $openId) {
    try { $bsp.Device.Close($openId) | Out-Null } catch { }
  }
}
