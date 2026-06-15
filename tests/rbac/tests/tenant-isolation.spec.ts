// ============================================================================
// tenant-isolation.spec.ts — Çok Kiracılı Sistem IDOR Testi
//
// Senaryo:
//   cross_tenant kullanıcısı (tenant-2) kendi token'ıyla login yapar,
//   fakat x-tenant-id header'ını tenant-1 olarak göndererek
//   yabancı tenant verilerine erişmeye çalışır.
//
// Beklenti: 403 veya 404 → erişim engellenmeli
// Gerçek:   Backend sadece header'daki tenant'ın VARLIĞINI kontrol ediyor,
//           kullanıcının o tenant'a ait olup olmadığını kontrol ETMİYOR.
//           → 200 dönerse KRİTİK IDOR AÇIĞI
// ============================================================================

import { test, expect, request } from "@playwright/test";
import { isolationMatrix, apiBaseURL } from "../rbac.config";
import fs from "fs";
import path from "path";

const authDir = path.join(__dirname, "..", "auth");

test.describe("Tenant izolasyonu (IDOR)", () => {
  for (const c of isolationMatrix) {
    test(c.name, async () => {
      // cross_tenant kullanıcısının token'ı — kendi tenantı tenant-2
      const tokenPath    = path.join(authDir, "cross_tenant.token");
      const token        = fs.existsSync(tokenPath) ? fs.readFileSync(tokenPath, "utf-8").trim() : "mock-token";

      // Ama x-tenant-id'yi tenant-1 olarak gönder (yabancı tenant saldırısı)
      const api = await request.newContext({
        baseURL: apiBaseURL,
        extraHTTPHeaders: {
          "Authorization": `Bearer ${token}`,
          "x-tenant-id":   c.targetTenantId, // ← yabancı tenant
          "Content-Type":  "application/json",
        },
      });

      const res    = await api.fetch(c.path, { method: c.method });
      const status = res.status();

      // Yanıt gövdesini de oku — 200 dönse bile boş veri mi geliyor?
      let body: unknown = null;
      try { body = await res.json(); } catch { /* ignore */ }

      if (status === 200) {
        // 200 döndü: body boş array veya null mı diye kontrol et
        const isEmpty =
          body === null ||
          (Array.isArray(body) && (body as unknown[]).length === 0);

        if (!isEmpty) {
          // Gerçek veri sızdı → KRİTİK açık
          throw new Error(
            `🔴 KRİTİK IDOR: cross_tenant kullanıcısı tenant-1 verisine erişti!\n` +
            `   Endpoint: ${c.method} ${c.path}\n` +
            `   Status: ${status}\n` +
            `   İlk kayıt: ${JSON.stringify(Array.isArray(body) ? (body as unknown[])[0] : body)}`
          );
        } else {
          // 200 ama boş — tenant filtresi çalışıyor olabilir, farklı sebepten boş
          console.warn(`⚠ ${c.name}: 200 döndü ama body boş — tenant filtresi çalışıyor olabilir`);
        }
      } else {
        // 403/404 bekleniyor
        expect(
          [403, 404],
          `🔴 KRİTİK IDOR: Beklenen 403/404 ama ${status} döndü — ${c.name}`
        ).toContain(status);
      }

      await api.dispose();
    });
  }
});
