import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // Local development:
  // Browser → Vite (5173) → Vercel API (3000)
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },

  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },

  assetsInclude: ['**/*.onnx'],
})