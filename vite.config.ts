import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv, splitVendorChunkPlugin } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), splitVendorChunkPlugin()],
    // NOTE: GEMINI_API_KEY is server-only — never expose it in the client bundle.
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (/react(-dom)?\/|scheduler\//.test(id)) return 'react-vendor';
            if (id.includes('framer-motion')) return 'framer';
            if (id.includes('pdf-lib') || id.includes('pdfjs-dist')) return 'pdf-vendor';
            if (id.includes('lucide-react')) return 'icons';
            return undefined;
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: Number(env.PORT) || 3015,
      strictPort: false,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
