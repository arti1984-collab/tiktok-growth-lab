# Signiert die gebaute exe, damit Windows sie nicht als unbekanntes Programm blockt.
# Beim ersten Lauf entsteht ein eigenes Code-Signing-Zertifikat; es wird nur für den
# angemeldeten Windows-Benutzer als vertrauenswürdig eingetragen (kein Adminrecht).

param(
    [string]$File = "release\TikTok-Growth-Lab.exe",
    [string]$Subject = "CN=TikTok Growth Lab, O=Artur, C=DE",
    [string]$TimestampServer = "http://timestamp.digicert.com"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $File)) {
    throw "Datei nicht gefunden: $File"
}
$target = (Resolve-Path $File).Path

$cert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert |
    Where-Object { $_.Subject -eq $Subject } |
    Sort-Object NotAfter -Descending |
    Select-Object -First 1

if (-not $cert) {
    $cert = New-SelfSignedCertificate `
        -Type CodeSigningCert `
        -Subject $Subject `
        -KeyUsage DigitalSignature `
        -CertStoreLocation Cert:\CurrentUser\My `
        -NotAfter (Get-Date).AddYears(5) `
        -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3")
    Write-Host "Zertifikat erzeugt: $($cert.Thumbprint)"
}

# Ohne diese beiden Einträge gilt die Signatur als nicht vertrauenswürdig.
foreach ($storeName in "TrustedPublisher", "Root") {
    $store = New-Object System.Security.Cryptography.X509Certificates.X509Store($storeName, "CurrentUser")
    $store.Open("ReadWrite")
    if (-not ($store.Certificates | Where-Object { $_.Thumbprint -eq $cert.Thumbprint })) {
        $store.Add($cert)
        Write-Host "Zertifikat eingetragen in: $storeName"
    }
    $store.Close()
}

$signature = Set-AuthenticodeSignature -FilePath $target -Certificate $cert -TimestampServer $TimestampServer
if ($signature.Status -ne "Valid" -and $signature.Status -ne "UnknownError") {
    Write-Host "Signatur ohne Zeitstempel, zweiter Versuch."
    $signature = Set-AuthenticodeSignature -FilePath $target -Certificate $cert
}

$result = Get-AuthenticodeSignature $target
Write-Host "Status:     $($result.Status)"
Write-Host "Herausgeber: $($result.SignerCertificate.Subject)"
Write-Host "Datei:      $target"
