# Enflow — 10x Durum
**Aktif iş:** `prod-runtime-pg-pipeline` (P0-1 + P0-2) · branch `feat/prod-runtime-pg-pipeline`
**Faz:** 3 — Planning Complete (2026-09-26) · sıradaki: T1 (M1)
**Spec:** `specs/2026-09-26-production-runtime-and-postgres-pipeline-design.md` (onaylı)
**Sürüm:** v2.5.0 (v2.6.0 önerildi, onay yok)

## Görevler
- [ ] M1: T1 build · T2 scheduler stop · T3 shutdown · T4 health · T5 pg şema sync · T6 config+baseline · T7 pg.mjs · T8 CI postgres job
- [ ] M2: T9 db-migrate · T10 wizard deploy · T11 migrateToPostgres · T12 upgrade restart/health/rollback · T13 upgrade PG yolu
- [ ] M3: T14 systemd/launchd · T15 WinSW · T16 wizard servis adımı · T17 docs · T18 release checklist · T19 RBAC+QA/Sec+sürüm
