import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// The backend has no CORS configuration, so in development the browser talks only to Vite and Vite forwards
// /api/* to Spring Boot. Port 3000 matches the backend's default VNPay return URL (http://localhost:3000/payment/return).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.BACKEND_URL || 'http://localhost:8080';
  return {
    plugins: [react()],
    server: {
      port: 3000,
      strictPort: true,
      proxy: {
        '/api': { target, changeOrigin: true, rewrite: (path) => path.replace(/^\/api/, '') },
      },
    },
    preview: {
      port: 3000,
      proxy: {
        '/api': { target, changeOrigin: true, rewrite: (path) => path.replace(/^\/api/, '') },
      },
    },
  };
});
