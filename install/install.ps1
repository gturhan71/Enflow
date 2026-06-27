<#
  Enflow — Windows kurulum bootstrap'ı (PowerShell 5.1+ / PowerShell 7+)
  Kullanım:
    .\install\install.ps1                  # bu depo içinde: en son sürüme güncelle + kur
    .\install\install.ps1 -Dir C:\Enflow   # tek başına (zip): depoyu klonla + kur
    .\install\install.ps1 -Yes             # etkileşimsiz (varsayılanlar)
    .\install\install.ps1 -Ref v1.2.0      # belirli git ref/tag
  Not: Gerekirse çalıştırma politikası:
    Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#>
param(
  [string]$Dir = "",
  [string]$Ref = "",
  [switch]$Yes
)
$ErrorActionPreference = "Stop"
$RepoUrl = if ($env:ENFLOW_REPO_URL) { $env:ENFLOW_REPO_URL } else { "https://github.com/gturhan71/Enflow.git" }
function Say($m){ Write-Host "» $m" -ForegroundColor Cyan }
function OK($m){ Write-Host "✓ $m" -ForegroundColor Green }
function Die($m){ Write-Host "✗ $m" -ForegroundColor Red; exit 1 }

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Say "Enflow kurulum (Windows)"

# ── önkoşullar ──────────────────────────────────────────────────────────────
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Die "Node.js bulunamadı. Kurun: https://nodejs.org (>= 20 LTS)." }
$nodeMajor = [int](node -p "process.versions.node.split('.')[0]")
if ($nodeMajor -lt 20) { Die "Node $(node -v) cok eski — en az 20 gerekli." }
OK "Node $(node -v)"
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Die "git bulunamadi. Kurun: https://git-scm.com" }
OK (git --version)
try { corepack enable | Out-Null } catch {}

# ── depo: klonla (tek basina) veya guncelle (depo ici) ──────────────────────
$parent = Split-Path -Parent $ScriptDir
if ((Test-Path (Join-Path $parent "package.json")) -and (Test-Path (Join-Path $parent "backend"))) {
  $RepoDir = (Resolve-Path $parent).Path
  Say "Depo bulundu: $RepoDir"
  if (Test-Path (Join-Path $RepoDir ".git")) {
    Say "En son surum cekiliyor (git pull)…"
    git -C $RepoDir fetch --all --tags --quiet 2>$null
    if ($Ref) { git -C $RepoDir checkout $Ref } else { git -C $RepoDir pull --ff-only }
  }
} else {
  if (-not $Dir) { $Dir = Join-Path (Get-Location) "Enflow" }
  Say "Tek basina mod — depo klonlaniyor: $RepoUrl -> $Dir"
  if (Test-Path (Join-Path $Dir ".git")) {
    git -C $Dir fetch --all --tags --quiet 2>$null
    git -C $Dir pull --ff-only
  } else {
    if ($Ref) { git clone --depth 1 --branch $Ref $RepoUrl $Dir } else { git clone --depth 1 $RepoUrl $Dir }
  }
  $RepoDir = (Resolve-Path $Dir).Path
}
OK "Kaynak hazir: $RepoDir"

# ── sihirbazi calistir ──────────────────────────────────────────────────────
$wizardArgs = @("$RepoDir\install\wizard.mjs", "--repo", "$RepoDir")
if ($Yes) { $wizardArgs += "--yes" }
& node @wizardArgs
exit $LASTEXITCODE
