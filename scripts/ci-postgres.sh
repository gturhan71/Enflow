#!/usr/bin/env bash
# Postgres uçtan uca doğrulama (ADR-002 B5) — CI `postgres` job'u ve yerel
# geliştirici aynı script'i koşar. Çalışan bir Postgres + superuser gerekir:
#   PGHOST PGPORT PGUSER PGPASSWORD  (superuser)
# Adımlar: rol/DB provizyonu → migrate deploy (migrator) → şema drift kontrolü →
# runtime GRANT → RLS uygula + doğrula → derlenmiş backend'i runtime rolüyle başlat
# → /api/health 200 → SIGTERM → ≤10 sn içinde exit 0.
# Varsayım: `pnpm install` (kök + backend) yapılmış; bağımlılık kurulmaz.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"

export ENFLOW_DB="${ENFLOW_DB:-enflow_ci}"
export ENFLOW_APP_USER="${ENFLOW_APP_USER:-enflow_ci}"
export ENFLOW_MIGRATOR_USER="${ENFLOW_MIGRATOR_USER:-enflow_ci_migrator}"
export ENFLOW_APP_PASS="${ENFLOW_APP_PASS:-$(openssl rand -hex 16)}"
export ENFLOW_MIGRATOR_PASS="${ENFLOW_MIGRATOR_PASS:-$(openssl rand -hex 16)}"
HEALTH_PORT="${HEALTH_PORT:-3199}"

PG_ADDR="${PGHOST:-localhost}:${PGPORT:-5432}"
MIGRATOR_URL="postgresql://${ENFLOW_MIGRATOR_USER}:${ENFLOW_MIGRATOR_PASS}@${PG_ADDR}/${ENFLOW_DB}?schema=public"
APP_URL="postgresql://${ENFLOW_APP_USER}:${ENFLOW_APP_PASS}@${PG_ADDR}/${ENFLOW_DB}?schema=public"

step() { printf '\n\033[1;36m━━ %s\033[0m\n' "$*"; }

step "1/7 Rol + veritabanı provizyonu"
node "$ROOT/install/lib/pg.mjs" provision

cd "$BACKEND"

step "2/7 prisma generate + migrate deploy (migrator)"
DATABASE_URL="$MIGRATOR_URL" npx prisma generate
DATABASE_URL="$MIGRATOR_URL" npx prisma migrate deploy

step "3/7 Şema drift kontrolü (DB ↔ prisma/postgres/schema.prisma)"
set +e
DATABASE_URL="$MIGRATOR_URL" npx prisma migrate diff --from-config-datasource --to-schema prisma/postgres/schema.prisma --exit-code
DRIFT=$?
set -e
if [ "$DRIFT" -eq 2 ]; then
  echo "✗ DRIFT: migrations-postgres şemayla uyuşmuyor (yukarıdaki fark). Eksik migration → pnpm db:migrate" >&2
  exit 1
elif [ "$DRIFT" -ne 0 ]; then
  echo "✗ migrate diff hata verdi (exit $DRIFT)" >&2; exit 1
fi
echo "✓ drift yok"

step "4/7 Runtime rolü GRANT"
node "$ROOT/install/lib/pg.mjs" grant

step "5/7 Backend derleme + RLS uygula (migrator) + doğrula (runtime)"
pnpm build
DATABASE_URL="$MIGRATOR_URL" node dist/scripts/apply-postgres-rls.js
DATABASE_URL="$APP_URL" node dist/scripts/verify-postgres-rls.js

step "6/7 Backend'i runtime rolüyle başlat → /api/health"
LOG="$(mktemp)"
DATABASE_URL="$APP_URL" PORT="$HEALTH_PORT" NODE_ENV=production \
  AUTH_JWT_SECRET="$(openssl rand -hex 32)" \
  DATA_ENCRYPTION_MASTER_KEY="$(openssl rand -base64 32)" \
  node dist/index.js >"$LOG" 2>&1 &
PID=$!
HEALTH=""
for _ in $(seq 1 40); do
  if HEALTH="$(curl -sf "http://localhost:${HEALTH_PORT}/api/health")"; then break; fi
  if ! kill -0 "$PID" 2>/dev/null; then echo "✗ backend erken çıktı:" >&2; cat "$LOG" >&2; exit 1; fi
  sleep 0.5
