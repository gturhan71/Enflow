// ============================================================================
// ui-access.spec.ts — Sidebar Görünürlük Testi
//
// Enflow bir SPA — URL tabanlı erişim kısıtlaması yoktur.
// Bu test login yaptıktan sonra sidebar'da hangi menü öğelerinin
// görünür / gizli olduğunu kontrol eder.
// ============================================================================

import { test, expect } from "@playwright/test";
import { uiMatrix, ROLE_NAMES, baseURL, roles } from "../rbac.config";
import path from "path";
import fs from "fs";

const authDir = path.join(__dirname, "..", "auth");

for (const role of ROLE_NAMES) {
  test.describe(`UI erişimi — ${role}`, () => {
    test.use({ storageState: path.join(authDir, `${role}.json`) });

    // Oturum httpOnly çerezde (JS göremez) → sunucudan doğrula; localStorage'da token OLMAMALI (P0-3)
    test("oturum doğrulama", async ({ page }) => {
      await page.goto(baseURL);

      const sess = await page.request.get(`${baseURL}/api/auth/session`);
      expect((await sess.json()).user, `${role} oturum çerezi yok/geçersiz — auth setup başarısız olmuş olabilir`).not.toBeNull();

      const leaked = await page.evaluate(() => localStorage.getItem("enflow_auth_token"));
      expect(leaked, "oturum token'ı localStorage'da OLMAMALI (XSS ile okunabilir)").toBeNull();
    });

    for (const c of uiMatrix) {
      const expected = c.expect[role];

      test(`${c.name} → ${expected}`, async ({ page }) => {
        await page.goto(baseURL);

        // Sidebar'ın yüklenmesini bekle (en az bir menü öğesi görünür olmalı)
        await page.waitForTimeout(1500);

        // Alt-öğe (subItem) menüleri yalnız üst grup GENİŞLETİLDİĞİNDE DOM'a gelir
        // (Sidebar.tsx: `{isExpanded && <AnimatePresence>…}`). Yalnızca ilgili üst
        // grubu aç — tüm grupları açmak sweep'i kararsızlaştırıyordu. Şu an tek
        // subItem satırı "Fiziksel Arşiv" (üst grup: "Şirket Evrakları").
        const SUBITEM_PARENT: Record<string, string> = {
          "Fiziksel Arşiv": "Şirket Evrakları",
          // "Test Ortamı" ayrı bir sidebar bloğuydu, 2026-08-19'da kaldırılıp
          // "Güvenlik Testi"/"Denetim İzi"/"Sanal Agentlar" normal "Ayarlar"
          // alt-öğelerine taşındı (bkz. src/constants.ts NAV_ITEMS yorumu) —
          // dolayısıyla artık "Ayarlar" genişletilmeden DOM'a gelmiyor.
          "Güvenlik Testi": "Ayarlar",
        };
        const parentLabel = SUBITEM_PARENT[c.sidebarText];
        if (parentLabel) {
          const grp = page.getByTestId("sidebar").getByRole("button").filter({ hasText: parentLabel }).first();
          if (await grp.count()) {
            await grp.click({ timeout: 1500 }).catch(() => {});
            await page.waitForTimeout(400); // AnimatePresence açılış animasyonu
          }
        }

        // Aramayı sidebar'a (Sidebar.tsx kök `data-testid="sidebar"`) daralt —
        // sayfa genelinde arama, kısa/ortak alt-string'lerin Dashboard
        // içeriğiyle yanlışlıkla eşleşmesine yol açabilir (ör. "Finans" →
        // "Finansman / Nakit Akış" widget başlığı). Test Ortamı bölümü
        // (Güvenlik Testi/Sanal Agentlar/Denetim İzi) <nav>'ın DIŞINDA ama
        // aynı sidebar kökünün içinde olduğu için testid gerekti.
        const element = page.getByTestId("sidebar").getByText(c.sidebarText, { exact: false }).first();
        const isVisible = await element.isVisible().catch(() => false);

        if (expected === "visible") {
          expect(
            isVisible,
            `⚠ UI HATASI: ${role} için "${c.sidebarText}" görünür olmalıydı ama gizli`
          ).toBeTruthy();
        } else {
          expect(
            isVisible,
            `⚠ UI AÇIĞI: ${role} için "${c.sidebarText}" gizli olmalıydı ama görünür`
          ).toBeFalsy();
        }
      });
    }

    // Giriş yapılmamış durumda login sayfası göster
    test("oturum yokken login sayfasına yönlendirme", async ({ page }) => {
      // Önce sayfayı yükle, sonra localStorage + oturum ÇEREZİNİ temizleyerek oturum durumunu sıfırla
      await page.goto(baseURL);
      await page.evaluate(() => localStorage.clear());
      await page.context().clearCookies();
      await page.reload();

      // SPA'nın Login render etmesini bekle
      const emailInput = page.locator('input[type="email"]');
      const loginBtn   = page.getByRole("button", { name: /giriş yap/i });

      await Promise.race([
        emailInput.waitFor({ state: "visible", timeout: 6000 }).catch(() => {}),
        loginBtn.waitFor({ state: "visible", timeout: 6000 }).catch(() => {}),
      ]);

      const emailVisible = await emailInput.isVisible().catch(() => false);
      const btnVisible   = await loginBtn.isVisible().catch(() => false);

      expect(
        emailVisible || btnVisible,
        "Oturum yokken login formu gösterilmeli"
      ).toBeTruthy();
    });
  });
}
