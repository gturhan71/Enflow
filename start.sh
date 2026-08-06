#!/bin/bash
# Enflow — macOS/Linux tek-komut başlangıç scripti.
# Backend (3002) + Frontend (3000) başlatır, health-check ile ayakta
# olduklarını doğrular ve sonucu raporlar. restarter.cjs bu scripti
# /restart endpoint'inde çağırır — imzasını (isim/konum) değiştirme.

BACKEND_PORT=3002
FRONTEND_PORT=3000
BACKEND_LOG="backend_dev.log"
FRONTEND_LOG="frontend_dev.log"
HEALTH_TIMEOUT=45   # saniye

GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "🚀 Enflow Sistemi Başlatılıyor..."

# 1. Eski süreçleri temizle
echo "🧹 Portlar temizleniyor..."
lsof -ti ":${BACKEND_PORT}" | xargs kill -9 2>/dev/null
lsof -ti ":${FRONTEND_PORT}" | xargs kill -9 2>/dev/null
pkill -f "vite" 2>/dev/null
pkill -f "ts-node" 2>/dev/null
true

# 2. Backend'i başlat
echo "📂 Backend başlatılıyor (log: ${BACKEND_LOG})..."
(cd backend && nohup pnpm ts-node src/index.ts > "../${BACKEND_LOG}" 2>&1 &)

# 3. Frontend'i başlat
echo "🖥️  Frontend başlatılıyor (log: ${FRONTEND_LOG})..."
nohup pnpm vite --port "${FRONTEND_PORT}" --host > "${FRONTEND_LOG}" 2>&1 &

# 4. Health-check: her ikisi de gerçekten ayağa kalkana kadar bekle
wait_for() {
  local name="$1" url="$2" log="$3" waited=0
  while [ "$waited" -lt "$HEALTH_TIMEOUT" ]; do
    if curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null | grep -q "^2\|^3"; then
      echo -e "${GREEN}✅ ${name} ayakta${RESET} (${url}, ${waited}s)"
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done
  echo -e "${RED}❌ ${name} ${HEALTH_TIMEOUT}s içinde cevap vermedi${RESET} (${url})"
  echo -e "${CYAN}   son log satırları (${log}):${RESET}"
  tail -n 15 "$log" | sed 's/^/   /'
  return 1
}

echo "⏳ Servislerin ayağa kalkması bekleniyor..."
BACKEND_OK=0
FRONTEND_OK=0
wait_for "Backend"  "http://localhost:${BACKEND_PORT}/api/health" "$BACKEND_LOG"  || BACKEND_OK=1
wait_for "Frontend" "http://localhost:${FRONTEND_PORT}/"          "$FRONTEND_LOG" || FRONTEND_OK=1

echo ""
if [ "$BACKEND_OK" -eq 0 ] && [ "$FRONTEND_OK" -eq 0 ]; then
  echo -e "${GREEN}✨ Sistem tam çalışır durumda — http://localhost:${FRONTEND_PORT}${RESET}"
  if [ "$(uname)" = "Darwin" ]; then
    open "http://localhost:${FRONTEND_PORT}" 2>/dev/null
  fi
  exit 0
else
  echo -e "${RED}⚠️  Sistem tam ayağa kalkmadı — yukarıdaki log satırlarını kontrol et.${RESET}"
  exit 1
fi
