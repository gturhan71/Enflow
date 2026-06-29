#!/usr/bin/env bash
# Enflow — dağıtılabilir kurulum zip'i üretir (install/ bootstrap'ları).
# Çıktı: dist-installer/enflow-installer-<tarih>.zip
# Bu zip tek başına çalışır: açıp install.sh / install.ps1 çalıştırılır,
# depo en son sürümüyle git'ten indirilip kurulur.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAMP="$(date +%Y%m%d)"
OUT_DIR="$HERE/../dist-installer"
ZIP="$OUT_DIR/enflow-installer-$STAMP.zip"
mkdir -p "$OUT_DIR"
STAGE="$(mktemp -d)"
PKG="$STAGE/enflow-installer"
mkdir -p "$PKG"

cp "$HERE/install.sh" "$HERE/install.ps1" "$HERE/install.bat" "$HERE/wizard.mjs" "$HERE/README.md" "$HERE/.env.example" "$PKG/"
chmod +x "$PKG/install.sh" 2>/dev/null || true

( cd "$STAGE" && zip -rq "$ZIP" enflow-installer )
rm -rf "$STAGE"
echo "✓ Kurulum paketi: $ZIP"
echo "  İçerik: install.sh · install.ps1 · install.bat · wizard.mjs · README.md · .env.example"
echo "  Kullanım (hedef makinede): açın → ./install.sh (Linux/macOS) · install.bat çift-tık veya .\\install.ps1 (Windows)"
