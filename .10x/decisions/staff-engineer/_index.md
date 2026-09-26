# Staff Engineer — [DISCOVERED]
- Güçlü: strict TS (1 `any`), logger, logActivity deseni, guard script'leri (no-mock/tenant-scope/no-console), CLAUDE.md çok detaylı.
- Zayıf: FE veri erişimi tutarsız (React Query vs manuel fetch), büyük dosyalar (WorkflowBuilder 984, opportunities route 948, ProposalEditor 931).
- Kök dizinde 10 log dosyası; `backend_log.txt`/`frontend_log.txt` git'te izleniyor (.gitignore yalnız *.log).
- `App.tsx:195` `'mock-token'` fallback'i kaldırılmalı.
