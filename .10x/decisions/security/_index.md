# Security — [DISCOVERED]
- İyi: JWT (12h), helmet, rate-limit, CORS allowlist, alan-bazlı AES-GCM (tenant DEK), Ed25519 lisans, SSRF guard, IDOR guard script'i.
- Risk: JWT localStorage'da + CSP kapalı (`contentSecurityPolicy:false`) → XSS = oturum çalma. Refresh/revocation yok.
- Risk: RLS doğrulanmamış; tenant izolasyonu tek katmanda.
- Risk: RBAC süiti CI'da yok (çapraz-tenant fixture eksik).
