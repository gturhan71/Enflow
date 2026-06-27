<#
  Enflow — dagitilabilir kurulum zip'i uretir (Windows).
  Cikti: dist-installer\enflow-installer-<tarih>.zip
#>
$ErrorActionPreference = "Stop"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Stamp = Get-Date -Format "yyyyMMdd"
$OutDir = Join-Path (Split-Path -Parent $Here) "dist-installer"
$Zip = Join-Path $OutDir "enflow-installer-$Stamp.zip"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$Stage = Join-Path ([System.IO.Path]::GetTempPath()) ("enflow-installer-" + [System.Guid]::NewGuid())
$Pkg = Join-Path $Stage "enflow-installer"
New-Item -ItemType Directory -Force -Path $Pkg | Out-Null

foreach ($f in @("install.sh","install.ps1","wizard.mjs","README.md",".env.example")) {
  Copy-Item (Join-Path $Here $f) (Join-Path $Pkg $f)
}
if (Test-Path $Zip) { Remove-Item $Zip }
Compress-Archive -Path $Pkg -DestinationPath $Zip
Remove-Item -Recurse -Force $Stage
Write-Host "OK Kurulum paketi: $Zip" -ForegroundColor Green
Write-Host "   Kullanim: acin -> .\install.ps1 (Windows) / ./install.sh (Linux/macOS)"
