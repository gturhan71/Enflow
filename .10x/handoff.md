# Handoff → EM / Senior Engineer
ADR-001 (runtime/servis/shutdown) + ADR-002 (çift migration hattı) kabul. Bileşen tablosu: decisions/architect/prod-runtime-pg-pipeline.md.
Prisma 7: drift kontrolü `--from-config-datasource` (shadow DB yok). Planlama: ≤yarım günlük görevler, M1 = CI'da PG+RLS yeşil.
