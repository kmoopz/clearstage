param(
  [switch]$SkipBuild,
  [switch]$PublishSite
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path 'node_modules\electron\dist\electron.exe')) {
  throw 'Electron runtime missing. Run: node node_modules/electron/install.js'
}

if (-not $SkipBuild) {
  npm run build
}

$release = Join-Path $root 'release'
$appDir = Join-Path $release 'ClearStage-win32-x64'
$stage = Join-Path $root '.pack-staging'
$zipPath = Join-Path $release 'ClearStage-0.1.0-win-x64.zip'

foreach ($path in @($release, $stage)) {
  if (Test-Path $path) {
    $resolved = (Resolve-Path $path).Path
    if ($resolved -notlike "$root*") { throw "Refusing to remove unexpected path: $resolved" }
    Remove-Item -Recurse -Force $resolved
  }
}

New-Item -ItemType Directory -Force -Path $appDir, $stage, (Join-Path $stage 'node_modules') | Out-Null
Copy-Item -Recurse -Force 'node_modules\electron\dist\*' $appDir
Copy-Item -Recurse -Force 'out' (Join-Path $stage 'out')
Copy-Item -Force 'package.json' (Join-Path $stage 'package.json')
Copy-Item -Recurse -Force 'node_modules\ws' (Join-Path $stage 'node_modules\ws')

& node 'node_modules\@electron\asar\bin\asar.js' pack $stage (Join-Path $appDir 'resources\app.asar')
if (-not (Test-Path (Join-Path $appDir 'resources\app.asar'))) { throw 'asar packaging failed' }

Rename-Item (Join-Path $appDir 'electron.exe') 'ClearStage.exe'
$rcedit = Join-Path $root 'node_modules\electron-winstaller\vendor\rcedit.exe'
if (Test-Path $rcedit) {
  & $rcedit (Join-Path $appDir 'ClearStage.exe') `
    --set-icon (Join-Path $root 'build\icon.ico') `
    --set-file-version '0.1.0' `
    --set-product-version '0.1.0' `
    --set-version-string 'ProductName' '澄幕' `
    --set-version-string 'FileDescription' '澄幕 ClearStage' `
    --set-version-string 'CompanyName' 'ClearStage' `
    --set-version-string 'LegalCopyright' 'ClearStage'
}

Compress-Archive -Path $appDir -DestinationPath $zipPath -CompressionLevel Optimal
$hash = (Get-FileHash $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
$size = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host "Portable package: $zipPath"
Write-Host "Size: $size MB"
Write-Host "SHA-256: $hash"

if ($PublishSite) {
  $downloads = Join-Path $root 'site\downloads'
  New-Item -ItemType Directory -Force -Path $downloads | Out-Null
  Copy-Item -Force $zipPath (Join-Path $downloads 'ClearStage-0.1.0-win-x64.zip')
  Set-Content -Path (Join-Path $downloads 'SHA256SUMS.txt') -Value "$hash  ClearStage-0.1.0-win-x64.zip" -Encoding ascii
  Write-Host "Published to $downloads"
}
