import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    build: {
      target: 'es2015',
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          // Vite 8 / Rolldown: manualChunks fonksiyonu yerine codeSplitting.groups
          // (regex `test` tabanlı; eski adı advancedChunks — Rolldown 1.x'te deprecated,
          // aynı şekil). İlk eşleşen grup kazanır — spesifik vendor'lar genel `vendor`
          // (node_modules) catch-all'ından ÖNCE. minSize:0 → küçük shared modüller de
          // inline edilmeyip kendi adlı chunk'ına gider.
          codeSplitting: {
            minSize: 0,
            groups: [
              { name: 'vendor-lucide',  test: /lucide-react/ },
              { name: 'vendor-charts',  test: /victory-vendor|recharts|[/]d3[/-]?/ },
              { name: 'vendor-query',   test: /@tanstack/ },
              { name: 'vendor-motion',  test: /node_modules[/](motion|framer)/ },
              { name: 'vendor-pdfjs',   test: /pdfjs-dist/ },
              { name: 'vendor-pdf',     test: /jspdf|canvg/ },
              { name: 'vendor-mammoth', test: /mammoth|jszip|bluebird/ },
              { name: 'vendor-xlsx',    test: /[/]xlsx/ },
              { name: 'vendor-ai',      test: /@google[/]genai|google-auth-library|protobufjs|@anthropic/ },
              { name: 'vendor-redux',   test: /@reduxjs|react-redux|[/]redux|immer|reselect/ },
              { name: 'vendor-misc',    test: /html2canvas|dompurify|date-fns|sonner/ },
              { name: 'vendor-react',   test: /react-dom|[/]react[/]|scheduler|react-is/ },
              { name: 'vendor',         test: /node_modules/ },
              // En büyük 2 modül (CRM 2030 satır, ContractWorkflow 1677 satır) tek başına
              // 600kB üstü chunk uyarısına neden oluyordu — statik olarak ayrı chunk'a
              // alındı (dinamik import/lazy-loading DEĞİL — Faz 5'in god-component ayrıştırma
              // kapsamı ayrı; bu yalnız build-çıktısı kategorilendirmesi, runtime davranışı aynı).
              { name: 'modules-crm',    test: /[/]src[/]modules[/]CRMModule/ },
              { name: 'modules-contract', test: /[/]src[/]modules[/]ContractWorkflowModule/ },
              { name: 'modules-project', test: /[/]src[/]modules[/]ProjectManagementModule/ },
              { name: 'modules-reports', test: /[/]src[/]modules[/]ManagementReportingModule/ },
              { name: 'modules-procurement', test: /[/]src[/]modules[/]ProcurementModule/ },
              { name: 'modules',        test: /[/]src[/]modules[/]/ },
              { name: 'components',     test: /[/]src[/]components[/]/ },
            ],
          },
        },
      },
    },
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      host: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: 'http://localhost:3002',
          changeOrigin: true,
          secure: false,
        },
        // Yüklenen dosyalar (fırsat şartname evrakları vb.) backend'den servis
        // edilir; prod'da aynı origin, dev'de proxy şart — SpecComplianceMatrix
        // fırsat evrakını doğrudan fetch edip metnini çıkarır.
        '/uploads': {
          target: 'http://localhost:3002',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
