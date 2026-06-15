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
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              // Specific checks BEFORE generic 'react' match
              if (id.includes('lucide-react'))   return 'vendor-lucide';
              if (id.includes('victory-vendor') || id.includes('recharts') || id.includes('/d3') || id.includes('/d3-')) return 'vendor-charts';
              if (id.includes('@tanstack'))       return 'vendor-query';
              if (id.includes('motion') || id.includes('framer')) return 'vendor-motion';
              if (id.includes('pdfjs-dist'))      return 'vendor-pdfjs';
              if (id.includes('jspdf') || id.includes('canvg')) return 'vendor-pdf';
              if (id.includes('mammoth') || id.includes('jszip') || id.includes('bluebird')) return 'vendor-mammoth';
              if (id.includes('/xlsx'))           return 'vendor-xlsx';
              if (id.includes('@google/genai') || id.includes('google-auth-library') || id.includes('protobufjs') || id.includes('@anthropic')) return 'vendor-ai';
              if (id.includes('@reduxjs') || id.includes('react-redux') || id.includes('/redux') || id.includes('immer') || id.includes('reselect')) return 'vendor-redux';
              if (id.includes('html2canvas') || id.includes('dompurify') || id.includes('date-fns') || id.includes('sonner')) return 'vendor-misc';
              if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler') || id.includes('react-is')) return 'vendor-react';
              return 'vendor';
            }
            if (id.includes('/src/modules/')) return 'modules';
            if (id.includes('/src/components/')) return 'components';
          },
        },
      },
    },
    esbuild: {
      target: 'es2015'
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
      },
    },
  };
});
