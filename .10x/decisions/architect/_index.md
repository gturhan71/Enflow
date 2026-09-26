# Architect — indeks
## Genel [DISCOVERED]
- Modüler monolit: 43 router, 71 servis, 79 Prisma modeli, 45 FE modülü; tek süreç + `schedulerLock`'lu zamanlayıcılar.
- Merkez: `processEngine.ts` + ApprovalChain/Workflow. Tenant izolasyonu: uygulama katmanı + (doğrulanmamış) PG RLS.
- FE: `App.tsx` activeTab router, TanStack Query yalnız 2 dosyada.
## Aktif işler
- [prod-runtime-pg-pipeline](prod-runtime-pg-pipeline.md) — ADR-001, ADR-002
