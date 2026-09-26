# Enflow — 10x Durum
**Aktif iş:** `prod-runtime-pg-pipeline` (P0-1 + P0-2) · branch `feat/prod-runtime-pg-pipeline`
**Faz:** 6 — Delivery hazır · M1 (PR #4) + M2 (PR #5) + M3 tamam; PR'lar inceleme/CI bekliyor; **sürüm kararı (v2.6.0) kullanıcıda**
**Spec:** `specs/2026-09-26-production-runtime-and-postgres-pipeline-design.md` (onaylı)
**Sürüm:** v2.5.0 (v2.6.0 önerildi, onay yok)

## Görevler
- [x] M1 (+ plan dışı RLS fix a85101b): T1 build · T2 scheduler stop · T3 shutdown · T4 health · T5 pg şema sync · T6 config+baseline · T7 pg.mjs · T8 CI postgres job
- [x] M2 (+ plan dışı backup fix 49fef93): T9 db-migrate · T10 wizard deploy · T11 migrateToPostgres · T12 upgrade restart/health/rollback · T13 upgrade PG yolu
- [x] M3: T14 systemd/launchd · T15 WinSW · T16 wizard servis adımı · T17 docs · T18 release checklist · T19 RBAC+QA/Sec+sürüm


## P0-3 (2026-09-26) — feat/p0-3-session-csp
Oturum httpOnly çerezde + zorunlu CSP + saklı-XSS kaçışları + pdf worker paketten. ADR-003. RBAC 1027/1027, e2e 21/21, verify yeşil, gerçek tarayıcı doğrulandı. PR inceleme bekliyor.
