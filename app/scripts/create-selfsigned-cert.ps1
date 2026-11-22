param(
  [string]$Subject = 'CN=ClearStage Local Code Signing, O=ClearStage'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$certDir = Join-Path $root 'certs'
New-Item -ItemType Directory -Force -Path $certDir | Out-Null

$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject $Subject `
  -FriendlyName 'ClearStage Local Code Signing' `
  -CertStoreLocation 'Cert:\CurrentUser\My' `
  -KeyExportPolicy Exportable `
  -KeyLength 3072 `
  -HashAlgorithm SHA256 `
  -NotAfter (Get-Date).AddYears(3)

$cerPath = Join-Path $certDir 'ClearStage-CodeSigning.cer'
Export-Certificate -Cert $cert -FilePath $cerPath -Force | Out-Null
Import-Certificate -FilePath $cerPath -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null
Import-Certificate -FilePath $cerPath -CertStoreLocation 'Cert:\CurrentUser\TrustedPublisher' | Out-Null

$cert.Thumbprint | Set-Content -Path (Join-Path $certDir 'thumbprint.txt') -Encoding ascii

Write-Host "Certificate created and trusted for the current user."
Write-Host "Subject: $($cert.Subject)"
Write-Host "Thumbprint: $($cert.Thumbprint)"
Write-Host "Public certificate: $cerPath"
Write-Host "Private key remains in Cert:\CurrentUser\My; use -sha1 for signing."
