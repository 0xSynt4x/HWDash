import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Tauri 推荐:固定开发端口
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
});
