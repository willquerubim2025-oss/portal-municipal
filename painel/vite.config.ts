import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Painel administrativo (SPA com login obrigatório; não precisa de SEO).
export default defineConfig({
  plugins: [react()],
  server: { port: 5190, strictPort: true },
  preview: { port: 4190, strictPort: true },
});
