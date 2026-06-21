// global-setup.ts — RBAC koşusundan ÖNCE swimlane/yönetici test kullanıcılarını seed eder.
// Bu roller (FINANCE_MGR, IGPD_MGR, KSU_MGR, PROJECT_MGR, LEGAL_MGR, PROCUREMENT_MGR, ISAB_MGR)
// üretimde agent/boş-koltuk olduğundan DB'de gerçek kullanıcıları yok; login (şifresiz, email ile)
// için var olmaları gerekir. Email'ler 'rbac-test-*' → global-teardown cleanup otomatik siler.

import { roles, SEED_ROLES, apiBaseURL } from "./rbac.config";

async function gmToken(): Promise<{ token: string; tenantId: string }> {
  const res = await fetch(`${apiBaseURL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: roles.general_manager.email }),
  });
  if (!res.ok) throw new Error(`[global-setup] GM login HTTP ${res.status}`);
  const data = (await res.json()) as { token: string; user: { tenantId: string } };
  return { token: data.token, tenantId: data.user.tenantId ?? "tenant-1" };
}

export default async function globalSetup() {
  const { token, tenantId } = await gmToken();
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "x-tenant-id": tenantId,
  };

  // Defansif: önceki koşudan kalan rbac-test kullanıcılarını temizle (duplicate login engeli)
  await fetch(`${apiBaseURL}/api/admin/security-test/cleanup`, { method: "DELETE", headers }).catch(() => {});

  let seeded = 0;
  for (const [key, def] of Object.entries(SEED_ROLES)) {
    const email = roles[key as keyof typeof roles].email;
    const res = await fetch(`${apiBaseURL}/api/users`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: `RBAC ${def.dbRole}`,
        email,
        role: def.dbRole,
        permissions: def.permissions,
      }),
    });
    if (res.ok) seeded++;
    else console.warn(`[global-setup] ${def.dbRole} seed HTTP ${res.status}`);
  }
  console.log(`[global-setup] ✔ ${seeded}/${Object.keys(SEED_ROLES).length} swimlane test kullanıcısı seed edildi.`);
}
