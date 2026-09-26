# SRE — prod-runtime-pg-pipeline
## Şimdi var
- `/api/health` (DB ping 2 sn, 200/503, uptime, sürüm) · servis otomatik yeniden başlatma (5 sn; WinSW 5/20/60 sn) · SIGTERM ≤10 sn temiz kapanış · zamanlanmış yedek + doğrulama · upgrade sağlık kapısı.
## Runbook (3 AM)
1. **Durum:** Linux `systemctl status enflow` / macOS `sudo launchctl print system/com.enflow.backend` / Windows `service\enflow-service.exe status`; `curl localhost:3002/api/health`.
2. **Loglar:** `journalctl -u enflow -e` · `logs/backend.log` · `logs\`. JSON satırlar (`level`,`msg`).
3. **health 503 (`db:down`):** Postgres servisi/ağ/`DATABASE_URL`; süreç ayakta olduğundan servis yöneticisi yeniden başlatmaz.
4. **Crash-loop:** log'da açılış hatası (env: `AUTH_JWT_SECRET`, `DATA_ENCRYPTION_MASTER_KEY` prod'da zorunlu); `backend/dist/` var mı → `cd backend && pnpm build`.
5. **Başarısız yükseltme:** upgrade-tool kodu geri alır; PG verisi için log'daki `pg_restore` komutunu (servis durmuşken) çalıştırın.
## Boşluklar (SLO YOK — bilinçli)
Metrik/alarm/trace yok (P1); SLO tanımlanmadı — önce ölçüm altyapısı. Zamanlayıcılar aynı süreçte. Windows graceful shutdown doğrulanmadı.
