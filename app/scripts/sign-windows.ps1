param(
  [string]$PfxPath,
  [string]$PasswordFile,
  [string]$Thumbprint,
  [string]$TimestampUrl = 'http://timestamp.digicert.com',
  [string[]]$Files = @(
    'release\ClearStage-win32-x64\ClearStage.exe',
    'release\ClearStage-Setup-0.1.0.exe'
  )
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not $Thumbprint) {
  $thumbprintFile = Join-Path $root 'certs\thumbprint.txt'
  if (Test-Path -LiteralPath $thumbprintFile) {
    $Thumbprint = (Get-Content -LiteralPath $thumbprintFile -Raw).Trim()
  }
}

$usePfx = $false
if ($PfxPath) {
  if (-not (Test-Path -LiteralPath $PfxPath)) {
    throw "PFX not found: $PfxPath"
  }
  if (-not $PasswordFile -or -not (Test-Path -LiteralPath $PasswordFile)) {
    throw 'When using a PFX, provide -PasswordFile pointing to a local password file.'
  }
  $password = (Get-Content -LiteralPath $PasswordFile -Raw).Trim()
  if (-not $password) {
    throw 'PFX password file is empty.'
  }
  $usePfx = $true
  $PfxPath = (Resolve-Path -LiteralPath $PfxPath).Path
}

if (-not $usePfx -and -not $Thumbprint) {
  throw 'Provide a PFX or an installed certificate thumbprint.'
}

$signtoolCandidates = @(
  'C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe',
  'C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe',
  'C:\Program Files\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe'
)
$signtool = $signtoolCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $signtool) {
  $candidate = Get-ChildItem 'C:\Program Files (x86)\Windows Kits\10\bin' -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match '\\x64\\' } |
    Select-Object -First 1
  $signtool = $candidate?.FullName
}
if (-not $signtool) {
  throw 'signtool.exe not found. Install the Windows SDK signing tools.'
}

$existing = @($Files | Where-Object { Test-Path -LiteralPath $_ })
if ($existing.Count -eq 0) {
  throw 'No files to sign. Build the application and installer first.'
}

foreach ($file in $existing) {
  Write-Host "Signing $file"
  if ($usePfx) {
    & $signtool sign /fd SHA256 /td SHA256 /tr $TimestampUrl /f $PfxPath /p $password /d '澄幕 ClearStage' $file
  } else {
    & $signtool sign /fd SHA256 /td SHA256 /tr $TimestampUrl /sha1 $Thumbprint /d '澄幕 ClearStage' $file
  }
  if ($LASTEXITCODE -ne 0) {
    throw "Signing failed for $file (signtool exit $LASTEXITCODE)"
  }
  Write-Host "Verifying $file"
  & $signtool verify /pa /v $file
  if ($LASTEXITCODE -ne 0) {
    throw "Signature verification failed for $file (signtool exit $LASTEXITCODE)"
  }
}

Write-Host 'Signature verification completed.'
