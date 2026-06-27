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

# ── önkoşullar ────────────────────────────────────────────────────────────────
command -v node >/dev/null 2>&1 || die "Node.js bulunamadı. Kurun: https://nodejs.org (≥ 20 LTS)."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[[ "$NODE_MAJOR" -ge 20 ]] || die "Node $(node -v) çok eski — en az 20 gerekli."
ok "Node $(node -v)"
command -v git >/dev/null 2>&1 || die "git bulunamadı. Kurun: https://git-scm.com"
ok "$(git --version)"
corepack enable >/dev/null 2>&1 || true

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
