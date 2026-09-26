# ADR-001: Derlenmiş çalışma zamanı + OS-native servis + graceful shutdown

**Status:** Accepted · **Date:** 2026-09-26 · **Feature:** prod-runtime-pg-pipeline · **Author:** 10x-Team (Architect + Staff Engineer)

## Context
Backend üretimde `ts-node src/index.ts` ile, süreç yöneticisi olmadan (`start.sh`: pkill + nohup) çalışıyor. Çökme/yeniden başlatma sonrası otomatik kalkış yok; SIGTERM'de temiz kapanma yok (`app.listen` dönüşü tutulmuyor, 4 scheduler `setInterval` handle'ı döndürmüyor, `reports.ts` SSE uzun bağlantı tutuyor). Hedef OS: Windows, Ubuntu, macOS.

## Decision
1. `tsc -p tsconfig.build.json` → `backend/dist/` (rootDir=src korunur, `__dirname` yolları aynı derinlikte kalır). `governance/` import eden 3 bakım script'i build dışı (dev aracı).
2. `start` = `node dist/index.js`.
3. `src/lifecycle.ts`: `installShutdown({ server, stops, disconnect, timeoutMs=10000 })` — SIGTERM/SIGINT → `server.close()` + `server.closeAllConnections()` → scheduler stop'ları → `prisma.$disconnect()` → exit(0); süre aşımı exit(1). Scheduler'lar `stop()` döndürür.
4. `/api/health` DB ping (2 sn timeout) → 200/503.
5. Servis tanımları `install/service/`: systemd, launchd, WinSW (sabit sürüm + SHA256). Wizard opt-in kurar. upgrade-tool varsayılan restart komutunu kurulu servise göre seçer, sonra health yoklar, başarısızsa kodu geri alır.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| pm2 | Tek araç, log rotation hazır | Windows autostart bakımsız paket; global bağımlılık | Windows hedefi zayıf kalır |
| Yalnız systemd (Linux) | En basit | Resmi Windows/macOS desteği geri çekilir | Kullanıcı reddetti |
| ts-node + `--transpile-only` prod | Değişiklik az | Dev bağımlılığı prod'da, yavaş açılış, tip hatası runtime'a kaçar | Kalite hedefiyle çelişir |
| Docker imajı | Taşınabilir | Mevcut bare-metal wizard modeliyle çelişir, Windows'ta ağır | Kapsam dışı (YAGNI) |

## Consequences
**Pozitif:** Reboot/çökme sonrası otomatik kalkış; hızlı açılış; prod'da dev bağımlılığı yok; upgrade güvenli restart + doğrulama.
**Negatif:** Üç servis şablonu bakımı; WinSW binary tedarik zinciri (SHA256 ile sınırlandı); build adımı upgrade süresini uzatır.
**Riskler:** Windows/macOS şablonları CI'da test edilmiyor → release checklist'te manuel VM testi. SSE istemcileri kapanışta kopar (yeniden bağlanırlar — kabul edilebilir).

## Dependencies
ADR-002 CI job'u `dist/` ve health'e bağlı. Gelecekte çoklu replika istenirse scheduler'ların `schedulerLock` ile zaten çok-süreç güvenli olması korunmalı.
