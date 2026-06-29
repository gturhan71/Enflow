#!/usr/bin/env bash
# Enflow — Linux/macOS kurulum bootstrap'ı
# Kullanım:
#   ./install/install.sh                 # bu depo içinde: en son sürüme güncelle + kur
#   ./install/install.sh --dir ~/Enflow  # tek başına (zip): depoyu klonla + kur
#   ./install/install.sh --yes           # etkileşimsiz (varsayılanlar)
#   ./install/install.sh --ref v1.2.0    # belirli git ref/tag
set -euo pipefail

REPO_URL="${ENFLOW_REPO_URL:-https://github.com/gturhan71/Enflow.git}"
RED='\033[31m'; GRN='\033[32m'; YEL='\033[33m'; CYN='\033[36m'; B='\033[1m'; R='\033[0m'
say() { printf "${CYN}${B}»${R} %s\n" "$*"; }
ok()  { printf "${GRN}✓${R} %s\n" "$*"; }
die() { printf "${RED}✗ %s${R}\n" "$*" >&2; exit 1; }

# ── argümanlar ────────────────────────────────────────────────────────────────
TARGET=""; REF=""; PASS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir) TARGET="${2:-}"; shift 2;;
    --ref) REF="${2:-}"; shift 2;;
    --yes|-y) PASS+=("--yes"); shift;;
    *) PASS+=("$1"); shift;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
say "Enflow kurulum (Linux/macOS)"

NODE_VERSION="${ENFLOW_NODE_VERSION:-22.11.0}" # portatif indirme için pinli LTS

# ── önkoşullar (HİBRİT auto-install: pkg-mgr → portatif → yönlendir) ──────────
node_ok() { command -v node >/dev/null 2>&1 && [[ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -ge 20 ]]; }

ensure_node() {
  if node_ok; then ok "Node $(node -v)"; return; fi
  command -v node >/dev/null 2>&1 && say "Node $(node -v) eski — uygun sürüm sağlanıyor…" || say "Node.js yok — otomatik sağlanıyor…"
  # 1) sistem paket yöneticisi (macOS brew)
  if [[ "$(uname -s)" == "Darwin" ]] && command -v brew >/dev/null 2>&1; then
    brew install node >/dev/null 2>&1 || true; node_ok && { ok "Node (brew) $(node -v)"; return; }
  fi
  # 2) portatif indirme (admin'siz; .tools/ altına)
  local os arch ext url dir
  case "$(uname -s)" in Darwin) os=darwin; ext=tar.gz;; Linux) os=linux; ext=tar.xz;; *) die "Desteklenmeyen OS — Node'u elle kurun: https://nodejs.org";; esac
  case "$(uname -m)" in x86_64|amd64) arch=x64;; arm64|aarch64) arch=arm64;; *) die "Desteklenmeyen mimari $(uname -m)";; esac
  dir="$SCRIPT_DIR/.tools"; mkdir -p "$dir"
  url="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-${os}-${arch}.${ext}"
  say "Portatif Node indiriliyor: $url"
  if command -v curl >/dev/null 2>&1; then curl -fsSL "$url" -o "$dir/node.${ext}" || die "Node indirilemedi (ağ/erişim?). Elle: https://nodejs.org"
  elif command -v wget >/dev/null 2>&1; then wget -qO "$dir/node.${ext}" "$url" || die "Node indirilemedi (ağ?). Elle: https://nodejs.org"
  else die "curl/wget yok — Node otomatik indirilemiyor. Elle kurun: https://nodejs.org"; fi
  tar -xf "$dir/node.${ext}" -C "$dir" || die "Node arşivi açılamadı."
  export PATH="$dir/node-v${NODE_VERSION}-${os}-${arch}/bin:$PATH"
  node_ok || die "Portatif Node PATH'e eklenemedi."
  ok "Portatif Node $(node -v) (.tools — yalnız bu kurulum)"
}

ensure_git() {
  command -v git >/dev/null 2>&1 && { ok "$(git --version)"; return; }
  say "git yok — sağlanıyor…"
  [[ "$(uname -s)" == "Darwin" ]] && command -v brew >/dev/null 2>&1 && brew install git >/dev/null 2>&1 || true
  if ! command -v git >/dev/null 2>&1 && command -v apt-get >/dev/null 2>&1; then sudo apt-get update -y >/dev/null 2>&1 && sudo apt-get install -y git >/dev/null 2>&1 || true; fi
  if ! command -v git >/dev/null 2>&1 && command -v dnf >/dev/null 2>&1; then sudo dnf install -y git >/dev/null 2>&1 || true; fi
  command -v git >/dev/null 2>&1 || die "git otomatik kurulamadı. Kurun: https://git-scm.com"
  ok "$(git --version)"
}

ensure_node
ensure_git
corepack enable >/dev/null 2>&1 || true # pnpm sihirbazda corepack ile sağlanır

# ── depo: klonla (tek başına) veya güncelle (depo içi) ────────────────────────
if [[ -f "$SCRIPT_DIR/../package.json" && -d "$SCRIPT_DIR/../backend" ]]; then
  REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
  say "Depo bulundu: $REPO_DIR"
  if git -C "$REPO_DIR" rev-parse >/dev/null 2>&1; then
    say "En son sürüm çekiliyor (git pull)…"
    git -C "$REPO_DIR" fetch --all --tags --quiet || true
    if [[ -n "$REF" ]]; then git -C "$REPO_DIR" checkout "$REF"; else git -C "$REPO_DIR" pull --ff-only || printf "${YEL}⚠ pull atlandı (yerel değişiklik?)${R}\n"; fi
  fi
else
  TARGET="${TARGET:-$PWD/Enflow}"
  say "Tek başına mod — depo klonlanıyor: $REPO_URL → $TARGET"
  if [[ -d "$TARGET/.git" ]]; then
    git -C "$TARGET" fetch --all --tags --quiet || true
    git -C "$TARGET" pull --ff-only || true
  else
    git clone --depth 1 ${REF:+--branch "$REF"} "$REPO_URL" "$TARGET"
  fi
  REPO_DIR="$(cd "$TARGET" && pwd)"
fi
ok "Kaynak hazır: $REPO_DIR"

# ── sihirbazı çalıştır (klonlanan deponun güncel sürümü) ─────────────────────
# Not: "${PASS[@]+...}" — set -u altında boş dizi genişlemesi (eski bash 3.2) güvenli.
exec node "$REPO_DIR/install/wizard.mjs" --repo "$REPO_DIR" ${PASS[@]+"${PASS[@]}"}
