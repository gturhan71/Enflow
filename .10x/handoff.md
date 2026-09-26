# Handoff — İŞ TAMAM (inceleme bekliyor)
3 yığılı PR: #4 (M1) ← #5 (M2) ← M3. Sırayla merge (her merge sonrası bir üstünün base'i main'e döner).
Kullanıcı kararı bekleyenler: (1) sürüm v2.6.0 (Faz 15 RLS + bu iş) — CLAUDE.md kuralı gereği açık onay olmadan artırılmadı; (2) CI `postgres` job'unun GH'daki ilk koşusu; (3) Windows/systemd/LaunchDaemon manuel testi (docs/RELEASE_CHECKLIST.md).
Takip işleri: tests/rbac artefakt untrack (spawn edildi); P0-3 CSP+JWT saklama; P0-4 RBAC'ı CI'a alma; PG için migrateToPostgres iki-rol uyarlaması.
