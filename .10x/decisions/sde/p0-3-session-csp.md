# SDE — p0-3-session-csp
Backend: `services/session.ts`, `config/csp.ts`, `routes/cspReport.ts`, auth/setup/middleware, index.ts (helmet CSP, trust proxy). Frontend: `apiClient.authFetch/authHeaders`, App boot `/auth/session`, 12 dağınık fetch → authFetch, `lib/html.ts`, pdf worker `?url`. Test/guard: `check-no-client-token`, RBAC auth.setup+ui-access, e2e spec.
Sapmalar: `GET /auth/session` oturum yokken 200 `{user:null}` (401 konsolda gereksiz kırmızı hata). Dağıtım: `TRUST_PROXY`/`COOKIE_SECURE`/`CSP_*` env'leri (`backend/.env.example`, `install/README.md`).
Not: `git commit` pre-commit kancası CLAUDE.md/copilot-instructions'ın otomatik bölümünü yeniden üretir.
