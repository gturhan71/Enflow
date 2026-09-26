# Handoff
M1 tamam (branch feat/prod-runtime-pg-pipeline → PR). Kritik bulgu: PG+RLS'te login kırıktı, düzeltildi (a85101b) — Faz 15 artık gerçek PG'de doğrulanmış.
Sıradaki M2 (branch M1 üstünden): T9 db-migrate · T10 wizard migrate deploy · T11 migrateToPostgres · T12 upgrade restart/health/rollback · T13 upgrade PG yolu.
Yerel PG: scratchpad/pgdata, port 55432 (LC_ALL=en_US.UTF-8, socket /private/tmp/claude-501/pgs).
