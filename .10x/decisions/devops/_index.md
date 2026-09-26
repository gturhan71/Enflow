# DevOps — [DISCOVERED]
- CI: tek `verify` job (tsc×2, guard'lar, vitest, vite build). RBAC/E2E/Postgres matrisi yok.
- Prod başlatma: `ts-node src/index.ts` (derleme adımı yok), `start.sh` pkill+nohup; process manager/servis birimi yok.
- upgrade-tool (git tabanlı güncelleme, DB yedek/geri al) mevcut.
