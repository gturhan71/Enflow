# CTO — prod-runtime-pg-pipeline (2026-09-26)
**Karar:** Yap (build). Yeni özellik değil, satılabilirlik ön koşulu: Postgres kurulumu bugün yükseltilemiyor, prod ts-node ile koşuyor.
**Build vs buy:** Servis yönetimi için OS-native (systemd/launchd) + WinSW (MIT, olgun, tek exe) — pm2 reddedildi (Windows autostart zayıf, ek global bağımlılık). Migration için Prisma 7'nin kendi `migrate diff`/`migrations.path` yetenekleri — ek araç yok.
**Strateji:** SQLite küçük on-prem, Postgres SaaS/büyük kurulum; ikisi de birinci sınıf, CI ikisini de doğrular.
**Fırsat maliyeti:** ~8–10 geliştirici-günü; P0-3 (CSP/JWT) ve P0-4 (RBAC CI) bunun arkasında bekler.
**Sürüm:** v2.6.0 önerisi (Faz 15 RLS ile birlikte) — artırım ayrıca açık onayla.
