import "dotenv/config";
import { defineConfig } from "@prisma/config";
import { resolvePrismaPaths } from "./src/config/prismaPaths";

// Sağlayıcıya göre şema + migration klasörü (ADR-002) — izlenen hiçbir dosya
// kurulumda değiştirilmez; `generate`/`migrate deploy` her ortamda aynı komut.
const paths = resolvePrismaPaths(process.env.DATABASE_URL);

export default defineConfig({
  schema: paths.schema,
  migrations: { path: paths.migrationsPath },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
