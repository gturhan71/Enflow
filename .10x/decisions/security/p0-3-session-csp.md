# Security — p0-3-session-csp (ADR-003)
**Tehdit modeli:** saldırgan = düşük yetkili tenant kullanıcısı (kayıt alanlarına HTML yazabilir) ya da üçüncü-taraf içerik; hedef = yöneticinin oturumu (hesap devralma, veri sızdırma).
**Bulgular (düzeltildi):**
- HIGH — JWT localStorage'da: herhangi bir XSS token'ı okuyup dışarı çıkarabilirdi → httpOnly çerez.
- HIGH — Saklı XSS yolu: 3 yazdırma penceresi (window.open('')+document.write, aynı-origin) kullanıcı verisini kaçışlamıyordu → escapeHtml (+guard).
- MEDIUM — CSP kapalı → zorunlu sıkı CSP (kanıt: enjekte inline script/onerror engellendi + sunucuya raporlandı).
- LOW — pdf.js worker üçüncü-taraf CDN'den (tedarik zinciri + internetsiz çalışmama) → paketten.
**Kalan/kabul:** sunucu-taraflı oturum iptali yok (çalınmış token 12 sa geçerli; çıkış çerezi siler); `style-src 'unsafe-inline'`; düz HTTP on-prem'de Secure çerez yok.
**Ayrı bulgu (kapsam dışı):** `/uploads` statik yolu kimliksiz servis ediliyor (CLAUDE.md "Static dosyalar"); dosya adları zaman damgalı ama yetkilendirme yok — ayrı iş.
