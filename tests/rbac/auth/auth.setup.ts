// ============================================================================
// auth.setup.ts — Enflow'a özel
// Her rol için bir kez login olur (imzalı JWT — parola doğrulamalı).
// P0-3: tarayıcı oturumu httpOnly ÇEREZDE (localStorage'da token YOK). Login uygulamanın kendi
// origin'inden (vite /api proxy'si) yapılır → Set-Cookie tarayıcı bağlamına yerleşir ve
// storageState ile auth/<rol>.json'a (cookie + localStorage işaretleri) kaydedilir.
// API testleri için token yine gövdeden alınıp auth/<rol>.token'a yazılır (Bearer kullanılır).
// ============================================================================

import { test as setup, type Page } from "@playwright/test";
import { roles, crossTenantUser, ROLE_NAMES, baseURL, testPassword } from "../rbac.config";
import fs from "fs";
import path from "path";

const authDir = path.join(__dirname);

async function loginAndSave(
  email: string,
  tenantId: string,
  saveName: string,
  page: Page
) {
  // Aynı-origin login (credentials: same-origin) → oturum çerezi tarayıcı bağlamına yazılır.
  // X-Enflow-Client GÖNDERİLMEZ → gövdede token de döner (API testleri Bearer için kullanır).
  const loginRes = await page.evaluate(
    async ({ email, password }: { email: string; password: string }) => {
      const res = await fetch(`/api/auth/login`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error(`Login HTTP ${res.status}`);
      return res.json() as Promise<{ user: Record<string, unknown>; token: string }>;
    },
    { email, password: testPassword }
  );

  const token = loginRes.token;
  const user  = loginRes.user;
  const effectiveTenantId = (user.tenantId as string) ?? tenantId;

  // localStorage'a yalnız SIR OLMAYAN işaretler (token YOK — çerezde)
  await page.evaluate(
    ({ tenantId, user }: { tenantId: string; user: Record<string, unknown> }) => {
      localStorage.setItem("enflow_active_tenant_id", tenantId);
      localStorage.setItem(`enflow_current_user_${tenantId}`, JSON.stringify(user));
    },
    { tenantId: effectiveTenantId, user }
  );

  // Oturumu kaydet (cookie + localStorage)
  await page.context().storageState({ path: path.join(authDir, `${saveName}.json`) });

  // Token ve tenantId'yi ayrı dosyalara kaydet (API testleri okur)
  fs.writeFileSync(path.join(authDir, `${saveName}.token`),    token,             "utf-8");
  fs.writeFileSync(path.join(authDir, `${saveName}.tenantId`), effectiveTenantId, "utf-8");
}

// Her rol için setup testi
for (const role of ROLE_NAMES) {
  setup(`login: ${role}`, async ({ page }) => {
    await page.goto(baseURL);
    await loginAndSave(roles[role].email, roles[role].tenantId, role, page);
    console.log(`✔ ${role} (${roles[role].email}) → kaydedildi`);
  });
}

// Çapraz-tenant kullanıcısı (yalnız tenant-izolasyon testleri için — OPSİYONEL).
// Bazı dev ortamlarında ikinci tenant + bu kullanıcı seed edilmemiş olur; o durumda
// bu adım SETUP'ı (ve dolayısıyla ui-access/api-permissions'ı) BLOKLAMAZ — atlanır.
// tenant-isolation.spec.ts zaten token yoksa "mock-token" fallback'i kullanır.
setup("login: cross_tenant", async ({ page }) => {
  try {
    await page.goto(baseURL);
    await loginAndSave(crossTenantUser.email, crossTenantUser.tenantId, "cross_tenant", page);
    console.log(`✔ cross_tenant (${crossTenantUser.email}) → kaydedildi`);
  } catch (e) {
    console.warn(`⚠ cross_tenant (${crossTenantUser.email}) login başarısız — ikinci tenant bu ortamda seed edilmemiş olabilir. Tenant-izolasyon testleri mock-token ile çalışır. (${(e as Error).message})`);
    setup.skip();
  }
});
