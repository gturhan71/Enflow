#!/usr/bin/env bash
# restart-test-env.sh
# Enflow frontend + backend'i, hangi portta çalışıyor olurlarsa olsun durdurur,
# sonra RBAC test paketinin beklediği sabit test portlarında yeniden başlatır:
#   backend  -> 3002  (backend/src/index.ts içinde hardcoded, değiştirilemez)
#   frontend -> 5173  (kök package.json'daki "dev" script'i varsayılan olarak 3000 kullanır — burada override ediyoruz)
#
# Kullanım: repo kökünde çalıştırın
#   chmod +x restart-test-env.sh
#   ./restart-test-env.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PORT=3002
FRONTEND_PORT=5173
LOG_DIR="$REPO_ROOT/.devlogs"
mkdir -p "$LOG_DIR"

echo "== 1) Var olan Enflow süreçleri durduruluyor (port fark etmeksizin) =="

kill_by_pattern() {
  local pattern="$1"
  local pids
  pids=$(pgrep -f "$pattern" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "  -> '$pattern' eşleşmesi için durduruluyor: $pids"
    kill $pids 2>/dev/null || true
    sleep 1
    pids=$(pgrep -f "$pattern" 2>/dev/null || true)
    if [ -n "$pids" ]; then
      echo "     hâlâ ayakta, zorla kapatılıyor: $pids"
      kill -9 $pids 2>/dev/null || true
    fi
  else
    echo "  -> '$pattern' için çalışan süreç yok"
  fi
}

# Backend: hem "pnpm dev" (nodemon sarmalayıcı) hem "pnpm start" (doğrudan ts-node) ihtimalini yakala
kill_by_pattern "nodemon.*src/index\.ts"
kill_by_pattern "ts-node.*src/index\.ts"

# Frontend: vite hangi portta açılmış olursa olsun yakala
kill_by_pattern "vite.*--port"
kill_by_pattern "node_modules/\.bin/vite"

# Ek güvence: bilinen portları da doğrudan boşalt (proje dışı bir süreç oturmuş olabilir)
free_port() {
  local port="$1"
  if ! command -v lsof >/dev/null 2>&1; then
    return 0   # lsof yoksa sessizce geç (Debian/Ubuntu: sudo apt install lsof)
  fi
  local pid
  pid=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo "  -> Port $port hâlâ dolu (pid $pid), kapatılıyor"
    kill -9 $pid 2>/dev/null || true
  fi
}
free_port "$BACKEND_PORT"
free_port "$FRONTEND_PORT"
free_port 3000   # kök "dev" script'inin varsayılan (test-dışı) portu

sleep 1

echo ""
echo "== 2) Backend başlatılıyor (sabit port $BACKEND_PORT) =="
(cd "$REPO_ROOT/backend" && nohup pnpm dev > "$LOG_DIR/backend.log" 2>&1 &)

echo -n "  -> hazır olması bekleniyor (http://localhost:$BACKEND_PORT/api/health) "
backend_ok=0
for i in $(seq 1 30); do
  if curl -sf "http://localhost:$BACKEND_PORT/api/health" > /dev/null 2>&1; then
    backend_ok=1
    break
  fi
  echo -n "."
  sleep 1
done
if [ "$backend_ok" -eq 1 ]; then
  echo " hazır"
else
  echo ""
  echo "  !! Backend 30sn içinde ayağa kalkmadı — $LOG_DIR/backend.log içeriğine bakın:"
  tail -n 20 "$LOG_DIR/backend.log" 2>/dev/null
fi

echo ""
echo "== 3) Frontend başlatılıyor (test portu $FRONTEND_PORT — kök script'in varsayılanı 3000'den FARKLI) =="
(cd "$REPO_ROOT" && nohup npx vite --port="$FRONTEND_PORT" --host=0.0.0.0 > "$LOG_DIR/frontend.log" 2>&1 &)

echo -n "  -> hazır olması bekleniyor (http://localhost:$FRONTEND_PORT) "
frontend_ok=0
for i in $(seq 1 30); do
  if curl -sf "http://localhost:$FRONTEND_PORT" > /dev/null 2>&1; then
    frontend_ok=1
    break
  fi
  echo -n "."
  sleep 1
done
if [ "$frontend_ok" -eq 1 ]; then
  echo " hazır"
else
  echo ""
  echo "  !! Frontend 30sn içinde ayağa kalkmadı — $LOG_DIR/frontend.log içeriğine bakın:"
  tail -n 20 "$LOG_DIR/frontend.log" 2>/dev/null
fi

echo ""
echo "-----------------------------------------------------------"
if [ "$backend_ok" -eq 1 ] && [ "$frontend_ok" -eq 1 ]; then
  echo "Hazır — RBAC testlerini çalıştırabilirsiniz:"
  echo "  cd tests/rbac && pnpm test"
else
  echo "Bir veya iki servis ayağa kalkmadı, loglara bakıp tekrar deneyin."
fi
echo "Backend : http://localhost:$BACKEND_PORT  (log: $LOG_DIR/backend.log)"
echo "Frontend: http://localhost:$FRONTEND_PORT  (log: $LOG_DIR/frontend.log)"
echo ""
echo "Durdurmak için:"
echo "  pkill -f 'src/index.ts'; pkill -f 'vite.*--port'"
echo "-----------------------------------------------------------"
