#!/usr/bin/env bash
# RBAC Playwright süiti (tests/rbac) — CI ve yerel aynı script (P0-4).
#   ./scripts/ci-rbac.sh api   → api-permissions + tenant-isolation (~1-2 dk)
#   ./scripts/ci-rbac.sh ui    → ui-access (~15 dk)
#   ./scripts/ci-rbac.sh all   → hepsi
# Taze SQLite DB → migrate deploy → deterministik fixture (pnpm seed:rbac) → derlenmiş backend
# (frontend dist'i de aynı origin'den sunar) → Playwright. Yerel dev.db'ye DOKUNMAZ.
# Varsayım: kök + backend + tests/rbac `pnpm install` yapılmış, kök `pnpm build` (dist/) hazır.
set -euo pipefail

MODE="${1:-all}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${RBAC_PORT:-3002}"
WORK="$(mktemp -d)"
export DATABASE_URL="file:$WORK/rbac.db"
export AUTH_JWT_SECRET="$(openssl rand -hex 32)"
export DATA_ENCRYPTION_MASTER_KEY="$(openssl rand -base64 32)"
export AUTH_RATE_LIMIT_MAX=5000
export NODE_ENV=production PORT="$PORT"

case "$MODE" in
  api) SPECS=(tests/api-permissions.spec.ts tests/tenant-isolation.spec.ts) ;;
  ui)  SPECS=(tests/ui-access.spec.ts) ;;
  all) SPECS=() ;;
  *) echo "kullanım: $0 api|ui|all" >&2; exit 2 ;;
esac

PID=""
cleanup() { [ -n "$PID" ] && kill "$PID" 2>/dev/null || true; rm -rf "$WORK"; }
trap cleanup EXIT

cd "$ROOT/backend"
npx prisma generate >/dev/null
npx prisma migrate deploy
pnpm build
pnpm seed:rbac
node dist/index.js >"$WORK/backend.log" 2>&1 &
PID=$!
for _ in $(seq 1 60); do
  curl -sf "http://localhost:$PORT/api/health" >/dev/null && break
  kill -0 "$PID" 2>/dev/null || { echo "✗ backend erken çıktı" >&2; cat "$WORK/backend.log" >&2; exit 1; }
  sleep 0.5
done

cd "$ROOT/tests/rbac"
export ENFLOW_API_URL="http://localhost:$PORT" ENFLOW_FRONTEND_URL="http://localhost:$PORT"
set +e
npx playwright test "${SPECS[@]}"
RC=$?
set -e
[ "$RC" -eq 0 ] || { echo "--- backend log (son 40) ---" >&2; tail -40 "$WORK/backend.log" >&2; }
exit "$RC"
