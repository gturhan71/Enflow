// ============================================================================
// auth.setup.ts — Enflow'a özel
// Her rol için bir kez login olur. Backend mock-JWT tabanlı (şifresiz).
// localStorage ayarlanarak oturum auth/<rol>.json + auth/<rol>.token olarak kaydedilir.
// ============================================================================

import { test as setup, type Page } from "@playwright/test";
import { roles, crossTenantUser, ROLE_NAMES, baseURL, apiBaseURL } from "../rbac.config";
import fs from "fs";
import path from "path";

const authDir = path.join(__dirname);

async function loginAndSave(
  email: string,
  tenantId: string,
  saveName: string,
  page: Page
) {
  // Backend'den token al (Enflow auth şifresiz mock-JWT)
  const loginRes = await page.evaluate(
    async ({ email, apiUrl }: { email: string; apiUrl: string }) => {
      const res = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error(`Login HTTP ${res.status}`);
      return res.json() as Promise<{ user: Record<string, unknown>; token: string }>;
    },
    { email, apiUrl: apiBaseURL }
  );

  const token = loginRes.token;
  const user  = loginRes.user;
  const effectiveTenantId = (user.tenantId as string) ?? tenantId;

  // localStorage'a Enflow'un beklediği key'leri yaz
  await page.evaluate(
    ({ token, tenantId, user }: { token: string; tenantId: string; user: Record<string, unknown> }) => {
      localStorage.setItem("enflow_auth_token", token);
      localStorage.setItem("enflow_active_tenant_id", tenantId);
      localStorage.setItem(`enflow_current_user_${tenantId}`, JSON.stringify(user));
    },
    { token, tenantId: effectiveTenantId, user }
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

// Çapraz-tenant kullanıcısı (izolasyon testleri için)
setup("login: cross_tenant", async ({ page }) => {
  await page.goto(baseURL);
  await loginAndSave(crossTenantUser.email, crossTenantUser.tenantId, "cross_tenant", page);
  console.log(`✔ cross_tenant (${crossTenantUser.email}) → kaydedildi`);
});
