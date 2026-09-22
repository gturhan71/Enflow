import { defineConfig } from 'vitest/config';

// Bu paket tests/rbac'a paraleldir ama Playwright degil Vitest kullanir — UI yok,
// saf API+DB dogrulamasi. Her senaryo dosyasi kendi izole backend+DB'sini
// helpers/backendProcess.ts uzerinden ayaga kaldirip test sonunda kapatir; bu yuzden
// dosyalar arasi paylasilan process/state riskini onlemek icin sirayla (tek worker)
// calistirilir.
export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
