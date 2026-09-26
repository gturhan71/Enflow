# ADR-003: Oturum httpOnly çerezde + sıkı CSP + saklı-XSS kaçışları

**Status:** Accepted · **Date:** 2026-09-26 · **Feature:** p0-3-session-csp · **Author:** 10x-Team (Security + Architect)

## Context
JWT tarayıcıda `localStorage`'daydı ve CSP kapalıydı (`helmet({contentSecurityPolicy:false})`). Bulunan herhangi bir XSS,
token'ı okuyup dışarı çıkarabilirdi (hesap devralma). Üstelik XSS için somut bir yol vardı: `window.open('') +
document.write` ile açılan yazdırma pencereleri (proje raporu, PO, yönetim raporları) uygulamayla AYNI origin'de çalışır ve
kullanıcı verisini (proje/müşteri/tedarikçi adı vb.) kaçışlamadan HTML'e koyuyordu (saklı XSS). Token 12 sa ömürlü ve iptal edilemezdi;
kodda 12 dağınık `localStorage` okuması ve `'mock-token'` yedeği vardı.

## Decision
1. **Oturum httpOnly çerezinde** (`enflow_session`: HttpOnly, SameSite=Lax, Secure yalnız HTTPS/`COOKIE_SECURE`, Max-Age=JWT exp).
   Frontend token'ı HİÇ tutmaz; "girişli miyim" = `GET /api/auth/session`. **Bearer HÂLÂ desteklenir** (API istemcileri,
   RBAC/e2e testleri) ve önceliklidir; Bearer istekleri CSRF'e tabi değildir.
2. **CSRF** (yalnız çerezle gelen durum-değiştiren istekler): `X-Enflow-CSRF` başlığı zorunlu + Origin aynı-host ya da `CORS_ORIGINS` listesinde +
   `Sec-Fetch-Site: cross-site` reddi. Web istemcisi `X-Enflow-Client: web` gönderir → giriş yanıtında token gövdede DÖNMEZ.
3. **CSP zorunlu** (`config/csp.ts`): `script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `report-uri /api/csp-report`
   (kimliksiz, hız sınırlı, yalnız log). `CSP_MODE=enforce|report-only|off` acil kaçış. `style-src 'unsafe-inline'` kabul (React/recharts
   `style=""` öznitelikleri nonce alamaz; betik yürütmeyi etkilemez).
4. **pdf.js worker paketten** (Vite `?url`): CDN bağımlılığı kalktı (CSP `'self'` ile uyumlu; internetsiz on-prem'de PDF çıkarımı çalışır).
5. **Saklı XSS kaçışlama** (`lib/html.ts escapeHtml`) + `check-no-client-token` guard'ı (`pnpm verify`): localStorage token, mock-token, Bearer başlığı
   üretimi, kaçışlamasız `document.write` regresyonu engellenir.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| Yalnız sıkı CSP (token localStorage'da kalır) | Küçük değişiklik | CSP'yi atlatan/CSP kapsamı dışı bir XSS token'ı yine çalar; savunma tek katman | Kullanıcı önerimizi seçti; defense-in-depth |
| Kısa ömürlü access token (bellekte) + refresh çerezi | İptal/rotasyon kolay | Refresh oturum tablosu + rotasyon + çoklu sekme karmaşıklığı; büyük şema/akış değişikliği | Bu iş için fazla; ileride sunucu-taraflı iptal için yeniden ele alınır |
| CSP `report-only` ile başla | Sıfır kırılma riski | Kimse raporu izlemiyor → enforce'a hiç geçilmez | Tam tarayıcı doğrulamasıyla doğrudan enforce; `report-only` acil kaçış olarak kalır |

## Consequences
**Pozitif:** XSS artık oturum çerezini OKUYAMAZ (istek atabilir ama hesabı devralamaz); CSP yürütmeyi engeller (kanıt: enjekte inline `<script>`/`onerror` engellendi);
token sızıntı yüzeyi (localStorage, `Bearer` üretimi) kapandı; internetsiz PDF çalışır.
**Negatif:** düz HTTP on-prem'de çerez `Secure` olmaz (HTTPS önerilir); ters proxy `Host`u korumazsa `CORS_ORIGINS` ayarı gerekir; yükseltmede herkes bir kez yeniden giriş yapar;
`unsafe-inline` stil; token hâlâ 12 sa geçerli ve **sunucu-taraflı iptal yok** (çıkış çerezi siler ama çalınmış token kullanılabilir — ayrı iş).
**Riskler:** `Origin` denetimi ters proxy yapılandırmasında yanlış-pozitif verebilir (log + dokümantasyon); Windows/proxy yapılandırmaları CI'da yok.

## Dependencies
ADR-001/002 (servis + CI). Gelecek: sunucu-taraflı oturum iptali (token sürümü), `/uploads` statik yolunun kimlik doğrulaması (ayrı bulgu).
