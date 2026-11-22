param(
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$version = '0.1.0'
$stageRoot = Join-Path $env:LOCALAPPDATA 'ClearStageBuild'
$payload = Join-Path $stageRoot 'payload'
$appDir = Join-Path $stageRoot 'ClearStage-win32-x64'
$release = Join-Path $root 'release'
$zipPath = Join-Path $release "ClearStage-$version-win-x64.zip"
$setupPath = Join-Path $release "ClearStage-Setup-$version.exe"
$nsi = Join-Path $root 'build\installer.nsi'
$icon = Join-Path $root 'build\icon.ico'
$downloads = Join-Path $root 'site\downloads'

$signtool = @(
  'C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe',
  'C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe'
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $signtool) { throw 'signtool.exe not found.' }
$thumbprintFile = Join-Path $root 'certs\thumbprint.txt'
if (-not (Test-Path -LiteralPath $thumbprintFile)) {
  throw 'Missing certs/thumbprint.txt. Run scripts/create-selfsigned-cert.ps1 first.'
}
$thumbprint = (Get-Content -LiteralPath $thumbprintFile -Raw).Trim()

$makensis = Get-Command makensis.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $makensis) {
  $makensis = Get-ChildItem (Join-Path $env:LOCALAPPDATA 'electron-builder-cache') -Recurse -Filter makensis.exe -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match '\\Bin\\' } |
    Select-Object -First 1 -ExpandProperty FullName
}
if (-not $makensis) { throw 'makensis.exe not found. Install NSIS or keep the electron-builder cache.' }

if (-not $SkipBuild) {
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'npm run build failed' }
}
if (-not (Test-Path 'node_modules\electron\dist\electron.exe')) {
  throw 'Electron runtime missing.'
}

# Build in a normal user-owned directory so the app does not inherit the workspace's
# low-integrity/AppContainer ACLs. Chromium's sandbox needs a readable install folder.
if (Test-Path $stageRoot) {
  $resolved = (Resolve-Path $stageRoot).Path
  if ($resolved -ne $stageRoot) { throw "Unexpected staging path: $resolved" }
  Remove-Item -Recurse -Force $stageRoot
}
New-Item -ItemType Directory -Force -Path $payload, $appDir, (Join-Path $payload 'node_modules') | Out-Null
Copy-Item -Recurse -Force 'node_modules\electron\dist\*' $appDir
Copy-Item -Recurse -Force 'out' (Join-Path $payload 'out')
Copy-Item -Force 'package.json' (Join-Path $payload 'package.json')
Copy-Item -Recurse -Force 'node_modules\ws' (Join-Path $payload 'node_modules\ws')

& node 'node_modules\@electron\asar\bin\asar.js' pack $payload (Join-Path $appDir 'resources\app.asar')
if (-not (Test-Path (Join-Path $appDir 'resources\app.asar'))) { throw 'asar packaging failed' }
Rename-Item (Join-Path $appDir 'electron.exe') 'ClearStage.exe'

# Bundle the public certificate and a one-click trust helper in the portable
# package. The NSIS installer also ships this file and imports it automatically.
$certSource = Join-Path $root 'certs\ClearStage-CodeSigning.cer'
if (-not (Test-Path -LiteralPath $certSource)) { throw 'Missing certs/ClearStage-CodeSigning.cer' }
Copy-Item -Force $certSource (Join-Path $appDir 'ClearStage-CodeSigning.cer')
$certCmd = @'
@echo off
chcp 65001 >nul
echo Installing the ClearStage code-signing certificate for the current user...
certutil -user -addstore Root "%~dp0ClearStage-CodeSigning.cer"
certutil -user -addstore TrustedPublisher "%~dp0ClearStage-CodeSigning.cer"
echo.
echo Done. You can now start ClearStage.exe.
pause
'@
[System.IO.File]::WriteAllText((Join-Path $appDir 'Install-Certificate.cmd'), $certCmd + "`r`n", (New-Object System.Text.UTF8Encoding($false)))

$appExe = Join-Path $appDir 'ClearStage.exe'
& $signtool sign /fd SHA256 /td SHA256 /tr 'http://timestamp.digicert.com' /sha1 $thumbprint /d '澄幕 ClearStage' $appExe
if ($LASTEXITCODE -ne 0) { throw 'Signing app EXE failed' }

New-Item -ItemType Directory -Force -Path $release, $downloads | Out-Null
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
Compress-Archive -Path $appDir -DestinationPath $zipPath -CompressionLevel Optimal

# NSIS must read the script as UTF-8 with BOM for the Chinese strings.
$nsiText = [System.IO.File]::ReadAllText($nsi)
[System.IO.File]::WriteAllText($nsi, $nsiText, (New-Object System.Text.UTF8Encoding($true)))
if (Test-Path $setupPath) { Remove-Item -Force $setupPath }
& $makensis "/DSOURCE_DIR=$appDir" "/DOUT_FILE=$setupPath" "/DAPP_VERSION=$version" "/DICON_FILE=$icon" $nsi
if ($LASTEXITCODE -ne 0) { throw 'NSIS build failed' }

& $signtool sign /fd SHA256 /td SHA256 /tr 'http://timestamp.digicert.com' /sha1 $thumbprint /d '澄幕 ClearStage 安装程序' $setupPath
if ($LASTEXITCODE -ne 0) { throw 'Signing installer failed' }

Copy-Item -Force $zipPath (Join-Path $downloads 'ClearStage-0.1.0-win-x64.zip')
Copy-Item -Force $setupPath (Join-Path $downloads 'ClearStage-Setup-0.1.0.exe')
$zipHash = (Get-FileHash $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
$setupHash = (Get-FileHash $setupPath -Algorithm SHA256).Hash.ToLowerInvariant()
$sums = "# ClearStage 0.1.0 Windows release`n$setupHash  ClearStage-Setup-0.1.0.exe`n$zipHash  ClearStage-0.1.0-win-x64.zip`n"
[System.IO.File]::WriteAllText((Join-Path $downloads 'SHA256SUMS.txt'), $sums, (New-Object System.Text.UTF8Encoding($false)))
Copy-Item -Force (Join-Path $downloads 'SHA256SUMS.txt') (Join-Path $release 'SHA256SUMS.txt')

Write-Host "ZIP: $zipPath"
Write-Host "ZIP SHA-256: $zipHash"
Write-Host "Setup: $setupPath"
Write-Host "Setup SHA-256: $setupHash"
Write-Host "App dir: $appDir"
