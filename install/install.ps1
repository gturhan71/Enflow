<#
  Enflow - Windows kurulum bootstrap (PowerShell 5.1+ / PowerShell 7+)
  Kullanim:
    .\install\install.ps1                  # bu depo icinde: en son surume guncelle + kur
    .\install\install.ps1 -Dir C:\Enflow   # tek basina (zip): depoyu klonla + kur
    .\install\install.ps1 -Yes             # etkilesimsiz (varsayilanlar)
    .\install\install.ps1 -Ref v1.2.0      # belirli git ref/tag
  Not: Gerekirse calistirma politikasi:
    Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#>
param(
  [string]$Dir = "",
  [string]$Ref = "",
  [switch]$Yes
)
$ErrorActionPreference = "Stop"
$RepoUrl = if ($env:ENFLOW_REPO_URL) { $env:ENFLOW_REPO_URL } else { "https://github.com/gturhan71/Enflow.git" }
function Say($m){ Write-Host ">> $m" -ForegroundColor Cyan }
function OK($m){ Write-Host "[OK] $m" -ForegroundColor Green }
function Die($m){ Write-Host "[X] $m" -ForegroundColor Red; exit 1 }

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$NodeVersion = if ($env:ENFLOW_NODE_VERSION) { $env:ENFLOW_NODE_VERSION } else { "22.11.0" }
Say "Enflow kurulum (Windows)"

# --- onkosullar (HIBRIT auto-install: winget -> portatif -> yonlendir) ---
function Node-Ok {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { return $false }
  try { return ([int](node -p "process.versions.node.split('.')[0]")) -ge 20 } catch { return $false }
}
function Ensure-Node {
  if (Node-Ok) { OK "Node $(node -v)"; return }
  Say "Node.js uygun degil - otomatik saglaniyor..."
  # 1) winget (sistem geneli; yetki gerekebilir)
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    try { winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent | Out-Null } catch {}
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    if (Node-Ok) { OK "Node (winget) $(node -v)"; return }
  }
  # 2) portatif indirme (admin'siz; .tools altina)
  $arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
  $dir = Join-Path $ScriptDir ".tools"; New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $url = "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-$arch.zip"
  $zip = Join-Path $dir "node.zip"
  Say "Portatif Node indiriliyor: $url"
  try { Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing } catch { Die "Node indirilemedi (ag/erisim?). Elle: https://nodejs.org" }
  Expand-Archive -Path $zip -DestinationPath $dir -Force
  $nodeHome = Join-Path $dir "node-v$NodeVersion-win-$arch"
  $env:Path = "$nodeHome;$env:Path"
  if (-not (Node-Ok)) { Die "Portatif Node PATH'e eklenemedi." }
  OK "Portatif Node $(node -v) (.tools - yalniz bu kurulum)"
}
function Ensure-Git {
  if (Get-Command git -ErrorAction SilentlyContinue) { OK (git --version); return }
  Say "git yok - saglaniyor..."
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    try { winget install -e --id Git.Git --accept-source-agreements --accept-package-agreements --silent | Out-Null } catch {}
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
  }
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Die "git otomatik kurulamadi. Kurun: https://git-scm.com" }
  OK (git --version)
}

Ensure-Node
Ensure-Git
try { corepack enable | Out-Null } catch {} # pnpm sihirbazda corepack ile saglanir

# --- depo: klonla (tek basina) veya guncelle (depo ici) ---
$parent = Split-Path -Parent $ScriptDir
if ((Test-Path (Join-Path $parent "package.json")) -and (Test-Path (Join-Path $parent "backend"))) {
  $RepoDir = (Resolve-Path $parent).Path
  Say "Depo bulundu: $RepoDir"
  if (Test-Path (Join-Path $RepoDir ".git")) {
    Say "En son surum cekiliyor (git pull)..."
    git -C $RepoDir fetch --all --tags --quiet 2>$null
    if ($Ref) { git -C $RepoDir checkout $Ref } else { git -C $RepoDir pull --ff-only }
  }
} else {
  if (-not $Dir) { $Dir = Join-Path (Get-Location) "Enflow" }
  Say "Tek basina mod - depo klonlaniyor: $RepoUrl -> $Dir"
  if (Test-Path (Join-Path $Dir ".git")) {
    git -C $Dir fetch --all --tags --quiet 2>$null
    git -C $Dir pull --ff-only
  } else {
    if ($Ref) { git clone --depth 1 --branch $Ref $RepoUrl $Dir } else { git clone --depth 1 $RepoUrl $Dir }
  }
  $RepoDir = (Resolve-Path $Dir).Path
}
OK "Kaynak hazir: $RepoDir"

# --- sihirbazi calistir ---
$wizardArgs = @("$RepoDir\install\wizard.mjs", "--repo", "$RepoDir")
if ($Yes) { $wizardArgs += "--yes" }
& node @wizardArgs
exit $LASTEXITCODE
