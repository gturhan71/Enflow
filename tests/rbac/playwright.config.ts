import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import path from "path";

// .env dosyasını process.env'e yükle (rbac.config import'undan önce)
loadEnv({ path: path.resolve(__dirname, ".env") });

import { baseURL } from "./rbac.config";

export default defineConfig({
  testDir: "./",
  timeout: 30_000,
  fullyParallel: false, // Sıralı — auth setup önce bitmeli
  retries: 0,
  globalTeardown: "./global-teardown.ts",
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["json", { outputFile: "test-results/results.json" }],
    ["./security-reporter.ts"],
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    // 1) Her rol için bir kez login → auth/<rol>.json + auth/<rol>.token kaydedilir
    { name: "setup", testMatch: /auth\/auth\.setup\.ts/ },

    // 2) Asıl testler kayıtlı token'larla çalışır
    {
      name: "rbac",
      testMatch: /tests\/.*\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