done
if ! echo "$HEALTH" | grep -q '"db":"ok"'; then
  echo "✗ /api/health db:ok dönmedi: $HEALTH" >&2; cat "$LOG" >&2; kill -9 "$PID" 2>/dev/null || true; exit 1
fi
echo "✓ health: $HEALTH"

# Uygulama katmanı RLS yolu (prismaClient $extends → SET LOCAL app.tenant_id) —
# verify-postgres-rls DB'ye doğrudan bağlanır; bu blok gerçek HTTP isteğiyle dener.
API="http://localhost:${HEALTH_PORT}/api"
json() { node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const v=JSON.parse(d);console.log(process.argv[1].split(".").reduce((o,k)=>o?.[k],v)??"")})' "$1"; }
fail() { echo "✗ $*" >&2; cat "$LOG" >&2; kill -9 "$PID" 2>/dev/null || true; exit 1; }
SETUP='{"company":{"name":"CI A.Ş."},"admin":{"name":"CI Admin","email":"ci@example.com","password":"Ci-Passw0rd!"}}'
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/setup/init" -H 'content-type: application/json' -d "$SETUP")
[ "$CODE" = 200 ] || fail "setup/init $CODE"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/setup/init" -H 'content-type: application/json' -d "$SETUP")
[ "$CODE" = 403 ] || fail "ikinci setup/init 403 değil ($CODE) — kurulu sistem yeniden kurulabiliyor!"
TOKEN=$(curl -s -X POST "$API/auth/login" -H 'content-type: application/json' -d '{"email":"ci@example.com","password":"Ci-Passw0rd!"}' | json token)
[ -n "$TOKEN" ] || fail "login token yok"
AUTH=(-H "Authorization: Bearer $TOKEN" -H 'content-type: application/json')
CODE=$(curl -s -o /dev/null -w '%{http_code}' "${AUTH[@]}" -X POST "$API/customers" -d '{"name":"RLS Müşteri"}')
[ "$CODE" = 200 ] || [ "$CODE" = 201 ] || fail "customer create $CODE"
COUNT=$(curl -s "${AUTH[@]}" "$API/customers" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const v=JSON.parse(d);console.log(Array.isArray(v)?v.length:(v.data?.length??-1))})')
[ "$COUNT" = 1 ] || fail "customers listesi 1 değil ($COUNT) — uygulama RLS yolu hatalı"
echo "✓ uygulama RLS yolu: setup → 2. setup 403 → login → yaz/oku (1 müşteri)"

# backupService STATE yedeği ile AYNI pg_dump çağrısı — FORCE RLS altında varsayılan
# pg_dump "row-level security policy" hatası verir; bayraklar bunu çözmeli.
DUMP="$(mktemp -d)/state.dump"
PGOPTIONS="-c app.bypass_rls=on" pg_dump -Fc --enable-row-security -f "$DUMP" "${APP_URL%%\?*}" || fail "pg_dump (RLS altında) başarısız"
pg_restore -f - --data-only -t Customer "$DUMP" | grep -q "RLS Müşteri" || fail "pg_dump çıktısında tenant verisi yok (RLS dump'ı boşaltıyor)"
echo "✓ pg_dump RLS altında tam veri aldı"

step "7/7 SIGTERM → graceful shutdown (≤10 sn, exit 0)"
kill -TERM "$PID"
for _ in $(seq 1 24); do kill -0 "$PID" 2>/dev/null || break; sleep 0.5; done
if kill -0 "$PID" 2>/dev/null; then echo "✗ 12 sn içinde kapanmadı" >&2; kill -9 "$PID"; cat "$LOG" >&2; exit 1; fi
set +e; wait "$PID"; RC=$?; set -e
if [ "$RC" -ne 0 ]; then echo "✗ çıkış kodu $RC" >&2; cat "$LOG" >&2; exit 1; fi
grep -q "Kapanış tamamlandı" "$LOG" || { echo "✗ kapanış log'u yok" >&2; cat "$LOG" >&2; exit 1; }
echo "✓ temiz kapanış (exit 0)"

printf '\n\033[1;32m✓ Postgres uçtan uca doğrulama BAŞARILI\033[0m\n'
