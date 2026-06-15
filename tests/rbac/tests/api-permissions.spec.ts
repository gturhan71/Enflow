// ============================================================================
// api-permissions.spec.ts — API Yetki Matrisi
//
// Her (rol × endpoint) kombinasyonunu doğrudan backend'e test eder.
// "deny" satırları en kritik olanlar: UI gizli olsa bile endpoint
// çağrılabiliyorsa güvenlik açığı var demektir.
//
// Beklenti tespiti:
//   allow → 401/403 OLMAMALI (2xx veya 404 geçer — "yetki var ama kayıt yok")
//   deny  → 401 veya 403 OLMALI
// ============================================================================

import { test, expect, request, APIRequestContext } from "@playwright/test";
import { apiMatrix, ROLE_NAMES, apiBaseURL, RoleName } from "../rbac.config";
import fs from "fs";
import path from "path";

const authDir = path.join(__dirname, "..", "auth");

function readFile(p: string): string {
  return fs.existsSync(p) ? fs.readFileSync(p, "utf-8").trim() : "";
}

async function contextForRole(role: RoleName): Promise<APIRequestContext> {
  const token    = readFile(path.join(authDir, `${role}.token`))    || "mock-token";
  const tenantId = readFile(path.join(authDir, `${role}.tenantId`)) || "";

  return request.newContext({
    baseURL: apiBaseURL,
    extraHTTPHeaders: {
      "Authorization": `Bearer ${token}`,
      "x-tenant-id":   tenantId,
      "Content-Type":  "application/json",
    },
  });
}

for (const role of ROLE_NAMES) {
  test.describe(`API yetkileri — ${role}`, () => {
    let api: APIRequestContext;

    test.beforeAll(async () => { api = await contextForRole(role); });
    test.afterAll(async ()  => { await api.dispose(); });

    for (const c of apiMatrix) {
      const expected = c.expect[role];

      test(`[${expected.toUpperCase()}] ${c.method} ${c.path} — ${c.name}`, async () => {
        const res = await api.fetch(c.path, {
          method: c.method,
          data:   c.body ? JSON.stringify(c.body) : undefined,
        });

        const status = res.status();

        if (expected === "allow") {
          // Yetki engeli olmamalı; 2xx, 404 veya 422 geçerli
          expect(
            [401, 403],
            `⚠ YETKİ HATASI: ${role} için "${c.name}" ÇALIŞMALIydı ama ${status} döndü`
          ).not.toContain(status);
        } else {
          // Erişim engellenmeli; 401 veya 403 beklenir
          // 200 dönerse → RBAC AÇIĞI
          expect(
            [401, 403],
            `🔴 RBAC AÇIĞI: ${role} "${c.name}" engellenmeliydi ama ${status} döndü`
          ).toContain(status);
        }
      });
    }
  });
}
