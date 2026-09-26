# Architect — [DISCOVERED]
- Modüler monolit: 43 router, 71 servis, 79 Prisma modeli, 45 FE modülü. Tek process; 3+ zamanlayıcı aynı process'te (`schedulerLock` ile).
- Merkez: `processEngine.ts` (1038 satır) + ApprovalChain/Workflow — tüm birimler-arası devirler buradan.
- Tenant izolasyonu: uygulama katmanı (tenantId filtresi + `check:tenant-scope` guard) + Postgres RLS (kod var, DOĞRULANMADI).
- Frontend: `App.tsx` activeTab router (URL routing yok), TanStack Query yalnız 2 dosyada; modüllerin çoğu useEffect+fetch.
